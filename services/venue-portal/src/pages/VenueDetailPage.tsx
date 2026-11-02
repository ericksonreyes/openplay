import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, attr, type Resource } from '../lib/api';
import { useList, today } from '../lib/hooks';
import { formatSlot } from '../lib/format';
import { EmptyState, ErrorState, PageHeader, Spinner, StatusBadge } from '../components/ui';
import { RecordActions } from '../components/RecordActions';
import { VENUE_FIELDS, venueRowActions } from './catalog';

/** A venue's home: identity + its resources + today's usage across them. */
export function VenueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [venue, setVenue] = useState<Resource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { rows: resources } = useList('/resources', { 'filter[venue_id]': id });
  const { rows: schedule } = useList('/schedule', { date: today(), venue_id: id });

  const load = () =>
    api
      .get(`/venues/${id}`)
      .then(setVenue)
      .catch((e: Error) => setError(e.message));

  useEffect(() => {
    if (id) load();
  }, [id]);

  if (error) return <ErrorState message={error} />;
  if (!venue) return <Spinner />;

  const a = venue.attributes;
  const address = (a?.address ?? {}) as Record<string, string>;
  const addressLine = [address.line1, address.city, address.country].filter(Boolean).join(', ');

  return (
    <div>
      <PageHeader title={attr(venue, 'name') || 'Venue'} description="This venue’s identity, facilities, and today’s bookings.">
        <Link to="/catalog/venues" className="text-sm text-indigo-600 hover:underline">
          ← All venues
        </Link>
      </PageHeader>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Details</h2>
          <dl className="divide-y divide-slate-100">
            {[
              ['Status', <StatusBadge key="s" status={attr(venue, 'status') || 'unknown'} />],
              ['Timezone', attr(venue, 'timezone') || '—'],
              ['Address', addressLine || '—'],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between px-1 py-2 text-sm">
                <dt className="text-slate-500">{k}</dt>
                <dd className="text-slate-800">{v}</dd>
              </div>
            ))}
          </dl>
          <h3 className="mt-5 mb-2 text-sm font-semibold text-slate-900">
            Facilities ({(resources ?? []).length})
          </h3>
          {(resources ?? []).length === 0 ? (
            <EmptyState message="No facilities yet." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {(resources ?? []).map((r) => (
                <li key={r.id} className="flex items-center justify-between px-1 py-2 text-sm">
                  <Link
                    to={`/catalog/resources/${r.id}`}
                    className="text-indigo-600 hover:underline"
                  >
                    {attr(r, 'name')}
                  </Link>
                  <StatusBadge status={attr(r, 'status')} />
                </li>
              ))}
            </ul>
          )}
          <RecordActions
            record={venue}
            path="/venues"
            type="venues"
            entity="Venue"
            backTo="/catalog/venues"
            fields={VENUE_FIELDS}
            rowActions={(r) => venueRowActions(r)}
            canDelete={{ attr: 'status', equals: 'draft' }}
            onChanged={load}
          />
        </div>
        <div className="rounded-lg border border-slate-200 bg-white">
          <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">
            Today's schedule ({(schedule ?? []).length})
          </h2>
          {(schedule ?? []).length === 0 ? (
            <EmptyState message="Nothing booked today." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {(schedule ?? []).slice(0, 12).map((r) => (
                <li key={r.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-slate-700">
                    {attr(r, 'resource_name') || '—'} · {attr(r, 'customer_name') || attr(r, 'reference_no') || '—'}
                    {' · '}
                    {formatSlot(attr(r, 'starts_at'), attr(r, 'ends_at'))}
                  </span>
                  <StatusBadge status={attr(r, 'status')} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {venue && (
        <div className="mt-3 flex justify-end">
          <Link
            to={`/history/venue/${id}`}
            className="text-xs text-slate-400 hover:text-indigo-600 hover:underline"
          >
            Show history
          </Link>
        </div>
      )}
    </div>
  );
}
