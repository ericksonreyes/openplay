import { useNavigate, useParams } from 'react-router-dom';
import { attr } from '../lib/api';
import { useServerTable } from '../lib/hooks';
import { formatDateTime } from '../lib/format';
import { DataTable } from '../components/CrudPage';
import { ErrorState, PageHeader, Spinner } from '../components/ui';

/** Compact payload summary: prefers {from,to} diffs; joins other keys. */
function payloadSummary(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '—';
  const p = payload as Record<string, unknown>;
  if ('from' in p || 'to' in p) {
    return `${p.from ?? '—'} → ${p.to ?? '—'}`;
  }
  const parts = Object.entries(p)
    .filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object')
    .slice(0, 4)
    .map(([k, v]) => `${k}: ${String(v)}`);
  return parts.length ? parts.join(' · ') : '—';
}

/** A record's audit event stream — reached via "History" links on detail pages. */
export function HistoryPage() {
  const navigate = useNavigate();
  const { streamType = '', streamId = '' } = useParams<{
    streamType: string;
    streamId: string;
  }>();
  const { rows, error, reload, server } = useServerTable(`/audit/${streamType}/${streamId}`);

  return (
    <div>
      <PageHeader
        title="Record history"
        description={`Every event recorded for this ${streamType.replace(/_/g, ' ')} (event-sourced audit stream).`}
      >
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-indigo-600 hover:underline"
        >
          Back to record
        </button>
      </PageHeader>
      {error && (
        <div className="mb-4">
          <ErrorState message={error} onRetry={reload} />
        </div>
      )}
      {rows === null ? (
        <Spinner />
      ) : (
        <DataTable
          server={server}
          columns={[
            { key: 'occurred_at', label: 'When', render: (r) => formatDateTime(attr(r, 'occurred_at')) },
            { key: 'sequence', label: 'Seq', sortValue: (r) => String(attr(r, 'sequence')).padStart(6, '0') },
            {
              key: 'event_type',
              label: 'Event',
              render: (r) => attr(r, 'event_type').replace(/_/g, ' '),
            },
            {
              key: 'actor',
              label: 'Actor',
              render: (r) => attr(r, 'actor_kind') || '—',
              sortValue: (r) => attr(r, 'actor_kind'),
            },
            {
              key: 'payload',
              label: 'Details',
              render: (r) => payloadSummary(r.attributes?.payload),
              sortValue: () => '',
            },
          ]}
          rows={rows}
          emptyMessage="No events recorded for this record yet."
        />
      )}
    </div>
  );
}
