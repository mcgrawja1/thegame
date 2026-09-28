import * as cheerio from 'cheerio';
import { fetchText } from '../http.js';
import type { RawListing } from '../normalize.js';
import { parsePrice } from '../text.js';
import { clean, enc, type SourceAdapter, type SourceContext } from './types.js';

export const SITE = 'microcenter.com';

/** Parse a microcenter.com search results page. Prices are store specific. */
export function parseMicroCenterSearch(html: string, storeLabel?: string): RawListing[] {
  const $ = cheerio.load(html);
  const out: RawListing[] = [];
  $('li.product_wrapper, .product_wrapper').each((_, el) => {
    const item = $(el);
    const link = item.find('a.productClickItemV2, .h2 a, a[data-name]').first();
    const title = clean(link.attr('data-name') || link.text());
    const href = link.attr('href') ?? '';
    if (!title || !href) return;

    const dataPrice = Number(link.attr('data-price'));
    const priceText = clean(item.find('span[itemprop="price"], .price_wrapper .price, .price').first().text());
    const price = Number.isFinite(dataPrice) && dataPrice > 0 ? dataPrice : parsePrice(priceText);
    if (price === null || price <= 0) return;

    const infoText = clean(item.find('.sku, .detail_wrapper, .product_info').text());
    const mfr = infoText.match(/mfr\.?\s*part\s*#?:?\s*([A-Za-z0-9][A-Za-z0-9\-/.]*)/i);
    const sku = link.attr('data-id') || (infoText.match(/sku:?\s*(\d+)/i)?.[1] ?? href);
    const stock = clean(item.find('.stock, .inventoryCnt, .instock, .inStock, .notInStock').first().text());
    const savings = clean(item.find('.price_savings, .savings, .instant_savings, .price_wrapper .save').first().text());
    const wasText = clean(item.find('.price_original, .strike, .original_price, s').first().text());
    const wasPrice = parsePrice(wasText);
    const notes = ['In-store pickup pricing' + (storeLabel ? ` (${storeLabel})` : '') + '; may vary by store'];
    if (stock && /not in stock|sold out|out of stock/i.test(stock)) notes.push('Backorder / out of stock');
    const openBox = /open box/i.test(title) || /open box/i.test(infoText);

    out.push({
      externalId: String(sku),
      title,
      url: href.startsWith('http') ? href : `https://www.microcenter.com${href}`,
      price,
      wasPrice: wasPrice && wasPrice > price ? wasPrice : null,
      shippingCost: null,
      seller: 'Micro Center',
      sellerSite: SITE,
      manufacturer: link.attr('data-brand') || null,
      modelNumber: mfr ? mfr[1] : null,
      condition: openBox ? 'open-box' : undefined,
      extraText: [savings, stock],
      notes,
      imageUrl: item.find('img').first().attr('src') ?? null,
      defaultCondition: 'new',
    });
  });
  return out;
}

export const microcenter: SourceAdapter = {
  id: 'microcenter',
  label: 'Micro Center',
  site: SITE,
  availability: () => ({ enabled: process.env.COMPSHOPPER_DISABLE_MICROCENTER !== '1' }),
  async search(ctx: SourceContext) {
    const storeId = process.env.MICROCENTER_STORE_ID || '029';
    const url = `https://www.microcenter.com/search/search_results.aspx?Ntt=${enc(ctx.searchText)}&storeid=${enc(storeId)}&myStore=true&sortby=pricelow`;
    const { body } = await fetchText(url, { signal: ctx.signal, headers: { Cookie: `storeSelected=${storeId}` } });
    return parseMicroCenterSearch(body, `store ${storeId}`);
  },
};
