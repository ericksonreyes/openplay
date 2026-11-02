import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { envelope, jsonApi } from '../lib/api';
import type { JsonApiResource } from '../lib/api';
import { attributeEntries, displayName, attrString } from '../lib/attrs';
import { useQuery } from '../lib/useQuery';
import { Card, DetailTable, ErrorState, Loading, PageHeader, StatusBadge } from '../components/ui';

const CANCELLABLE = new Set(['held', 'pending', 'confirmed', 'approved']);

export function ReservationDetailPage() {
  const { id = '' } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, error, loading, reload } = useQuery<JsonApiResource>(
    (t) => jsonApi<JsonApiResource>(`/reservations/${id}`, { token: t }),
    [id],
  );

  const status = attrString(data, 'status');
  const cancellable = CANCELLABLE.has(status.toLowerCase());

  async function onCancel() {
    setBusy(true);
    setActionError(null);
    try {
      await jsonApi(`/reservations/${id}/cancel`, {
        method: 'POST',
        token,
        body: envelope('cancellations', {}),
      });
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Cancellation failed.');
    } finally {
      setBusy(false);
    }
  }

  async function onPay() {
    setBusy(true);
    setActionError(null);
    try {
      const payment = await jsonApi<JsonApiResource>('/payments', {
        method: 'POST',
        token,
        body: envelope('payments', { payable_type: 'reservation', payable_id: id }),
      });
      const paymentId = payment?.id;
      if (paymentId) {
        const latest = await jsonApi<JsonApiResource>(`/payments/${paymentId}`, { token });
        const state = attrString(latest, 'status');
        setActionError(state ? `Payment status: ${state}` : 'Payment initiated.');
      } else {
        setActionError('Payment initiated.');
      }
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Payment failed.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title={displayName(data, 'Reservation')} description="Booking details, payment, and cancellation.">
        {status && <StatusBadge status={status} />}
      </PageHeader>
      {actionError && <ErrorState message={actionError} actionLabel="Dismiss" onRetry={() => setActionError(null)} />}

      <Card>
        <DetailTable rows={attributeEntries(data, ['name', 'title'])} />
      </Card>

      <div className="flex justify-end gap-3">
        {cancellable && (
          <button
            onClick={onPay}
            disabled={busy}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Pay now
          </button>
        )}
        {cancellable && (
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Cancel reservation
          </button>
        )}
        <button
          onClick={() => navigate('/reservations')}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Back
        </button>
      </div>
    </div>
  );
}
