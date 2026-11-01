import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { envelope, jsonApi, newIdempotencyKey } from '../lib/api';
import type { JsonApiResource } from '../lib/api';
import { attrString, displayName } from '../lib/attrs';
import { useQuery } from '../lib/useQuery';
import { Card, EmptyState, ErrorState, Loading, PageHeader, StatusBadge } from '../components/ui';

export function MembershipsPage() {
  const { token } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<Record<string, { id: string; status: string }>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const plans = useQuery<JsonApiResource[]>(
    (t) => jsonApi<JsonApiResource[]>('/membership-plans', { token: t }),
    [],
  );
  const memberships = useQuery<JsonApiResource[]>(
    (t) => jsonApi<JsonApiResource[]>('/memberships', { token: t }),
    [],
  );

  async function onPurchase(planId: string) {
    setBusyId(planId);
    setError(null);
    try {
      const membership = await jsonApi<JsonApiResource>('/memberships', {
        method: 'POST',
        token,
        idempotencyKey: newIdempotencyKey(),
        body: envelope('memberships', { plan_id: planId }),
      });
      // Initiate payment for the new membership, then report its status.
      const payment = await jsonApi<JsonApiResource>('/payments', {
        method: 'POST',
        token,
        idempotencyKey: newIdempotencyKey(),
        body: envelope('payments', {
          payable_type: 'membership',
          payable_id: membership?.id,
        }),
      });
      if (payment?.id) {
        const latest = await jsonApi<JsonApiResource>(`/payments/${payment.id}`, { token });
        setPaymentStatus((prev) => ({
          ...prev,
          [planId]: { id: payment.id, status: attrString(latest, 'status') || 'initiated' },
        }));
      }
      memberships.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-10">
      <PageHeader title="Memberships" />
      {error && <ErrorState message={error} />}

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-800">My memberships</h2>
        {memberships.loading ? (
          <Loading />
        ) : memberships.error ? (
          <ErrorState message={memberships.error} onRetry={memberships.reload} />
        ) : !memberships.data || memberships.data.length === 0 ? (
          <EmptyState title="No memberships yet" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {memberships.data.map((m) => (
              <Card key={m.id}>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-medium text-slate-900">{displayName(m, 'Membership')}</h3>
                  <StatusBadge status={attrString(m, 'status')} />
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {attrString(m, 'plan_name', 'plan_id') && `Plan: ${attrString(m, 'plan_name', 'plan_id')}`}
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Available plans</h2>
        {plans.loading ? (
          <Loading />
        ) : plans.error ? (
          <ErrorState message={plans.error} onRetry={plans.reload} />
        ) : !plans.data || plans.data.length === 0 ? (
          <EmptyState title="No plans published" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {plans.data.map((p) => (
              <Card key={p.id}>
                <h3 className="font-medium text-slate-900">{displayName(p, 'Plan')}</h3>
                {attrString(p, 'description') && (
                  <p className="mt-1 text-sm text-slate-600">{attrString(p, 'description')}</p>
                )}
                {attrString(p, 'price', 'amount') && (
                  <p className="mt-1 text-sm font-medium text-slate-800">
                    {attrString(p, 'currency')} {attrString(p, 'price', 'amount')}
                  </p>
                )}
                {paymentStatus[p.id] && (
                  <p className="mt-2 text-xs">
                    Payment:{' '}
                    <Link to={`/payments/${paymentStatus[p.id].id}`} className="text-blue-600 hover:underline">
                      <StatusBadge status={paymentStatus[p.id].status} />
                    </Link>
                  </p>
                )}
                <button
                  onClick={() => onPurchase(p.id)}
                  disabled={busyId === p.id}
                  className="mt-3 w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {busyId === p.id ? 'Processing…' : 'Purchase'}
                </button>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
