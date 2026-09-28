import type { CategoryDef, Condition, FieldDef, Listing, SearchQuery } from '@compshopper/shared';
import { canonicalBrand } from './brands.js';
import { compact, containsWord, extractCapacitiesGb, extractSizes, normalizeText, parseCapacityGb, parseSize } from './text.js';

function listingText(l: Listing): string {
  return [l.title, l.manufacturer ?? '', l.modelNumber ?? '', ...Object.values(l.attributes)].join(' ');
}

export function matchesField(listing: Listing, field: FieldDef, value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  const text = listingText(listing);
  switch (field.match) {
    case 'capacity': {
      const want = parseCapacityGb(v);
      if (want === null) return containsWord(text, v);
      return extractCapacitiesGb(text).some((gb) => Math.abs(gb - want) < 0.01);
    }
    case 'size': {
      const want = parseSize(v);
      if (!want) return containsWord(text, v);
      return extractSizes(text).some((s) => s.unit === want.unit && Math.abs(s.value - want.value) < 0.05);
    }
    case 'exact':
      return containsWord(text, v);
    case 'text':
    default:
      return matchesText(text, v);
  }
}

/** Every token of the value must occur in the text (as a word or compact substring). */
export function matchesText(text: string, value: string): boolean {
  const tokens = normalizeText(value).split(' ').filter(Boolean);
  if (!tokens.length) return true;
  const c = compact(text);
  return tokens.every((tok) => containsWord(text, tok) || (tok.length >= 3 && c.includes(compact(tok))));
}

export function matchesManufacturer(listing: Listing, value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  const wanted = canonicalBrand(v);
  if (wanted && listing.manufacturer && listing.manufacturer.toLowerCase() === wanted.toLowerCase()) return true;
  if (listing.manufacturer && listing.manufacturer.toLowerCase() === v.toLowerCase()) return true;
  return matchesText(listing.title, v);
}

export function matchesModel(listing: Listing, value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  const want = compact(v);
  if (!want) return true;
  if (listing.modelNumber && compact(listing.modelNumber).includes(want)) return true;
  return compact(listing.title).includes(want);
}

export function matchesCondition(listing: Listing, cond: Condition | 'any' | undefined): boolean {
  if (!cond || cond === 'any') return true;
  return listing.condition === cond;
}

export function isAccessory(listing: Listing, category: CategoryDef, query: SearchQuery): boolean {
  const userText = normalizeText([query.keywords ?? '', query.modelNumber ?? ''].join(' '));
  const title = normalizeText(listing.title);
  const terms = category.excludeTerms.map(normalizeText).filter(Boolean);
  // If the user explicitly searched for an "accessory" word, they want accessories.
  if (terms.some((t) => containsWord(userText, t))) return false;
  return terms.some((t) => containsWord(title, t));
}

/** Apply every filled-in query field. Blank fields match everything. */
export function matchesQuery(listing: Listing, query: SearchQuery, category: CategoryDef): boolean {
  if (typeof query.minPrice === 'number' && listing.price < query.minPrice) return false;
  if (typeof query.maxPrice === 'number' && listing.price > query.maxPrice) return false;
  if (!matchesCondition(listing, query.condition)) return false;
  if (query.manufacturer && !matchesManufacturer(listing, query.manufacturer)) return false;
  if (query.modelNumber && !matchesModel(listing, query.modelNumber)) return false;
  if (query.keywords && !matchesText(listing.title, query.keywords)) return false;
  const attrs = query.attributes ?? {};
  for (const field of category.fields) {
    const value = attrs[field.key];
    if (value && !matchesField(listing, field, value)) return false;
  }
  if (isAccessory(listing, category, query)) return false;
  return true;
}
