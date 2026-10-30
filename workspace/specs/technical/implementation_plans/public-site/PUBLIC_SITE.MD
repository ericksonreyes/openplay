# Public site implementation plan

The public-facing site in `services/public-site/` (Next.js + Tailwind, local port 3000). It renders published Business Profile Pages, venue pages, public event listings, and discovery pages for anonymous visitors and crawlers. It reads only through the backend's public read-only endpoints and contains no business rules.

## Sources

- [ADR-0001](../../decisions/0001-web-application-framework.MD) — separate frontends; Next.js for the public site
- [ADR-0002](../../decisions/0002-tailwind-css-for-styling.MD) — Tailwind CSS across all frontends
- [ADR-0003](../../decisions/0003-docker-local-development.MD) — service-owned Compose file, Dockerfile, `.env.example`, installer
- [ADR-0004](../../decisions/0004-nestjs-backend-api.MD) — read-only public endpoints; ISR caching boundary
- [Public content delivery](../../PUBLIC_CONTENT_DELIVERY.MD) — rendering strategy, cache contract, crawler guidance, indexation
- [Business Profile Pages](../../../domain/specifications/BUSINESS_PROFILE_PAGES.MD) — page content and publish states
- [Search and discovery](../../../domain/specifications/SEARCH_AND_DISCOVERY.MD) — form-based search behavior
- [User experience](../../user_experience/README.MD) — UX principles; [layout](../../user_experience/LAYOUT.MD) when populated

## Pages

- **Business profile** — `/b/<slug>`: business name, description, images, activities, linked venues, published events, public hours, published Facility Use Rules, owner-selected contact details.
- **Venue** — `/v/<slug>`: venue details, bookable resources, hours, applicable public rules, upcoming public events.
- **Event** — `/e/<slug>`: public scheduled-event listing with registration state. Finished or cancelled events render an "ended" page that still links to the venue, not a bare 404.
- **Discovery/search** — form-based search by activity, location, date/time, and offering type. Results link into the booking flows hosted by the player portal; search itself never holds a resource or place.
- **Booking entry** — links lead to the player portal's reservation and registration flows (including guest checkout). The public site does not host booking forms.

## Rendering and caching

- Incremental Static Regeneration per page type; no per-request SSR for published content.
- Respect backend `Cache-Control`/`ETag` so revalidation returns cheap 304s.
- Live elements (availability badge, places remaining) fetch separately client-side from the dedicated `no-store` endpoint — never folded into the cached page.
- Renamed slugs serve permanent redirects so inbound links keep working.

## Indexation

- Unique title, meta description, Open Graph/Twitter tags, and canonical URL per indexable page.
- JSON-LD: `SportsActivityLocation`/`LocalBusiness` on venue pages, `Event` on event pages.
- `robots.txt` and `sitemap.xml` point crawlers at canonical pages.
- Filtered/faceted result URLs are `noindex` with canonical links to the base page; unpublished profiles and expired events are `noindex`.

## Platform pieces

- Typed API client for the public endpoint contract. Server components call `BACKEND_INTERNAL_URL` (the `openplay-backend` alias on the shared Docker network); browser-side calls use `NEXT_PUBLIC_API_URL`.
- Tailwind setup with shared design tokens so all four frontends stay consistent.
- Mobile-first responsive layouts per the UX principles.
- A health or readiness response the installer status checks can poll.
- npm scripts: `dev` listening on `0.0.0.0:3000`, `test` (Jest via `next/jest`), `build`, `lint`.

## Dependencies

- [Local development](../tooling/LOCAL_DEVELOPMENT.MD) — Compose file, Dockerfiles, `.env.example`, installer.
- [Foundation](../backend/FOUNDATION.MD) — a running backend API to call.
- [Public content](../backend/PUBLIC_CONTENT.MD) — the read-only endpoints, field allowlist, and cache contract this site consumes.

## Acceptance checks

- Every indexable page carries canonical metadata and valid JSON-LD; `robots.txt`/`sitemap.xml` resolve.
- No private data can appear: the site renders only what the allowlisted public endpoints return — no bookings, guest contacts, payment records, or internal notes.
- Cached pages are never the source of truth for a booking; availability and price are revalidated when the player enters the booking flow.
- `npm test` runs a Jest suite that exits non-zero on failure.
- The site installs and runs through its own Compose file and installer per ADR-0003.

## Open decisions

- Revalidation intervals per content type, final slug format, `og:image` fallback, CDN/WAF, and sitemap cadence — tracked in [Public content delivery](../../PUBLIC_CONTENT_DELIVERY.MD).
- Business Profile Page field list, brand assets, and publishing review — tracked in [Open product decisions](../../../domain/specifications/OPEN_PRODUCT_DECISIONS.MD).
