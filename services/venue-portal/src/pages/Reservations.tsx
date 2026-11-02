import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, attr } from '../lib/api';
import { CrudPage, statusColumn } from '../components/CrudPage';
import { PageHeader, Spinner } from '../components/ui';
import { BookingModal } from '../components/BookingModal';
import { useList, usePersistedView, today } from '../lib/hooks';
import { displayDay, formatSlot } from '../lib/format';
import { addDays, TimeGrid, weekStart } from '../components/ScheduleGrid';

export function ReservationsPage() {
  const { rows: venues } = useList('/venues');
  const { rows: resources } = useList('/resources');
  const resourceName = (id: unknown): string => {
    const hit = (resources ?? []).find((r) => r.id === id);
    return hit ? attr(hit, 'name') || '—' : '—';
  };
  const [statusFilter, setStatusFilter] = useState('');
  const [view, setView] = usePersistedView<'table' | 'day' | 'week'>('reservations', 'table');
  const [gridDate, setGridDate] = useState(today());
  const [creating, setCreating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [subjectMode, setSubjectMode] = useState<'member' | 'guest'>('member');

  // Deep link from the front desk: /reservations?book=guest opens the
  // walk-in form directly.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('book') === 'guest') {
      setSubjectMode('guest');
      setCreating(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Grid views: date-scoped fetch (same endpoint, day/week params).
  const wkStart = weekStart(gridDate);
  const { rows: gridRows } = useList(
    '/reservations',
    view === 'day'
      ? { 'filter[date]': gridDate, 'filter[status]': statusFilter || undefined }
      : view === 'week'
        ? { 'filter[from]': wkStart, 'filter[to]': addDays(wkStart, 6), 'filter[status]': statusFilter || undefined }
        : undefined,
    view !== 'table',
  );

  const viewToggle = (
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
  );

  const statusSelect = (
    <select
      value={statusFilter}
      onChange={(e) => setStatusFilter(e.target.value)}
      className="rounded border border-slate-300 px-2 py-1.5 text-sm"
      aria-label="Filter by status"
    >
      <option value="">All statuses</option>
      {['pending_approval', 'approved', 'confirmed', 'declined', 'cancelled', 'no_show', 'completed'].map((s) => (
        <option key={s} value={s}>
          {s.replace(/_/g, ' ')}
        </option>
      ))}
    </select>
  );

  const gridControls = view === 'table' ? null : (
    <>
      <button
        onClick={() => setGridDate((d) => addDays(d, view === 'week' ? -7 : -1))}
        className="rounded border border-slate-300 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        aria-label={view === 'week' ? 'Previous week' : 'Previous day'}
      >
        ‹
      </button>
      <input
        type="date"
        value={gridDate}
        onChange={(e) => setGridDate(e.target.value)}
        className="rounded border border-slate-300 px-2 py-1.5 text-sm"
        aria-label="Grid date"
      />
      <button
        onClick={() => setGridDate((d) => addDays(d, view === 'week' ? 7 : 1))}
        className="rounded border border-slate-300 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        aria-label={view === 'week' ? 'Next week' : 'Next day'}
      >
        ›
      </button>
      <button
        onClick={() => setGridDate(today())}
        className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
      >
        Today
      </button>
    </>
  );


  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(wkStart, i));

  return (
    <div key={reloadKey}>
      {view !== 'table' && (
        <>
          <PageHeader title="Reservations"
            description="All bookings made by members, guests, and staff. Approve, decline, or track each one here.">
            {viewToggle}
            {statusSelect}
            {gridControls}
            <button
              onClick={() => setCreating(true)}
              className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              New reservation
            </button>
          </PageHeader>
          {gridRows === null ? (
            <Spinner />
          ) : view === 'day' ? (
            <TimeGrid
              columns={(resources ?? []).map((r) => ({ key: attr(r, 'name'), label: attr(r, 'name') }))}
              rows={gridRows}
              colOf={(r) => attr(r, 'resource_name')}
              onEmptySlot={() => { setSubjectMode('guest'); setCreating(true); }}
              labelOf={(r) => attr(r, 'customer_name') || attr(r, 'player_name') || attr(r, 'guest_name') || attr(r, 'reference_no') || '—'}
            />
          ) : (
            <TimeGrid
              columns={weekDays.map((d) => ({
                key: d,
                label: new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }),
              }))}
              rows={gridRows}
              colOf={(r) => displayDay(attr(r, 'starts_at'))}
              onEmptySlot={() => { setSubjectMode('guest'); setCreating(true); }}
              labelOf={(r) => attr(r, 'customer_name') || attr(r, 'player_name') || attr(r, 'guest_name') || attr(r, 'reference_no') || '—'}
            />
          )}
        </>
      )}
      {view === 'table' && (
      <CrudPage
        title="Reservations"
        description="All bookings made by members, guests, and staff. Approve, decline, or track each one here."
        path="/reservations"
        type="reservations"
        canCreate={false}
        canEdit={false}
        canDelete={false}
        params={{ 'filter[status]': statusFilter || undefined }}
        toolbar={
          <>
            {viewToggle}
            {statusSelect}
            <button
              onClick={() => setCreating(true)}
              className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              New reservation
            </button>
          </>
        }
        columns={[
          {
            key: 'customer',
            label: 'Customer',
            render: (r) => {
              const name =
                attr(r, 'customer_name') ||
                attr(r, 'player_name') ||
                attr(r, 'guest_name') ||
                attr(r, 'reference_no') ||
                '—';
              return (
                <Link to={`/reservations/${r.id}`} className="font-medium text-indigo-600 hover:underline">
                  {name}
                </Link>
              );
            },
          },
          {
            key: 'resource_name',
            label: 'Facility',
            render: (r) => {
              const name =
                attr(r, 'resource_name') || resourceName(attr(r, 'resource_id')) || '—';
              return (
                <Link to={`/catalog/resources/${attr(r, 'resource_id')}`} className="text-indigo-600 hover:underline">
                  {name}
                </Link>
              );
            },
          },
          {
            key: 'time',
            label: 'Time',
            render: (r) => formatSlot(attr(r, 'starts_at'), attr(r, 'ends_at')),
          },
          statusColumn(),
        ]}
        rowActions={(r) => [
          {
            label: 'Approve reservation',
            tableLabel: 'Approve',
            when: { attr: 'status', equals: ['pending_approval', 'pending'] },
            confirm: 'Approve this reservation?',
            run: () => api.action(`/reservations/${r.id}/approve`),
          },
          {
            label: 'Decline reservation',
            tableLabel: 'Decline',
            when: { attr: 'status', equals: ['pending_approval', 'pending'] },
            confirm: 'Decline this reservation?',
            danger: true,
            run: () => api.action(`/reservations/${r.id}/decline`),
          },
          {
            label: 'Mark no-show',
            when: { attr: 'status', equals: ['approved', 'confirmed'] },
            confirm: 'Mark this reservation as a no-show?',
            danger: true,
            run: () => api.action(`/reservations/${r.id}/no-show`),
          },
          {
            label: 'Cancel reservation',
            tableLabel: 'Cancel',
            when: { attr: 'status', equals: ['pending_approval', 'pending', 'approved', 'confirmed'] },
            confirm: 'Cancel this reservation?',
            danger: true,
            run: () => api.action(`/reservations/${r.id}/cancel`),
          },
        ]}
        emptyMessage="No reservations found."
      />
      )}
      {creating && (
        <BookingModal
          venues={venues}
          resources={resources}
          initialMode={subjectMode}
          onClose={() => setCreating(false)}
          onCreated={() => setReloadKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
