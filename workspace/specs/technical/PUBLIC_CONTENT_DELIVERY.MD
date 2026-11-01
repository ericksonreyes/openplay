# Public Content Delivery

This document describes how the public site serves crawled pages without letting crawler traffic choke the backend. It applies to published Business Profile Pages, venue pages, and public event listings — the pages a search engine will crawl. Private and time-sensitive data follow different rules.

## Goals

- Serve crawler and link-preview traffic from generated output, not from live backend queries.
- Keep the backend's public endpoints cheap, bounded, and separately rate-limited.
- Keep crawlers on canonical pages instead of exploring an unbounded URL space.
- Keep availability and prices accurate at booking time regardless of page caching.

## Rendering strategy

- Public pages use **Incremental Static Regeneration (ISR)**: Next.js generates each page once and revalidates on an interval, so repeated crawls hit generated output instead of the backend API.
- Server-side rendering per request (SSR) is avoided for published content — a page rendered per request turns every crawler hit into a backend call.
- Live elements on otherwise static pages (for example an availability badge or "places remaining" count) are fetched separately from a small, dedicated endpoint — never folded into the cached page.

## Cache contract with the backend

- Public endpoints return explicit `Cache-Control` and `ETag` headers so revalidation returns cheap 304 responses and any CDN or proxy in front can cache correctly.
- Stable published content (profile text, venue descriptions, schedules, rules) is cacheable for the configured interval.
- Availability, prices, booking status, and anything private are `no-store` and are revalidated by the backend at submission time — the cached page is never the source of truth for a booking.
- The backend allowlist still limits which fields public endpoints return; caching changes *how often* data is fetched, not *what* is exposed.

## Crawler guidance

- The public site publishes `robots.txt` and `sitemap.xml` pointing crawlers at canonical pages.
- Filter and faceted-search URLs (`?city=`, `?sport=`, `?date=` combinations) are excluded from crawling (`Disallow`/`noindex`) and carry canonical links to their base page — parameter combinations are an unbounded URL space and the classic crawler trap.
- `robots.txt` governs honest crawlers only. Abusive bots are a deployment concern handled by a CDN/WAF in front of the site, not by the app.

## Indexation and discovery

Crawl-efficiency rules keep the backend safe; these rules make the pages worth indexing.

- **Per-page metadata** — every indexable page sets a unique title and meta description, Open Graph and Twitter card tags, and a canonical URL. A published venue photo is the `og:image` source when present.
- **Structured data (JSON-LD)** — venue pages emit `SportsActivityLocation` (or `LocalBusiness`) markup with name, address, hours, and amenities; public event pages emit `Event` markup with start time, location, and registration state. This makes listings eligible for rich results.
- **Indexable vs `noindex`** — published business profiles, venue pages, and upcoming public event listings are indexable. Unpublished or draft profiles, filtered/search-result pages, and expired events are `noindex`.
- **URL design** — pages get clean slugs generated from business names (for example `/b/acme-sports`). Business Owners can edit a profile slug; collisions are prevented. When a slug changes, the old slug redirects to the new one so inbound links keep working.
- **Expired content** — a finished or cancelled event returns an "ended" page (still linked to the venue), not a bare 404, so crawl equity is not wasted and links players saved keep resolving.
- **Localization** — `hreflang` variants are deferred until a second language ships; the URL structure should not preclude it.

## Backend budget

- Public endpoints live under their own route prefix with a dedicated rate-limit bucket, so a crawler spike saturates the public budget without starving portal or booking traffic.
- Public queries are restricted to indexed single lookups — no unbounded joins or scans that grow with table size.
- The database pool is bounded and public queries carry a statement timeout, so a slow public query cannot hold connections needed by protected traffic.

## Open decisions

- Revalidation intervals per content type (profiles vs. event listings).
- CDN/WAF provider and whether it is included in a deployment.
- Whether live-element endpoints need their own tighter throttle.
- Sitemap generation cadence for frequently added venues and events.
- Slug normalization and collision behavior, plus how long old slugs redirect after a rename.
- `og:image` fallback when a business has no photo, and whether event pages get generated share images.
- Exact JSON-LD fields per schema type and how cancelled events are marked (`eventStatus`).

## Related specifications

- [ADR-0004: Use NestJS for Backend APIs](decisions/0004-nestjs-backend-api.MD)
- [ADR-0001: Separate the Public Site and Portal Frontends](decisions/0001-web-application-framework.MD)
- [OpenPlay API and Service Security](security/INTERNAL_SERVICE_SECURITY.MD)
- [Search and discovery](../domain/specifications/SEARCH_AND_DISCOVERY.MD)
- [Business Profile Pages](../domain/specifications/BUSINESS_PROFILE_PAGES.MD)
