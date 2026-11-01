import Link from 'next/link';
import type { Business, EventItem, VenueSummary } from '../lib/types';

function cardClass(extra = '') {
  return `block rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow ${extra}`;
}

export function BusinessCard({ business }: { business: { id: string } & Business }) {
  return (
    <Link href={`/businesses/${business.code}`} className={cardClass()}>
      <h3 className="text-base font-semibold text-slate-900">{business.name}</h3>
      {business.profile ? (
        <p className="mt-1 line-clamp-2 text-sm text-slate-600">{business.profile.description}</p>
      ) : (
        <p className="mt-1 text-sm text-slate-400">No profile yet.</p>
      )}
    </Link>
  );
}

export function VenueCard({ venue }: { venue: { id: string } & VenueSummary }) {
  const address = [venue.address?.line1, venue.address?.city, venue.address?.country]
    .filter(Boolean)
    .join(', ');
  return (
    <Link href={`/venues/${venue.id}`} className={cardClass()}>
      <h3 className="text-base font-semibold text-slate-900">{venue.name}</h3>
      {address && <p className="mt-1 text-sm text-slate-600">{address}</p>}
      {venue.details?.description && (
        <p className="mt-1 line-clamp-2 text-sm text-slate-500">
          {venue.details.description}
        </p>
      )}
    </Link>
  );
}

export function formatEventTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatFee(event: EventItem): string {
  if (event.payment_timing === 'free' || event.fee_cents === 0) return 'Free';
  if (event.fee_cents == null) return '';
  return `${event.currency ?? 'USD'} ${(event.fee_cents / 100).toFixed(2)}`;
}

export function EventCard({ event }: { event: { id: string } & EventItem }) {
  return (
    <Link href={`/events/${event.id}`} className={cardClass()}>
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-base font-semibold text-slate-900">{event.name}</h3>
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
          {formatFee(event)}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        {formatEventTime(event.starts_at)}
        {event.ends_at ? ` – ${formatEventTime(event.ends_at)}` : ''}
      </p>
      {event.remaining_capacity != null && (
        <p className="mt-1 text-xs text-slate-500">
          {event.remaining_capacity} of {event.capacity} spots left
        </p>
      )}
    </Link>
  );
}
