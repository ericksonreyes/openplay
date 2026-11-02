import { Link } from 'react-router-dom';
import { useState, type FormEvent } from 'react';
import { api, attr, rawAttr, type Resource } from '../lib/api';
import { DataTable } from '../components/CrudPage';
import { ConfirmDialog, EmptyState, ErrorState, Modal, PageHeader, Spinner, StatusBadge } from '../components/ui';
import { useList } from '../lib/hooks';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

/** Scheduled holidays — venue closures that recur annually (FREQ=YEARLY). */
export function HolidaysPage() {
  const { rows: closures, error, reload } = useList('/closures');
  const { rows: venues } = useList('/venues');
  const [statusFilter, setStatusFilter] = useState<'scheduled' | 'all' | 'cancelled'>('scheduled');
  const [venueId, setVenueId] = useState('');
  const [creating, setCreating] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ r: Resource; status: 'scheduled' | 'cancelled' } | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const holidays = (closures ?? []).filter(
    (c) =>
      attr(c, 'kind') === 'holiday' &&
      (statusFilter === 'all' || attr(c, 'status') === statusFilter) &&
      (!venueId || attr(c, 'venue_id') === venueId),
  );
  const venueName = (id: string) =>
    (venues ?? []).find((v) => v.id === id) ? attr((venues ?? []).find((v) => v.id === id) ?? null, 'name') : 'All venues';

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const month = Number(form.get('month'));
    const day = Number(form.get('day'));
    const startsAt = new Date(new Date().getFullYear(), month - 1, day, 0, 0);
    const endsAt = new Date(new Date().getFullYear(), month - 1, day, 23, 59);
    setBusy(true);
    try {
      await api.create('/closures', 'closures', {
        venue_id: form.get('venue_id') || undefined,
        reason: String(form.get('reason') || ''),
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        recurrence: { rule: 'FREQ=YEARLY' },
        kind: 'holiday',
      });
      setCreating(false);
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to save holiday.');
    } finally {
      setBusy(false);
    }
  }

  async function runAction() {
    if (!pendingAction) return;
    setBusy(true);
    try {
      await api.update(`/closures/${pendingAction.r.id}`, 'closures', { status: pendingAction.status });
      setPendingAction(null);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Scheduled holidays"
        description="Annual closures — the venue is unavailable on these dates every year.">
        <button
          onClick={() => setCreating(true)}
          className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          New holiday
        </button>
      </PageHeader>
      {(error || actionError) && <div className="mb-4"><ErrorState message={error ?? actionError ?? ''} onRetry={reload} /></div>}
      {closures === null ? (
        <Spinner />
      ) : holidays.length === 0 ? (
        <EmptyState message="No holidays scheduled." />
      ) : (
        <DataTable
          toolbar={
            <>
            <select
              value={venueId}
              onChange={(e) => setVenueId(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1.5 text-sm"
              aria-label="Filter by venue"
            >
              <option value="">All venues</option>
              {(venues ?? []).map((v) => (
                <option key={v.id} value={v.id}>{attr(v, 'name')}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="rounded border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="scheduled">Scheduled</option>
              <option value="cancelled">Cancelled</option>
              <option value="all">All statuses</option>
            </select>
            </>
          }
          columns={[
            {
              key: 'reason',
              label: 'Holiday',
              render: (r) => (
                <Link to={`/catalog/closures/${r.id}`} className="font-medium text-indigo-600 hover:underline">
                  {attr(r, 'reason') || '—'}
                </Link>
              ),
            },
            {
              key: 'starts_at',
              label: 'Date (every year)',
              render: (r) => {
                const d = new Date(String(rawAttr(r, 'starts_at')));
                return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
              },
              sortValue: (r) => {
                const d = new Date(String(rawAttr(r, 'starts_at')));
                return String(d.getMonth() * 31 + d.getDate());
              },
            },
            { key: 'venue_id', label: 'Venue', render: (r) => (attr(r, 'venue_id') ? venueName(attr(r, 'venue_id')) : 'All venues (national)') },
            statusColumnLite(),
          ]}
          rows={holidays}
          actions={(r) =>
            attr(r, 'status') === 'scheduled' ? (
              <button
                onClick={() => setPendingAction({ r, status: 'cancelled' })}
                className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
              >
                Unpublish
              </button>
            ) : (
              <button
                onClick={() => setPendingAction({ r, status: 'scheduled' })}
                className="rounded border border-indigo-300 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
              >
                Publish
              </button>
            )
          }
        />
      )}

      {creating && (
        <Modal title="New holiday" onClose={() => setCreating(false)}>
          <form onSubmit={create} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
              <input name="reason" required placeholder="Christmas Day" className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Venue</label>
              <select name="venue_id" className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
                <option value="">All venues (national)</option>
                {(venues ?? []).map((v) => (
                  <option key={v.id} value={v.id}>{attr(v, 'name')}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Month</label>
                <select name="month" required className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
                  <option value="">Choose…</option>
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Day</label>
                <input name="day" type="number" min={1} max={31} required placeholder="25" className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Repeats every year as a full-day closure. Leave Venue blank for a national holiday
              that applies to every venue.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setCreating(false)} className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={busy} className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                {busy ? 'Saving…' : 'Save holiday'}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {pendingAction && (
        <ConfirmDialog
          title={pendingAction.status === 'cancelled' ? 'Unpublish holiday' : 'Publish holiday'}
          message={
            pendingAction.status === 'cancelled'
              ? `Unpublish "${attr(pendingAction.r, 'reason')}"? The date opens up for booking every year; the record is kept for history.`
              : `Publish "${attr(pendingAction.r, 'reason')}"? The venue closes on this date every year.`
          }
          danger={pendingAction.status === 'cancelled'}
          onConfirm={runAction}
          onCancel={() => setPendingAction(null)}
          busy={busy}
        />
      )}
    </div>
  );
}

function statusColumnLite() {
  return { key: 'status', label: 'Status', render: (r: Resource) => <StatusBadge status={attr(r, 'status')} /> };
}
