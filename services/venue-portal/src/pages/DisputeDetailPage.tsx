import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, attr, type Resource } from '../lib/api';
import { formatDateTime, formatMoney } from '../lib/format';
import { EmptyState, ErrorState, PageHeader, Spinner, StatusBadge } from '../components/ui';

export function DisputeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [dispute, setDispute] = useState<Resource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    if (!id) return;
    api.get(`/disputes/${id}`).then(setDispute).catch((e: Error) => setError(e.message));
  };
  useEffect(load, [id]);

  if (error) return <ErrorState message={error} />;
  if (!dispute) return <Spinner />;

  const messages = (dispute.attributes?.messages as Resource[] | undefined) ?? [];
  const status = attr(dispute, 'status');
  const open = ['open', 'under_review', 'escalated'].includes(status);

  const act = async (path: string, body?: Record<string, unknown>) => {
    setBusy(true);
    try {
      await api.action(`/disputes/${id}/${path}`, body);
      setResponse('');
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title={attr(dispute, 'reference_no') || attr(dispute, 'reference') || 'Dispute'} description="Dispute details, message thread, and resolution actions.">
        <Link to="/disputes" className="text-sm text-indigo-600 hover:underline">← All disputes</Link>
      </PageHeader>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <dl className="divide-y divide-slate-100">
            {[
              ['Status', <StatusBadge key="s" status={status} />],
              ['Reason', attr(dispute, 'reason') || attr(dispute, 'category') || '—'],
              ['Subject', attr(dispute, 'subject_type') ? `${attr(dispute, 'subject_type')} · ${attr(dispute, 'subject_id') ?? '—'}` : '—'],
              ['Amount', attr(dispute, 'amount_cents') != null ? formatMoney(attr(dispute, 'amount_cents'), attr(dispute, 'currency')) : '—'],
              ['Opened', formatDateTime(attr(dispute, 'opened_at') || attr(dispute, 'created_at'))],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between gap-4 px-1 py-2 text-sm">
                <dt className="shrink-0 text-slate-500">{k}</dt>
                <dd className="text-right text-slate-800">{v}</dd>
              </div>
            ))}
          </dl>
          {open && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <textarea
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                placeholder="Response to the customer…"
                className="mb-2 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                rows={3}
              />
              <div className="flex gap-2">
                <button disabled={busy || !response.trim()} onClick={() => act('respond', { body: response })}
                  className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                  Respond
                </button>
                <button disabled={busy} onClick={() => act('resolve')}
                  className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                  Resolve
                </button>
                <button disabled={busy} onClick={() => act('escalate')}
                  className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50">
                  Escalate
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white">
          <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">Thread</h2>
          {messages.length === 0 ? (
            <EmptyState message="No messages yet." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {messages.map((m, i) => (
                <li key={m.id ?? i} className="px-4 py-3 text-sm">
                  <p className="text-slate-800">{attr(m, 'body') || attr(m, 'message') || '—'}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {attr(m, 'author_name') || attr(m, 'author') || ''} · {formatDateTime(attr(m, 'created_at'))}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
