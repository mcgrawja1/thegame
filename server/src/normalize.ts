import type { Condition, Listing, SourceId } from '@compshopper/shared';
import { inferManufacturer } from './brands.js';
import { extractCapacitiesGb, extractSizes, formatCapacity, truncate } from './text.js';

/** What a source adapter produces before normalisation. */
export interface RawListing {
  externalId: string;
  title: string;
  url: string;
  price: number;
  wasPrice?: number | null;
  shippingCost?: number | null;
  /** Seller display name, e.g. "Newegg" or "eBay - techdeals_usa". */
  seller: string;
  sellerSite: string;
  /** Explicit condition when the retailer reports one. */
  condition?: Condition | null;
  /** Raw condition text (e.g. "Certified - Refurbished") for note extraction. */
  conditionText?: string | null;
  manufacturer?: string | null;
  modelNumber?: string | null;
  /** Extra strings shown near the price: promo badges, subtitles, flags. */
  extraText?: string[];
  /** Notes the adapter already knows (e.g. "Price varies by store"). */
  notes?: string[];
  /** True when sold by a third-party marketplace seller on the site. */
  marketplace?: boolean;
  imageUrl?: string | null;
  /** Default condition for the source when nothing indicates otherwise. */
  defaultCondition?: Condition;
}

const COLOR_WORDS = new Set([
  'black', 'white', 'silver', 'gray', 'grey', 'graphite', 'blue', 'navy', 'green', 'red', 'pink',
  'purple', 'lavender', 'violet', 'gold', 'titanium', 'midnight', 'starlight', 'natural', 'desert',
  'yellow', 'orange', 'teal', 'cream', 'obsidian', 'hazel', 'porcelain', 'bay', 'peony', 'wintergreen',
  'iris', 'sage', 'jade', 'ultramarine', 'coral', 'mint', 'lilac', 'aqua', 'cyan', 'bronze', 'copper',
  'charcoal', 'ivory', 'beige', 'sand', 'olive', 'lime', 'magenta', 'burgundy', 'maroon', 'indigo',
]);
/** Words that only count as part of a colour when next to a colour word. */
const COLOR_MODIFIERS = new Set([
  'space', 'rose', 'phantom', 'cobalt', 'amber', 'marble', 'icy', 'deep', 'dark', 'light', 'pacific',
  'sierra', 'alpine', 'forest', 'sky', 'jet', 'matte', 'glossy', 'sierra', 'mystic', 'cloud', 'awesome',
  'moonlight', 'sunset', 'aurora', 'arctic', 'lunar', 'stellar', 'steel', 'platinum',
]);

const CARRIERS = ['unlocked', 'verizon', 'at&t', 't-mobile', 'sprint', 'cricket', 'boost', 'metro', 'us cellular', 'xfinity', 'spectrum', 'straight talk', 'tracfone'];

export function detectCondition(text: string, fallback: Condition = 'unknown'): Condition {
  const t = text.toLowerCase();
  if (/\b(refurbished|refurb|renewed|reconditioned|certified pre[- ]?owned|remanufactured|restored)\b/.test(t)) return 'refurbished';
  if (/\bopen[- ]?box\b/.test(t)) return 'open-box';
  if (/\b(used|pre[- ]?owned|second[- ]?hand|good condition|fair condition|excellent condition|very good|acceptable|for parts|parts only|not working)\b/.test(t)) return 'used';
  if (/\b(brand new|new|sealed)\b/.test(t)) return 'new';
  return fallback;
}

/**
 * Extract a manufacturer part / model number from listing text.
 * Explicit "Model: XYZ" labels win; otherwise alphanumeric tokens are scored
 * (hyphens, slashes and length make a token look more like a part number).
 */
