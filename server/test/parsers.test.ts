import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseNeweggSearch } from '../src/sources/newegg.js';
import { parseEbaySearch, mapEbayApiItems } from '../src/sources/ebay.js';
import { parseWalmartSearch } from '../src/sources/walmart.js';
import { parseMicroCenterSearch } from '../src/sources/microcenter.js';
import { mapBestBuyProducts, parseBestBuySearch } from '../src/sources/bestbuy.js';
import { SourceBlockedError, looksBlocked } from '../src/http.js';
import { normalizeListing } from '../src/normalize.js';

const fx = (name: string) => readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

describe('Newegg parser', () => {
  const items = parseNeweggSearch(fx('newegg.html'));
  it('parses price, was price, shipping, brand and promo', () => {
    expect(items).toHaveLength(2);
    const cpu = items[0];
    expect(cpu.price).toBe(429.99);
    expect(cpu.wasPrice).toBe(479);
    expect(cpu.shippingCost).toBe(0);
    expect(cpu.manufacturer).toBe('AMD');
    expect(cpu.externalId).toBe('N82E16819113877');
    const n = normalizeListing(cpu, 'newegg', new Date().toISOString());
    expect(n.modelNumber).toBe('100-100001084WOF');
    expect(n.pricingNotes).toContain('Free gift included');
    expect(n.pricingNotes).toContain('Free shipping');
  });
  it('detects marketplace sellers and paid shipping', () => {
    const phone = items[1];
    expect(phone.price).toBe(1029);
    expect(phone.shippingCost).toBe(9.99);
    expect(phone.marketplace).toBe(true);
    const n = normalizeListing(phone, 'newegg', new Date().toISOString());
    expect(n.condition).toBe('refurbished');
    expect(n.pricingNotes).toContain('Bundle');
  });
});

describe('eBay parser', () => {
  const items = parseEbaySearch(fx('ebay.html'));
  it('skips the placeholder and parses real items', () => {
    expect(items).toHaveLength(2);
    const s24 = items[0];
    expect(s24.externalId).toBe('394812345678');
    expect(s24.url).toBe('https://www.ebay.com/itm/394812345678');
    expect(s24.price).toBe(689.95);
    expect(s24.wasPrice).toBe(799.99);
    expect(s24.shippingCost).toBe(0);
    expect(s24.condition).toBe('used');
    expect(s24.seller).toBe('eBay – phoneflip_usa');
    const n = normalizeListing(s24, 'ebay', new Date().toISOString());
    expect(n.modelNumber).toBe('SM-S928U');
    expect(n.pricingNotes).toContain('Best offer accepted');
  });
  it('handles price ranges, "New Listing" prefixes and paid shipping', () => {
    const watch = items[1];
    expect(watch.title.startsWith('Apple Watch')).toBe(true);
    expect(watch.price).toBe(299);
    expect(watch.shippingCost).toBe(12.55);
    expect(watch.condition).toBe('new');
  });
  it('maps Browse API items', () => {
    const mapped = mapEbayApiItems([
      { itemId: 'v1|123|0', title: 'Pixel 9 128GB', price: { value: '399.00', currency: 'USD' }, itemWebUrl: 'https://www.ebay.com/itm/123', condition: 'Certified - Refurbished', seller: { username: 'shop' }, shippingOptions: [{ shippingCost: { value: '0.00' } }], buyingOptions: ['FIXED_PRICE'] },
      { itemId: 'v1|124|0', title: 'GBP item', price: { value: '10', currency: 'GBP' }, itemWebUrl: 'x' },
    ]);
    expect(mapped).toHaveLength(1);
    expect(mapped[0].externalId).toBe('123');
    expect(mapped[0].condition).toBe('refurbished');
    expect(mapped[0].shippingCost).toBe(0);
  });
});

describe('Walmart parser', () => {
  it('reads products out of __NEXT_DATA__', () => {
    const items = parseWalmartSearch(fx('walmart.html'));
    expect(items).toHaveLength(2);
    const first = items[0];
    expect(first.price).toBe(799);
    expect(first.wasPrice).toBe(829);
    expect(first.shippingCost).toBe(0);
    expect(first.seller).toBe('Walmart');
    expect(first.url).toBe('https://www.walmart.com/ip/Apple-iPhone-16-128GB-Black/5044789001');
    const n = normalizeListing(first, 'walmart', new Date().toISOString());
    expect(n.pricingNotes).toContain('Sale / clearance');
    const second = items[1];
    expect(second.marketplace).toBe(true);
    expect(second.shippingCost).toBe(5.99);
    const n2 = normalizeListing(second, 'walmart', new Date().toISOString());
    expect(n2.condition).toBe('refurbished');
    expect(n2.pricingNotes).toContain('Availability: Out of stock');
  });
  it('raises a blocked error on the bot challenge page', () => {
    expect(() => parseWalmartSearch(fx('walmart-blocked.html'))).toThrow(SourceBlockedError);
    expect(looksBlocked(fx('walmart-blocked.html'))).toBe(true);
  });
});

describe('Micro Center parser', () => {
  const items = parseMicroCenterSearch(fx('microcenter.html'), 'store 029');
  it('uses data attributes, part numbers and stock info', () => {
    expect(items).toHaveLength(2);
    expect(items[0].price).toBe(449.99);
    expect(items[0].modelNumber).toBe('100-100001084WOF');
    expect(items[0].manufacturer).toBe('AMD');
    expect(items[0].url).toBe('https://www.microcenter.com/product/687012/amd-ryzen-7-9800x3d');
    expect(items[0].notes?.[0]).toMatch(/store 029/);
  });
  it('falls back to the displayed price and flags open box / sold out', () => {
    expect(items[1].price).toBe(279.99);
    expect(items[1].condition).toBe('open-box');
    expect(items[1].notes).toContain('Backorder / out of stock');
  });
});

describe('Best Buy', () => {
  it('maps API products', () => {
    const json = JSON.parse(fx('bestbuy-api.json'));
    const items = mapBestBuyProducts(json.products);
    expect(items).toHaveLength(2);
    expect(items[0].modelNumber).toBe('MYMT3LL/A');
    expect(items[0].shippingCost).toBe(0);
    const n = normalizeListing(items[0], 'bestbuy', new Date().toISOString());
    expect(n.pricingNotes).toContain('Activation / carrier plan required');
    expect(items[1].condition).toBe('refurbished');
    expect(items[1].wasPrice).toBe(949.99);
  });
  it('parses the HTML search page', () => {
    const items = parseBestBuySearch(fx('bestbuy.html'));
    expect(items).toHaveLength(1);
    expect(items[0].price).toBe(899.99);
    expect(items[0].wasPrice).toBe(999.99);
    expect(items[0].modelNumber).toBe('MTQP3LL/A');
    expect(items[0].externalId).toBe('6525406');
  });
});
