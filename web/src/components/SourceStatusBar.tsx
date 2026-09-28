import type { SourceStatus } from '@compshopper/shared';

const LABELS: Record<SourceStatus['status'], string> = {
  ok: 'OK',
  'no-results': 'No matches',
  blocked: 'Blocked',
  error: 'Error',
  timeout: 'Timed out',
  disabled: 'Off',
};

export function SourceStatusBar({ sources }: { sources: SourceStatus[] }) {
  return (
    <ul className="source-status" aria-label="Retailer status">
      {sources.map((s) => (
        <li key={s.source} className={`status status-${s.status}`} title={s.message ?? `${s.rawCount} parsed, ${s.count} matched in ${s.durationMs}ms`}>
          <span className="dot" aria-hidden="true" />
          <span className="status-label">{s.label}</span>
          <span className="status-detail">
            {s.status === 'ok' ? `${s.count} offer${s.count === 1 ? '' : 's'}` : LABELS[s.status]}
          </span>
        </li>
      ))}
    </ul>
  );
}
