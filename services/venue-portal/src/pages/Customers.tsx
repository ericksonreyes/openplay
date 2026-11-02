import { useState } from 'react';
import { attr } from '../lib/api';
import { useServerTable } from '../lib/hooks';
import { formatDateTime } from '../lib/format';
import { DataTable, statusColumn, type ColumnDef } from '../components/CrudPage';
import { api } from '../lib/api';
import { ErrorState, Modal, PageHeader, Spinner, StatusBadge } from '../components/ui';

const memberColumns: ColumnDef[] = [
  { key: 'display_name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'note', label: 'Notes', render: (r) => attr(r, 'note') || '—' },
  {
    key: 'kind',
    label: 'Type',
    render: () => <StatusBadge status="member" />,
    sortValue: () => 'member',
  },
];

const guestColumns: ColumnDef[] = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  {
    key: 'kind',
    label: 'Type',
    render: (r) => (attr(r, 'verified_at') ? <StatusBadge status="verified" /> : <StatusBadge status="walk-in" />),
    sortValue: (r) => (attr(r, 'verified_at') ? 'verified' : 'walk-in'),
  },
  { key: 'notes', label: 'Notes', render: (r) => attr(r, 'notes') || '—' },
  { key: 'created_at', label: 'Since', render: (r) => formatDateTime(attr(r, 'created_at')) },
];

/**
 * Customer directory: members (player accounts that have booked/registered
 * here) and guests (walk-ins + guest bookings, verified or not).
 */
export function CustomersPage() {
  const [tab, setTab] = useState<'members' | 'guests'>('members');
  const members = useServerTable('/reservations/players', {}, tab === 'members');
  const guests = useServerTable('/guest-contacts', {}, tab === 'guests');
  const [noteTarget, setNoteTarget] = useState<import('../lib/api').Resource | null>(null);

  const active = tab === 'members' ? members : guests;

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Everyone who has booked here — account members and walk-in guests."
      />
      {active.error && <div className="mb-4"><ErrorState message={active.error} onRetry={active.reload} /></div>}
      {active.rows === null ? (
        <Spinner />
      ) : (
        <DataTable
          server={active.server}
          toolbar={
            <div className="inline-flex rounded-lg border border-slate-300 bg-white p-1" role="tablist">
              {(['members', 'guests'] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize ${
                    tab === t ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {t === 'members' ? 'Members' : 'Guests'}
                </button>
              ))}
            </div>
          }
          columns={tab === 'members' ? memberColumns : guestColumns}
          actions={(r) => (
            <button
              onClick={() => setNoteTarget(r)}
              className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Edit
            </button>
          )}
          rows={active.rows}
          emptyMessage={tab === 'members' ? 'No members yet — they appear once they book or register.' : 'No guests yet — walk-ins and guest bookings land here.'}
        />
      )}
      {noteTarget && (
        <NotesDialog
          customer={noteTarget}
          isMember={tab === 'members'}
          onDone={() => {
            setNoteTarget(null);
            active.reload();
          }}
          onCancel={() => setNoteTarget(null)}
        />
      )}
    </div>
  );
}

/** Edit a staff note on a customer (member → PUT players/:id/notes; guest → PATCH guest-contacts/:id). */
function NotesDialog({
  customer,
  isMember,
  onDone,
  onCancel,
}: {
  customer: import('../lib/api').Resource;
  isMember: boolean;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [note, setNote] = useState(isMember ? attr(customer, 'note') : attr(customer, 'notes'));
  const [phone, setPhone] = useState(attr(customer, 'phone'));
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      if (isMember) {
        await api.update(`/reservations/players/${customer.id}`, 'player', {
          phone: phone.trim(),
          note: note.trim(),
        });
      } else {
        await api.update(`/guest-contacts/${customer.id}`, 'guest-contact', {
          phone: phone.trim(),
          notes: note.trim(),
        });
      }
      onDone();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={`Edit — ${attr(customer, 'display_name') || attr(customer, 'name')}`}
      onClose={onCancel}
      centered
    >
      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-medium text-slate-500">Phone</span>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="+63…"
        />
      </label>
      <label className="mb-4 block">
        <span className="mb-1 block text-xs font-medium text-slate-500">Staff note (optional)</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="e.g. Prefers morning slots"
        />
      </label>
      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          disabled={busy}
          onClick={submit}
          className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </Modal>
  );
}
