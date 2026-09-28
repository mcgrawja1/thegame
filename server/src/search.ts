import { getCategory, type Listing, type SearchQuery, type SearchResponse, type SourceId, type SourceStatus } from '@compshopper/shared';
import { TtlCache } from './cache.js';
import { SourceBlockedError, SourceTimeoutError } from './http.js';
import { matchesQuery } from './match.js';
import { normalizeListing } from './normalize.js';
import { buildSearchText, queryCacheKey } from './query.js';
import { SOURCES } from './sources/index.js';
import type { SourceAdapter } from './sources/types.js';

const ttlSeconds = Number(process.env.CACHE_TTL_SECONDS ?? 300);
const cache = new TtlCache<SearchResponse>(ttlSeconds * 1000);

export function clearCache(): void {
  cache.clear();
}

function selectSources(query: SearchQuery): SourceAdapter[] {
  const wanted = query.sources && query.sources.length ? new Set<SourceId>(query.sources) : null;
  return SOURCES.filter((s) => !wanted || wanted.has(s.id));
}

function dedupe(listings: Listing[]): Listing[] {
  const byKey = new Map<string, Listing>();
  for (const l of listings) {
    const key = `${l.source}|${l.url.toLowerCase()}`;
    const existing = byKey.get(key);
    if (!existing || l.price < existing.price) byKey.set(key, l);
  }
  return [...byKey.values()];
}

export function sortListings(listings: Listing[]): Listing[] {
  return [...listings].sort((a, b) => {
    const ta = a.price + (a.shippingCost ?? 0);
    const tb = b.price + (b.shippingCost ?? 0);
    if (ta !== tb) return ta - tb;
    return a.price - b.price;
  });
}

async function runSource(adapter: SourceAdapter, query: SearchQuery, searchText: string, fetchedAt: string, signal: AbortSignal) {
  const category = getCategory(query.category);
  const started = Date.now();
  const base = { source: adapter.id, label: adapter.label } as const;
  const availability = adapter.availability();
  if (!availability.enabled) {
    const status: SourceStatus = { ...base, status: 'disabled', count: 0, rawCount: 0, durationMs: 0, message: availability.reason };
    return { status, listings: [] as Listing[] };
  }
  try {
    const raws = await adapter.search({ searchText, query, category, signal });
    const normalized = raws.map((r) => normalizeListing(r, adapter.id, fetchedAt));
    const matched = normalized.filter((l) => matchesQuery(l, query, category));
    const status: SourceStatus = {
      ...base,
      status: matched.length ? 'ok' : 'no-results',
      count: matched.length,
      rawCount: normalized.length,
      durationMs: Date.now() - started,
      message: !matched.length && normalized.length ? `${normalized.length} listings parsed, none matched the requested attributes` : undefined,
    };
    return { status, listings: matched };
  } catch (err) {
    const durationMs = Date.now() - started;
    let kind: SourceStatus['status'] = 'error';
    if (err instanceof SourceBlockedError) kind = 'blocked';
    else if (err instanceof SourceTimeoutError) kind = 'timeout';
    const message = err instanceof Error ? err.message : String(err);
    const status: SourceStatus = { ...base, status: kind, count: 0, rawCount: 0, durationMs, message };
    return { status, listings: [] as Listing[] };
  }
}

export async function search(query: SearchQuery, signal?: AbortSignal): Promise<SearchResponse> {
  const key = queryCacheKey(query);
  if (!query.refresh) {
    const hit = cache.get(key);
    if (hit) return { ...hit, cached: true };
  }
  const started = Date.now();
  const fetchedAt = new Date().toISOString();
  const category = getCategory(query.category);
  const searchText = buildSearchText(query, category);
  const controller = new AbortController();
  if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true });
  const overall = setTimeout(() => controller.abort(), Number(process.env.SEARCH_TIMEOUT_MS ?? 25000));

  try {
    const results = await Promise.all(selectSources(query).map((s) => runSource(s, query, searchText, fetchedAt, controller.signal)));
    const listings = sortListings(dedupe(results.flatMap((r) => r.listings)));
    const response: SearchResponse = {
      query: { ...query, refresh: undefined },
      searchText,
      listings,
      sources: results.map((r) => r.status),
      cached: false,
      fetchedAt,
      durationMs: Date.now() - started,
    };
    if (listings.length) cache.set(key, response);
    return response;
  } finally {
    clearTimeout(overall);
  }
}
