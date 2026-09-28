import type { SearchQuery, SearchResponse, SourceInfo } from '@compshopper/shared';

export async function fetchSources(): Promise<SourceInfo[]> {
  const res = await fetch('/api/sources');
  if (!res.ok) throw new Error(`Failed to load sources (${res.status})`);
  return res.json();
}

export async function runSearch(query: SearchQuery, signal?: AbortSignal): Promise<SearchResponse> {
  const res = await fetch('/api/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(query),
    signal,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Search failed (${res.status})`);
  return body as SearchResponse;
}

/** Encode a query into URL search params so searches are shareable. */
export function queryToParams(q: SearchQuery): URLSearchParams {
  const p = new URLSearchParams();
  p.set('category', q.category);
  if (q.manufacturer) p.set('manufacturer', q.manufacturer);
  if (q.modelNumber) p.set('modelNumber', q.modelNumber);
  if (q.keywords) p.set('keywords', q.keywords);
  if (q.condition && q.condition !== 'any') p.set('condition', q.condition);
  if (q.minPrice !== undefined) p.set('minPrice', String(q.minPrice));
  if (q.maxPrice !== undefined) p.set('maxPrice', String(q.maxPrice));
  for (const [k, v] of Object.entries(q.attributes ?? {})) if (v) p.set(`attr.${k}`, v);
  if (q.sources?.length) p.set('sources', q.sources.join(','));
  return p;
}

export function paramsToQuery(p: URLSearchParams): SearchQuery | null {
  const category = p.get('category');
  if (!category) return null;
  const attributes: Record<string, string> = {};
  p.forEach((v, k) => {
    if (k.startsWith('attr.')) attributes[k.slice(5)] = v;
  });
  const num = (k: string) => (p.get(k) ? Number(p.get(k)) : undefined);
  return {
    category,
    manufacturer: p.get('manufacturer') ?? undefined,
    modelNumber: p.get('modelNumber') ?? undefined,
    keywords: p.get('keywords') ?? undefined,
    condition: (p.get('condition') as SearchQuery['condition']) ?? 'any',
    minPrice: num('minPrice'),
    maxPrice: num('maxPrice'),
    attributes,
    sources: p.get('sources') ? (p.get('sources')!.split(',') as SearchQuery['sources']) : undefined,
  };
}
