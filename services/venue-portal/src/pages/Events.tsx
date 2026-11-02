import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { displayDay, formatDateTime, formatSlot } from '../lib/format';
import { api, attr } from '../lib/api';
import { CrudPage, DataTable, statusColumn } from '../components/CrudPage';
import { ConfirmDialog, EmptyState, ErrorState, Modal, PageHeader, Spinner, StatusBadge } from '../components/ui';
import { useList, usePersistedView, useServerTable, today } from '../lib/hooks';
import { addDays, TimeGrid, weekStart } from '../components/ScheduleGrid';

/** Cancel event with a required reason (stored as cancellation_reason). */
function CancelEventDialog({
  event,
  activeRegistrations,
  onDone,
  onCancel,
}: {
  event: import('../lib/api').Resource;
  activeRegistrations?: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const registrants = activeRegistrations ?? (Number(attr(event, 'registered_count')) || 0);
  const required = registrants > 0;
  const submit = async () => {
    setBusy(true);
    try {
      await api.post(`/events/${event.id}/cancel`, { reason: reason.trim() || null });
      onDone();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Cancel event" onClose={onCancel} centered>
      <p className="mb-3 text-sm text-slate-600">
        {registrants > 0
          ? `${registrants} active registration${registrants === 1 ? '' : 's'} for "${attr(event, 'name') || 'this event'}" will be cancelled.`
          : `"${attr(event, 'name') || 'This event'}" has no registrations to cancel.`}
      </p>
      <label className="mb-4 block">
        <span className="mb-1 block text-xs font-medium text-slate-500">
          {required ? 'Reason (required — shown to registrants)' : 'Reason (optional)'}
        </span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          required
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="e.g. Venue maintenance"
        />
      </label>
      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Back
        </button>
        <button
          disabled={(required && !reason.trim()) || busy}
          onClick={submit}
          className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          Cancel event
        </button>
      </div>
    </Modal>
  );
}

function useOptions(path: string, activeOnly = false) {
  const { rows } = useList(path);
  return (rows ?? [])
    .filter((r) => !activeOnly || attr(r, 'status') === 'active')
    .map((r) => ({ value: r.id, label: attr(r, 'name') || r.id }));
}

export function EventsPage() {
  const venues = useOptions('/venues', true);
  const resources = useOptions('/resources');
  const [cancelTarget, setCancelTarget] = useState<import('../lib/api').Resource | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const { rows: resourceRows } = useList('/resources');
  const [view, setView] = usePersistedView<'table' | 'day' | 'week'>('events', 'table');
  const [gridDate, setGridDate] = useState(today());

  // Grid views: date-scoped fetch via the shared list params.
  const wkStart = weekStart(gridDate);
  const { rows: gridRows } = useList(
    '/events',
    view === 'day'
      ? { 'filter[from]': gridDate, 'filter[to]': gridDate }
      : view === 'week'
        ? { 'filter[from]': wkStart, 'filter[to]': addDays(wkStart, 6) }
        : undefined,
    view !== 'table',
  );
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(wkStart, i));

  const controls = (
    <>
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
      {view !== 'table' && (
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
      )}
    </>
  );

  if (view !== 'table') {
    return (
      <div>
        <PageHeader title="Events"
          description="Scheduled events customers can register for: tournaments, leagues, and drop-ins.">
          {controls}
        </PageHeader>
        {gridRows === null ? (
          <Spinner />
        ) : view === 'day' ? (
          <TimeGrid
            columns={[
              ...(resourceRows ?? []).map((r) => ({ key: r.id, label: attr(r, 'name') })),
              ...((gridRows ?? []).some((r) => !(attr(r, 'resource_ids') || []).length)
                ? [{ key: 'unassigned', label: 'Unassigned' }]
                : []),
            ]}
            rows={gridRows}
            colOf={(r) => (attr(r, 'resource_ids') || [null])[0] ?? 'unassigned'}
            labelOf={(r) => attr(r, 'name') || '—'}
          />
        ) : (
          <TimeGrid
            columns={weekDays.map((d) => ({
              key: d,
              label: new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }),
            }))}
            rows={gridRows}
            colOf={(r) => displayDay(attr(r, 'starts_at'))}
            labelOf={(r) => attr(r, 'name') || '—'}
          />
        )}
      </div>
    );
  }

  return (
    <>
    <CrudPage
      title="Events"
        description="Scheduled events customers can register for: tournaments, leagues, and drop-ins."
      toolbar={controls}
      path="/events"
      type="events"
      columns={[
        {
          key: 'name',
          label: 'Name',
          render: (r) => (
            <Link to={`/events/${r.id}/registrations`} className="text-indigo-600 hover:underline">
              {attr(r, 'name')}
            </Link>
          ),
        },
        { key: 'starts_at', label: 'Starts', render: (r) => formatDateTime(attr(r, 'starts_at')) },
        {
          key: 'participants',
          label: 'Participants',
          render: (r) =>
            attr(r, 'capacity')
              ? `${attr(r, 'registered_count') || 0} / ${attr(r, 'capacity')}`
              : (attr(r, 'registered_count') || '0'),
        },
        { key: 'capacity', label: 'Capacity' },
        {
          key: 'venue_id',
          label: 'Venue',
          render: (r) => {
              const id = attr(r, 'venue_id');
              const label = venues.find((v) => v.value === id)?.label;
              return id && label ? (
                <Link to={`/catalog/venues/${id}`} className="text-indigo-600 hover:underline">{label}</Link>
              ) : (
                '—'
              );
            },
        },
        statusColumn(),
      ]}
      fields={[
        { name: 'name', label: 'Name', required: true },
        { name: 'description', label: 'Description', type: 'textarea' },
        { name: 'venue_id', label: 'Venue', type: 'select', required: true, options: venues },
        { name: 'resource_ids', label: 'Resource', type: 'select', options: resources, listify: true },
        { name: 'starts_at', label: 'Starts at', type: 'datetime-local', required: true },
        { name: 'ends_at', label: 'Ends at', type: 'datetime-local', required: true },
        { name: 'capacity', help: 'Maximum registrants; leave blank for unlimited.', label: 'Capacity', type: 'number' },
        { name: 'fee_cents', label: 'Fee', type: 'number', toCents: true, help: 'Per participant, in major units (e.g. 250 = PHP 250).' },
      ]}
      canDelete={{ attr: 'status', equals: 'draft' }}
      rowActions={(r) => [
        {
          label: 'Publish',
          when: { attr: 'status', equals: ['draft', 'unpublished'] },
          confirm: 'Publish this event? It will be visible to players.',
          run: () => api.action(`/events/${r.id}/publish`),
        },
        {
          label: 'Cancel',
          when: { attr: 'status', equals: ['draft', 'published'] },
          danger: true,
          run: async () => setCancelTarget(r),
        },
      ]}
      emptyMessage="No events yet."
      key={reloadKey}
    />
    {cancelTarget && (
      <CancelEventDialog
        event={cancelTarget}
        onDone={() => {
          setCancelTarget(null);
          setReloadKey((k) => k + 1);
        }}
        onCancel={() => setCancelTarget(null)}
      />
    )}
  </>
  );
}



