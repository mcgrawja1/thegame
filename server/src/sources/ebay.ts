import * as cheerio from 'cheerio';
import type { Condition } from '@compshopper/shared';
import { fetchJson, fetchText } from '../http.js';
import type { RawListing } from '../normalize.js';
import { parsePrice } from '../text.js';
import { clean, enc, type SourceAdapter, type SourceContext } from './types.js';

export const SITE = 'ebay.com';

function mapCondition(text: string): Condition | null {
  const t = text.toLowerCase();
  if (!t) return null;
  if (/refurbished|renewed/.test(t)) return 'refurbished';
  if (/open box/.test(t)) return 'open-box';
  if (/pre-owned|used|for parts|not working|good|acceptable|excellent|very good/.test(t)) return 'used';
  if (/new/.test(t)) return 'new';
  return null;
}

/** Parse an eBay search results page (https://www.ebay.com/sch/i.html?_nkw=...). */
export function parseEbaySearch(html: string): RawListing[] {
  const $ = cheerio.load(html);
  const out: RawListing[] = [];
  $('li.s-item, li.s-card, div.s-item, .srp-results .s-card').each((_, el) => {
    const item = $(el);
    const titleEl = item.find('.s-item__title, .s-card__title').first();
    let title = clean(titleEl.text());
    title = title.replace(/^(new listing|sponsored)\s*/i, '');
    if (!title || /^shop on ebay$/i.test(title)) return;

    const linkEl = item.find('a.s-item__link, a.s-card__link, a[href*="/itm/"]').first();
    const href = linkEl.attr('href') ?? '';
    if (!href) return;
    const idMatch = href.match(/\/itm\/(?:[^/]+\/)?(\d{9,15})/) || href.match(/[?&]item=(\d+)/);
    const externalId = idMatch ? idMatch[1] : href;
    const url = idMatch ? `https://www.ebay.com/itm/${externalId}` : href.split('?')[0];

    const priceText = clean(item.find('.s-item__price, .s-card__price').first().text());
    const price = parsePrice(priceText);
    if (price === null || price <= 0) return;

    const conditionText = clean(item.find('.s-item__subtitle .SECONDARY_INFO, .s-item__subtitle, .s-card__subtitle, .s-item__condition').first().text());
    const shipText = clean(item.find('.s-item__shipping, .s-item__logisticsCost, .s-card__shipping, [class*="logisticsCost"], [class*="shipping"]').first().text());
    let shippingCost: number | null = null;
    if (/free/i.test(shipText)) shippingCost = 0;
    else if (/\$/.test(shipText)) shippingCost = parsePrice(shipText);

    const wasText = clean(item.find('.s-item__additional-price .STRIKETHROUGH, .s-item__additional-price, .s-card__strikethrough, .STRIKETHROUGH').first().text());
    const wasPrice = parsePrice(wasText);
    const sellerText = clean(item.find('.s-item__seller-info-text, .s-card__seller-info, [class*="seller-info"]').first().text());
    const sellerName = sellerText.split(/\s*\(/)[0] || '';
    const purchase = clean(item.find('.s-item__purchase-options, .s-item__purchaseOptionsWithIcon, .s-item__dynamic, [class*="purchase-options"]').text());
    const discount = clean(item.find('.s-item__discount, .s-card__discount').first().text());
    const image = item.find('.s-item__image-img, img').first().attr('src') ?? null;
    const isAuction = /bids?\b/i.test(clean(item.find('.s-item__bids, .s-item__bidCount, [class*="bid"]').text()));

    out.push({
      externalId,
      title,
      url,
      price,
      wasPrice: wasPrice && wasPrice > price ? wasPrice : null,
      shippingCost,
      seller: sellerName ? `eBay – ${sellerName}` : 'eBay seller',
      sellerSite: SITE,
      condition: mapCondition(conditionText),
      conditionText,
      extraText: [purchase, discount, sellerText, isAuction ? 'auction' : ''],
      marketplace: true,
      imageUrl: image,
      defaultCondition: 'unknown',
    });
  });
  return out;
}

interface EbayItemSummary {
  itemId: string;
  title: string;
  price?: { value: string; currency: string };
  itemWebUrl: string;
  condition?: string;
  seller?: { username?: string; feedbackPercentage?: string };
  shippingOptions?: { shippingCost?: { value: string } }[];
  marketingPrice?: { originalPrice?: { value: string }; discountPercentage?: string };
  buyingOptions?: string[];
  image?: { imageUrl?: string };
  itemGroupType?: string;
  epid?: string;
}

let tokenCache: { token: string; expires: number } | null = null;

async function ebayToken(signal: AbortSignal): Promise<string> {
  if (tokenCache && tokenCache.expires > Date.now()) return tokenCache.token;
  const id = process.env.EBAY_CLIENT_ID!;
  const secret = process.env.EBAY_CLIENT_SECRET!;
  const basic = Buffer.from(`${id}:${secret}`).toString('base64');
  const { body } = await fetchText('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: 'grant_type=client_credentials&scope=' + encodeURIComponent('https://api.ebay.com/oauth/api_scope'),
  });
  const json = JSON.parse(body) as { access_token: string; expires_in: number };
  tokenCache = { token: json.access_token, expires: Date.now() + (json.expires_in - 60) * 1000 };
  return json.access_token;
}

