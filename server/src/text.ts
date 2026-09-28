/** Small, dependency-free text helpers shared by the normaliser and matcher. */

export function lower(s: string): string {
  return s.toLowerCase();
}

/** Lower-case, collapse every non alphanumeric run into a single space. */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’“”]/g, '"')
    .replace(/[^a-z0-9.+"]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lower-case and strip everything except letters and digits. */
export function compact(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Whole-word (token) match of `needle` inside `haystack`, both normalised. */
export function containsWord(haystack: string, needle: string): boolean {
  const h = normalizeText(haystack);
  const n = normalizeText(needle);
  if (!n) return true;
  const re = new RegExp(`(^|\\s)${escapeRegExp(n)}(?=\\s|$)`);
  return re.test(h);
}

/** Parse the first money amount out of a string like "$1,199.99" or "Now $799". */
export function parsePrice(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = s.replace(/,/g, '').match(/(\d+(?:\.\d{1,2})?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/** Parse a capacity like "128GB", "1 TB", "512 gb" into gigabytes. */
export function parseCapacityGb(s: string): number | null {
  const m = s.trim().match(/^(\d+(?:\.\d+)?)\s*(tb|gb|mb)$/i);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (unit === 'tb') return n * 1024;
  if (unit === 'mb') return n / 1024;
  return n;
}

/** Find every capacity mentioned in a text, in gigabytes, preserving order. */
export function extractCapacitiesGb(text: string): number[] {
  const out: number[] = [];
  const re = /(\d+(?:\.\d+)?)\s*(tb|gb|mb)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const gb = parseCapacityGb(`${m[1]}${m[2]}`);
    if (gb !== null) out.push(gb);
  }
  return out;
}

export function formatCapacity(gb: number): string {
  if (gb >= 1024 && gb % 1024 === 0) return `${gb / 1024}TB`;
  if (gb < 1) return `${Math.round(gb * 1024)}MB`;
  return `${gb}GB`;
}

export type SizeUnit = 'mm' | 'in';

export function parseSize(s: string): { value: number; unit: SizeUnit } | null {
  const m = s.trim().match(/^(\d+(?:\.\d+)?)\s*(mm|"|”|''|in(?:ch(?:es)?)?|-inch)$/i);
  if (!m) return null;
  const unit: SizeUnit = m[2].toLowerCase() === 'mm' ? 'mm' : 'in';
  return { value: Number(m[1]), unit };
}

export function extractSizes(text: string): { value: number; unit: SizeUnit }[] {
  const out: { value: number; unit: SizeUnit }[] = [];
  const re = /(\d+(?:\.\d+)?)\s*(mm|"|”|''|-inch|inch(?:es)?|in\b)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const unit: SizeUnit = m[2].toLowerCase() === 'mm' ? 'mm' : 'in';
    out.push({ value: Number(m[1]), unit });
  }
  return out;
}

export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}
