import { Link } from 'react-router-dom';
import { formatDateTime, formatMoney } from '../lib/format';
import { api, attr, newIdempotencyKey } from '../lib/api';
import { CrudPage, DataTable, ResourceForm, statusColumn } from '../components/CrudPage';
import { EmptyState, ErrorState, Modal, PageHeader, Spinner } from '../components/ui';
import { useList } from '../lib/hooks';
import { useState } from 'react';
import type { Resource } from '../lib/api';

export function MembershipPlansPage() {
  return (
    <CrudPage
      title="Membership plans"
      path="/membership-plans"
      type="membership-plans"
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'price', label: 'Price', render: (r) => formatMoney(attr(r, 'price_cents') || attr(r, 'price'), attr(r, 'currency')) },
                { key: 'duration_days', label: 'Duration (days)' },
        statusColumn(),
      ]}
      fields={[
        { name: 'name', label: 'Name', required: true },
        { name: 'description', label: 'Description', type: 'textarea' },
        { name: 'price', label: 'Price', type: 'number', required: true },
        { name: 'currency', label: 'Currency', placeholder: 'PHP' },
        { name: 'duration_days', label: 'Duration (days)', type: 'number', required: true },
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { value: 'active', label: 'Active' },
            { value: 'draft', label: 'Draft' },
            { value: 'retired', label: 'Retired' },
          ],
        },
      ]}
      emptyMessage="No membership plans yet."
    />
  );
}

export function PaymentsPage() {
  const { rows, error, reload } = useList('/payments');
  const [refunding, setRefunding] = useState<Resource | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function refund(attrs: Record<string, unknown>) {
    if (!refunding) return;
    setBusy(true);
    try {
      await api.action(`/payments/${refunding.id}/refund`, attrs, 'refunds', newIdempotencyKey());
      setRefunding(null);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="Payments"
        description="Every payment recorded against bookings, memberships, and rentals." />
      {(error || actionError) && <div className="mb-4"><ErrorState message={error ?? actionError ?? ''} onRetry={reload} /></div>}
      {rows === null ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState message="No payments recorded." />
      ) : (
        <DataTable
          columns={[
            { key: 'reference_no', label: 'Reference', render: (r) => attr(r, 'reference_no') || attr(r, 'reference') || '—' },
            { key: 'amount', label: 'Amount', render: (r) => formatMoney(attr(r, 'amount_cents') || attr(r, 'amount'), attr(r, 'currency')) },
                        { key: 'method', label: 'Method', render: (r) => attr(r, 'method') || attr(r, 'provider') || '—' },
            { key: 'created_at', label: 'Created', render: (r) => formatDateTime(attr(r, 'created_at')) },
            statusColumn(),
          ]}
          rows={rows}
          actions={(r) =>
            ['paid', 'completed', 'succeeded'].includes(attr(r, 'status')) ? (
              <button
                onClick={() => {
                  setActionError(null);
                  setRefunding(r);
                }}
                className="rounded px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
              >
                Refund
              </button>
            ) : null
          }
        />
      )}
      {refunding && (
        <Modal title={`Refund payment ${refunding.id.slice(0, 8)}`} onClose={() => setRefunding(null)}>
          <ResourceForm
            fields={[
              { name: 'amount', label: 'Amount (blank = full)', type: 'number' },
              { name: 'reason', label: 'Reason', type: 'textarea', required: true },
            ]}
            submitLabel="Issue refund"
            busy={busy}
            onCancel={() => setRefunding(null)}
            onSubmit={async (attrs) => {
              try {
                await refund(attrs);
              } catch (err) {
                setActionError(err instanceof Error ? err.message : 'Refund failed.');
                throw err;
              }
            }}
          />
        </Modal>
      )}
    </div>
  );
}

export function DisputesPage() {
  const { rows, error, reload } = useList('/disputes');
  const [responding, setResponding] = useState<Resource | null>(null);
  const [resolving, setResolving] = useState<Resource | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function submit(path: string, attrs: Record<string, unknown>, type: string) {
    setBusy(true);
    try {
      await api.action(path, attrs, type);
      setResponding(null);
      setResolving(null);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="Disputes"
        description="Payment disputes and complaints opened by customers; respond and resolve here." />
      {(error || actionError) && <div className="mb-4"><ErrorState message={error ?? actionError ?? ''} onRetry={reload} /></div>}
      {rows === null ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState message="No open disputes." />
      ) : (
        <DataTable
          columns={[
            { key: 'reference_no', label: 'Reference', render: (r) => { const v = attr(r, 'reference_no') || attr(r, 'reference') || '—'; return <Link to={`/disputes/${r.id}`} className="font-medium text-indigo-600 hover:underline">{v}</Link>; } },
            { key: 'reason', label: 'Reason', render: (r) => attr(r, 'reason') || attr(r, 'category') || '—' },
            { key: 'amount', label: 'Amount', render: (r) => formatMoney(attr(r, 'amount_cents') || attr(r, 'amount'), attr(r, 'currency')) },
            { key: 'opened_at', label: 'Opened', render: (r) => formatDateTime(attr(r, 'opened_at') || attr(r, 'created_at')) },
            statusColumn(),
          ]}
          rows={rows}
          actions={(r) => (
            <div className="flex justify-end gap-1.5">
              <button
                onClick={() => setResponding(r)}
                className="rounded px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
              >
                Respond
              </button>
              {attr(r, 'status') !== 'resolved' && (
                <button
                  onClick={() => setResolving(r)}
                  className="rounded px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50"
                >
                  Resolve
                </button>
              )}
            </div>
          )}
        />
      )}
      {responding && (
        <Modal title="Respond to dispute" onClose={() => setResponding(null)}>
          <ResourceForm
            fields={[{ name: 'response', label: 'Response', type: 'textarea', required: true }]}
            submitLabel="Send response"
            busy={busy}
            onCancel={() => setResponding(null)}
            onSubmit={async (attrs) => {
              try {
                await submit(`/disputes/${responding.id}/respond`, attrs, 'dispute-responses');
              } catch (err) {
                setActionError(err instanceof Error ? err.message : 'Failed.');
                throw err;
              }
            }}
          />
        </Modal>
      )}
      {resolving && (
        <Modal title="Resolve dispute" onClose={() => setResolving(null)}>
          <ResourceForm
            fields={[
              {
                name: 'resolution',
                label: 'Resolution',
                type: 'select',
                required: true,
                options: [
                  { value: 'accepted', label: 'Accept dispute (refund)' },
                  { value: 'rejected', label: 'Reject dispute' },
                  { value: 'resolved', label: 'Resolved' },
                ],
              },
              { name: 'note', label: 'Note', type: 'textarea' },
            ]}
            submitLabel="Resolve"
            busy={busy}
            onCancel={() => setResolving(null)}
            onSubmit={async (attrs) => {
              try {
                await submit(`/disputes/${resolving.id}/resolve`, attrs, 'dispute-resolutions');
              } catch (err) {
                setActionError(err instanceof Error ? err.message : 'Failed.');
                throw err;
              }
            }}
          />
        </Modal>
      )}
    </div>
  );
}
