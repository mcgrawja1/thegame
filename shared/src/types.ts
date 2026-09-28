/** Identifiers for the retailer/marketplace adapters CompShopper can query. */
export type SourceId = 'newegg' | 'ebay' | 'bestbuy' | 'walmart' | 'microcenter' | 'sample';

export type Condition = 'new' | 'refurbished' | 'open-box' | 'used' | 'unknown';

/** A single purchasable offer, normalised across all sources. */
export interface Listing {
  /** Stable id: `${source}:${externalId}` */
  id: string;
  source: SourceId;
  /** Human readable seller / marketplace name, e.g. "eBay - techdeals_usa" */
  seller: string;
  /** Retailer web site the listing lives on, e.g. "newegg.com" */
  sellerSite: string;
  /** Direct link to the product page where it can be bought. */
  url: string;
  /** Full listing title as shown by the retailer. */
  title: string;
  /** Short device name derived from the title. */
  device: string;
  manufacturer: string | null;
  modelNumber: string | null;
  /** Price in USD. */
  price: number;
  currency: 'USD';
  /** Regular / strike-through price when the retailer shows one. */
  wasPrice: number | null;
  /** Shipping cost in USD; 0 for free shipping; null when unknown. */
  shippingCost: number | null;
  condition: Condition;
  /** Attributes extracted from the listing (storage, color, ...). */
  attributes: Record<string, string>;
  /** Extra pricing context: bundle, promo, activation required, trade-in, ... */
  pricingNotes: string[];
  /** ISO timestamp of when this price was observed. */
  fetchedAt: string;
  imageUrl?: string | null;
}

export type SourceStatusKind = 'ok' | 'blocked' | 'error' | 'timeout' | 'disabled' | 'no-results';

export interface SourceStatus {
  source: SourceId;
  label: string;
  status: SourceStatusKind;
  /** Number of listings returned after attribute filtering. */
  count: number;
  /** Number of listings parsed before attribute filtering. */
  rawCount: number;
  durationMs: number;
  message?: string;
}

/** A search request. Every field is optional: an empty field means "any". */
export interface SearchQuery {
  category: string;
  /** Free-form keywords appended to the retailer search. */
  keywords?: string;
  manufacturer?: string;
  modelNumber?: string;
  /** Category specific attribute values keyed by FieldDef.key */
  attributes?: Record<string, string>;
  condition?: Condition | 'any';
  maxPrice?: number;
  minPrice?: number;
  /** Restrict to these sources; empty/undefined = all enabled sources. */
  sources?: SourceId[];
  /** Bypass the cache and fetch fresh prices. */
  refresh?: boolean;
}

export interface SearchResponse {
  query: SearchQuery;
  /** The text sent to each retailer's search box. */
  searchText: string;
  listings: Listing[];
  sources: SourceStatus[];
  cached: boolean;
  fetchedAt: string;
  durationMs: number;
}

export interface SourceInfo {
  id: SourceId;
  label: string;
  site: string;
  enabled: boolean;
  /** Why the source is disabled (e.g. missing API key). */
  reason?: string;
}
