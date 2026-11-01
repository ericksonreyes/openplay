import { Link } from 'react-router-dom';
import { useState } from 'react';
import { api, attr, newIdempotencyKey, type Resource } from '../lib/api';
import { CrudPage, DataTable, ResourceForm, statusColumn } from '../components/CrudPage';
import { EmptyState, ErrorState, Modal, PageHeader, Spinner } from '../components/ui';
import { formatDateTime } from '../lib/format';
import { useList } from '../lib/hooks';

function useOptions(path: string) {
  const { rows } = useList(path);
  return (rows ?? []).map((r) => ({ value: r.id, label: attr(r, 'name') || r.id }));
}

export function EquipmentPage() {
  const venues = useOptions('/venues');
  return (
    <CrudPage
      title="Equipment"
        description="Rentable gear inventory per venue: quantities, prices, and condition."
      path="/equipment"
      type="equipment"
      columns={[
        {
          key: 'name',
          label: 'Name',
          render: (r) => (
            <Link to={`/equipment/${r.id}`} className="font-medium text-indigo-600 hover:underline">
              {attr(r, 'name') || '—'}
            </Link>
          ),
        },
        { key: 'sku', label: 'SKU' },
        { key: 'quantity', label: 'Quantity', render: (r) => attr(r, 'quantity') || attr(r, 'stock') || '—' },
        { key: 'rental_price', label: 'Rental price' },
        {
          key: 'venue_id',
          label: 'Venue',
          render: (r) => venues.find((v) => v.value === attr(r, 'venue_id'))?.label ?? (attr(r, 'venue_id') || '—'),
        },
        statusColumn(),
      ]}
      fields={[
        { name: 'name', label: 'Name', required: true },
        { name: 'sku', label: 'SKU' },
        { name: 'venue_id', label: 'Venue', type: 'select', required: true, options: venues },
        { name: 'quantity', help: 'Total units available to rent at this venue.', label: 'Quantity', type: 'number', required: true },
        { name: 'rental_price', label: 'Rental price', type: 'number' },
      ]}
      emptyMessage="No equipment in inventory."
    />
  );
}

export function RentalsPage() {
  const { rows, error, reload } = useList('/rentals');
  const equipment = useOptions('/equipment');
  const [checkingOut, setCheckingOut] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function markReturned(r: Resource) {
    setActionError(null);
    try {
      await api.action(`/rentals/${r.id}/return`);
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Return failed.');
    }
  }

  return (
    <div>
      <PageHeader title="Rentals"
        description="Equipment check-outs and returns tied to reservations and walk-ins.">
        <button
          onClick={() => setCheckingOut(true)}
          className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Check out equipment
        </button>
      </PageHeader>
      {(error || actionError) && <div className="mb-4"><ErrorState message={error ?? actionError ?? ''} onRetry={reload} /></div>}
      {rows === null ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState message="No rentals." />
      ) : (
        <DataTable
          columns={[
            {
              key: 'equipment_id',
              label: 'Equipment',
              render: (r) => equipment.find((e) => e.value === attr(r, 'equipment_id'))?.label ?? '—',
            },
            { key: 'renter', label: 'Renter', render: (r) => attr(r, 'renter_name') || attr(r, 'customer_name') || '—' },
            { key: 'checked_out_at', label: 'Checked out', render: (r) => formatDateTime(attr(r, 'checked_out_at')) },
            { key: 'returned_at', label: 'Returned', render: (r) => (attr(r, 'returned_at') ? formatDateTime(attr(r, 'returned_at')) : '—') },
            statusColumn(),
          ]}
          rows={rows}
          actions={(r) =>
            ['checked_out', 'overdue'].includes(attr(r, 'status')) ? (
              <button
                onClick={() => markReturned(r)}
                className="rounded px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50"
              >
                Mark returned
              </button>
            ) : null
          }
        />
      )}
      {checkingOut && (
        <Modal title="Check out equipment" onClose={() => setCheckingOut(false)}>
          <ResourceForm
            fields={[
              { name: 'equipment_id', label: 'Equipment', type: 'select', required: true, options: equipment },
              { name: 'renter_name', label: 'Renter name', required: true },
              { name: 'quantity', label: 'Quantity', type: 'number' },
              { name: 'due_at', label: 'Due back at', type: 'datetime-local' },
            ]}
            submitLabel="Check out"
            busy={busy}
            onCancel={() => setCheckingOut(false)}
            onSubmit={async (attrs) => {
              setBusy(true);
              try {
                await api.create('/rentals', 'rentals', attrs, newIdempotencyKey());
                setCheckingOut(false);
                await reload();
              } finally {
                setBusy(false);
              }
            }}
          />
        </Modal>
      )}
    </div>
  );
}
