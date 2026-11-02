import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { envelope, jsonApi, newIdempotencyKey } from '../lib/api';
import type { JsonApiResource } from '../lib/api';
import { attrString, displayName, formatDateTime } from '../lib/attrs';
import { useQuery } from '../lib/useQuery';
import { Card, EmptyState, ErrorState, Loading, PageHeader, StatusBadge } from '../components/ui';

export function RentalsPage() {
  const { token } = useAuth();
  const rentals = useQuery<JsonApiResource[]>(
    (t) => jsonApi<JsonApiResource[]>('/rentals', { token: t }),
    [],
  );
  const reservations = useQuery<JsonApiResource[]>(
    (t) => jsonApi<JsonApiResource[]>('/reservations', { token: t }),
    [],
  );

  const [reservationId, setReservationId] = useState('');
  const [item, setItem] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await jsonApi('/rentals', {
        method: 'POST',
        token,
        idempotencyKey: newIdempotencyKey(),
        body: envelope('rentals', {
          reservation_id: reservationId || undefined,
          item,
          quantity,
        }),
      });
      setItem('');
      setQuantity(1);
      rentals.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rental request failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Rentals" description="Borrow equipment for a reservation or on its own." />
      {error && <ErrorState message={error} actionLabel="Dismiss" onRetry={() => setError(null)} />}

      <Card>
        <h2 className="mb-3 font-semibold text-slate-800">Request equipment</h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">For reservation (optional)</span>
            <select
              value={reservationId}
              onChange={(e) => setReservationId(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="">— none —</option>
              {(reservations.data ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {displayName(r, attrString(r, 'reference_no') || 'Reservation')}{' '}
                  {formatDateTime(attrString(r, 'starts_at', 'start', 'date'))}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-3">
            <label className="block flex-1 text-sm">
              <span className="mb-1 block font-medium text-slate-700">Item</span>
              <input
                type="text"
                required
                value={item}
                onChange={(e) => setItem(e.target.value)}
                placeholder="e.g. racket, ball set"
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="block w-28 text-sm">
              <span className="mb-1 block font-medium text-slate-700">Qty</span>
              <input
                type="number"
                min={1}
                required
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy ? 'Requesting…' : 'Request rental'}
          </button>
        </form>
      </Card>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-800">My rentals</h2>
        {rentals.loading ? (
          <Loading />
        ) : rentals.error ? (
          <ErrorState message={rentals.error} onRetry={rentals.reload} />
        ) : !rentals.data || rentals.data.length === 0 ? (
          <EmptyState title="No rentals" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {rentals.data.map((r) => (
              <Card key={r.id}>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-medium text-slate-900">{displayName(r, 'Rental')}</h3>
                  <StatusBadge status={attrString(r, 'status')} />
                </div>
                {attrString(r, 'quantity') && (
                  <p className="mt-1 text-sm text-slate-600">Qty: {attrString(r, 'quantity')}</p>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
