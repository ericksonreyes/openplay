import { useEffect, useRef, useState } from 'react';
import { api, attr, newIdempotencyKey, type Resource } from '../lib/api';
import { ResourceForm } from '../components/CrudPage';
import { Modal } from '../components/ui';

/**
 * Staff "New reservation" flow, self-contained so any page can render it
 * in place (walk-in deep links, time-grid empty-slot double-clicks)
 * without navigating away and losing the user's context.
 */
export function BookingModal({
  venues,
  resources,
  initialMode = 'member',
  onClose,
  onCreated,
}: {
  venues: Resource[] | null;
  resources: Resource[] | null;
  initialMode?: 'member' | 'guest';
  onClose: () => void;
  onCreated?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [subjectMode, setSubjectMode] = useState<'member' | 'guest'>(initialMode);
  const [memberQuery, setMemberQuery] = useState('');
  const [members, setMembers] = useState<{ value: string; label: string }[]>([]);
  const [memberId, setMemberId] = useState('');
  const [memberName, setMemberName] = useState('');
  const [memberOpen, setMemberOpen] = useState(false);
  const memberBoxRef = useRef<HTMLDivElement>(null);
  const [guestName, setGuestName] = useState('');
  const [guestContact, setGuestContact] = useState('');

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

  // Member lookup for on-behalf booking — refreshes as the name/email search changes.
  useEffect(() => {
    if (subjectMode !== 'member') return;
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
    }, 500);
    return () => clearTimeout(t);
  }, [subjectMode, memberQuery]);

  return (
    <Modal title="New reservation (staff booking)" onClose={onClose}>
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
            options: (venues ?? []).filter((v) => attr(v, 'status') === 'active').map((v) => ({ value: v.id, label: attr(v, 'name') })),
          },
          {
            name: 'resource_id',
            label: 'Facility',
            type: 'select',
            required: true,
            options: (resources ?? []).map((v) => ({ value: v.id, label: attr(v, 'name') })),
          },
          { name: 'starts_at', label: 'Starts at', type: 'datetime-local', required: true },
          { name: 'ends_at', label: 'Ends at', type: 'datetime-local', required: true },
        ]}
        submitLabel="Create reservation"
        busy={busy}
        onCancel={onClose}
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
            onCreated?.();
            onClose();
          } finally {
            setBusy(false);
          }
        }}
      />
    </Modal>
  );
}
