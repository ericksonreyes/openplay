# Backend — Implementation Plans

Plans for `services/backend/` — the NestJS + TypeScript + PostgreSQL backend that serves all four frontends ([SERVICE_MAP.md](../../../../../SERVICE_MAP.md), [ADR-0004](../../decisions/0004-nestjs-backend-api.MD)). One modular monolith: each module owns its tables, and cross-module calls go through permission-checked services — never shared tables or outside access to a module's data.

## Foundation

- [Foundation](FOUNDATION.MD) — app shell, module conventions, env config, request pipeline, errors, health, migrations, seeds
- [Tenant data](TENANT_DATA.MD) — schema conventions, RLS context plumbing, audit event stream
- [Identity & access](IDENTITY_AND_ACCESS.MD) — the `iam` module (users, credentials, JWT) plus the tenant/business account lifecycle it does not own but provisions against

## Domain modules

- [Venue catalog](VENUE_CATALOG.MD) — business profile content, venues, resources, activities, prices, facility rules, closures, waiver documents
- [Booking](BOOKING.MD) — availability, private/guest/recurring reservations, holds, check-in and attendance, consent records
- [Events](EVENTS.MD) — scheduled events, registration, series, results and standings (Open Play as the first format)
- [Commerce](COMMERCE.MD) — payments, memberships, equipment rentals, disputes
- [Notifications](NOTIFICATIONS.MD) — notification records, reminder worker, delivery channels

## Edge-facing modules

- [Public content](PUBLIC_CONTENT.MD) — the anonymous, read-only public API that feeds the public site
- [AI assistant](AI_ASSISTANT.MD) — the optional assistant module: provider adapters, read-only tools, prefill

## Module-boundary rules

- Each module owns its tables. Another module that needs data calls the owning module's service under the caller's context — row-level security still applies.
- `iam` has a hard boundary per [ADR-0007](../../decisions/0007-iam-as-backend-module.MD): no other module writes to user/credential tables or issues tokens, so it can be extracted later.
- Deterministic business rules (pricing, conflicts, capacity, refunds, verification) live in these modules — never in frontends, the assistant, or ad-hoc SQL.
- Every mutation writes its `audit_events` row in the same transaction, per [Tenant data](TENANT_DATA.MD).
- Tenant-owned tables follow the RLS contract in [Tenant data](TENANT_DATA.MD); a table without `ENABLE` + `FORCE` and policies must not ship.
