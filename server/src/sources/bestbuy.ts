import * as cheerio from 'cheerio';
import type { Condition } from '@compshopper/shared';
import { fetchJson, fetchText } from '../http.js';
import type { RawListing } from '../normalize.js';
import { parsePrice } from '../text.js';
import { clean, enc, type SourceAdapter, type SourceContext } from './types.js';

export const SITE = 'bestbuy.com';

interface BestBuyProduct {
  sku: number;
  name: string;
  manufacturer?: string;
  modelNumber?: string;
  salePrice: number;
  regularPrice?: number;
  onSale?: boolean;
  dollarSavings?: number;
  percentSavings?: number;
  url: string;
  freeShipping?: boolean;
  shippingCost?: number;
  condition?: string;
  color?: string;
  onlineAvailability?: boolean;
  inStoreAvailability?: boolean;
  image?: string;
  type?: string;
  priceUpdateDate?: string;
  offers?: { text?: string; type?: string }[];
}

function mapCondition(c?: string): Condition {
  const t = (c ?? '').toLowerCase();
  if (t.includes('refurb')) return 'refurbished';
  if (t.includes('open')) return 'open-box';
  if (t.includes('pre-owned') || t.includes('used')) return 'used';
  return 'new';
}

export function mapBestBuyProducts(products: BestBuyProduct[]): RawListing[] {
  const out: RawListing[] = [];
  for (const p of products) {
    if (!p.salePrice || p.salePrice <= 0 || !p.url) continue;
    const offers = (p.offers ?? []).map((o) => o.text ?? '').filter(Boolean);
    const notes: string[] = [];
    if (p.type === 'Bundle') notes.push('Bundle');
    if (p.onlineAvailability === false && p.inStoreAvailability) notes.push('In-store only');
    if (p.onlineAvailability === false && !p.inStoreAvailability) notes.push('Backorder / out of stock');
    out.push({
      externalId: String(p.sku),
      title: p.name,
      url: p.url,
      price: p.salePrice,
      wasPrice: p.regularPrice && p.regularPrice > p.salePrice ? p.regularPrice : null,
      shippingCost: p.freeShipping ? 0 : typeof p.shippingCost === 'number' ? p.shippingCost : null,
      seller: 'Best Buy',
      sellerSite: SITE,
      condition: mapCondition(p.condition),
      manufacturer: p.manufacturer ?? null,
      modelNumber: p.modelNumber ?? null,
      extraText: offers,
      notes,
      imageUrl: p.image ?? null,
    });
  }
  return out;
}

/** Parse a bestbuy.com search page (best effort; the site is heavily bot-protected). */
export function parseBestBuySearch(html: string): RawListing[] {
  const $ = cheerio.load(html);
  const out: RawListing[] = [];
  $('li.sku-item, .sku-item').each((_, el) => {
    const item = $(el);
    const titleEl = item.find('.sku-title a, h4.sku-title a, a.product-list-item-link').first();
    const title = clean(titleEl.text());
    const href = titleEl.attr('href') ?? '';
    if (!title || !href) return;
    const sku = item.attr('data-sku-id') || clean(item.find('.sku-model .sku-value').last().text()) || href;
    const model = clean(item.find('.sku-model .sku-value').first().text()) || null;
    const priceText = clean(item.find('.priceView-hero-price span[aria-hidden="true"], .priceView-customer-price span, [data-testid="customer-price"] span').first().text());
    const price = parsePrice(priceText);
    if (price === null || price <= 0) return;
    const wasText = clean(item.find('.pricing-price__regular-price, [data-testid="regular-price"]').first().text());
    const wasPrice = parsePrice(wasText.replace(/^was/i, ''));
    const savings = clean(item.find('.pricing-price__savings, [data-testid="savings"]').first().text());
    const openBox = clean(item.find('.open-box-option, [class*="open-box"]').first().text());
    const url = href.startsWith('http') ? href : `https://www.bestbuy.com${href}`;
    out.push({
      externalId: sku,
      title,
      url,
      price,
      wasPrice: wasPrice && wasPrice > price ? wasPrice : null,
      shippingCost: null,
      seller: 'Best Buy',
      sellerSite: SITE,
      modelNumber: model,
      extraText: [savings, openBox],
      defaultCondition: 'new',
    });
  });
  return out;
}

export const bestbuy: SourceAdapter = {
  id: 'bestbuy',
  label: 'Best Buy',
  site: SITE,
  availability: () => {
    if (process.env.COMPSHOPPER_DISABLE_BESTBUY === '1') return { enabled: false, reason: 'Disabled by configuration' };
    return { enabled: true, reason: process.env.BESTBUY_API_KEY ? undefined : 'No BESTBUY_API_KEY set; falling back to HTML scraping, which Best Buy often blocks' };
  },
  async search(ctx: SourceContext) {
    const apiKey = process.env.BESTBUY_API_KEY;
    if (apiKey) {
      const terms = ctx.searchText.split(/\s+/).filter(Boolean).map((t) => `search=${enc(t)}`);
      const show = [
        'sku', 'name', 'manufacturer', 'modelNumber', 'salePrice', 'regularPrice', 'onSale', 'dollarSavings',
        'percentSavings', 'url', 'freeShipping', 'shippingCost', 'condition', 'color', 'onlineAvailability',
        'inStoreAvailability', 'image', 'type', 'priceUpdateDate', 'offers',
      ].join(',');
      const url = `https://api.bestbuy.com/v1/products((${terms.join('&')})&active=true)?apiKey=${enc(apiKey)}&format=json&show=${show}&pageSize=50&sort=salePrice.asc`;
      const json = await fetchJson<{ products?: BestBuyProduct[] }>(url, { signal: ctx.signal });
      return mapBestBuyProducts(json.products ?? []);
    }
    const url = `https://www.bestbuy.com/site/searchpage.jsp?st=${enc(ctx.searchText)}&intl=nosplash&sp=-currentprice%20skuidsaas`;
    const { body } = await fetchText(url, { signal: ctx.signal });
    return parseBestBuySearch(body);
  },
};
