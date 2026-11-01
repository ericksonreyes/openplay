import { Link, useParams } from 'react-router-dom';
import { formatDateTime } from '../lib/format';
import { api, attr } from '../lib/api';
import { CrudPage, DataTable, statusColumn } from '../components/CrudPage';
import { EmptyState, ErrorState, PageHeader, Spinner } from '../components/ui';
import { useList } from '../lib/hooks';

function useOptions(path: string) {
  const { rows } = useList(path);
  return (rows ?? []).map((r) => ({ value: r.id, label: attr(r, 'name') || r.id }));
}

export function EventsPage() {
  const venues = useOptions('/venues');
  const resources = useOptions('/resources');
  return (
    <CrudPage
      title="Events"
        description="Scheduled events customers can register for: tournaments, leagues, and drop-ins."
      path="/events"
      type="events"
      columns={[
        {
          key: 'title',
          label: 'Title',
          render: (r) => (
            <Link to={`/events/${r.id}/registrations`} className="text-indigo-600 hover:underline">
              {attr(r, 'title') || attr(r, 'name')}
            </Link>
          ),
        },
        { key: 'starts_at', label: 'Starts', render: (r) => formatDateTime(attr(r, 'starts_at')) },
        { key: 'capacity', label: 'Capacity' },
        {
          key: 'venue_id',
          label: 'Venue',
          render: (r) => {
              const id = attr(r, 'venue_id');
              const label = venues.find((v) => v.value === id)?.label;
              return id && label ? (
                <Link to={`/catalog/venues/${id}`} className="text-indigo-600 hover:underline">{label}</Link>
              ) : (
                '—'
              );
            },
        },
        statusColumn(),
      ]}
      fields={[
        { name: 'title', label: 'Title', required: true },
        { name: 'description', label: 'Description', type: 'textarea' },
        { name: 'venue_id', label: 'Venue', type: 'select', required: true, options: venues },
        { name: 'resource_id', label: 'Resource', type: 'select', options: resources },
        { name: 'starts_at', label: 'Starts at', type: 'datetime-local', required: true },
        { name: 'ends_at', label: 'Ends at', type: 'datetime-local', required: true },
        { name: 'capacity', help: 'Maximum registrants; leave blank for unlimited.', label: 'Capacity', type: 'number' },
        { name: 'price', label: 'Price', type: 'number' },
      ]}
      rowActions={(r) => [
        {
          label: 'Publish',
          when: { attr: 'status', equals: ['draft', 'unpublished'] },
          confirm: 'Publish this event? It will be visible to players.',
          run: () => api.action(`/events/${r.id}/publish`),
        },
        {
          label: 'Cancel',
          when: { attr: 'status', equals: ['draft', 'published'] },
          confirm: 'Cancel this event? Registrants will be notified.',
          danger: true,
          run: () => api.action(`/events/${r.id}/cancel`),
        },
      ]}
      emptyMessage="No events yet."
    />
  );
}

export function EventRegistrationsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { rows, error, reload } = useList(`/events/${eventId}/registrations`);

  return (
    <div>
      <PageHeader title="Event registrations">
        <Link to="/events" className="text-sm text-indigo-600 hover:underline">
          Back to events
        </Link>
      </PageHeader>
      {error && <div className="mb-4"><ErrorState message={error} onRetry={reload} /></div>}
      {rows === null ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState message="No registrations for this event." />
      ) : (
        <DataTable
          columns={[
            { key: 'name', label: 'Name', render: (r) => attr(r, 'name') || attr(r, 'player_name') || '—' },
            { key: 'contact', label: 'Contact', render: (r) => attr(r, 'contact') || attr(r, 'email') || '—' },
            { key: 'registered_at', label: 'Registered', render: (r) => formatDateTime(attr(r, 'registered_at')) },
            statusColumn(),
          ]}
          rows={rows}
        />
      )}
    </div>
  );
}
