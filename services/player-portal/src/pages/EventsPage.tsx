import { jsonApi } from '../lib/api';
import type { JsonApiResource } from '../lib/api';
import { attrString, displayName, formatDateTime } from '../lib/attrs';
import { useQuery } from '../lib/useQuery';
import { EmptyState, ErrorState, Loading, PageHeader, ResourceCard } from '../components/ui';

export function EventsPage() {
  const { data, error, loading, reload } = useQuery<JsonApiResource[]>(
    (token) => jsonApi<JsonApiResource[]>('/events', { token }),
    [],
  );

  return (
    <div>
      <PageHeader title="Events" description="Tournaments, leagues, and drop-ins you can join." />
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data || data.length === 0 ? (
        <EmptyState title="No events" hint="Upcoming events published by venues will appear here." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((e) => (
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
    </div>
  );
}
