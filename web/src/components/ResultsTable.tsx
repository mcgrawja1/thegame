import type { Listing } from '@compshopper/shared';
import { useMemo, useState } from 'react';

type SortKey = 'price' | 'device' | 'modelNumber' | 'manufacturer' | 'seller' | 'notes';
type SortDir = 'asc' | 'desc';

export interface TableFilters {
  priceMin: string;
  priceMax: string;
  device: string;
  modelNumber: string;
  manufacturer: string;
  seller: string;
  notes: string;
  condition: string;
  hidePromos: boolean;
}

export const EMPTY_FILTERS: TableFilters = {
  priceMin: '',
  priceMax: '',
  device: '',
  modelNumber: '',
  manufacturer: '',
  seller: '',
  notes: '',
  condition: '',
  hidePromos: false,
};

const PROMO_NOTES = new Set(['Bundle', 'Activation / carrier plan required', 'Trade-in offer', 'Promo / coupon', 'Gift card included', 'Financing offer', 'Membership price', 'Multi-pack / lot']);

const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const includes = (hay: string | null | undefined, needle: string) => !needle || (hay ?? '').toLowerCase().includes(needle.trim().toLowerCase());

export function applyFilters(listings: Listing[], f: TableFilters): Listing[] {
  const min = f.priceMin ? Number(f.priceMin) : null;
  const max = f.priceMax ? Number(f.priceMax) : null;
  return listings.filter((l) => {
    if (min !== null && l.price < min) return false;
    if (max !== null && l.price > max) return false;
    if (!includes(`${l.device} ${l.title} ${Object.values(l.attributes).join(' ')}`, f.device)) return false;
    if (!includes(l.modelNumber, f.modelNumber)) return false;
    if (!includes(l.manufacturer, f.manufacturer)) return false;
    if (f.seller && l.sellerSite !== f.seller) return false;
    if (f.condition && l.condition !== f.condition) return false;
    if (!includes(l.pricingNotes.join(' '), f.notes)) return false;
    if (f.hidePromos && l.pricingNotes.some((n) => PROMO_NOTES.has(n))) return false;
    return true;
  });
}

function compare(a: Listing, b: Listing, key: SortKey): number {
  switch (key) {
    case 'price':
      return a.price + (a.shippingCost ?? 0) - (b.price + (b.shippingCost ?? 0)) || a.price - b.price;
    case 'device':
      return a.device.localeCompare(b.device);
    case 'modelNumber':
      return (a.modelNumber ?? '￿').localeCompare(b.modelNumber ?? '￿');
    case 'manufacturer':
      return (a.manufacturer ?? '￿').localeCompare(b.manufacturer ?? '￿');
    case 'seller':
      return a.seller.localeCompare(b.seller) || a.price - b.price;
    case 'notes':
      return a.pricingNotes.length - b.pricingNotes.length || a.pricingNotes.join().localeCompare(b.pricingNotes.join());
  }
}

export function sortListings(listings: Listing[], key: SortKey, dir: SortDir): Listing[] {
  const sorted = [...listings].sort((a, b) => compare(a, b, key));
  return dir === 'asc' ? sorted : sorted.reverse();
}

