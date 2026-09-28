import * as cheerio from 'cheerio';
import { SourceBlockedError, fetchText } from '../http.js';
import type { RawListing } from '../normalize.js';
import { parsePrice } from '../text.js';
import { clean, enc, type SourceAdapter, type SourceContext } from './types.js';

export const SITE = 'walmart.com';

interface WalmartItem {
  __typename?: string;
  id?: string;
  usItemId?: string;
  name?: string;
  canonicalUrl?: string;
  brand?: string;
  sellerName?: string;
  sellerId?: string;
  isSponsoredFlag?: boolean;
  availabilityStatusDisplayValue?: string;
  imageInfo?: { thumbnailUrl?: string };
  priceInfo?: {
    linePrice?: string;
    currentPrice?: string;
    wasPrice?: string;
    shipPrice?: string;
    priceRangeString?: string;
    unitPrice?: string;
  };
  badges?: {
    flags?: { text?: string }[];
    tags?: { text?: string }[];
    labels?: { text?: string }[];
  };
  fulfillmentBadges?: string[];
  fulfillmentBadgeGroups?: { text?: string }[];
}

function collectItems(node: unknown, out: WalmartItem[], depth = 0): void {
  if (!node || depth > 12) return;
  if (Array.isArray(node)) {
    for (const n of node) collectItems(n, out, depth + 1);
    return;
  }
  if (typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    if (obj.__typename === 'Product' && typeof obj.name === 'string' && obj.priceInfo) {
      out.push(obj as WalmartItem);
      return;
    }
    if (Array.isArray(obj.itemStacks)) {
      for (const stack of obj.itemStacks as { items?: unknown[] }[]) collectItems(stack.items ?? [], out, depth + 1);
      return;
    }
    for (const v of Object.values(obj)) collectItems(v, out, depth + 1);
  }
}

/** Parse a walmart.com search page: product data lives in the __NEXT_DATA__ JSON blob. */
export function parseWalmartSearch(html: string): RawListing[] {
  const $ = cheerio.load(html);
  const json = $('script#__NEXT_DATA__').first().html();
  if (!json) {
    if (/robot or human|blocked|captcha/i.test(html)) throw new SourceBlockedError('Walmart served a bot challenge');
    return [];
  }
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return [];
  }
  const items: WalmartItem[] = [];
  collectItems(data, items);

  const out: RawListing[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const title = clean(it.name);
    const id = it.usItemId || it.id;
    if (!title || !id || seen.has(id)) continue;
    const pi = it.priceInfo ?? {};
    const price = parsePrice(pi.linePrice ?? pi.currentPrice ?? pi.priceRangeString ?? '');
    if (price === null || price <= 0) continue;
    seen.add(id);
    const was = parsePrice(pi.wasPrice ?? '');
    let shipping: number | null = null;
    const shipText = clean(pi.shipPrice ?? '');
    const badgeTexts = [
      ...(it.badges?.flags ?? []).map((b) => b.text ?? ''),
      ...(it.badges?.tags ?? []).map((b) => b.text ?? ''),
      ...(it.badges?.labels ?? []).map((b) => b.text ?? ''),
      ...(it.fulfillmentBadges ?? []),
      ...(it.fulfillmentBadgeGroups ?? []).map((b) => b.text ?? ''),
    ].filter(Boolean);
    if (/free shipping|free delivery/i.test([shipText, ...badgeTexts].join(' '))) shipping = 0;
    else if (/\$/.test(shipText)) shipping = parsePrice(shipText);
    const seller = clean(it.sellerName) || 'Walmart';
    const marketplace = seller.toLowerCase() !== 'walmart' && seller.toLowerCase() !== 'walmart.com';
    const path = it.canonicalUrl ?? `/ip/${id}`;
    const notes: string[] = [];
    if (it.availabilityStatusDisplayValue && !/in stock/i.test(it.availabilityStatusDisplayValue)) notes.push(`Availability: ${it.availabilityStatusDisplayValue}`);
    out.push({
      externalId: String(id),
      title,
      url: path.startsWith('http') ? path : `https://www.walmart.com${path.split('?')[0]}`,
      price,
      wasPrice: was && was > price ? was : null,
      shippingCost: shipping,
      seller: marketplace ? `Walmart Marketplace – ${seller}` : 'Walmart',
      sellerSite: SITE,
      manufacturer: it.brand ?? null,
      extraText: [...badgeTexts, it.isSponsoredFlag ? 'sponsored' : '', pi.unitPrice ?? ''],
      notes,
      marketplace,
      imageUrl: it.imageInfo?.thumbnailUrl ?? null,
      defaultCondition: 'new',
    });
  }
  return out;
}

export const walmart: SourceAdapter = {
  id: 'walmart',
  label: 'Walmart',
  site: SITE,
  availability: () => ({ enabled: process.env.COMPSHOPPER_DISABLE_WALMART !== '1' }),
  async search(ctx: SourceContext) {
    const url = `https://www.walmart.com/search?q=${enc(ctx.searchText)}&sort=price_low`;
    const { body } = await fetchText(url, { signal: ctx.signal });
    return parseWalmartSearch(body);
  },
};
