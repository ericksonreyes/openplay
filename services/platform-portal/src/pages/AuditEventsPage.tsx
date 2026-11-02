import { useState } from 'react';
import { apiFetch } from '../lib/api';

interface AuditEvent {
  id: string;
  attributes: {
    tenant_id: string | null;
    stream_type: string;
    event_type: string;
    actor_kind: string;
    payload: Record<string, unknown>;
    occurred_at: string;
  };
}

const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** Cross-tenant audit trail — the API requires an explicit purpose, recorded
 *  in the audit stream itself (AUDIT_LOGGING spec). */
export function AuditEventsPage() {
  const [purpose, setPurpose] = useState('');
  const [streamType, setStreamType] = useState('');
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    if (!purpose.trim()) return;
    setBusy(true);
    setError(null);
    const qs = new URLSearchParams({ purpose: purpose.trim() });
    if (streamType) qs.set('stream_type', streamType);
    apiFetch<AuditEvent[]>(`/platform/audit-events?${qs}`)
      .then(setEvents)
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  };

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Audit events</h1>
      <p className="mt-1 max-w-prose text-sm text-slate-500">
        Cross-tenant audit trail. Every read requires a purpose — it's logged as part of the audit record itself.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="Purpose (required, e.g. investigation #42)"
          className="w-72 rounded border border-slate-300 px-3 py-1.5 text-sm"
        />
        <select
          value={streamType}
          onChange={(e) => setStreamType(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
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

      {error && (
        <p role="alert" className="mt-4 flex items-center justify-between rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-4 text-xs font-medium underline">Dismiss</button>
        </p>
      )}

      {events !== null && (
        events.length === 0 ? (
          <p className="mt-6 text-sm text-slate-500">No events match.</p>
        ) : (
          <>
            <div className="mt-4 hidden overflow-x-auto rounded-lg border border-slate-200 bg-white md:block">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium text-slate-600">When</th>
                    <th className="px-5 py-3 text-left font-medium text-slate-600">Event</th>
                    <th className="px-5 py-3 text-left font-medium text-slate-600">Stream</th>
                    <th className="px-5 py-3 text-left font-medium text-slate-600">Actor</th>
                    <th className="px-5 py-3 text-left font-medium text-slate-600">Tenant</th>
                    <th className="px-5 py-3 text-left font-medium text-slate-600">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {events.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 text-slate-600">{fmt(e.attributes.occurred_at)}</td>
                      <td className="px-5 py-3 font-medium text-slate-800">{e.attributes.event_type}</td>
                      <td className="px-5 py-3 text-slate-600">{e.attributes.stream_type}</td>
                      <td className="px-5 py-3 text-slate-600">{e.attributes.actor_kind}</td>
                      <td className="px-5 py-3 text-slate-600">{e.attributes.tenant_id ?? '—'}</td>
                      <td className="px-5 py-3 text-slate-600">
                        <code className="text-xs">{JSON.stringify(e.attributes.payload).slice(0, 80)}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="mt-4 space-y-3 md:hidden">
              {events.map((e) => (
                <li key={e.id} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-800">{e.attributes.event_type}</span>
                    <span className="text-xs text-slate-500">{fmt(e.attributes.occurred_at)}</span>
                  </div>
                  <dl className="mt-2 divide-y divide-slate-100 text-sm">
                    <div className="flex justify-between py-1.5"><dt className="text-slate-500">Stream</dt><dd className="text-slate-800">{e.attributes.stream_type}</dd></div>
                    <div className="flex justify-between py-1.5"><dt className="text-slate-500">Actor</dt><dd className="text-slate-800">{e.attributes.actor_kind}</dd></div>
                    <div className="flex justify-between py-1.5"><dt className="text-slate-500">Tenant</dt><dd className="text-slate-800">{e.attributes.tenant_id ?? '—'}</dd></div>
                  </dl>
                </li>
              ))}
            </ul>
          </>
        )
      )}
    </div>
  );
}
