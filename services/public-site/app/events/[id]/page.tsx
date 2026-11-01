import Link from 'next/link';
import { notFound } from 'next/navigation';
import { jsonApiGet, playerPortalUrl } from '../../../lib/api';
import { unwrapResource } from '../../../lib/jsonapi';
import type { EventItem } from '../../../lib/types';
import { formatEventTime, formatFee } from '../../../components/cards';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const doc = await jsonApiGet(`/events/${encodeURIComponent(id)}`);
  const event = unwrapResource<EventItem>(doc);
  return { title: event ? `${event.name} — OpenPlay` : 'Event — OpenPlay' };
}

export default async function EventPage({ params }: Props) {
  const { id } = await params;
  const doc = await jsonApiGet(`/events/${encodeURIComponent(id)}`);
  const event = unwrapResource<EventItem>(doc);
  if (!event) notFound();

  return (
    <div className="space-y-8">
      <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
        <Link href="/events" className="hover:text-slate-900 hover:underline">
          Events
        </Link>
        <span aria-hidden className="mx-2">/</span>
        <span className="text-slate-700">{event.name}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{event.name}</h1>
          <p className="mt-2 text-slate-600">
            {formatEventTime(event.starts_at)}
            {event.ends_at ? ` – ${formatEventTime(event.ends_at)}` : ''}
          </p>
          {event.description && (
            <p className="mt-3 max-w-2xl text-slate-600">{event.description}</p>
          )}
        </div>
        <a
          href={playerPortalUrl(`/events/${id}`)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Register via player portal
        </a>
      </header>

      <dl className="grid max-w-xl grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <dt className="text-xs font-medium uppercase text-slate-500">Fee</dt>
          <dd className="mt-1 text-sm font-semibold">{formatFee(event) || '—'}</dd>
        </div>
        {event.capacity != null && (
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <dt className="text-xs font-medium uppercase text-slate-500">Capacity</dt>
            <dd className="mt-1 text-sm font-semibold">
              {event.remaining_capacity != null
                ? `${event.remaining_capacity} / ${event.capacity} left`
                : event.capacity}
            </dd>
          </div>
        )}
        {event.format && (
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <dt className="text-xs font-medium uppercase text-slate-500">Format</dt>
            <dd className="mt-1 text-sm font-semibold">
              {event.format.replace(/_/g, ' ')}
            </dd>
          </div>
        )}
      </dl>

      {event.venue_id && (
        <p className="text-sm">
          <Link
            href={`/venues/${event.venue_id}`}
            className="font-medium text-indigo-600 hover:underline"
          >
            View venue details
          </Link>
        </p>
      )}
    </div>
  );
}
