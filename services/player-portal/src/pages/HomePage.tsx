import { Link } from 'react-router-dom';
import { jsonApi } from '../lib/api';
import type { JsonApiResource } from '../lib/api';
import { attrString, displayName, formatDateTime } from '../lib/attrs';
import { useQuery } from '../lib/useQuery';
import { EmptyState, ErrorState, Loading, PageHeader, ResourceCard } from '../components/ui';

export function HomePage() {
  const reservations = useQuery<JsonApiResource[]>(
    (token) => jsonApi<JsonApiResource[]>('/reservations', { token }),
    [],
  );
  const events = useQuery<JsonApiResource[]>((token) => jsonApi<JsonApiResource[]>('/events', { token }), []);

  return (
    <div className="space-y-10">
      <PageHeader title="Home" description="Your bookings, events, and quick actions." />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Upcoming reservations</h2>
          <Link to="/venues" className="text-sm font-medium text-indigo-700 hover:underline">
            Book a venue
          </Link>
        </div>
        {reservations.loading ? (
          <Loading />
        ) : reservations.error ? (
          <ErrorState message={reservations.error} onRetry={reservations.reload} />
        ) : !reservations.data || reservations.data.length === 0 ? (
          <EmptyState
            title="No reservations yet"
            hint="Browse venues and pick a slot to get started."
            action={
              <Link to="/venues" className="text-sm font-medium text-indigo-700 hover:underline">
                Browse venues
              </Link>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {reservations.data.slice(0, 4).map((r) => (
              <ResourceCard
                key={r.id}
                to={`/reservations/${r.id}`}
                title={displayName(r, 'Reservation')}
                subtitle={formatDateTime(attrString(r, 'starts_at', 'start', 'date'))}
                status={attrString(r, 'status')}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Upcoming events</h2>
          <Link to="/events" className="text-sm font-medium text-indigo-700 hover:underline">
            All events
          </Link>
        </div>
        {events.loading ? (
          <Loading />
        ) : events.error ? (
          <ErrorState message={events.error} onRetry={events.reload} />
        ) : !events.data || events.data.length === 0 ? (
          <EmptyState title="No upcoming events" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {events.data.slice(0, 4).map((e) => (
              <ResourceCard
                key={e.id}
                to={`/events/${e.id}`}
                title={displayName(e, 'Event')}
                subtitle={formatDateTime(attrString(e, 'starts_at', 'date', 'start'))}
                status={attrString(e, 'status')}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
