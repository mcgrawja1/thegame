import { CATEGORIES, getCategory, type SearchQuery, type SourceId, type SourceInfo } from '@compshopper/shared';
import { useMemo } from 'react';

export interface FormState {
  category: string;
  manufacturer: string;
  modelNumber: string;
  keywords: string;
  condition: NonNullable<SearchQuery['condition']>;
  minPrice: string;
  maxPrice: string;
  attributes: Record<string, string>;
  sources: SourceId[];
}

export const EMPTY_FORM: FormState = {
  category: 'smartphone',
  manufacturer: '',
  modelNumber: '',
  keywords: '',
  condition: 'any',
  minPrice: '',
  maxPrice: '',
  attributes: {},
  sources: [],
};

export function formToQuery(f: FormState, refresh = false): SearchQuery {
  const attributes = Object.fromEntries(Object.entries(f.attributes).filter(([, v]) => v.trim()));
  return {
    category: f.category,
    manufacturer: f.manufacturer.trim() || undefined,
    modelNumber: f.modelNumber.trim() || undefined,
    keywords: f.keywords.trim() || undefined,
    condition: f.condition,
    minPrice: f.minPrice ? Number(f.minPrice) : undefined,
    maxPrice: f.maxPrice ? Number(f.maxPrice) : undefined,
    attributes,
    sources: f.sources.length ? f.sources : undefined,
    refresh: refresh || undefined,
  };
}

export function queryToForm(q: SearchQuery): FormState {
  return {
    category: q.category || 'smartphone',
    manufacturer: q.manufacturer ?? '',
    modelNumber: q.modelNumber ?? '',
    keywords: q.keywords ?? '',
    condition: q.condition ?? 'any',
    minPrice: q.minPrice !== undefined ? String(q.minPrice) : '',
    maxPrice: q.maxPrice !== undefined ? String(q.maxPrice) : '',
    attributes: { ...(q.attributes ?? {}) },
    sources: q.sources ?? [],
  };
}

interface Props {
  form: FormState;
  sources: SourceInfo[];
  loading: boolean;
  onChange: (next: FormState) => void;
  onSubmit: () => void;
  onReset: () => void;
}

export function SearchForm({ form, sources, loading, onChange, onSubmit, onReset }: Props) {
  const category = useMemo(() => getCategory(form.category), [form.category]);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => onChange({ ...form, [key]: value });
  const setAttr = (key: string, value: string) => onChange({ ...form, attributes: { ...form.attributes, [key]: value } });

  const toggleSource = (id: SourceId) => {
    const enabledIds = sources.filter((s) => s.enabled).map((s) => s.id);
    const current = form.sources.length ? form.sources : enabledIds;
    const next = current.includes(id) ? current.filter((s) => s !== id) : [...current, id];
    // Empty selection means "all enabled", so store [] when everything is ticked.
    set('sources', next.length === enabledIds.length && enabledIds.every((s) => next.includes(s)) ? [] : next);
  };
  const sourceChecked = (id: SourceId) => (form.sources.length ? form.sources.includes(id) : true);

  return (
    <form
      className="search-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="form-grid">
        <label className="field">
          <span>Item category</span>
          <select
            value={form.category}
            onChange={(e) => onChange({ ...form, category: e.target.value, attributes: {} })}
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Manufacturer</span>
          <input
            list="manufacturer-suggestions"
            value={form.manufacturer}
            placeholder="Any manufacturer"
            onChange={(e) => set('manufacturer', e.target.value)}
          />
          <datalist id="manufacturer-suggestions">
            {category.manufacturers.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>

        <label className="field">
          <span>Model / model number</span>
          <input
            value={form.modelNumber}
            placeholder="e.g. iPhone 16 Pro, SM-S938U, RTX 5070"
            onChange={(e) => set('modelNumber', e.target.value)}
          />
        </label>

        {category.fields.map((f) => (
          <label className="field" key={f.key}>
            <span>{f.label}</span>
            {f.type === 'select' ? (
              <select value={form.attributes[f.key] ?? ''} onChange={(e) => setAttr(f.key, e.target.value)}>
                <option value="">Any</option>
                {f.options?.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <input
                  list={f.suggestions ? `suggest-${f.key}` : undefined}
                  value={form.attributes[f.key] ?? ''}
                  placeholder={f.placeholder ?? 'Any'}
                  onChange={(e) => setAttr(f.key, e.target.value)}
                />
                {f.suggestions && (
                  <datalist id={`suggest-${f.key}`}>
                    {f.suggestions.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                )}
              </>
            )}
          </label>
        ))}

        <label className="field">
          <span>Condition</span>
          <select value={form.condition} onChange={(e) => set('condition', e.target.value as FormState['condition'])}>
            <option value="any">Any</option>
            <option value="new">New</option>
            <option value="refurbished">Refurbished</option>
            <option value="open-box">Open box</option>
            <option value="used">Used</option>
          </select>
        </label>

        <label className="field">
          <span>Price range (USD)</span>
          <div className="range">
            <input type="number" min="0" inputMode="decimal" placeholder="Min" value={form.minPrice} onChange={(e) => set('minPrice', e.target.value)} />
            <span aria-hidden="true">–</span>
            <input type="number" min="0" inputMode="decimal" placeholder="Max" value={form.maxPrice} onChange={(e) => set('maxPrice', e.target.value)} />
          </div>
        </label>

        <label className="field field-wide">
          <span>Extra keywords</span>
          <input value={form.keywords} placeholder="Anything else that must appear in the listing" onChange={(e) => set('keywords', e.target.value)} />
        </label>
      </div>

      <fieldset className="sources">
        <legend>Retailers to search</legend>
        {sources.map((s) => (
          <label key={s.id} className={`source-toggle ${s.enabled ? '' : 'disabled'}`} title={s.reason ?? s.site}>
            <input type="checkbox" disabled={!s.enabled} checked={s.enabled && sourceChecked(s.id)} onChange={() => toggleSource(s.id)} />
            {s.label}
            {!s.enabled && <span className="muted"> (off)</span>}
          </label>
        ))}
      </fieldset>

      <div className="form-actions">
        <button type="submit" className="primary" disabled={loading}>
          {loading ? 'Searching…' : 'Compare prices'}
        </button>
        <button type="button" onClick={onReset} disabled={loading}>
          Clear
        </button>
        <span className="hint">Blank fields match any value.</span>
      </div>
    </form>
  );
}
