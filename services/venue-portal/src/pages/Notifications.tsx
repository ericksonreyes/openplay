import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDateTime } from '../lib/format';
import { api, attr, type Resource } from '../lib/api';
import { DataTable, statusColumn } from '../components/CrudPage';
import { EmptyState, ErrorState, Modal, PageHeader, Spinner } from '../components/ui';
import { useServerTable } from '../lib/hooks';

/** Human-readable title from the notification kind or payload. */
function notificationTitle(r: Resource): string {
  const payload = r.attributes?.payload as Record<string, unknown> | undefined;
  if (typeof payload?.title === 'string' && payload.title) return payload.title;
  const kind = attr(r, 'kind');
  if (!kind) return 'Notification';
  return kind
    .split('.')
    .map((s) => s.replace(/_/g, ' '))
    .join(' · ')
    .replace(/^./, (c) => c.toUpperCase());
}

export function NotificationsPage() {
  const { rows, error, reload, server } = useServerTable('/notifications');
  const [selected, setSelected] = useState<Resource | null>(null);
  const [detail, setDetail] = useState<Resource | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function open(r: Resource) {
    setSelected(r);
    setDetail(null);
    setActionError(null);
    try {
      setDetail(await api.get(`/notifications/${r.id}`));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to load notification.');
    }
  }

  return (
    <div>
      <PageHeader title="Notifications"
        description="Messages the system sends to staff and customers: reminders, updates, alerts." />
      {(error || actionError) && <div className="mb-4"><ErrorState message={error ?? actionError ?? ''} onRetry={reload} /></div>}
      {rows === null ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState message="No notifications." />
      ) : (
        <DataTable
          server={server}
          columns={[
            {
              key: 'title',
              label: 'Title',
              render: (r) => (
                <Link to={`/notifications/${r.id}`} className="text-indigo-600 hover:underline">
                  {notificationTitle(r)}
                </Link>
              ),
              sortValue: (r) => notificationTitle(r),
            },
            { key: 'kind', label: 'Type', render: (r) => attr(r, 'kind') || attr(r, 'type') || '—' },
            { key: 'created_at', label: 'Received', render: (r) => formatDateTime(attr(r, 'created_at')) },
            statusColumn(),
          ]}
          rows={rows}
          actions={(r) => (
            <button
              onClick={() => open(r)}
              className="rounded border border-indigo-300 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
            >
              View
            </button>
          )}
        />
      )}
      {selected && (
        <Modal title={notificationTitle(selected)} onClose={() => setSelected(null)}>
          {detail === null ? (
            <Spinner />
          ) : (
            <div className="space-y-3 text-sm text-slate-700">
              <dl className="space-y-1.5">
                {[
                  ['Channel', attr(detail, 'channel')],
                  ['Recipient', attr(detail, 'recipient_address') || attr(detail, 'recipient_user_id') || '—'],
                  ['Sent at', attr(detail, 'sent_at') ? formatDateTime(attr(detail, 'sent_at')) : '—'],
                  ['Error', attr(detail, 'error')],
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-3">
                    <dt className="w-24 shrink-0 text-slate-500">{k}</dt>
                    <dd>{v || '—'}</dd>
                  </div>
                ))}
              </dl>
              {(detail.attributes?.payload as Record<string, unknown> | undefined) && (
                <pre className="overflow-auto rounded bg-slate-50 p-3 text-xs">
                  {JSON.stringify(detail.attributes!.payload, null, 2)}
                </pre>
              )}
              <p className="text-xs text-slate-400">{formatDateTime(attr(detail, 'created_at'))}</p>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
