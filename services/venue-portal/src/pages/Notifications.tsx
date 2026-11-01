import { useState } from 'react';
import { formatDateTime } from '../lib/format';
import { api, attr, type Resource } from '../lib/api';
import { DataTable, statusColumn } from '../components/CrudPage';
import { EmptyState, ErrorState, Modal, PageHeader, Spinner } from '../components/ui';
import { useList } from '../lib/hooks';

export function NotificationsPage() {
  const { rows, error, reload } = useList('/notifications');
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
          columns={[
            { key: 'title', label: 'Title', render: (r) => attr(r, 'title') || attr(r, 'subject') || '—' },
            { key: 'kind', label: 'Type', render: (r) => attr(r, 'kind') || attr(r, 'type') || '—' },
            { key: 'created_at', label: 'Received', render: (r) => formatDateTime(attr(r, 'created_at')) },
            statusColumn(),
          ]}
          rows={rows}
          actions={(r) => (
            <button
              onClick={() => open(r)}
              className="rounded px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
            >
              View
            </button>
          )}
        />
      )}
      {selected && (
        <Modal title={attr(selected, 'title') || 'Notification'} onClose={() => setSelected(null)}>
          {detail === null ? (
            <Spinner />
          ) : (
            <div className="space-y-3 text-sm text-slate-700">
              <p className="whitespace-pre-wrap">{attr(detail, 'body') || attr(detail, 'message') || '(no content)'}</p>
              <p className="text-xs text-slate-400">{formatDateTime(attr(detail, 'created_at'))}</p>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
