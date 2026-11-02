import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, attr, type Resource } from '../lib/api';
import { useList } from '../lib/hooks';
import { formatDateTime, formatMoney } from '../lib/format';
import { EmptyState, ErrorState, PageHeader, Spinner, StatusBadge } from '../components/ui';
import { RecordActions } from '../components/RecordActions';
import { equipmentFields, equipmentRowActions } from './inventory';

export function EquipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<Resource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { rows: venues } = useList('/venues');
  const { rows: rentals } = useList('/rentals');

  const load = () =>
    api.get(`/equipment/${id}`).then(setItem).catch((e: Error) => setError(e.message));

  useEffect(() => {
    if (id) load();
  }, [id]);

  if (error) return <ErrorState message={error} />;
  if (!item) return <Spinner />;

  const venue = (venues ?? []).find((v) => v.id === attr(item, 'venue_id'));
  const itemRentals = (rentals ?? []).filter((r) => attr(r, 'equipment_id') === item.id);

  return (
    <div>
      <PageHeader title={attr(item, 'name') || 'Equipment'} description="This equipment item and its recent rentals.">
        <Link to="/equipment" className="text-sm text-indigo-600 hover:underline">← All equipment</Link>
      </PageHeader>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <dl className="divide-y divide-slate-100">
            {[
              ['Status', <StatusBadge key="s" status={attr(item, 'status') || 'unknown'} />],
              ['SKU', attr(item, 'sku') || '—'],
              ['Quantity', String(attr(item, 'quantity') ?? attr(item, 'total_stock') ?? '—')],
              [
                'Venue',
                venue ? (
                  <Link to={`/catalog/venues/${venue.id}`} className="text-indigo-600 hover:underline">
                    {attr(venue, 'name')}
                  </Link>
                ) : '—',
              ],
              ['Rental price', attr(item, 'rental_price_cents') != null ? formatMoney(attr(item, 'rental_price_cents'), attr(item, 'currency')) : '—'],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between gap-4 px-1 py-2 text-sm">
                <dt className="shrink-0 text-slate-500">{k}</dt>
                <dd className="text-right text-slate-800">{v}</dd>
              </div>
            ))}
          </dl>
          <RecordActions
            record={item}
            path="/equipment"
            type="equipment"
            entity="Equipment"
            backTo="/equipment"
            fields={equipmentFields((venues ?? []).map((v) => ({ value: v.id, label: attr(v, 'name') })))}
            rowActions={(r) => equipmentRowActions(r)}
            canDelete={{ attr: 'status', equals: 'draft' }}
            onChanged={load}
          />
        </div>
        <div className="rounded-lg border border-slate-200 bg-white">
          <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">
            Recent rentals ({itemRentals.length})
          </h2>
          {itemRentals.length === 0 ? (
            <EmptyState message="No rentals recorded." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {itemRentals.slice(0, 10).map((r) => (
                <li key={r.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-slate-700">
                    {attr(r, 'renter_name') || attr(r, 'customer_name') || '—'}
                    {' · '}
                    {attr(r, 'checked_out_at') ? formatDateTime(attr(r, 'checked_out_at')) : '—'}
                  </span>
                  <StatusBadge status={attr(r, 'status')} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {item && (
        <div className="mt-3 flex justify-end">
          <Link
            to={`/history/equipment/${item.id}`}
            className="text-xs text-slate-400 hover:text-indigo-600 hover:underline"
          >
            Show history
          </Link>
        </div>
      )}
    </div>
  );
}
