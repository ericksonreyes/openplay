import { jsonApiGet } from '../../lib/api';
import { firstErrorDetail, unwrapCollection } from '../../lib/jsonapi';
import type { EventItem } from '../../lib/types';
import { EventCard } from '../../components/cards';
import { EmptyState, ErrorState } from '../../components/states';

export const metadata = { title: 'Events — OpenPlay' };

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const dateFilter = /^\d{4}-\d{2}-\d{2}$/.test(date ?? '') ? date : undefined;
  const path = dateFilter
    ? `/events?filter[date]=${encodeURIComponent(dateFilter)}`
    : '/events';
  const doc = await jsonApiGet(path, { revalidate: 60 });
  const events = unwrapCollection<EventItem>(doc);
  const error =
    doc === null || 'errors' in (doc ?? {})
      ? firstErrorDetail(doc as { errors?: { detail?: string }[] })
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Upcoming events</h1>
          <p className="mt-1 text-sm text-slate-600">
            Open play sessions and published events.
          </p>
        </div>
        <form action="/events" method="get" className="flex items-end gap-2">
          <label className="text-sm font-medium text-slate-700">
            Date
            <input
              type="date"
              name="date"
              defaultValue={dateFilter ?? ''}
              className="mt-1 block rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Filter
          </button>
          {dateFilter && (
            <a
              href="/events"
              className="px-2 py-2 text-sm text-slate-500 hover:underline"
            >
              Clear
            </a>
          )}
        </form>
      </div>

      {error ? (
        <ErrorState detail={error} />
      ) : events.length === 0 ? (
        <EmptyState
          title={dateFilter ? `No events on ${dateFilter}.` : 'No upcoming events.'}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
          {events.map((e) => (
            <li key={e.id}>
              <EventCard event={e} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