export function extractModelNumber(text: string): string | null {
  const explicit = text.match(/\b(?:model|mpn|part\s*(?:#|number|no\.?)|mfr\s*part\s*#?)\s*[:#]?\s*([A-Za-z0-9][A-Za-z0-9\-/.]{3,})/i);
  if (explicit) return explicit[1].replace(/[.,;:]+$/, '');

  const tokens = text
    .replace(/[(),;|"]/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^[\-/.:]+|[\-/.:,]+$/g, ''))
    .filter(Boolean);

  const NOISE = /^(\d+(\.\d+)?(gb|tb|mb|mhz|ghz|hz|mm|w|k|in|ms|nits|mp|mah|fps|bit|rpm|gbps|mbps|x|p|pin|core|cores|inch)|\d+x\d+|5g|4g|lte|4k|8k|2k|1080p|1440p|2160p|usb\-?c|usb3(\.\d)?|usb\-?a|hdmi2(\.\d)?|ddr[345]|lpddr[345]x?|gddr[67]x?|pcie?\s*[345](\.0)?|gen[345]|m\.2|2280|2230|wi\-?fi\s*[67]e?|wifi[67]e?|bt5(\.\d)?|80\+|ip6[78]|h\d{3}|x3d|xt|ti|fe|3d|2\.5|3\.5|q\d|v\d|gen\d|m[1234]|a1[5-9]|i[3579]|mk\d+|no\.\d+|type\-?c)$/i;

  let best: { token: string; score: number } | null = null;
  for (const raw of tokens) {
    const token = raw;
    if (token.length < 4 || token.length > 32) continue;
    if (!/[A-Za-z]/.test(token) || !/\d/.test(token)) continue;
    if (NOISE.test(token)) continue;
    if (/^\d+(\.\d+)?[a-z]{1,2}$/i.test(token)) continue; // 44mm, 27in, 6.1in

    let score = 0;
    if (token.includes('-')) score += 2;
    if (token.includes('/')) score += 1;
    if (token.length >= 6) score += 1;
    if (token.length >= 9) score += 1;
    const transitions = (token.match(/[A-Za-z](?=\d)|\d(?=[A-Za-z])/g) || []).length;
    if (transitions >= 2) score += 1;
    if (/^[A-Z0-9\-/.]+$/.test(token) && /[A-Z]/.test(token)) score += 1; // all caps
    if (/^(rtx|rx|gtx|arc|core|ryzen)\d/i.test(token)) score -= 2;
    if (best === null || score > best.score) best = { token, score };
  }
  return best && best.score >= 1 ? best.token : null;
}

export function extractColor(text: string): string | null {
  const tokens = text.toLowerCase().replace(/[^a-z0-9&]+/g, ' ').split(' ').filter(Boolean);
  let best: string[] = [];
  let run: string[] = [];
  const flush = () => {
    if (run.some((w) => COLOR_WORDS.has(w)) && run.length > best.length) best = run;
    run = [];
  };
  for (const tok of tokens) {
    if (COLOR_WORDS.has(tok) || COLOR_MODIFIERS.has(tok)) run.push(tok);
    else flush();
  }
  flush();
  if (!best.length) return null;
  // Trim modifiers that dangle at either end without a colour word next to them.
  while (best.length && COLOR_MODIFIERS.has(best[best.length - 1])) best = best.slice(0, -1);
  while (best.length && COLOR_MODIFIERS.has(best[0]) && !COLOR_WORDS.has(best[1] ?? '')) best = best.slice(1);
  return best.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function extractCarrier(text: string): string | null {
  const t = ` ${text.toLowerCase()} `;
  for (const c of CARRIERS) {
    if (t.includes(` ${c} `) || t.includes(`(${c})`)) {
      return c === 'at&t' ? 'AT&T' : c === 't-mobile' ? 'T-Mobile' : c.replace(/\b\w/g, (m) => m.toUpperCase());
    }
  }
  return null;
}

interface NoteRule {
  note: string;
  re: RegExp;
}

const NOTE_RULES: NoteRule[] = [
  { note: 'Bundle', re: /\b(bundle|bundled|combo|combo special|value pack|starter pack|w\/ .*(?:included|bundle))\b/i },
  { note: 'Multi-pack / lot', re: /\b(lot of \d+|\d+[- ]pack|pack of \d+|\d+ ?x ?\d+ ?(?:gb|tb)\s*kit|2 ?x ?\d+gb|\(\d+ ?x)/i },
  { note: 'Activation / carrier plan required', re: /\b(activation|activate today|activate now|with a new line|new line|add a line|with plan|with contract|on contract|installment|device payment|monthly installments|w\/ ?plan|w\/ ?activation|carrier financing|requires? (?:a )?(?:new )?(?:line|plan|activation))\b/i },
  { note: 'Trade-in offer', re: /\btrade[- ]?in\b/i },
  { note: 'Promo / coupon', re: /\b(promo|promotion|coupon|promo code|use code|clip coupon|with code|rebate|instant savings|instant rebate|mail[- ]in rebate|voucher)\b/i },
  { note: 'Gift card included', re: /\b(gift card|e-?gift|egift)\b/i },
  { note: 'Financing offer', re: /(\$\s?\d+(?:\.\d+)?\s*\/\s*mo\b|per month|\bfinancing\b|\baffirm\b|\bklarna\b|\bafterpay\b|\bmonthly payments?\b)/i },
  { note: 'Sale / clearance', re: /\b(clearance|on sale|sale price|flash sale|limited time|limited-time|deal of the day|daily deal|lightning deal|rollback|price drop|black friday|cyber monday|prime day|shell shocker)\b/i },
  { note: 'Free gift included', re: /\b(free gift|free item|bonus item|gift with purchase)\b/i },
  { note: 'For parts / damaged', re: /\b(for parts|parts only|not working|cracked|damaged|as[- ]is|no power)\b/i },
  { note: 'Carrier locked', re: /\b(carrier locked|locked to|network locked)\b/i },
  { note: 'International / import model', re: /\b(international version|international model|global version|import|imported|no warranty|no us warranty)\b/i },
  { note: 'Auction', re: /\b(auction|bids?|bidding)\b/i },
  { note: 'Best offer accepted', re: /\b(or best offer|best offer)\b/i },
  { note: 'Pre-order', re: /\b(pre-?order|preorder|coming soon|ships (?:on|by) [a-z]+ \d+)\b/i },
  { note: 'Backorder / out of stock', re: /\b(backorder|back-order|out of stock|sold out|notify me)\b/i },
  { note: 'Membership price', re: /\b(member price|members only|prime exclusive|plus member|my best buy|totaltech|walmart\+|walmart plus)\b/i },
  { note: 'Sponsored listing', re: /\b(sponsored|ad\b)/i },
];

export function extractPricingNotes(texts: string[]): string[] {
  const joined = texts.filter(Boolean).join(' \n ');
  const notes: string[] = [];
  for (const rule of NOTE_RULES) {
    if (rule.re.test(joined)) notes.push(rule.note);
  }
  return notes;
}

function deriveDeviceName(title: string): string {
  let t = title.replace(/\s+/g, ' ').trim();
  // Strip a leading condition prefix: "Refurbished: ", "Open Box: "
  t = t.replace(/^(refurbished|open box|open-box|renewed|used)\s*[:\-–]\s*/i, '');
  // Cut marketing tails after " - ", " | ", " – " when the head is meaningful.
  const cut = t.search(/\s[-|–—]\s/);
  if (cut >= 18) t = t.slice(0, cut);
  const paren = t.indexOf(' (');
  if (paren >= 18) t = t.slice(0, paren);
  return truncate(t.trim(), 96);
}

function pct(was: number, now: number): number {
  return Math.round(((was - now) / was) * 100);
}

export function normalizeListing(raw: RawListing, source: SourceId, fetchedAt: string): Listing {
  const allText = [raw.title, raw.conditionText ?? '', ...(raw.extraText ?? [])].join(' \n ');
  const condition: Condition = raw.condition ?? detectCondition(allText, raw.defaultCondition ?? 'unknown');

  const capacities = extractCapacitiesGb(raw.title);
  const sizes = extractSizes(raw.title);
  const attributes: Record<string, string> = {};
  if (capacities.length) attributes.capacity = [...new Set(capacities)].map(formatCapacity).join(' / ');
  if (sizes.length) attributes.size = sizes.map((s) => `${s.value}${s.unit === 'mm' ? 'mm' : '"'}`).join(' / ');
  const color = extractColor(raw.title);
  if (color) attributes.color = color;
  const carrier = extractCarrier(raw.title);
  if (carrier) attributes.carrier = carrier;
  attributes.condition = condition;

  const notes = new Set<string>(raw.notes ?? []);
  for (const n of extractPricingNotes([raw.title, raw.conditionText ?? '', ...(raw.extraText ?? [])])) notes.add(n);
  if (condition === 'refurbished') notes.add('Refurbished');
  if (condition === 'open-box') notes.add('Open box');
  if (condition === 'used') notes.add('Used');
  if (raw.marketplace) notes.add('Third-party marketplace seller');
  if (raw.wasPrice && raw.wasPrice > raw.price) {
    notes.add(`Was $${raw.wasPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (save ${pct(raw.wasPrice, raw.price)}%)`);
  }
  if (raw.shippingCost === 0) notes.add('Free shipping');
  else if (typeof raw.shippingCost === 'number' && raw.shippingCost > 0) notes.add(`+ $${raw.shippingCost.toFixed(2)} shipping`);

  return {
    id: `${source}:${raw.externalId}`,
    source,
    seller: raw.seller,
    sellerSite: raw.sellerSite,
    url: raw.url,
    title: raw.title.replace(/\s+/g, ' ').trim(),
    device: deriveDeviceName(raw.title),
    manufacturer: raw.manufacturer?.trim() || inferManufacturer(raw.title),
    modelNumber: raw.modelNumber?.trim() || extractModelNumber(raw.title),
    price: Math.round(raw.price * 100) / 100,
    currency: 'USD',
    wasPrice: raw.wasPrice ?? null,
    shippingCost: raw.shippingCost ?? null,
    condition,
    attributes,
    pricingNotes: [...notes],
    fetchedAt,
    imageUrl: raw.imageUrl ?? null,
  };
}
