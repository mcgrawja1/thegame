import type { CategoryDef, SearchQuery, SourceId } from '@compshopper/shared';
import type { RawListing } from '../normalize.js';

export interface SourceContext {
  /** Text sent to the retailer's search box. */
  searchText: string;
  query: SearchQuery;
  category: CategoryDef;
  signal: AbortSignal;
}

export interface SourceAvailability {
  enabled: boolean;
  reason?: string;
}

export interface SourceAdapter {
  id: SourceId;
  label: string;
  site: string;
  availability(): SourceAvailability;
  search(ctx: SourceContext): Promise<RawListing[]>;
}

export function enc(s: string): string {
  return encodeURIComponent(s.trim());
}

/** Extract text from a cheerio node, collapsing whitespace. */
export function clean(s: string | undefined | null): string {
  return (s ?? '').replace(/\s+/g, ' ').trim();
}
