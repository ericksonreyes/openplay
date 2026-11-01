/**
 * Pure filter/query helpers for the public surface — unit-tested without a DB.
 *
 * Every helper encodes the publication rules from BUSINESS_PROFILE_PAGES /
 * SEARCH_AND_DISCOVERY: only published, active businesses and their public
 * content are ever visible to anonymous callers.
 */

/** A tenant is publicly listable only when published AND fully active. */
export const isPublishedBusiness = (t: {
  status: string;
  published: boolean;
}): boolean => t.published === true && t.status === 'active';

/** Prisma where-fragment for the business directory (name substring search). */
export const businessListWhere = (name?: string): Record<string, unknown> => ({
  published: true,
  status: 'active',
  ...(name ? { name: { contains: name, mode: 'insensitive' } } : {}),
});

/** Event statuses anonymous callers may see in listings (upcoming only). */
export const LISTED_EVENT_STATUSES = [
  'published',
  'registration_open',
  'registration_closed',
] as const;

/** Detail lookups also resolve ended events so saved links keep working. */
export const RESOLVABLE_EVENT_STATUSES = [
  ...LISTED_EVENT_STATUSES,
  'complete',
  'cancelled',
] as const;

export const isListedEvent = (e: { status: string; visibility: string }): boolean =>
  e.visibility === 'public' && (LISTED_EVENT_STATUSES as readonly string[]).includes(e.status);

export const isResolvableEvent = (e: {
  status: string;
  visibility: string;
}): boolean =>
  e.visibility === 'public' &&
  (RESOLVABLE_EVENT_STATUSES as readonly string[]).includes(e.status);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Day bounds for a YYYY-MM-DD filter, or null when malformed. */
export const dayRange = (date: string): { gte: Date; lt: Date } | null => {
  if (!DATE_RE.test(date)) return null;
  const gte = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(gte.getTime())) return null;
  return { gte, lt: new Date(gte.getTime() + 24 * 3_600_000) };
};

/**
 * Query-string filter reader. Accepts both `?filter[name]=x` (Express extended
 * parser -> query.filter.name) and a literal `filter[name]` key.
 */
export const readFilter = (
  query: Record<string, unknown>,
  key: string,
): string | undefined => {
  const nested = query['filter'];
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const v = (nested as Record<string, unknown>)[key];
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
  }
  const flat = query[`filter[${key}]`];
  if (typeof flat === 'string' && flat.trim() !== '') return flat.trim();
  return undefined;
};
