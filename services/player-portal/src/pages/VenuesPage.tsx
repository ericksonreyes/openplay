import { jsonApi } from '../lib/api';
import type { JsonApiResource } from '../lib/api';
import { attrString, displayName } from '../lib/attrs';
import { useQuery } from '../lib/useQuery';
import { EmptyState, ErrorState, Loading, PageHeader, ResourceCard } from '../components/ui';

export function VenuesPage() {
  const { data, error, loading, reload } = useQuery<JsonApiResource[]>(
    (token) => jsonApi<JsonApiResource[]>('/venues', { token }),
    [],
  );

  return (
    <div>
      <PageHeader title="Venues" />
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data || data.length === 0 ? (
        <EmptyState title="No venues available" hint="Check back once businesses publish venues." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((venue) => (
            <ResourceCard
              key={venue.id}
              to={`/venues/${venue.id}`}
              title={displayName(venue, 'Venue')}
              subtitle={attrString(venue, 'description', 'address', 'city')}
              status={attrString(venue, 'status')}
            />
          ))}
        </div>
      )}
    </div>
  );
}
