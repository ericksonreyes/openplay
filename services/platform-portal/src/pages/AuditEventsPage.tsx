import { useState } from 'react';
import { apiFetch, attr, type Resource } from '../lib/api';
import { DataTable, type ColumnDef } from '../components/DataTable';
import { ErrorState, PageHeader } from '../components/ui';

const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

const columns: ColumnDef[] = [
  {
    key: 'occurred_at',
    label: 'When',
    render: (r) => fmt(attr(r, 'occurred_at')),
  },
  {
    key: 'event_type',
    label: 'Event',
    render: (r) => <span className="font-medium text-slate-800">{attr(r, 'event_type')}</span>,
  },
  { key: 'stream_type', label: 'Stream' },
  { key: 'actor_kind', label: 'Actor' },
  {
    key: 'tenant_id',
    label: 'Tenant',
    render: (r) => attr(r, 'tenant_id') || '—',
  },
  {
    key: 'payload',
    label: 'Detail',
    sortable: false,
    render: (r) => (
      <code className="text-xs">{JSON.stringify(r.attributes.payload ?? {}).slice(0, 80)}</code>
    ),
  },
];

/** Cross-tenant audit trail — the API requires an explicit purpose, recorded
 *  in the audit stream itself (AUDIT_LOGGING spec). */
export function AuditEventsPage() {
  const [purpose, setPurpose] = useState('');
  const [streamType, setStreamType] = useState('');
  const [events, setEvents] = useState<Resource[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    if (!purpose.trim()) return;
    setBusy(true);
    setError(null);
    const qs = new URLSearchParams({ purpose: purpose.trim() });
    if (streamType) qs.set('stream_type', streamType);
    apiFetch<Resource[]>(`/platform/audit-events?${qs}`)
      .then(setEvents)
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  };

  const inputCls =
    'rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none';

  return (
    <div>
      <PageHeader
        title="Audit events"
        description="Cross-tenant audit trail. Every read requires a purpose — it's logged as part of the audit record itself."
      />
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="Purpose (required, e.g. investigation #42)"
          aria-label="Audit purpose"
          className={`${inputCls} w-72`}
        />
        <select
          value={streamType}
          onChange={(e) => setStreamType(e.target.value)}
          aria-label="Filter by stream"
          className={inputCls}
        >
          <option value="">All streams</option>
          {['tenant', 'reservation', 'payment', 'user', 'audit_read', 'notification', 'membership'].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <button
          onClick={load}
          disabled={busy || !purpose.trim()}
          className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy ? 'Loading…' : 'Search'}
        </button>
      </div>

      {error && <ErrorState message={error} onRetry={() => setError(null)} actionLabel="Dismiss" />}

      {events !== null && <DataTable columns={columns} rows={events} dateKey="occurred_at" />}
    </div>
  );
}
