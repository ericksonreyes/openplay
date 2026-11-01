import { Link } from 'react-router-dom';
import { useState } from 'react';
import { formatDateTime } from '../lib/format';
import { api, attr, type Resource } from '../lib/api';
import { DataTable, statusColumn } from '../components/CrudPage';
import { EmptyState, ErrorState, PageHeader, Spinner } from '../components/ui';
import { useList, today } from '../lib/hooks';

export function CheckInsPage() {
  const [date, setDate] = useState(today());
  const { rows: reservations, error, reload } = useList('/reservations', {
    'filter[date]': date,
    'filter[status]': 'approved,confirmed',
  });
  const { rows: checkIns, reload: reloadCheckIns } = useList('/check-ins');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const checkedInReservationIds = new Set(
    (checkIns ?? []).map((c: Resource) => attr(c, 'reservation_id')).filter(Boolean),
  );

  async function checkIn(r: Resource) {
    setBusyId(r.id);
    setActionError(null);
    try {
      await api.create('/check-ins', 'check-ins', { reservation_id: r.id });
      await reloadCheckIns();
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Check-in failed.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader title="Check-in desk"
        description="Today's arrivals. Check customers in as they arrive for their reservations.">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          aria-label="Date"
        />
      </PageHeader>
      {(error || actionError) && <div className="mb-4"><ErrorState message={error ?? actionError ?? ''} onRetry={reload} /></div>}
      {reservations === null ? (
        <Spinner />
      ) : reservations.length === 0 ? (
        <EmptyState message="No checkable reservations for this date." />
      ) : (
        <DataTable
          columns={[
            {
              key: 'customer_name',
              label: 'Customer',
              render: (r) => (
                <Link to={`/reservations/${r.id}`} className="font-medium text-indigo-600 hover:underline">
                  {attr(r, 'customer_name') || attr(r, 'player_name') || '—'}
                </Link>
              ),
            },
            {
              key: 'resource_name',
              label: 'Resource',
              render: (r) =>
                attr(r, 'resource_id') ? (
                  <Link to={`/catalog/resources/${attr(r, 'resource_id')}`} className="text-indigo-600 hover:underline">
                    {attr(r, 'resource_name') || '—'}
                  </Link>
                ) : (
                  '—'
                ),
            },
            { key: 'starts_at', label: 'Starts', render: (r) => formatDateTime(attr(r, 'starts_at')) },
            statusColumn(),
            {
              key: 'checked_in',
              label: 'Attendance',
              render: (r) => (checkedInReservationIds.has(r.id) ? 'Checked in' : 'Waiting'),
            },
          ]}
          rows={reservations}
          actions={(r) =>
            checkedInReservationIds.has(r.id) ? null : (
              <button
                onClick={() => checkIn(r)}
                disabled={busyId === r.id}
                className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {busyId === r.id ? 'Checking in…' : 'Check in'}
              </button>
            )
          }
        />
      )}
    </div>
  );
}
