import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, attr, type Resource } from '../lib/api';
import { formatSlot, formatDateTime } from '../lib/format';
import { ErrorState, PageHeader, Spinner, StatusBadge, ConfirmDialog } from '../components/ui';

/** One reservation: who/what/when + staff actions. */
export function ReservationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [reservation, setReservation] = useState<Resource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ path: string; label: string } | null>(null);

  const load = () => {
    if (!id) return;
    api.get(`/reservations/${id}`).then(setReservation).catch((e: Error) => setError(e.message));
  };
  useEffect(load, [id]);

  if (error) return <ErrorState message={error} />;
  if (!reservation) return <Spinner />;

  const status = attr(reservation, 'status');
  const actions = [
    { path: 'approve', label: 'Approve', when: ['pending_approval', 'pending'] },
    { path: 'decline', label: 'Decline', when: ['pending_approval', 'pending'], danger: true },
    { path: 'no-show', label: 'Mark no-show', when: ['approved', 'confirmed'], danger: true },
    { path: 'cancel', label: 'Cancel', when: ['pending_approval', 'approved', 'confirmed', 'hold'], danger: true },
  ].filter((a) => a.when.includes(status));

  const run = async () => {
    if (!pendingAction) return;
    setBusy(true);
    try {
      await api.action(`/reservations/${id}/${pendingAction.path}`);
      setPendingAction(null);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title={attr(reservation, 'reference_no') || 'Reservation'} description="Full reservation details and available staff actions.">
        <Link to="/reservations" className="text-sm text-indigo-600 hover:underline">
          ← All reservations
        </Link>
      </PageHeader>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <dl className="divide-y divide-slate-100">
            {[
              ['Status', <StatusBadge key="s" status={status} />],
              ['Customer', attr(reservation, 'customer_name') || attr(reservation, 'reference_no') || '—'],
              [
                'Resource',
                attr(reservation, 'resource_id') ? (
                  <Link
                    to={`/catalog/resources/${attr(reservation, 'resource_id')}`}
                    className="text-indigo-600 hover:underline"
                  >
                    {attr(reservation, 'resource_name') || 'Resource'}
                  </Link>
                ) : (
                  '—'
                ),
              ],
              [
                'Venue',
                attr(reservation, 'venue_id') ? (
                  <Link
                    to={`/catalog/venues/${attr(reservation, 'venue_id')}`}
                    className="text-indigo-600 hover:underline"
                  >
                    Venue
                  </Link>
                ) : (
                  '—'
                ),
              ],
              ['Time', formatSlot(attr(reservation, 'starts_at'), attr(reservation, 'ends_at'))],
              ['Party size', String(attr(reservation, 'party_size') ?? '—')],
              ['Payment', attr(reservation, 'payment_state') || '—'],
              ['Hold expires', attr(reservation, 'hold_expires_at') ? formatDateTime(attr(reservation, 'hold_expires_at')) : '—'],
              ['Notes', attr(reservation, 'notes') || '—'],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between gap-4 px-1 py-2 text-sm">
                <dt className="shrink-0 text-slate-500">{k}</dt>
                <dd className="text-right text-slate-800">{v}</dd>
              </div>
            ))}
          </dl>
          {actions.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              {actions.map((a) => (
                <button
                  key={a.path}
                  onClick={() => setPendingAction(a)}
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
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Record</h2>
          <pre className="overflow-auto rounded bg-slate-50 p-3 text-xs text-slate-700">
            {JSON.stringify(reservation.attributes, null, 2)}
          </pre>
        </div>
      </div>
      {pendingAction && (
        <ConfirmDialog
          title={pendingAction.label}
          message={`${pendingAction.label} reservation ${attr(reservation, 'reference_no') || id}?`}
          onConfirm={run}
          onCancel={() => setPendingAction(null)}
          busy={busy}
        />
      )}
    </div>
  );
}