export function EventRegistrationsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { rows, error, reload, server } = useServerTable(`/events/${eventId}/registrations`);
  const [event, setEvent] = useState<import('../lib/api').Resource | null>(null);
  const [pendingAction, setPendingAction] = useState<{ label: string; danger?: boolean; confirm: string; reasonDialog?: boolean; run: () => Promise<unknown> } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<import('../lib/api').Resource | null>(null);
  const [busy, setBusy] = useState(false);

  const loadEvent = () => {
    if (!eventId) return;
    api.get(`/events/${eventId}`).then(setEvent).catch(() => setEvent(null));
  };
  useEffect(loadEvent, [eventId]);

  const eventStatus = event ? attr(event, 'status') : '';
  const eventActions = event
    ? [
        {
          label: 'Publish event',
          danger: false,
          when: eventStatus === 'draft',
          confirm: 'Publish this event? It will be visible to players.',
          run: () => api.action(`/events/${eventId}/publish`),
        },
        {
          label: 'Cancel event',
          danger: true,
          when: eventStatus === 'draft' || eventStatus === 'published' || eventStatus === 'registration_open',
          reasonDialog: true,
          confirm: 'Cancel this event?',
          run: () => api.action(`/events/${eventId}/cancel`),
        },
      ].filter((a) => a.when)
    : [];

  const runAction = async () => {
    if (!pendingAction) return;
    setBusy(true);
    try {
      await pendingAction.run();
      setPendingAction(null);
      loadEvent();
      reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Event registrations" description="People registered for this event — check them in or export the list.">
        <Link to="/events" className="text-sm text-indigo-600 hover:underline">
          Back to events
        </Link>
      </PageHeader>
      {event && (
        <div className="mb-5 rounded-lg border border-slate-200 bg-white p-5">
          <dl className="divide-y divide-slate-100">
            {[
              ['Event', attr(event, 'name') || attr(event, 'title') || '—'],
              ['Status', <StatusBadge key="s" status={attr(event, 'status')} />],
              [
                'Venue',
                attr(event, 'venue_id') ? (
                  <Link to={`/catalog/venues/${attr(event, 'venue_id')}`} className="text-indigo-600 hover:underline">
                    {attr(event, 'venue_name') || 'Venue'}
                  </Link>
                ) : (
                  '—'
                ),
              ],
              ['Time', formatSlot(attr(event, 'starts_at'), attr(event, 'ends_at'))],
              [
                'Capacity',
                (() => {
                  const parties = (rows ?? []).filter((r) => ['pending', 'confirmed'].includes(attr(r, 'status'))).length;
                  const seats = Number(attr(event, 'registered_count')) || 0;
                  const cap = attr(event, 'capacity');
                  return `${parties} registration${parties === 1 ? '' : 's'} · ${seats}${cap ? ` / ${cap}` : ''} seats`;
                })(),
              ],
              ['Registration closes', attr(event, 'registration_closes_at') ? formatDateTime(attr(event, 'registration_closes_at')) : '—'],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between gap-4 px-1 py-2 text-sm">
                <dt className="shrink-0 text-slate-500">{k}</dt>
                <dd className="text-right text-slate-800">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
            {eventActions.length > 0 && (
              <div className="flex flex-wrap justify-end gap-3">
                {eventActions.map((a) => (
                <button
                  key={a.label}
                  onClick={() => (a.reasonDialog ? setCancelTarget(event) : setPendingAction(a))}
                  className={`rounded px-3 py-1.5 text-sm font-medium ${
                    a.danger
                      ? 'border border-red-200 text-red-700 hover:bg-red-50'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {cancelTarget && (
        <CancelEventDialog
          event={cancelTarget}
          activeRegistrations={
            (rows ?? []).filter((r: import('../lib/api').Resource) =>
              ['pending', 'confirmed'].includes(attr(r, 'status')),
            ).length
          }
          onDone={() => {
            setCancelTarget(null);
            loadEvent();
            reload();
          }}
          onCancel={() => setCancelTarget(null)}
        />
      )}
      {pendingAction && (
        <ConfirmDialog
          title={pendingAction.label}
          message={pendingAction.confirm}
          confirmLabel={pendingAction.label}
          danger={pendingAction.danger}
          busy={busy}
          onConfirm={runAction}
          onCancel={() => setPendingAction(null)}
        />
      )}
      {error && <div className="mb-4"><ErrorState message={error} onRetry={reload} /></div>}
      {rows === null ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState message="No registrations for this event." />
      ) : (
        <DataTable
          server={server}
          columns={[
            { key: 'name', label: 'Name', render: (r) => attr(r, 'name') || attr(r, 'player_name') || '—' },
            { key: 'contact', label: 'Email', render: (r) => attr(r, 'contact') || attr(r, 'email') || '—' },
            { key: 'phone', label: 'Phone', render: (r) => attr(r, 'phone') || '—' },
            { key: 'registered_at', label: 'Registered', render: (r) => formatDateTime(attr(r, 'registered_at')) },
            statusColumn(),
          ]}
          rows={rows}
        />
      )}
      {event && (
        <div className="mt-3 flex justify-end">
          <Link
            to={`/history/event/${event.id}`}
            className="text-xs text-slate-400 hover:text-indigo-600 hover:underline"
          >
            Show history
          </Link>
        </div>
      )}
    </div>
  );
}
