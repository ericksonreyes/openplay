import Link from 'next/link';
import { notFound } from 'next/navigation';
import { jsonApiGet } from '../../../lib/api';
import { unwrapCollection, unwrapResource } from '../../../lib/jsonapi';
import type { Business, VenueSummary } from '../../../lib/types';
import { VenueCard } from '../../../components/cards';
import { EmptyState } from '../../../components/states';

interface Props {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { code } = await params;
  const doc = await jsonApiGet(`/businesses/${encodeURIComponent(code)}`);
  const business = unwrapResource<Business>(doc);
  return { title: business ? `${business.name} — OpenPlay` : 'Business — OpenPlay' };
}

export default async function BusinessPage({ params }: Props) {
  const { code } = await params;
  const doc = await jsonApiGet(`/businesses/${encodeURIComponent(code)}`);
  const business = unwrapResource<Business>(doc);
  if (!business) notFound();

  // Prefer venues embedded in the profile payload; fall back to the venues endpoint.
  let venues: ({ id: string } & VenueSummary)[] = (business.venues ?? []).map((v) => ({
    id: v.id,
    ...v.attributes,
  }));
  if (venues.length === 0) {
    const venuesDoc = await jsonApiGet(`/businesses/${encodeURIComponent(code)}/venues`);
    venues = unwrapCollection<VenueSummary>(venuesDoc);
  }

  return (
    <div className="space-y-8">
      <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
        <Link href="/businesses" className="hover:text-slate-900 hover:underline">
          Businesses
        </Link>
        <span aria-hidden className="mx-2">/</span>
        <span className="text-slate-700">{business.name}</span>
      </nav>

      <header>
        <h1 className="text-2xl font-bold tracking-tight">{business.name}</h1>
        {business.profile?.description && (
          <p className="mt-2 max-w-2xl text-slate-600">{business.profile.description}</p>
        )}
        {business.profile?.links?.website && (
          <a
            className="mt-2 inline-block text-sm font-medium text-indigo-600 hover:underline"
            href={business.profile.links.website}
            rel="noreferrer"
          >
            Website
          </a>
        )}
      </header>

      <section aria-labelledby="venues-heading">
        <h2 id="venues-heading" className="text-xl font-semibold">
          Venues
        </h2>
        {venues.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="This business has no published venues yet." />
          </div>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2" role="list">
            {venues.map((v) => (
              <li key={v.id}>
                <VenueCard venue={v} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
