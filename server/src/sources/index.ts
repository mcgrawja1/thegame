import type { SourceId, SourceInfo } from '@compshopper/shared';
import { bestbuy } from './bestbuy.js';
import { ebay } from './ebay.js';
import { microcenter } from './microcenter.js';
import { newegg } from './newegg.js';
import { sample } from './sample.js';
import type { SourceAdapter } from './types.js';
import { walmart } from './walmart.js';

export const SOURCES: SourceAdapter[] = [newegg, ebay, bestbuy, walmart, microcenter, sample];

export const SOURCE_MAP: Record<SourceId, SourceAdapter> = Object.fromEntries(SOURCES.map((s) => [s.id, s])) as Record<SourceId, SourceAdapter>;

export function listSources(): SourceInfo[] {
  return SOURCES.map((s) => {
    const a = s.availability();
    return { id: s.id, label: s.label, site: s.site, enabled: a.enabled, reason: a.reason };
  });
}
