import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, attr, newIdempotencyKey } from '../lib/api';
import { CrudPage, ResourceForm, statusColumn } from '../components/CrudPage';
import { Modal } from '../components/ui';
import { useList } from '../lib/hooks';
import { formatSlot } from '../lib/format';

export function ReservationsPage() {
  const { rows: venues } = useList('/venues');
  const { rows: resources } = useList('/resources');
  const resourceName = (id: unknown): string => {
    const hit = (resources ?? []).find((r) => r.id === id);
    return hit ? attr(hit, 'name') || '—' : '—';
  };
  const [statusFilter, setStatusFilter] = useState('');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [subjectMode, setSubjectMode] = useState<'member' | 'guest'>('member');
  const [memberQuery, setMemberQuery] = useState('');
  const [members, setMembers] = useState<{ value: string; label: string }[]>([]);
  const [memberId, setMemberId] = useState('');
  const [memberName, setMemberName] = useState('');
  const [memberOpen, setMemberOpen] = useState(false);
  const memberBoxRef = useRef<HTMLDivElement>(null);

  // Close the member dropdown when clicking outside it.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (memberBoxRef.current && !memberBoxRef.current.contains(e.target as Node)) {
        setMemberOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);
  const [guestName, setGuestName] = useState('');
  const [guestContact, setGuestContact] = useState('');

  // Member lookup for on-behalf booking — refreshes as the name/email search changes.
  useEffect(() => {
    if (!creating || subjectMode !== 'member') return;
    const t = setTimeout(() => {
      api
        .list(`/reservations/players`, { q: memberQuery || undefined })
        .then((rows) =>
          setMembers(
            rows.map((u) => ({
              value: u.id,
              label: `${attr(u, 'display_name') || '—'}${attr(u, 'email') ? ` · ${attr(u, 'email')}` : ''}`,
            })),
          ),
        )
        .catch(() => setMembers([]));
    }, 250);
    return () => clearTimeout(t);
  }, [creating, subjectMode, memberQuery]);

  return (
    <div key={reloadKey}>
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
            label: 'Resource',
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
            label: 'Approve',
            when: { attr: 'status', equals: ['pending_approval', 'pending'] },
            confirm: 'Approve this reservation?',
            run: () => api.action(`/reservations/${r.id}/approve`),
          },
          {
            label: 'Decline',
            when: { attr: 'status', equals: ['pending_approval', 'pending'] },
            confirm: 'Decline this reservation?',
            danger: true,
            run: () => api.action(`/reservations/${r.id}/decline`),
          },
          {
            label: 'No-show',
            when: { attr: 'status', equals: ['approved', 'confirmed'] },
            confirm: 'Mark this reservation as a no-show?',
            danger: true,
            run: () => api.action(`/reservations/${r.id}/no-show`),
          },
          {
            label: 'Cancel',
            when: { attr: 'status', equals: ['pending_approval', 'pending', 'approved', 'confirmed'] },
            confirm: 'Cancel this reservation?',
            danger: true,
            run: () => api.action(`/reservations/${r.id}/cancel`),
          },
        ]}
        emptyMessage="No reservations found."
      />
      {creating && (
        <Modal title="New reservation (staff booking)" onClose={() => setCreating(false)}>
          <fieldset className="mb-4 rounded-md border border-slate-200 p-3">
            <legend className="px-1 text-xs font-semibold uppercase text-slate-500">Booked by</legend>
            <div className="mb-3 flex gap-4 text-sm">
              {(['member', 'guest'] as const).map((m) => (
                <label key={m} className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="subject_mode"
                    checked={subjectMode === m}
                    onChange={() => setSubjectMode(m)}
                  />
                  {m === 'member' ? 'Member (has account)' : 'Walk-in guest'}
                </label>
              ))}
            </div>
            {subjectMode === 'member' ? (
              <div ref={memberBoxRef} className="relative">
                {memberId ? (
                  <div className="flex items-center justify-between rounded border border-indigo-200 bg-indigo-50 px-2 py-1.5 text-sm">
                    <span className="text-indigo-800">{memberName}</span>
                    <button
                      type="button"
                      onClick={() => { setMemberId(''); setMemberName(''); }}
                      className="ml-2 text-indigo-500 hover:text-indigo-800"
                      aria-label="Clear member"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      type="search"
                      value={memberQuery}
                      onChange={(e) => { setMemberQuery(e.target.value); setMemberOpen(true); }}
                      onFocus={() => setMemberOpen(true)}
                      placeholder="Search member by name or email…"
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                      autoComplete="off"
                    />
                    {memberOpen && (
                      <ul
                        className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded border border-slate-200 bg-white shadow-lg"
                        role="listbox"
                      >
                        {members.length === 0 ? (
                          <li className="px-3 py-2 text-sm text-slate-400">No members found</li>
                        ) : (
                          members.map((m) => (
                            <li key={m.value} role="option" aria-selected={memberId === m.value}>
                              <button
                                type="button"
                                className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-indigo-50"
                                onClick={() => {
                                  setMemberId(m.value);
                                  setMemberName(m.label);
                                  setMemberOpen(false);
                                }}
                              >
                                {m.label}
                              </button>
                            </li>
                          ))
                        )}
                      </ul>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="grid gap-2">
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Guest name (required)"
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
                <input
                  type="text"
                  value={guestContact}
                  onChange={(e) => setGuestContact(e.target.value)}
                  placeholder="Phone or email (optional)"
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>
            )}
          </fieldset>
          <ResourceForm
            fields={[
              {
                name: 'venue_id',
                label: 'Venue',
                type: 'select',
                required: true,
                options: (venues ?? []).map((v) => ({ value: v.id, label: attr(v, 'name') })),
              },
              {
                name: 'resource_id',
                label: 'Resource',
                type: 'select',
                required: true,
                options: (resources ?? []).map((v) => ({ value: v.id, label: attr(v, 'name') })),
              },
              { name: 'starts_at', label: 'Starts at', type: 'datetime-local', required: true },
              { name: 'ends_at', label: 'Ends at', type: 'datetime-local', required: true },
            ]}
            submitLabel="Create reservation"
            busy={busy}
            onCancel={() => setCreating(false)}
            onSubmit={async (attrs) => {
              const subject =
                subjectMode === 'member'
                  ? { player_id: memberId || undefined }
                  : { guest_name: guestName.trim() || undefined, guest_contact: guestContact.trim() || undefined };
              if (subjectMode === 'member' && !memberId) return;
              if (subjectMode === 'guest' && !guestName.trim()) return;
              setBusy(true);
              try {
                await api.create('/reservations', 'reservations', { ...attrs, ...subject }, newIdempotencyKey());
                setMemberId(''); setGuestName(''); setGuestContact(''); setMemberQuery('');
                setCreating(false);
                setReloadKey((k) => k + 1);
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
