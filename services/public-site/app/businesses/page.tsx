import { jsonApiGet } from '../../lib/api';
import { unwrapCollection, firstErrorDetail } from '../../lib/jsonapi';
import type { Business } from '../../lib/types';
import { BusinessCard } from '../../components/cards';
import { EmptyState, ErrorState } from '../../components/states';

export const metadata = { title: 'Businesses — OpenPlay' };

export default async function BusinessesPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string }>;
}) {
  const { name } = await searchParams;
  const query = name?.trim();
  const path = query ? `/businesses?filter[name]=${encodeURIComponent(query)}` : '/businesses';
  const doc = await jsonApiGet(path, { revalidate: 60 });
  const businesses = unwrapCollection<Business>(doc);
  const error = doc === null || 'errors' in (doc ?? {})
    ? firstErrorDetail(doc as { errors?: { detail?: string }[] })
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Businesses</h1>
          <p className="mt-1 text-sm text-slate-600">
            Published businesses hosting venues and open play sessions.
          </p>
        </div>
        <form action="/businesses" method="get" className="flex gap-2">
          <label htmlFor="business-search" className="sr-only">
            Search by name
          </label>
          <input
            id="business-search"
            name="name"
            type="search"
            defaultValue={query ?? ''}
            placeholder="Search by name…"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Search
          </button>
        </form>
      </div>

      {error ? (
        <ErrorState detail={error} />
      ) : businesses.length === 0 ? (
        <EmptyState
          title={query ? `No businesses matching “${query}”.` : 'No published businesses yet.'}
          hint={query ? 'Try a different search term.' : undefined}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
          {businesses.map((b) => (
            <li key={b.id}>
              <BusinessCard business={b} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
