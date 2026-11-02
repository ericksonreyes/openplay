import { Link } from 'react-router-dom';
import { jsonApi } from '../lib/api';
import type { JsonApiResource } from '../lib/api';
import { attrString, displayName, formatDateTime } from '../lib/attrs';
import { useQuery } from '../lib/useQuery';
import { EmptyState, ErrorState, Loading, PageHeader, ResourceCard } from '../components/ui';

export function ReservationsPage() {
  const { data, error, loading, reload } = useQuery<JsonApiResource[]>(
    (token) => jsonApi<JsonApiResource[]>('/reservations', { token }),
    [],
  );

  return (
    <div>
      <PageHeader title="My reservations" description="Your upcoming and past bookings.">
        <Link
          to="/venues"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          New booking
        </Link>
      </PageHeader>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data || data.length === 0 ? (
        <EmptyState title="No reservations" hint="Book a slot at a venue to see it here." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.map((r) => (
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
    </div>
  );
}
