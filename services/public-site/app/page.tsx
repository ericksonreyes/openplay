import Link from 'next/link';
import { jsonApiGet } from '../lib/api';
import { unwrapCollection } from '../lib/jsonapi';
import type { Business, EventItem } from '../lib/types';
import { BusinessCard, EventCard } from '../components/cards';
import { StatusPill } from '../components/StatusPill';

export default async function Home() {
  const [businessesDoc, eventsDoc] = await Promise.all([
    jsonApiGet('/businesses'),
    jsonApiGet('/events'),
  ]);
  const businesses = unwrapCollection<Business>(businessesDoc).slice(0, 6);
  const events = unwrapCollection<EventItem>(eventsDoc).slice(0, 3);

  return (
    <div className="space-y-14">
      <section className="rounded-2xl bg-chrome px-6 py-16 text-white sm:px-12">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Find a court. Join the play.
            </h1>
            <p className="mt-3 max-w-xl text-indigo-100">
              Browse published venues and open play events near you — no account
              needed to look around.
            </p>
          </div>
          <StatusPill />
        </div>
        <form action="/businesses" method="get" className="mt-8 flex max-w-md gap-2">
          <label htmlFor="hero-search" className="sr-only">
            Search businesses by name
          </label>
          <input
            id="hero-search"
            name="name"
            type="search"
            placeholder="Search businesses…"
            className="w-full rounded-md border-0 px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <button
            type="submit"
            className="rounded-md bg-white/15 px-4 py-2.5 text-sm font-medium hover:bg-white/25"
          >
            Search
          </button>
        </form>
      </section>

      <section aria-labelledby="featured-businesses">
        <div className="flex items-center justify-between">
          <h2 id="featured-businesses" className="text-xl font-semibold">
            Featured businesses
          </h2>
          <Link href="/businesses" className="text-sm font-medium text-indigo-600 hover:underline">
            View all
          </Link>
        </div>
        {businesses.length > 0 ? (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
            {businesses.map((b) => (
              <li key={b.id}>
                <BusinessCard business={b} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-slate-500">No published businesses yet.</p>
        )}
      </section>

      <section aria-labelledby="upcoming-events">
        <div className="flex items-center justify-between">
          <h2 id="upcoming-events" className="text-xl font-semibold">
            Upcoming events
          </h2>
          <Link href="/events" className="text-sm font-medium text-indigo-600 hover:underline">
            View all
          </Link>
        </div>
        {events.length > 0 ? (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
            {events.map((e) => (
              <li key={e.id}>
                <EventCard event={e} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-slate-500">No upcoming events right now.</p>
        )}
      </section>
    </div>
  );
}
