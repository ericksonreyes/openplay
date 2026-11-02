import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, attr, type Resource } from '../lib/api';
import { useList, today } from '../lib/hooks';
import { formatSlot } from '../lib/format';
import { EmptyState, ErrorState, PageHeader, Spinner, StatusBadge } from '../components/ui';
import { RecordActions } from '../components/RecordActions';
import { facilityRowActions, RESOURCE_FIELDS_TAIL } from './catalog';

/** A bookable resource's home: identity + what it's attached to + upcoming usage. */
export function ResourceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [resource, setResource] = useState<Resource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { rows: venues } = useList('/venues');
  const { rows: schedule } = useList('/schedule', { date: today() });

  const load = () =>
    api
      .get(`/resources/${id}`)
      .then(setResource)
      .catch((e: Error) => setError(e.message));

  useEffect(() => {
    if (id) load();
  }, [id]);

  if (error) return <ErrorState message={error} />;
  if (!resource) return <Spinner />;

  const venue = (venues ?? []).find((v) => v.id === attr(resource, 'venue_id'));
  const upcoming = (schedule ?? []).filter(
    (r) => attr(r, 'resource_id') === resource.id || attr(r, 'resource_name') === attr(resource, 'name'),
  );

  return (
    <div>
      <PageHeader title={attr(resource, 'name') || 'Facility'} description="This facility’s details and today’s reservations.">
        <Link to="/catalog/resources" className="text-sm text-indigo-600 hover:underline">
          ← All facilities
        </Link>
      </PageHeader>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Details</h2>
          <dl className="divide-y divide-slate-100">
            {[
              ['Status', <StatusBadge key="s" status={attr(resource, 'status') || 'unknown'} />],
              ['Type', attr(resource, 'resource_type') || '—'],
              [
                'Venue',
                venue ? (
                  <Link to="/catalog/venues" className="text-indigo-600 hover:underline">
                    {attr(venue, 'name')}
                  </Link>
                ) : (
                  '—'
                ),
              ],
              ['Capacity', String(attr(resource, 'capacity') || '—')],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between px-1 py-2 text-sm">
                <dt className="text-slate-500">{k}</dt>
                <dd className="text-slate-800">{v}</dd>
              </div>
            ))}
          </dl>
          <RecordActions
            record={resource}
            path="/resources"
            type="resources"
            entity="Facility"
            backTo="/catalog/resources"
            fields={[
              { name: 'venue_id', label: 'Venue', type: 'select', required: true, options: (venues ?? []).map((v) => ({ value: v.id, label: attr(v, 'name') })) },
              ...RESOURCE_FIELDS_TAIL,
            ]}
            rowActions={(r) => facilityRowActions(r)}
            canDelete={{ attr: 'status', equals: 'draft' }}
            onChanged={load}
          />
        </div>
        <div className="rounded-lg border border-slate-200 bg-white">
          <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">
            Today's reservations ({upcoming.length})
          </h2>
          {upcoming.length === 0 ? (
            <EmptyState message="Nothing booked today." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcoming.slice(0, 10).map((r) => (
                <li key={r.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-slate-700">
                    {attr(r, 'customer_name') || attr(r, 'reference_no') || '—'}
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
      {resource && (
        <div className="mt-3 flex justify-end">
          <Link
            to={`/history/venue_resource/${resource.id}`}
            className="text-xs text-slate-400 hover:text-indigo-600 hover:underline"
          >
            Show history
          </Link>
        </div>
      )}
    </div>
  );
}
