import * as cheerio from 'cheerio';
import { fetchText } from '../http.js';
import type { RawListing } from '../normalize.js';
import { parsePrice } from '../text.js';
import { clean, enc, type SourceAdapter, type SourceContext } from './types.js';

export const SITE = 'newegg.com';

/** Parse a Newegg search results page (https://www.newegg.com/p/pl?d=...). */
export function parseNeweggSearch(html: string): RawListing[] {
  const $ = cheerio.load(html);
  const out: RawListing[] = [];
  const cells = $('.item-cell').length ? $('.item-cell') : $('.item-container');
  cells.each((_, el) => {
    const cell = $(el);
    const titleEl = cell.find('a.item-title').first();
    const title = clean(titleEl.text());
    const url = titleEl.attr('href') ?? '';
    if (!title || !url) return;

    const priceEl = cell.find('li.price-current').first();
    const dollars = clean(priceEl.find('strong').first().text());
    const cents = clean(priceEl.find('sup').first().text());
    let price = parsePrice(dollars ? `${dollars}${cents || '.00'}` : priceEl.text());
    if (price === null || price <= 0) return;

    const wasText = clean(cell.find('li.price-was .price-was-data, li.price-was').first().text());
    const wasPrice = parsePrice(wasText);
    const shipText = clean(cell.find('li.price-ship').first().text());
    let shippingCost: number | null = null;
    if (/free/i.test(shipText)) shippingCost = 0;
    else if (/\$/.test(shipText)) shippingCost = parsePrice(shipText);

    const promo = clean(cell.find('.item-promo').first().text());
    const brand = cell.find('.item-brand img').first().attr('title') || cell.find('.item-brand img').first().attr('alt') || null;
    const sellerText = clean(cell.find('.item-info .item-sold-by, .item-features, .item-msg').text());
    const marketplace = /sold by|ships from/i.test(sellerText) && !/newegg/i.test(sellerText);
    const idMatch = url.match(/\/p\/([A-Za-z0-9-]+)/) || url.match(/Item=([A-Za-z0-9-]+)/);
    const externalId = idMatch ? idMatch[1] : url;
    const image = cell.find('.item-img img').first().attr('src') ?? null;
    const savePct = clean(cell.find('.price-save-percent').first().text());

    out.push({
      externalId,
      title,
      url: url.startsWith('http') ? url : `https://www.newegg.com${url}`,
      price,
      wasPrice: wasPrice && wasPrice > price ? wasPrice : null,
      shippingCost,
      seller: marketplace ? `Newegg Marketplace` : 'Newegg',
      sellerSite: SITE,
      manufacturer: brand,
      extraText: [promo, savePct ? `save ${savePct}` : '', sellerText],
      marketplace,
      imageUrl: image,
      defaultCondition: 'new',
    });
  });
  return out;
}

export const newegg: SourceAdapter = {
  id: 'newegg',
  label: 'Newegg',
  site: SITE,
  availability: () => ({ enabled: process.env.COMPSHOPPER_DISABLE_NEWEGG !== '1' }),
  async search(ctx: SourceContext) {
    const url = `https://www.newegg.com/p/pl?d=${enc(ctx.searchText)}&PageSize=96`;
    const { body } = await fetchText(url, { signal: ctx.signal });
    return parseNeweggSearch(body);
  },
};