export function toCsv(listings: Listing[]): string {
  const esc = (v: string | number | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [
    ['Price', 'Shipping', 'Was price', 'Device', 'Model number', 'Manufacturer', 'Seller', 'Seller site', 'URL', 'Condition', 'Pricing notes', 'Fetched at', 'Full title'],
    ...listings.map((l) => [l.price, l.shippingCost ?? '', l.wasPrice ?? '', l.device, l.modelNumber, l.manufacturer, l.seller, l.sellerSite, l.url, l.condition, l.pricingNotes.join('; '), l.fetchedAt, l.title]),
  ];
  return rows.map((r) => r.map(esc).join(',')).join('\n');
}

interface Props {
  listings: Listing[];
}

export function ResultsTable({ listings }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('price');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filters, setFilters] = useState<TableFilters>(EMPTY_FILTERS);

  const sellers = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of listings) map.set(l.sellerSite, l.sellerSite);
    return [...map.keys()].sort();
  }, [listings]);

  const visible = useMemo(() => sortListings(applyFilters(listings, filters), sortKey, sortDir), [listings, filters, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };
  const setF = <K extends keyof TableFilters>(k: K, v: TableFilters[K]) => setFilters({ ...filters, [k]: v });
  const filtersActive = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

  const exportCsv = () => {
    const blob = new Blob([toCsv(visible)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `compshopper-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const header = (key: SortKey, label: string) => (
    <th scope="col" aria-sort={sortKey === key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="sort-btn" onClick={() => toggleSort(key)}>
        {label}
        <span className="sort-indicator" aria-hidden="true">
          {sortKey === key ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  );

  return (
    <section className="results">
      <div className="results-toolbar">
        <span>
          Showing <strong>{visible.length}</strong> of {listings.length} offers
          {filtersActive && (
            <>
              {' · '}
              <button type="button" className="link" onClick={() => setFilters(EMPTY_FILTERS)}>
                clear column filters
              </button>
            </>
          )}
        </span>
        <button type="button" onClick={exportCsv} disabled={!visible.length}>
          Export CSV
        </button>
      </div>

      <div className="table-wrap">
        <table className="results-table">
          <thead>
            <tr>
              {header('price', 'Price')}
              {header('device', 'Device')}
              {header('modelNumber', 'Model number')}
              {header('manufacturer', 'Manufacturer')}
              {header('seller', 'Seller website')}
              {header('notes', 'Pricing notes')}
            </tr>
            <tr className="filter-row">
              <th>
                <div className="range">
                  <input type="number" placeholder="Min" aria-label="Minimum price" value={filters.priceMin} onChange={(e) => setF('priceMin', e.target.value)} />
                  <input type="number" placeholder="Max" aria-label="Maximum price" value={filters.priceMax} onChange={(e) => setF('priceMax', e.target.value)} />
                </div>
              </th>
              <th>
                <input placeholder="Filter device…" aria-label="Filter by device" value={filters.device} onChange={(e) => setF('device', e.target.value)} />
              </th>
              <th>
                <input placeholder="Filter model…" aria-label="Filter by model number" value={filters.modelNumber} onChange={(e) => setF('modelNumber', e.target.value)} />
              </th>
              <th>
                <input placeholder="Filter manufacturer…" aria-label="Filter by manufacturer" value={filters.manufacturer} onChange={(e) => setF('manufacturer', e.target.value)} />
              </th>
              <th>
                <select aria-label="Filter by seller" value={filters.seller} onChange={(e) => setF('seller', e.target.value)}>
                  <option value="">All sellers</option>
                  {sellers.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </th>
              <th>
                <div className="notes-filter">
                  <input placeholder="Filter notes…" aria-label="Filter by pricing notes" value={filters.notes} onChange={(e) => setF('notes', e.target.value)} />
                  <select aria-label="Filter by condition" value={filters.condition} onChange={(e) => setF('condition', e.target.value)}>
                    <option value="">Any condition</option>
                    <option value="new">New</option>
                    <option value="refurbished">Refurbished</option>
                    <option value="open-box">Open box</option>
                    <option value="used">Used</option>
                    <option value="unknown">Unknown</option>
                  </select>
                  <label className="checkbox">
                    <input type="checkbox" checked={filters.hidePromos} onChange={(e) => setF('hidePromos', e.target.checked)} />
                    Hide bundles &amp; promos
                  </label>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((l) => (
              <tr key={l.id}>
                <td className="price-cell">
                  <div className="price">{money(l.price)}</div>
                  {l.wasPrice && l.wasPrice > l.price && <div className="was">{money(l.wasPrice)}</div>}
                  {l.shippingCost === 0 && <div className="ship free">Free shipping</div>}
                  {typeof l.shippingCost === 'number' && l.shippingCost > 0 && <div className="ship">+ {money(l.shippingCost)} ship</div>}
                </td>
                <td className="device-cell">
                  <div className="device" title={l.title}>
                    {l.device}
                  </div>
                  <div className="attrs">
                    {l.attributes.capacity && <span className="chip">{l.attributes.capacity}</span>}
                    {l.attributes.size && <span className="chip">{l.attributes.size}</span>}
                    {l.attributes.color && <span className="chip">{l.attributes.color}</span>}
                    {l.attributes.carrier && <span className="chip">{l.attributes.carrier}</span>}
                    <span className={`chip cond-${l.condition}`}>{l.condition}</span>
                  </div>
                </td>
                <td className="mono">{l.modelNumber ?? <span className="muted">—</span>}</td>
                <td>{l.manufacturer ?? <span className="muted">—</span>}</td>
                <td className="seller-cell">
                  <a href={l.url} target="_blank" rel="noopener noreferrer nofollow">
                    {l.seller}
                  </a>
                  <div className="muted small">{l.sellerSite}</div>
                </td>
                <td className="notes-cell">
                  {l.pricingNotes.length ? (
                    <ul className="notes">
                      {l.pricingNotes.map((n) => (
                        <li key={n} className={`chip note ${PROMO_NOTES.has(n) ? 'note-promo' : ''}`}>
                          {n}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              </tr>
            ))}
            {!visible.length && (
              <tr>
                <td colSpan={6} className="empty">
                  {listings.length ? 'No offers match the column filters.' : 'No offers found.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
