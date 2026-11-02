import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, attr, type Resource } from '../lib/api';
import { useList, usePersistedView, today } from '../lib/hooks';
import { formatSlot } from '../lib/format';
import { DataTable, statusColumn } from '../components/CrudPage';
import { EmptyState, ErrorState, PageHeader, Spinner } from '../components/ui';
import { addDays, TimeGrid, weekStart } from '../components/ScheduleGrid';
import { BookingModal } from '../components/BookingModal';

type View = 'day' | 'week' | 'table';

export function SchedulePage() {
  const [view, setView] = usePersistedView<View>('schedule', 'day');
  const [date, setDate] = useState(today());
  const [venueId, setVenueId] = useState('');
  const { rows: venues } = useList('/venues');
  const { rows: resources } = useList('/resources');
  const [booking, setBooking] = useState(false);
  const toBooking = () => setBooking(true);
  const [weekRows, setWeekRows] = useState<Resource[] | null>(null);
  const [weekErr, setWeekErr] = useState<string | null>(null);

  const start = view === 'week' ? weekStart(date) : date;
  const { rows: dayRows, error, reload } = useList('/schedule', {
    date,
    venue_id: venueId || undefined,
  });

  // Week view fans out to one /schedule call per day.
  useEffect(() => {
    if (view !== 'week') return;
    setWeekErr(null);
    setWeekRows(null);
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    Promise.all(
      days.map((d) => api.list('/schedule', { date: d, venue_id: venueId || undefined }).then((rows) => rows.map((r) => ({ ...r, __day: d })))),
    )
      .then((sets) => setWeekRows(sets.flat()))
      .catch((err) => setWeekErr(err instanceof Error ? err.message : 'Failed to load week.'));
  }, [view, start, venueId]);

  const rows = view === 'week' ? weekRows : dayRows;
  const facilities = useMemo(() => {
    const names = new Set<string>();
    for (const b of rows ?? []) names.add(attr(b, 'resource_name') || 'Unassigned');
    return [...names].sort((a, c) => a.localeCompare(c));
  }, [rows]);

  const grouped = useMemo(() => {
    const byResource = new Map<string, Resource[]>();
    for (const b of rows ?? []) {
      const key = attr(b, 'resource_name') || 'Unassigned';
      byResource.set(key, [...(byResource.get(key) ?? []), b]);
    }
    return [...byResource.entries()].sort(([a], [c]) => a.localeCompare(c));
  }, [rows]);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, i)), [start]);

  const step = (n: number) => setDate((d) => addDays(d, view === 'week' ? n * 7 : n));
  const loading = view === 'week' ? weekRows === null : dayRows === null;
  const err = view === 'week' ? weekErr : error;

  return (
    <div>
      <PageHeader title="Schedule"
        description="Bookings across all facilities — day grid, week grid, or table.">
        <div className="inline-flex rounded-lg border border-slate-300 bg-white p-1" role="tablist">
          {(['day', 'week', 'table'] as const).map((v) => (
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
        <button
          onClick={() => step(-1)}
          className="rounded border border-slate-300 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          aria-label={view === 'week' ? 'Previous week' : 'Previous day'}
        >
          ‹
        </button>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          aria-label="Schedule date"
        />
        <button
          onClick={() => step(1)}
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
        <select
          value={venueId}
          onChange={(e) => setVenueId(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          aria-label="Filter by venue"
        >
          <option value="">All venues</option>
          {(venues ?? []).map((v) => (
            <option key={v.id} value={v.id}>
              {attr(v, 'name')}
            </option>
          ))}
        </select>
      </PageHeader>

      {err && <div className="mb-4"><ErrorState message={err} onRetry={reload} /></div>}
      {loading ? (
        <Spinner />
      ) : view === 'table' ? (
        (rows ?? []).length === 0 ? (
          <EmptyState message="No bookings or events scheduled for this date." />
        ) : (
          <div className="space-y-6">
            {grouped.map(([resource, bookings]) => (
              <section key={resource}>
                <h2 className="mb-2 text-sm font-semibold text-slate-800">{resource}</h2>
                <DataTable
                  columns={[
                    {
                      key: 'time',
                      label: 'Time',
                      render: (r) =>
                        formatSlot(attr(r, 'starts_at') || attr(r, 'start_time'), attr(r, 'ends_at') || attr(r, 'end_time')),
                    },
                    { key: 'who', label: 'Booking', render: (r) => attr(r, 'customer_name') || attr(r, 'title') || attr(r, 'activity_name') || '—' },
                    { key: 'kind', label: 'Type', render: (r) => r.type },
                    statusColumn(),
                  ]}
                  rows={bookings ?? []}
                />
              </section>
            ))}
          </div>
        )
      ) : view === 'day' ? (
        <TimeGrid
          columns={facilities.map((f) => ({ key: f, label: f }))}
          rows={dayRows ?? []}
          colOf={(r) => attr(r, 'resource_name') || 'Unassigned'}
          onEmptySlot={toBooking}
        />
      ) : (
        <TimeGrid
          columns={weekDays.map((d) => ({
            key: d,
            label: new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }),
          }))}
          rows={weekRows ?? []}
          colOf={(r) => (r as Resource & { __day?: string }).__day ?? ''}
          onEmptySlot={toBooking}
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
