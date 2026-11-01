import { useMemo, useState } from 'react';
import { attr } from '../lib/api';
import { useList, today } from '../lib/hooks';
import { formatSlot } from '../lib/format';
import { DataTable, statusColumn } from '../components/CrudPage';
import { EmptyState, ErrorState, PageHeader, Spinner } from '../components/ui';

export function SchedulePage() {
  const [date, setDate] = useState(today());
  const [venueId, setVenueId] = useState('');
  const { rows: venues } = useList('/venues');
  const { rows, error, reload } = useList('/schedule', {
    date,
    venue_id: venueId || undefined,
  });

  const grouped = useMemo(() => {
    const byResource = new Map<string, typeof rows>();
    for (const b of rows ?? []) {
      const key = attr(b, 'resource_name') || 'Unassigned';
      byResource.set(key, [...(byResource.get(key) ?? []), b]);
    }
    return [...byResource.entries()].sort(([a], [c]) => a.localeCompare(c));
  }, [rows]);

  return (
    <div>
      <PageHeader title="Schedule"
        description="Today's bookings across all resources at a glance.">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          aria-label="Schedule date"
        />
        <select
          value={venueId}
          onChange={(e) => setVenueId(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          aria-label="Filter by venue"
        >
          <option value="">All venues</option>
          {(venues ?? []).map((v) => (
            <option key={v.id} value={v.id}>
              {attr(v, 'name')}
            </option>
          ))}
        </select>
      </PageHeader>
      {error && <div className="mb-4"><ErrorState message={error} onRetry={reload} /></div>}
      {rows === null ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState message="No bookings or events scheduled for this date." />
      ) : (
        <div className="space-y-6">
          {grouped.map(([resource, bookings]) => (
            <section key={resource}>
              <h2 className="mb-2 text-sm font-semibold text-slate-800">{resource}</h2>
              <DataTable
                columns={[
                  {
                    key: 'time',
                    label: 'Time',
                    render: (r) =>
                      formatSlot(attr(r, 'starts_at') || attr(r, 'start_time'), attr(r, 'ends_at') || attr(r, 'end_time')),
                  },
                  {
                    key: 'who',
                    label: 'Booking',
                    render: (r) => attr(r, 'customer_name') || attr(r, 'title') || attr(r, 'activity_name') || '—',
                  },
                  { key: 'kind', label: 'Type', render: (r) => r.type },
                  statusColumn(),
                ]}
                rows={bookings ?? []}
              />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
