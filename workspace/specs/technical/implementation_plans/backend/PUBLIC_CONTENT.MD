# Public content implementation plan

The `public` read surface of the backend: the anonymous, read-only endpoints that feed the Next.js public site and public discovery. Everything outside this prefix stays default-deny — this module owns the only unauthenticated routes, apart from webhooks and auth entry points.

## Sources

- [Public content delivery](../../PUBLIC_CONTENT_DELIVERY.MD) — cache contract, crawler rules, indexation inputs, backend budget
- [ADR-0004](../../decisions/0004-nestjs-backend-api.MD) — read-only public endpoints, allowlist, separate rate limits
- [Internal service security](../../security/INTERNAL_SERVICE_SECURITY.MD) — public-access rules
- [Business Profile Pages](../../../domain/specifications/BUSINESS_PROFILE_PAGES.MD) — what published content is
- [Search and discovery](../../../domain/specifications/SEARCH_AND_DISCOVERY.MD) — public search behavior
- [Row-level security](../../security/ROW_LEVEL_SECURITY.MD) — the `app.is_public` context

## Deliverables

- A dedicated route prefix for public endpoints with its own rate-limit bucket, so crawler traffic can never starve portal or booking traffic.
- Endpoints (shapes, not a final contract):
  - published business profile by slug;
  - venue public details (resources, hours, public rules, upcoming events);
  - published event listings and detail;
  - form-based search/discovery query by activity, location, date/time, offering type, map bounds, and radius, with relevance-ordered results;
  - a small live-availability endpoint for ISR page badges and remaining-place counts, marked `no-store`;
  - sitemap feed data for the public site.
- A field-allowlist serializer: responses emit only explicitly published fields. A contract test proves private data — bookings, guest contacts, payment records, internal notes, unpublished content — cannot leak.
- The cache contract with the site: `Cache-Control` and `ETag` per content type so revalidation returns cheap 304s; availability, price, and status always `no-store` and revalidated server-side at submission.
- Business Owner-editable slug resolution with redirects for the configured rename window; ended or cancelled events still resolve to an "ended" state.
- Public queries run under `SET LOCAL app.is_public = 'true'`, seeing only `published` rows; all queries are bounded, indexed lookups under a statement timeout so a slow public query cannot hold the connection pool.
- Guest flows that do more than read — verification requests, booking submission — are **not** here; they live in [Booking](BOOKING.MD) behind their own rate-limited controllers.

## Dependencies

- [Foundation](FOUNDATION.MD), [Tenant data](TENANT_DATA.MD) — pipeline, `app.is_public` context, `published` flag conventions.
- [Venue catalog](VENUE_CATALOG.MD) — published profile, venue, rule, and closure content.
- [Events](EVENTS.MD) — published event listings.
- [Booking](BOOKING.MD) — the live-availability read.

## Acceptance checks

- Contract test: only allowlisted fields serialize; private fields are structurally absent.
- `app.is_public` reads return published rows only; unpublished content 404s.
- `ETag` revalidation yields 304; the availability endpoint is `no-store`.
- The public bucket throttles independently of authenticated traffic; queries stay bounded and timed out.
- Renamed slugs redirect for the configured retention window; ended events resolve instead of 404ing.

## Open decisions

- Exact search query shapes, radius presets, relevance weights/tie-breaks, endpoint naming, and throttle values — [Search and discovery](../../../domain/specifications/SEARCH_AND_DISCOVERY.MD) and [Public content delivery](../../PUBLIC_CONTENT_DELIVERY.MD).
