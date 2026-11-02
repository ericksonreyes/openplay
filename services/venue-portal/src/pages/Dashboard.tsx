import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, attr, type Resource } from '../lib/api';
import { useList, usePersistedView, today } from '../lib/hooks';
import { formatDateTime } from '../lib/format';
import { PageHeader, Spinner, StatusBadge } from '../components/ui';
import { TimeGrid } from '../components/ScheduleGrid';
import { BookingModal } from '../components/BookingModal';

function CountCard({ label, path, filterKey, filterValue }: { label: string; path: string; filterKey?: string; filterValue?: string }) {
  const { rows, error } = useList(path, filterKey ? { [filterKey]: filterValue } : undefined);
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      {error ? (
        <p className="mt-1 text-sm text-red-600">unavailable</p>
      ) : (
        <p className="mt-1 text-2xl font-semibold text-slate-900">{rows === null ? '…' : rows.length}</p>
      )}
    </div>
  );
}

/** Debounced reference/name lookup across all reservations. */
function ReservationSearch() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Resource[] | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const needle = q.trim();
    if (!needle) {
      setResults(null);
      return;
    }
    const t = setTimeout(() => {
      api
        .list('/reservations', { 'filter[q]': needle })
        .then((rows) => setResults(rows.slice(0, 8)))
        .catch(() => setResults([]));
    }, 500);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div>
      <label htmlFor="desk-search" className="mb-1 block text-sm font-medium text-slate-700">
        Find a booking
      </label>
      <input
        id="desk-search"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Reference no. or customer name…"
        className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
      />
      {results !== null && (
        <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {results.length === 0 && (
            <li className="px-3 py-3 text-sm text-slate-500">No matching bookings.</li>
          )}
          {results.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => navigate(`/reservations/${r.id}`)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <span className="text-slate-800">
                  {attr(r, 'reference_no') || '—'}
                  <span className="ml-2 text-slate-500">
                    {attr(r, 'customer_name') || attr(r, 'player_name') || attr(r, 'guest_name') || '—'}
                  </span>
                </span>
                <StatusBadge status={attr(r, 'status')} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DashboardPage() {
  const date = today();
  const { rows: schedule, reload: reloadSchedule } = useList('/schedule', { date });
  const { rows: resources } = useList('/resources');
  const { rows: venues } = useList('/venues');
  const [booking, setBooking] = useState(false);
  const [schedView, setSchedView] = usePersistedView<'calendar' | 'table'>('dashboard-schedule', 'calendar');

  return (
    <div>
      <PageHeader title="Dashboard"
        description="Front desk actions and today's schedule." />

      {/* Front desk: primary actions first. */}
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">Instant booking</p>
          <p className="mt-0.5 text-xs text-slate-500">Walk-in guest? Book a facility right away.</p>
          <button
            onClick={() => setBooking(true)}
            className="mt-3 inline-block rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Walk-in booking
          </button>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <ReservationSearch />
        </div>
      </div>

      {/* Today's schedule — mini day grid across facilities. */}
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Today's schedule ({date})</h2>
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5" role="tablist">
              {(['calendar', 'table'] as const).map((v) => (
                <button
                  key={v}
                  role="tab"
                  aria-selected={schedView === v}
                  onClick={() => setSchedView(v)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize ${
                    schedView === v ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <Link to="/schedule" className="text-xs font-medium text-indigo-600 hover:underline">
              Open schedule
            </Link>
          </div>
        </div>
        {schedule === null ? (
          <Spinner />
        ) : schedView === 'calendar' ? (
          <TimeGrid
            columns={(resources ?? []).map((r) => ({ key: attr(r, 'name'), label: attr(r, 'name') }))}
            rows={schedule.filter((r) => attr(r, 'starts_at'))}
            colOf={(r) => attr(r, 'resource_name')}
            onEmptySlot={() => setBooking(true)}
          />
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            {schedule.length === 0 && (
              <li className="px-4 py-6 text-sm text-slate-500">No bookings today.</li>
            )}
            {schedule.slice(0, 8).map((b) => (
              <li key={b.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-slate-700">
                  {attr(b, 'starts_at') ? formatDateTime(attr(b, 'starts_at')) : attr(b, 'start_time') || '—'}
                  {' — '}
                  {attr(b, 'title') || attr(b, 'resource_name') || attr(b, 'customer_name') || b.type}
                </span>
                <StatusBadge status={attr(b, 'status')} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Stats: informational, lowest priority. */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <CountCard label="Reservations" path="/reservations" />
        <CountCard label="Pending approval" path="/reservations" filterKey="filter[status]" filterValue="pending_approval" />
        <CountCard label="Open disputes" path="/disputes" filterKey="filter[status]" filterValue="open" />
        <CountCard label="Unread notifications" path="/notifications" />
      </div>
      {booking && (
        <BookingModal
          venues={venues}
          resources={resources}
          initialMode="guest"
          onClose={() => setBooking(false)}
          onCreated={reloadSchedule}
        />
      )}
    </div>
  );
}
