import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, attr, type Resource } from '../lib/api';
import { useList } from '../lib/hooks';
import { formatSlot, formatDateTime, formatMoney } from '../lib/format';
import { ErrorState, PageHeader, Spinner, StatusBadge } from '../components/ui';

export function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<Resource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { rows: venues } = useList('/venues');

  useEffect(() => {
    if (!id) return;
    api.get(`/events/${id}`).then(setEvent).catch((e: Error) => setError(e.message));
  }, [id]);

  if (error) return <ErrorState message={error} />;
  if (!event) return <Spinner />;

  const venue = (venues ?? []).find((v) => v.id === attr(event, 'venue_id'));

  return (
    <div>
      <PageHeader title={attr(event, 'name') || attr(event, 'title') || 'Event'} description="Event setup, capacity, and registration window.">
        <div className="flex gap-3 text-sm">
          <Link to="/events" className="text-indigo-600 hover:underline">← All events</Link>
          <Link to={`/events/${id}/registrations`} className="font-medium text-indigo-600 hover:underline">
            Registrations
          </Link>
        </div>
      </PageHeader>
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <dl className="divide-y divide-slate-100">
          {[
            ['Status', <StatusBadge key="s" status={attr(event, 'status') || 'unknown'} />],
            ['Format', attr(event, 'format') || '—'],
            [
              'Venue',
              venue ? (
                <Link to={`/catalog/venues/${venue.id}`} className="text-indigo-600 hover:underline">
                  {attr(venue, 'name')}
                </Link>
              ) : '—',
            ],
            ['Time', formatSlot(attr(event, 'starts_at'), attr(event, 'ends_at'))],
            ['Capacity', `${attr(event, 'capacity') ?? '—'} ${attr(event, 'capacity_unit') || ''}`.trim()],
            ['Fee', attr(event, 'fee_cents') != null ? formatMoney(attr(event, 'fee_cents'), attr(event, 'currency')) : 'Free'],
            ['Registration opens', attr(event, 'registration_opens_at') ? formatDateTime(attr(event, 'registration_opens_at')) : '—'],
            ['Registration closes', attr(event, 'registration_closes_at') ? formatDateTime(attr(event, 'registration_closes_at')) : '—'],
            ['Description', attr(event, 'description') || '—'],
          ].map(([k, v]) => (
            <div key={String(k)} className="flex justify-between gap-4 px-1 py-2 text-sm">
              <dt className="shrink-0 text-slate-500">{k}</dt>
              <dd className="text-right text-slate-800">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      {event && (
        <div className="mt-3 flex justify-end">
          <Link
            to={`/history/event/${event.id}`}
            className="text-xs text-slate-400 hover:text-indigo-600 hover:underline"
          >
            Show history
          </Link>
        </div>
      )}
    </div>
  );
}
