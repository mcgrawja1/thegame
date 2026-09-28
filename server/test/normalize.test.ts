import { describe, expect, it } from 'vitest';
import { detectCondition, extractColor, extractModelNumber, extractPricingNotes, normalizeListing } from '../src/normalize.js';
import { inferManufacturer, canonicalBrand } from '../src/brands.js';
import { extractCapacitiesGb, parseCapacityGb, parsePrice } from '../src/text.js';

describe('text helpers', () => {
  it('parses prices with thousands separators and prefixes', () => {
    expect(parsePrice('$1,199.99')).toBe(1199.99);
    expect(parsePrice('Now $799')).toBe(799);
    expect(parsePrice('$299.00 to $349.00')).toBe(299);
    expect(parsePrice('')).toBeNull();
  });
  it('normalises capacities to gigabytes', () => {
    expect(parseCapacityGb('128GB')).toBe(128);
    expect(parseCapacityGb('1 TB')).toBe(1024);
    expect(parseCapacityGb('512 gb')).toBe(512);
    expect(extractCapacitiesGb('Laptop 16GB RAM 1TB SSD')).toEqual([16, 1024]);
  });
});

describe('model number extraction', () => {
  it('prefers explicit model labels', () => {
    expect(extractModelNumber('Apple iPhone 15 Pro 128GB Model: A2848 Unlocked')).toBe('A2848');
    expect(extractModelNumber('Something Mfr Part #: 100-100001084WOF')).toBe('100-100001084WOF');
  });
  it('finds part-number looking tokens and ignores capacities', () => {
    expect(extractModelNumber('Samsung Galaxy S24 Ultra SM-S928U 256GB Titanium Black')).toBe('SM-S928U');
    expect(extractModelNumber('Samsung 990 PRO 2TB NVMe M.2 SSD MZ-V9P2T0B/AM')).toBe('MZ-V9P2T0B/AM');
    expect(extractModelNumber('Corsair Vengeance 32GB (2x16GB) DDR5 6000 CMK32GX5M2B6000C36')).toBe('CMK32GX5M2B6000C36');
    expect(extractModelNumber('Apple Watch Series 10 46mm GPS MWWD3LL/A')).toBe('MWWD3LL/A');
  });
  it('returns null when nothing looks like a model number', () => {
    expect(extractModelNumber('Apple iPhone 16 128GB Black Unlocked')).toBeNull();
    expect(extractModelNumber('Sony 65 inch 4K TV 120Hz')).toBeNull();
  });
});

describe('manufacturer inference', () => {
  it('uses brand names and product-family hints', () => {
    expect(inferManufacturer('iPhone 16 Pro Max 256GB')).toBe('Apple');
    expect(inferManufacturer('Galaxy S25 Ultra 512GB')).toBe('Samsung');
    expect(inferManufacturer('ASUS TUF Gaming GeForce RTX 5070 Ti')).toBe('ASUS');
    expect(inferManufacturer('NVIDIA GeForce RTX 5090 Founders Edition')).toBe('NVIDIA');
    expect(inferManufacturer('WD_BLACK SN850X 2TB')).toBe('Western Digital');
    expect(inferManufacturer('Generic USB cable')).toBeNull();
  });
  it('canonicalises aliases', () => {
    expect(canonicalBrand('wd')).toBe('Western Digital');
    expect(canonicalBrand('apple')).toBe('Apple');
    expect(canonicalBrand('unknownco')).toBeNull();
  });
});

describe('condition and notes', () => {
  it('detects conditions from text', () => {
    expect(detectCondition('Certified - Refurbished')).toBe('refurbished');
    expect(detectCondition('Open Box: Great')).toBe('open-box');
    expect(detectCondition('Pre-Owned')).toBe('used');
    expect(detectCondition('Brand New')).toBe('new');
    expect(detectCondition('', 'new')).toBe('new');
  });
  it('extracts pricing context notes', () => {
    const notes = extractPricingNotes(['iPhone 16 Pro with activation today', 'Trade-in and save', 'Bundle with case', '$33.29/mo']);
    expect(notes).toContain('Activation / carrier plan required');
    expect(notes).toContain('Trade-in offer');
    expect(notes).toContain('Bundle');
    expect(notes).toContain('Financing offer');
    expect(extractPricingNotes(['plain listing'])).toEqual([]);
  });
  it('extracts colors', () => {
    expect(extractColor('iPhone 15 Pro Blue Titanium')).toBe('Blue Titanium');
    expect(extractColor('MacBook Air Space Gray')).toBe('Space Gray');
  });
});

describe('normalizeListing', () => {
  it('builds a complete listing with derived fields and notes', () => {
    const l = normalizeListing(
      {
        externalId: 'x1',
        title: 'Refurbished: Apple iPhone 15 Pro 256GB Blue Titanium Unlocked A2848 - Bundle with Case',
        url: 'https://example.com/x1',
        price: 1029,
        wasPrice: 1199,
        shippingCost: 9.99,
        seller: 'Newegg Marketplace',
        sellerSite: 'newegg.com',
        marketplace: true,
        defaultCondition: 'new',
      },
      'newegg',
      '2026-01-01T00:00:00.000Z',
    );
    expect(l.id).toBe('newegg:x1');
    expect(l.manufacturer).toBe('Apple');
    expect(l.modelNumber).toBe('A2848');
    expect(l.condition).toBe('refurbished');
    expect(l.attributes.capacity).toBe('256GB');
    expect(l.attributes.color).toBe('Blue Titanium');
    expect(l.attributes.carrier).toBe('Unlocked');
    expect(l.device).toBe('Apple iPhone 15 Pro 256GB Blue Titanium Unlocked A2848');
    expect(l.pricingNotes).toEqual(expect.arrayContaining(['Bundle', 'Refurbished', 'Third-party marketplace seller', 'Was $1,199.00 (save 14%)', '+ $9.99 shipping']));
  });
});
