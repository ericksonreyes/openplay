import { Link, useParams } from 'react-router-dom';
import { jsonApi, type JsonApiResource } from '../lib/api';
import { attrString, attr, displayName, formatDateTime, formatMoney } from '../lib/attrs';
import { useQuery } from '../lib/useQuery';
import { Card, ErrorState, Loading, PageHeader, StatusBadge } from '../components/ui';

/** One payment's status/history for the payer. */
export default function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading } = useQuery(
    (token) => jsonApi<JsonApiResource>(`/payments/${id}`, { token }),
    [id],
  );

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  const payableLink =
    attrString(data, 'reservation_id') || attrString(data, 'payable_id')
      ? `/reservations/${attrString(data, 'reservation_id') || attrString(data, 'payable_id')}`
      : null;

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title={attrString(data, 'reference_no') || displayName(data, 'Payment')} description="Payment status and receipt details.">
        <StatusBadge status={attrString(data, 'status')} />
      </PageHeader>
      <Card>
        <dl className="divide-y divide-slate-100">
          {[
            ['Status', <StatusBadge key="s" status={attrString(data, 'status')} />],
            ['Amount', formatMoney(attr(data, 'amount_cents') ?? attr(data, 'amount'), attr(data, 'currency'))],
            ['Method', attrString(data, 'method') || attrString(data, 'provider') || '—'],
            ['Purpose', attrString(data, 'purpose') || '—'],
            [
              'Linked record',
              payableLink ? (
                <Link to={payableLink} className="text-blue-600 hover:underline">
                  View reservation
                </Link>
              ) : (
                attrString(data, 'payable_type') || '—'
              ),
            ],
            ['Created', formatDateTime(attrString(data, 'created_at'))],
            ['Captured', attrString(data, 'captured_at') ? formatDateTime(attrString(data, 'captured_at')) : '—'],
            ['Provider ref', attrString(data, 'provider_ref') || '—'],
          ].map(([k, v]) => (
            <div key={String(k)} className="flex justify-between gap-4 px-1 py-2 text-sm">
              <dt className="shrink-0 text-slate-500">{k}</dt>
              <dd className="text-right text-slate-800">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
