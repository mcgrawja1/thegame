import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { SearchResponse } from '@compshopper/shared';
import { createApp } from '../src/app.js';

let server: Server;
let base: string;

beforeAll(async () => {
  process.env.COMPSHOPPER_DEMO = '1';
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => server.close());

describe('API', () => {
  it('lists categories and sources', async () => {
    const cats = await (await fetch(`${base}/api/categories`)).json();
    expect(cats.some((c: { id: string }) => c.id === 'smartphone')).toBe(true);
    const sources = await (await fetch(`${base}/api/sources`)).json();
    expect(sources.find((s: { id: string }) => s.id === 'sample').enabled).toBe(true);
  });

  it('rejects empty searches', async () => {
    const res = await fetch(`${base}/api/search`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ category: 'other' }) });
    expect(res.status).toBe(400);
  });

  it('searches the sample source, sorts by price and reports statuses', async () => {
    const res = await fetch(`${base}/api/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ category: 'smartphone', manufacturer: 'Apple', attributes: { storage: '256GB' }, sources: ['sample'] }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as SearchResponse;
    expect(body.searchText).toBe('Apple 256GB');
    expect(body.listings.length).toBeGreaterThan(0);
    for (const l of body.listings) {
      expect(l.manufacturer).toBe('Apple');
      expect(l.attributes.capacity).toContain('256GB');
      expect(l.url.startsWith('https://example.com/')).toBe(true);
    }
    const prices = body.listings.map((l) => l.price + (l.shippingCost ?? 0));
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
    expect(body.sources.find((s) => s.source === 'sample')?.status).toBe('ok');
    expect(body.cached).toBe(false);

    const again = (await (await fetch(`${base}/api/search?category=smartphone&manufacturer=Apple&attr[storage]=256GB&sources=sample`)).json()) as SearchResponse;
    expect(again.cached).toBe(true);
    expect(again.listings.length).toBe(body.listings.length);
  });
});
