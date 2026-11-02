import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { jsonApi } from '../lib/api';
import type { JsonApiResource } from '../lib/api';
import { attributeEntries, displayName } from '../lib/attrs';
import { useQuery } from '../lib/useQuery';
import { SlotGrid } from '../components/SlotGrid';
import { Card, DetailTable, ErrorState, Loading, PageHeader } from '../components/ui';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function VenueDetailPage() {
  const { id = '' } = useParams();
  const [date, setDate] = useState(today());

  const venue = useQuery<JsonApiResource>(
    (token) => jsonApi<JsonApiResource>(`/venues/${id}`, { token }),
    [id],
  );
  const activities = useQuery<JsonApiResource[]>(
    (token) => jsonApi<JsonApiResource[]>('/activities', { token }),
    [],
  );
  const availability = useQuery<JsonApiResource[]>(
    (token) => jsonApi<JsonApiResource[]>(`/venues/${id}/availability?date=${date}`, { token }),
    [id, date],
  );

  if (venue.loading) return <Loading />;
  if (venue.error) return <ErrorState message={venue.error} onRetry={venue.reload} />;

  return (
    <div className="space-y-8">
      <PageHeader title={displayName(venue.data, 'Venue')} description="Venue details, live availability, and booking.">
        <Link
          to={`/book/${id}`}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Book a slot
        </Link>
      </PageHeader>

      <Card>
        <DetailTable rows={attributeEntries(venue.data, ['name', 'title'])} />
      </Card>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Activities</h2>
        {activities.loading ? (
          <Loading />
        ) : activities.error ? (
          <ErrorState message={activities.error} />
        ) : !activities.data || activities.data.length === 0 ? (
          <p className="text-sm text-slate-500">No activities listed.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {activities.data.map((a) => (
              <li
                key={a.id}
                className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700"
              >
                {displayName(a, 'Activity')}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-800">Availability</h2>
          <input
            type="date"
            value={date}
            min={today()}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            aria-label="Availability date"
          />
        </div>
        {availability.loading ? (
          <Loading />
        ) : availability.error ? (
          <ErrorState message={availability.error} onRetry={availability.reload} />
        ) : (
          <SlotGrid slots={availability.data ?? []} selected={null} onSelect={() => {}} />
        )}
      </section>
    </div>
  );
}
