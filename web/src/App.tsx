import type { SearchResponse, SourceInfo } from '@compshopper/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchSources, paramsToQuery, queryToParams, runSearch } from './api';
import { ResultsTable } from './components/ResultsTable';
import { EMPTY_FORM, SearchForm, formToQuery, queryToForm, type FormState } from './components/SearchForm';
import { SourceStatusBar } from './components/SourceStatusBar';

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function App() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [sources, setSources] = useState<SourceInfo[]>([]);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const initialised = useRef(false);

  const doSearch = useCallback(async (f: FormState, refresh = false) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    const query = formToQuery(f, refresh);
    history.replaceState(null, '', `?${queryToParams(query).toString()}`);
    try {
      const res = await runSearch(query, controller.signal);
      if (!controller.signal.aborted) setResult(res);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSources().then(setSources).catch(() => setSources([]));
    if (initialised.current) return;
    initialised.current = true;
    const fromUrl = paramsToQuery(new URLSearchParams(location.search));
    if (fromUrl) {
      const f = queryToForm(fromUrl);
      setForm(f);
      void doSearch(f);
    }
  }, [doSearch]);

  const blockedCount = result?.sources.filter((s) => s.status === 'blocked' || s.status === 'error' || s.status === 'timeout').length ?? 0;
  const hasSample = result?.listings.some((l) => l.source === 'sample') ?? false;

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>CompShopper</h1>
          <p className="tagline">Live price comparison for consumer electronics: phones, watches, PC parts and more.</p>
        </div>
      </header>

      <main>
        <SearchForm
          form={form}
          sources={sources}
          loading={loading}
          onChange={setForm}
          onSubmit={() => void doSearch(form)}
          onReset={() => {
            setForm(EMPTY_FORM);
            setResult(null);
            setError(null);
            history.replaceState(null, '', location.pathname);
          }}
        />

        {error && (
          <div className="banner error" role="alert">
            {error}
          </div>
        )}

        {loading && !result && <div className="banner">Contacting retailers… this usually takes a few seconds.</div>}

        {result && (
          <>
            <div className="freshness">
              <span>
                Searched retailers for <strong>“{result.searchText}”</strong>. Prices fetched at {fmtTime(result.fetchedAt)}
                {result.cached ? ' (cached; hit Refresh for live prices)' : ' (live)'} in {(result.durationMs / 1000).toFixed(1)}s.
              </span>
              <button type="button" onClick={() => void doSearch(form, true)} disabled={loading}>
                {loading ? 'Refreshing…' : 'Refresh prices'}
              </button>
            </div>
            <SourceStatusBar sources={result.sources} />
            {blockedCount > 0 && (
              <div className="banner warn">
                {blockedCount} retailer{blockedCount === 1 ? '' : 's'} could not be read this time (blocked, timed out, or errored). Hover a retailer above for details; see the README for API keys and proxy options that improve reliability.
              </div>
            )}
            {hasSample && <div className="banner warn">Sample data mode is on: listings marked [SAMPLE] are fabricated for testing and link to example.com.</div>}
            <ResultsTable listings={result.listings} />
          </>
        )}
      </main>

      <footer className="app-footer">
        Prices are read live from each retailer at search time and may change without notice. Always confirm the final price on the seller's site.
      </footer>
    </div>
  );
}
