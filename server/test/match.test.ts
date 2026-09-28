import { describe, expect, it } from 'vitest';
import { getCategory, type Listing, type SearchQuery } from '@compshopper/shared';
import { matchesQuery } from '../src/match.js';
import { normalizeListing } from '../src/normalize.js';
import { buildSearchText } from '../src/query.js';

function mk(title: string, price = 500, extra: Partial<Parameters<typeof normalizeListing>[0]> = {}): Listing {
  return normalizeListing({ externalId: title, title, url: `https://example.com/${encodeURIComponent(title)}`, price, seller: 'Test', sellerSite: 'example.com', defaultCondition: 'new', ...extra }, 'sample', '2026-01-01T00:00:00Z');
}

const phones = getCategory('smartphone');

describe('matchesQuery', () => {
  const iphone128 = mk('Apple iPhone 16 128GB Black Unlocked');
  const iphone256 = mk('Apple iPhone 16 256GB Blue Unlocked');
  const pixel = mk('Google Pixel 9 Pro 256GB Obsidian Unlocked GA05070');
  const caseListing = mk('Silicone Case for iPhone 16 Black', 12);

  it('blank fields match anything (except accessories)', () => {
    const q: SearchQuery = { category: 'smartphone' };
    expect(matchesQuery(iphone128, q, phones)).toBe(true);
    expect(matchesQuery(pixel, q, phones)).toBe(true);
    expect(matchesQuery(caseListing, q, phones)).toBe(false);
  });

  it('filters by storage capacity regardless of formatting', () => {
    const q: SearchQuery = { category: 'smartphone', attributes: { storage: '256GB' } };
    expect(matchesQuery(iphone128, q, phones)).toBe(false);
    expect(matchesQuery(iphone256, q, phones)).toBe(true);
    expect(matchesQuery(mk('iPhone 16 256 GB'), q, phones)).toBe(true);
  });

  it('filters by manufacturer using inference and aliases', () => {
    expect(matchesQuery(iphone128, { category: 'smartphone', manufacturer: 'Apple' }, phones)).toBe(true);
    expect(matchesQuery(pixel, { category: 'smartphone', manufacturer: 'Apple' }, phones)).toBe(false);
    expect(matchesQuery(pixel, { category: 'smartphone', manufacturer: 'google' }, phones)).toBe(true);
  });

  it('filters by model number ignoring punctuation', () => {
    expect(matchesQuery(pixel, { category: 'smartphone', modelNumber: 'ga-05070' }, phones)).toBe(true);
    expect(matchesQuery(pixel, { category: 'smartphone', modelNumber: 'iphone 16' }, phones)).toBe(false);
    expect(matchesQuery(iphone256, { category: 'smartphone', modelNumber: 'iPhone 16' }, phones)).toBe(true);
  });

  it('filters by color, condition and price range', () => {
    expect(matchesQuery(iphone256, { category: 'smartphone', attributes: { color: 'blue' } }, phones)).toBe(true);
    expect(matchesQuery(iphone128, { category: 'smartphone', attributes: { color: 'blue' } }, phones)).toBe(false);
    expect(matchesQuery(iphone128, { category: 'smartphone', maxPrice: 400 }, phones)).toBe(false);
    expect(matchesQuery(iphone128, { category: 'smartphone', minPrice: 400, maxPrice: 600 }, phones)).toBe(true);
    const refurb = mk('Refurbished Apple iPhone 16 128GB');
    expect(matchesQuery(refurb, { category: 'smartphone', condition: 'new' }, phones)).toBe(false);
    expect(matchesQuery(refurb, { category: 'smartphone', condition: 'refurbished' }, phones)).toBe(true);
    expect(matchesQuery(refurb, { category: 'smartphone', condition: 'any' }, phones)).toBe(true);
  });

  it('matches watch case sizes and monitor sizes', () => {
    const watches = getCategory('smartwatch');
    const w44 = mk('Samsung Galaxy Watch7 44mm Bluetooth Green');
    expect(matchesQuery(w44, { category: 'smartwatch', attributes: { caseSize: '44mm' } }, watches)).toBe(true);
    expect(matchesQuery(w44, { category: 'smartwatch', attributes: { caseSize: '40mm' } }, watches)).toBe(false);
    const monitors = getCategory('monitor');
    const m27 = mk('LG UltraGear 27" 1440p 240Hz OLED');
    expect(matchesQuery(m27, { category: 'monitor', attributes: { screenSize: '27"' } }, monitors)).toBe(true);
    expect(matchesQuery(m27, { category: 'monitor', attributes: { screenSize: '32"' } }, monitors)).toBe(false);
  });

  it('keeps accessories when the user explicitly asked for them', () => {
    expect(matchesQuery(caseListing, { category: 'smartphone', keywords: 'case' }, phones)).toBe(true);
  });
});

describe('buildSearchText', () => {
  it('joins filled fields and skips blanks', () => {
    expect(buildSearchText({ category: 'smartphone', manufacturer: 'Apple', modelNumber: 'iPhone 16', attributes: { storage: '256GB', color: '' } }, phones)).toBe('Apple iPhone 16 256GB');
  });
  it('adds the category keyword when the user gave little', () => {
    expect(buildSearchText({ category: 'smartphone', manufacturer: 'Apple' }, phones)).toBe('smartphone Apple');
    expect(buildSearchText({ category: 'gpu', attributes: { chipset: 'RTX 5070' } }, getCategory('gpu'))).toBe('RTX 5070');
  });
  it('omits fields flagged includeInSearch=false', () => {
    expect(buildSearchText({ category: 'cpu', manufacturer: 'AMD', attributes: { cores: '8-core', socket: 'AM5' } }, getCategory('cpu'))).toBe('AMD AM5');
  });
});
