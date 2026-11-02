import { Link } from 'react-router-dom';
import { useState } from 'react';
import { displayDay, formatDateTime } from '../lib/format';
import { api, attr, type Resource } from '../lib/api';
import { DataTable, statusColumn } from '../components/CrudPage';
import { EmptyState, ErrorState, PageHeader, Spinner } from '../components/ui';
import { addDays, TimeGrid, weekStart } from '../components/ScheduleGrid';
import { BookingModal } from '../components/BookingModal';
import { useList, usePersistedView, useServerTable, today } from '../lib/hooks';

export function CheckInsPage() {
  const [date, setDate] = useState(today());
  // Filtered only after Apply — default view is all expected check-ins (UX rule).
  const [appliedDate, setAppliedDate] = useState<string | null>(null);
  const { rows: reservations, error, reload, server } = useServerTable('/reservations', {
    'filter[date]': appliedDate ?? undefined,
    'filter[status]': 'approved,confirmed',
  });
  const { rows: checkIns, reload: reloadCheckIns } = useList('/check-ins');
  const { rows: resources } = useList('/resources');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [view, setView] = usePersistedView<'table' | 'day' | 'week'>('check-ins', 'table');
  const { rows: venues } = useList('/venues');
  const [booking, setBooking] = useState(false);
  const toBooking = () => setBooking(true);

  // Grid views: expected check-ins for a day/week window.
  const wkStart = weekStart(date);
  const { rows: gridRows } = useList(
    '/reservations',
    view === 'day'
      ? { 'filter[date]': date, 'filter[status]': 'approved,confirmed' }
      : view === 'week'
        ? { 'filter[from]': wkStart, 'filter[to]': addDays(wkStart, 6), 'filter[status]': 'approved,confirmed' }
        : undefined,
    view !== 'table',
  );
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(wkStart, i));

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
        description={appliedDate ? `Arrivals for ${appliedDate}.` : "All expected check-ins — approved and confirmed bookings."}>
        <div className="inline-flex rounded-lg border border-slate-300 bg-white p-1" role="tablist">
          {(['table', 'day', 'week'] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize ${
                view === v ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          aria-label="Filter by date"
        />
        {view === 'table' ? (
          appliedDate ? (
            <button
              onClick={() => setAppliedDate(null)}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Show all
            </button>
          ) : (
            <button
              onClick={() => setAppliedDate(date)}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Filter
            </button>
          )
        ) : (
          <>
            <button
              onClick={() => setDate((d) => addDays(d, view === 'week' ? -7 : -1))}
              className="rounded border border-slate-300 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              aria-label={view === 'week' ? 'Previous week' : 'Previous day'}
            >
              ‹
            </button>
            <button
              onClick={() => setDate((d) => addDays(d, view === 'week' ? 7 : 1))}
              className="rounded border border-slate-300 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              aria-label={view === 'week' ? 'Next week' : 'Next day'}
            >
              ›
            </button>
            <button
              onClick={() => setDate(today())}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Today
            </button>
          </>
        )}
      </PageHeader>
      {error && <div className="mb-4"><ErrorState message={error} onRetry={reload} /></div>}
      {actionError && (
        <div className="mb-4">
          <ErrorState
            message={actionError}
            actionLabel="Dismiss"
            onRetry={() => {
              setActionError(null);
              void reload();
            }}
          />
        </div>
      )}
      {view !== 'table' ? (
        gridRows === null ? (
          <Spinner />
        ) : view === 'day' ? (
          <TimeGrid
            columns={(resources ?? []).map((r) => ({ key: attr(r, 'name'), label: attr(r, 'name') }))}
            rows={gridRows}
            colOf={(r) => attr(r, 'resource_name')}
            onEmptySlot={toBooking}
            labelOf={(r) => attr(r, 'customer_name') || attr(r, 'player_name') || '—'}
          />
        ) : (
          <TimeGrid
            columns={weekDays.map((d) => ({
              key: d,
              label: new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }),
            }))}
            rows={gridRows}
            colOf={(r) => displayDay(attr(r, 'starts_at'))}
            onEmptySlot={toBooking}
            labelOf={(r) => attr(r, 'customer_name') || attr(r, 'player_name') || '—'}
          />
        )
      ) : reservations === null ? (
        <Spinner />
      ) : reservations.length === 0 ? (
        <EmptyState message={appliedDate ? "No checkable reservations for this date." : "No expected check-ins."} />
      ) : (
        <DataTable
          server={server}
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
              label: 'Facility',
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
      {booking && (
        <BookingModal
          venues={venues}
          resources={resources}
          initialMode="guest"
          onClose={() => setBooking(false)}
          onCreated={reload}
        />
      )}
    </div>
  );
}
