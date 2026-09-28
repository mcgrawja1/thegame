import type { CategoryDef, SearchQuery } from '@compshopper/shared';
import { normalizeText } from './text.js';

/**
 * Build the text typed into each retailer's search box. Blank attributes are
 * simply omitted, so they act as "any". The category keyword is only added
 * when the user gave us very little to go on, since "iPhone 16 smartphone"
 * returns worse results than "iPhone 16" on most retailers.
 */
export function buildSearchText(query: SearchQuery, category: CategoryDef): string {
  const parts: string[] = [];
  if (query.manufacturer) parts.push(query.manufacturer.trim());
  if (query.modelNumber) parts.push(query.modelNumber.trim());
  if (query.keywords) parts.push(query.keywords.trim());

  const attrs = query.attributes ?? {};
  for (const field of category.fields) {
    const value = attrs[field.key]?.trim();
    if (!value || field.includeInSearch === false) continue;
    parts.push(value);
  }

  const userTokens = parts.join(' ').split(/\s+/).filter(Boolean);
  if (userTokens.length < 2 && category.searchTerms.length) parts.unshift(category.searchTerms[0]);
  if (query.condition === 'refurbished') parts.push('refurbished');
  if (query.condition === 'open-box') parts.push('open box');

  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const p of parts.join(' ').split(/\s+/)) {
    const key = normalizeText(p);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(p);
  }
  return deduped.join(' ');
}

/** Stable cache key for a query (ignores the refresh flag). */
export function queryCacheKey(query: SearchQuery): string {
  const { refresh: _refresh, ...rest } = query;
  const sortedAttrs = Object.fromEntries(Object.entries(rest.attributes ?? {}).filter(([, v]) => v).sort());
  return JSON.stringify({ ...rest, attributes: sortedAttrs, sources: [...(rest.sources ?? [])].sort() });
}
