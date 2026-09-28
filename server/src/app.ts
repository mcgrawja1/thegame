import express, { type Request, type Response, type NextFunction } from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { CATEGORIES, type SearchQuery } from '@compshopper/shared';
import { listSources } from './sources/index.js';
import { clearCache, search } from './search.js';

const sourceIds = ['newegg', 'ebay', 'bestbuy', 'walmart', 'microcenter', 'sample'] as const;

const querySchema = z.object({
  category: z.string().min(1).max(40).default('other'),
  keywords: z.string().max(200).optional(),
  manufacturer: z.string().max(80).optional(),
  modelNumber: z.string().max(80).optional(),
  attributes: z.record(z.string().max(80)).optional(),
  condition: z.enum(['any', 'new', 'refurbished', 'open-box', 'used', 'unknown']).optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  sources: z.array(z.enum(sourceIds)).optional(),
  refresh: z.coerce.boolean().optional(),
});

function trimQuery(q: z.infer<typeof querySchema>): SearchQuery {
  const attributes = Object.fromEntries(Object.entries(q.attributes ?? {}).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));
  return {
    ...q,
    keywords: q.keywords?.trim() || undefined,
    manufacturer: q.manufacturer?.trim() || undefined,
    modelNumber: q.modelNumber?.trim() || undefined,
    attributes,
  };
}

function parseGetQuery(req: Request): unknown {
  const attributes: Record<string, string> = {};
  const rest: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(req.query)) {
    if (k === 'attr' && v && typeof v === 'object' && !Array.isArray(v)) {
      // Express's query parser already expanded attr[storage]=256GB into { storage: '256GB' }.
      for (const [ak, av] of Object.entries(v as Record<string, unknown>)) if (typeof av === 'string') attributes[ak] = av;
      continue;
    }
    if (typeof v !== 'string') continue;
    const m = k.match(/^attr\[(.+)\]$/) || k.match(/^attr\.(.+)$/);
    if (m) attributes[m[1]] = v;
    else if (k === 'sources') rest.sources = v.split(',').filter(Boolean);
    else rest[k] = v;
  }
  return { ...rest, attributes };
}

export function createApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));
  app.get('/api/categories', (_req, res) => res.json(CATEGORIES));
  app.get('/api/sources', (_req, res) => res.json(listSources()));
  app.post('/api/cache/clear', (_req, res) => {
    clearCache();
    res.json({ ok: true });
  });

  const handleSearch = async (input: unknown, req: Request, res: Response, next: NextFunction) => {
    const parsed = querySchema.safeParse(input);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid search', issues: parsed.error.issues });
      return;
    }
    const query = trimQuery(parsed.data);
    const hasCriteria = Boolean(query.keywords || query.manufacturer || query.modelNumber || Object.keys(query.attributes ?? {}).length || (query.category && query.category !== 'other'));
    if (!hasCriteria) {
      res.status(400).json({ error: 'Enter at least a category, manufacturer, model number or keywords.' });
      return;
    }
    const controller = new AbortController();
    // Abort the retailer fetches if the client goes away before we respond.
    res.on('close', () => {
      if (!res.writableFinished) controller.abort();
    });
    try {
      const result = await search(query, controller.signal);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  app.post('/api/search', (req, res, next) => handleSearch(req.body, req, res, next));
  app.get('/api/search', (req, res, next) => handleSearch(parseGetQuery(req), req, res, next));

  // Serve the built web client when present (production mode).
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    process.env.WEB_DIST ?? '',
    path.resolve(here, '../../../../web/dist'), // server/dist/server/src -> <repo>/web/dist (built)
    path.resolve(here, '../../web/dist'), // server/src -> <repo>/web/dist (tsx dev)
  ].filter(Boolean);
  const webDist = candidates.find((p) => existsSync(path.join(p, 'index.html')));
  if (webDist) {
    app.use(express.static(webDist));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    res.status(500).json({ error: message });
  });

  return app;
}
