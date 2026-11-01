import { notFound } from 'next/navigation';
import { jsonApiGet, playerPortalUrl } from '../../../lib/api';
import {
  firstErrorDetail,
  unwrapCollection,
  unwrapResource,
} from '../../../lib/jsonapi';
import type { AvailabilitySlot, VenueDetail } from '../../../lib/types';
import { AvailabilityPicker } from '../../../components/AvailabilityPicker';
import { SlotGrid } from '../../../components/SlotGrid';
import { ErrorState } from '../../../components/states';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const doc = await jsonApiGet(`/venues/${encodeURIComponent(id)}`);
  const venue = unwrapResource<VenueDetail>(doc);
  return { title: venue ? `${venue.name} — OpenPlay` : 'Venue — OpenPlay' };
}

export default async function VenuePage({ params, searchParams }: Props) {
  const { id } = await params;
  const { date } = await searchParams;
  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(date ?? '') ? (date as string) : today();

  const doc = await jsonApiGet(`/venues/${encodeURIComponent(id)}`);
  const venue = unwrapResource<VenueDetail>(doc);
  if (!venue) notFound();

  // Availability is fetched per selected date. The endpoint may be unavailable;
  // surface the error document detail when present.
  const availabilityDoc = await jsonApiGet(
    `/venues/${encodeURIComponent(id)}/availability?date=${selectedDate}`,
    { revalidate: 0 },
  );
  const availabilityError =
    availabilityDoc === null || 'errors' in (availabilityDoc ?? {})
      ? firstErrorDetail(availabilityDoc as { errors?: { detail?: string }[] }) ??
        'Availability could not be loaded for this date.'
      : null;
  const slots = availabilityError
    ? []
    : unwrapCollection<AvailabilitySlot>(availabilityDoc);

  const address = [venue.address?.line1, venue.address?.city, venue.address?.country]
    .filter(Boolean)
    .join(', ');
  const resources = (venue.resources ?? []).map((r) => ({ id: r.id, ...r.attributes }));
  const activities = (venue.activities ?? []).map((a) => ({ id: a.id, ...a.attributes }));
  const prices = (venue.prices ?? []).map((p) => ({ id: p.id, ...p.attributes }));
  const rules = (venue.facility_rules ?? []).map((r) => ({ id: r.id, ...r.attributes }));

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{venue.name}</h1>
          {address && <p className="mt-1 text-sm text-slate-600">{address}</p>}
          {venue.details?.description && (
            <p className="mt-2 max-w-2xl text-slate-600">{venue.details.description}</p>
          )}
          {venue.timezone && (
            <p className="mt-1 text-xs text-slate-400">Timezone: {venue.timezone}</p>
          )}
        </div>
        <a
          href={playerPortalUrl(`/venues/${id}`)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Book via player portal
        </a>
      </header>

      <section aria-labelledby="availability-heading" className="space-y-4">
        <h2 id="availability-heading" className="text-xl font-semibold">
          Availability
        </h2>
        <AvailabilityPicker venueId={id} initialDate={selectedDate} />
        {availabilityError ? <ErrorState detail={availabilityError} /> : <SlotGrid slots={slots} />}
      </section>

      <div className="grid gap-8 md:grid-cols-2">
        <section aria-labelledby="resources-heading">
          <h2 id="resources-heading" className="text-lg font-semibold">
            Resources
          </h2>
          {resources.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No resources listed.</p>
          ) : (
            <ul className="mt-2 space-y-2" role="list">
              {resources.map((r) => (
                <li
                  key={r.id}
                  className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm"
                >
                  <span className="font-medium text-slate-900">{r.name}</span>
                  {r.resource_type && (
                    <span className="ml-2 text-slate-500">{r.resource_type}</span>
                  )}
                  {r.capacity != null && (
                    <span className="ml-2 text-xs text-slate-400">
                      capacity {r.capacity}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="activities-heading">
          <h2 id="activities-heading" className="text-lg font-semibold">
            Activities
          </h2>
          {activities.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No activities listed.</p>
          ) : (
            <ul className="mt-2 space-y-2" role="list">
              {activities.map((a) => (
                <li
                  key={a.id}
                  className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm"
                >
                  <span className="font-medium text-slate-900">{a.name}</span>
                  {a.description && (
                    <p className="text-xs text-slate-500">{a.description}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {prices.length > 0 && (
        <section aria-labelledby="prices-heading">
          <h2 id="prices-heading" className="text-lg font-semibold">
            Prices
          </h2>
          <ul className="mt-2 space-y-2" role="list">
            {prices.map((p) => (
              <li
                key={p.id}
                className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm"
              >
                {p.name && <span className="font-medium">{p.name}: </span>}
                {p.amount_cents != null
                  ? `${p.currency ?? 'USD'} ${(p.amount_cents / 100).toFixed(2)}`
                  : 'See venue'}
                {p.unit && <span className="text-slate-500"> / {p.unit}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {rules.length > 0 && (
        <section aria-labelledby="rules-heading">
          <h2 id="rules-heading" className="text-lg font-semibold">
            Facility rules
          </h2>
          <ul className="mt-2 space-y-2" role="list">
            {rules.map((r) => (
              <li
                key={r.id}
                className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm"
              >
                <p className="font-medium text-slate-900">{r.title}</p>
                {r.body && <p className="mt-1 text-slate-600">{r.body}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