export function mapEbayApiItems(items: EbayItemSummary[]): RawListing[] {
  const out: RawListing[] = [];
  for (const it of items) {
    const price = it.price ? Number(it.price.value) : NaN;
    if (!Number.isFinite(price) || price <= 0) continue;
    if (it.price?.currency && it.price.currency !== 'USD') continue;
    const ship = it.shippingOptions?.[0]?.shippingCost?.value;
    const was = it.marketingPrice?.originalPrice?.value;
    out.push({
      externalId: it.itemId.replace(/^v1\|/, '').replace(/\|.*$/, ''),
      title: it.title,
      url: it.itemWebUrl,
      price,
      wasPrice: was ? Number(was) : null,
      shippingCost: ship !== undefined ? Number(ship) : null,
      seller: it.seller?.username ? `eBay – ${it.seller.username}` : 'eBay seller',
      sellerSite: SITE,
      condition: mapCondition(it.condition ?? ''),
      conditionText: it.condition ?? '',
      extraText: [
        (it.buyingOptions ?? []).includes('AUCTION') ? 'auction' : '',
        (it.buyingOptions ?? []).includes('BEST_OFFER') ? 'or best offer' : '',
        it.marketingPrice?.discountPercentage ? `save ${it.marketingPrice.discountPercentage}%` : '',
      ],
      marketplace: true,
      imageUrl: it.image?.imageUrl ?? null,
    });
  }
  return out;
}

function apiConfigured(): boolean {
  return Boolean(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET);
}

export const ebay: SourceAdapter = {
  id: 'ebay',
  label: 'eBay',
  site: SITE,
  availability: () => ({ enabled: process.env.COMPSHOPPER_DISABLE_EBAY !== '1' }),
  async search(ctx: SourceContext) {
    if (apiConfigured()) {
      const token = await ebayToken(ctx.signal);
      const filters = ['buyingOptions:{FIXED_PRICE|BEST_OFFER}', 'priceCurrency:USD', 'itemLocationCountry:US'];
      const url =
        `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${enc(ctx.searchText)}` +
        `&limit=50&sort=price&filter=${enc(filters.join(','))}`;
      const json = await fetchJson<{ itemSummaries?: EbayItemSummary[] }>(url, {
        signal: ctx.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
          'Content-Type': 'application/json',
        },
      });
      return mapEbayApiItems(json.itemSummaries ?? []);
    }
    const url = `https://www.ebay.com/sch/i.html?_nkw=${enc(ctx.searchText)}&LH_BIN=1&LH_PrefLoc=1&_sop=15&_ipg=60`;
    const { body } = await fetchText(url, { signal: ctx.signal });
    return parseEbaySearch(body);
  },
};
