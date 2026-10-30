# ADR-0004: Use NestJS for Backend APIs

## Status

Accepted

## Context

OpenPlay will have separate public, player, venue, and Platform Administrator frontends. They need one trusted backend for published content, account access, bookings, events, payments, memberships, and venue operations.

The backend must protect private data and enforce business rules. Frontends must not connect directly to PostgreSQL or other backend data stores.

## Decision

Use NestJS with TypeScript for OpenPlay's backend APIs.

- The backend API serves all four frontends.
- The Next.js public site reads public content through read-only backend endpoints. These endpoints return only published fields and must not expose private bookings, guest contact details, payment records, or internal notes.
- Public endpoints use rate limits and return only the data needed by public pages.
- Player, venue, and Platform Administrator portals use protected API endpoints. The backend verifies identity, tenant scope, role, and permission for each protected action.
- The backend owns database access, booking and capacity rules, payment status, membership benefits, and other business decisions.
- No frontend or Next.js server code may connect directly to PostgreSQL or read backend tables.
- The public site caches stable published content via Incremental Static Regeneration — crawler traffic hits generated pages, not live backend calls. The backend must provide current availability and price when a player submits a booking. Details: [Public Content Delivery](../PUBLIC_CONTENT_DELIVERY.MD).
- Keep public and authenticated API behavior separate, even if both use the same NestJS application.
- Follow the access, tenant-scope, and public-data safeguards in [OpenPlay API and Service Security](../security/INTERNAL_SERVICE_SECURITY.MD), and the database-level tenant isolation and audit logging in [ADR-0005](0005-postgresql-row-level-security.MD).

The example endpoint paths in this ADR are not a final API contract. For example, the backend could provide public read endpoints for published business profiles, venues, and events.

## Reasons

- NestJS provides a structured TypeScript framework for backend APIs.
- One backend keeps business rules and data access in a trusted place.
- All frontends can use the same API contracts while keeping separate user experiences.
- Public read endpoints let Next.js render search-friendly pages without exposing the database.

## Consequences

- The backend must define and maintain API contracts for all frontend apps.
- Public output fields need an explicit allowlist and tests to prevent private data from appearing.
- The backend must enforce permissions and tenant scope. Hiding a page or button in a frontend is not an access control.
- The Next.js public site must follow clear cache rules. Private and time-sensitive data must not be served from stale or public caches.
- The backend framework is selected, but this ADR does not decide the database schema, API protocol, deployment topology, or whether the backend later splits into separate services.

## Alternatives considered

### Let the frontends read PostgreSQL directly

This would tie each frontend to the database schema and could bypass backend permissions and business rules. It is not selected.

### Use a different backend framework

Other frameworks could serve the APIs. NestJS is selected to provide a TypeScript structure for the backend.
