# Backend API Contract

The REST + JSON:API surface the four frontends consume. Envelope rules live in
[ADR-0011](decisions/0011-jsonapi-api-envelope.MD); identifier rules in
[IDENTIFIERS.MD](IDENTIFIERS.MD); auth claims and exposure rules in
[security/](security/README.MD). This document is the inventory — implementation
plans own field-level details.

## Conventions

- **Base**: `http://localhost:8000/api/v1` (local). Media type `application/vnd.api+json`.
- **REST shape**: plural resource collections (`/venues`), `GET` list + `GET /:id`,
  `POST` create, `PATCH` update, `DELETE` remove, `POST /:id/<action>` for state
  transitions (`approve`, `cancel`, `publish`, `check-in`, `suspend`, `restore`).
- **Success**: `{ "data": <resource object or array> }` — `type`, `id` (UUIDv7 or
  SQID per identifiers policy), `attributes`, optional `relationships`/`links`.
- **Errors**: `{ "errors": [{ "status", "code", "title", "detail", "meta": { "request_id" } }] }`.
  `code` is the machine contract: `BAD_REQUEST`, `UNAUTHENTICATED`, `FORBIDDEN`,
  `NOT_FOUND`, `CONFLICT`, `UNPROCESSABLE`, `RATE_LIMITED`, `INTERNAL`, `UNAVAILABLE`.
- **Auth**: `Authorization: Bearer <jwt>` — sign-in is the only way to get one.
  Default deny; endpoints marked *(public)* need no token. 401 = no/invalid token,
  403 = valid token, insufficient permission.
- **Query params** (JSON:API recommended members): `filter[<field>]=`,
  `page[number]`/`page[size]`, `sort=` (comma list, `-` prefix descending).
- **Idempotency**: `Idempotency-Key` header on money/booking POSTs; provider
  webhooks verify signatures and are idempotent server-side.
- Status: ✅ implemented · 🚧 planned

## Shared (all clients)

| Endpoint | Auth | Notes | Status |
| --- | --- | --- | --- |
| `GET /health`, `GET /health/ready` | public | infra checks, outside `/api/v1` | ✅ |
| `GET /api/v1/public/status` | public | connectivity/status resource | ✅ |
| `POST /api/v1/auth/sign-in` | public | `{scope: platform\|tenant, tenantCode?, identifier, password}` → session + RS256 JWT | ✅ |
| `GET /api/v1/me` | any | actor claims echo | ✅ |
| `POST /api/v1/auth/sign-out` | any | revokes jti in Redis blacklist until expiry | ✅ |
| `POST /api/v1/auth/recover` · `POST /api/v1/auth/reset` | public | non-revealing recovery per IAM plan | ✅ |

## Public site (anonymous — `app.is_public`, published rows only, field allowlist)

| Endpoint | Notes | Status |
| --- | --- | --- |
| `GET /api/v1/public/businesses` | published business profiles (search/discovery) | 🚧 |
| `GET /api/v1/public/businesses/:code` | Business Profile Page payload | 🚧 |
| `GET /api/v1/public/businesses/:code/venues` | venues of a published business | 🚧 |
| `GET /api/v1/public/venues/:id` | public venue summary (resources, activities) | 🚧 |
| `GET /api/v1/public/events` | upcoming published events, `filter[date]`, `filter[tenant]` | 🚧 |
| `GET /api/v1/public/events/:id` | public event detail | 🚧 |
| `GET /api/v1/public/venues/:id/availability?date=` | bookable-slot grid (no PII) | 🚧 |

## Player portal (platform-scope player)

| Endpoint | Notes | Status |
| --- | --- | --- |
| `POST /api/v1/auth/sign-up` | platform-scope account creation | ✅ |
| `GET /api/v1/venues` · `/venues/:id` | browse published venues of active tenants | 🚧 |
| `GET /api/v1/activities` · `/activities/:id` | activity catalog | 🚧 |
| `GET /api/v1/venues/:id/availability?date=` | holdable slots for booking | 🚧 |
| `POST /api/v1/reservations` | private reservation (hold → confirm) | 🚧 |
| `GET /api/v1/reservations` · `/reservations/:id` | own reservations only (player-row RLS) | 🚧 |
| `POST /api/v1/reservations/:id/cancel` | cancellation per venue policy | 🚧 |
| `POST /api/v1/guest-bookings` · `POST /api/v1/guest-bookings/:id/verify` | no-account booking + contact verification | 🚧 |
| `GET /api/v1/events` · `/events/:id` | event discovery | 🚧 |
| `POST /api/v1/events/:id/register` · `DELETE /api/v1/registrations/:id` | registration lifecycle | 🚧 |
| `GET /api/v1/membership-plans` · `POST /api/v1/memberships` | plan browse + purchase | 🚧 |
| `GET /api/v1/memberships` · `/memberships/:id` | own memberships | 🚧 |
| `POST /api/v1/rentals` · `GET /api/v1/rentals` | equipment rental at booking | 🚧 |
| `POST /api/v1/payments` | initiate checkout (GCash/Maya stub locally) | 🚧 |
| `GET /api/v1/payments/:id` | own payment status | 🚧 |
| `POST /api/v1/check-ins` | self check-in where enabled | 🚧 |
| `GET /api/v1/notifications` | own notification feed | 🚧 |
| `POST /api/v1/facility-rules/:id/acknowledge` · `POST /api/v1/waivers/:id/sign` | consent records | 🚧 |

## Venue portal (tenant scope — owner/manager/staff)

| Endpoint | Notes | Status |
| --- | --- | --- |
| `GET /api/v1/tenants/current` · `PATCH /api/v1/tenants/current` | business profile/settings | ✅ |
| Venue catalog CRUD | `/venues`, `/resources`, `/activities`, `/prices`, `/facility-rules`, `/closures`, `/waiver-documents` (+ publish/version actions) — `bookings.view` read, `venue.config.manage` write | ✅ |
| `GET /api/v1/schedule?date=&venue_id=` | booking/event calendar feed | 🚧 |
| `POST /api/v1/reservations` (staff) · `POST /reservations/:id/approve|decline` | staff booking ops | 🚧 |
| `POST /api/v1/check-ins` · `POST /reservations/:id/no-show` | front-desk attendance | 🚧 |
| `GET/POST/PATCH/DELETE /api/v1/events` · `GET /events/:id/registrations` | event management | 🚧 |
| `GET/POST/PATCH/DELETE /api/v1/membership-plans` | plan management | 🚧 |
| `GET /api/v1/payments` · `POST /payments/:id/refund` · `GET/POST /disputes/:id/...` | money ops | 🚧 |
| `GET/POST/PATCH/DELETE /api/v1/equipment` · `GET /rentals` | rental inventory + returns | 🚧 |
| `POST /api/v1/staff/invite` · `POST /staff/invite/accept` · `GET /staff` · `PATCH /staff/:id` | staff + venue assignments | ✅ |
| `GET /api/v1/notifications` · `GET /notifications/:id` | tenant notification list | ✅ |
| `GET /api/v1/facility-rules/:id/acknowledgments` · `GET /waiver-documents/:id/signatures` | consent reporting | 🚧 |
| `GET /api/v1/audit-events?stream_type=&stream_id=` | owner-visible activity log | 🚧 |

## Platform portal (platform administrator)

| Endpoint | Notes | Status |
| --- | --- | --- |
| `GET /api/v1/platform/tenants` · `GET /platform/tenants/:id` | review queue | ✅ |
| `POST /api/v1/platform/tenants/:id/approve|suspend|restore` | lifecycle actions | ✅ |
| `POST /api/v1/tenants` | public business submission (creates review item) | ✅ |
| `GET /api/v1/platform/ping` | perm-gated smoke route | ✅ |
| `GET /api/v1/platform/users` · `POST /platform/users/:id/suspend` · `/unsuspend` | platform user admin | ✅ |
| `GET /api/v1/platform/audit-events` | cross-tenant audit read (`purpose` required) | ✅ |
| `GET /api/v1/platform/settings` · `PATCH /platform/settings/:key` | platform configuration | ✅ |

## AI assistant (edge-facing, optional module)

| Endpoint | Notes | Status |
| --- | --- | --- |
| `POST /api/v1/assistant/messages` (+ `GET /assistant/status`) | caller-claims-scoped chat; read-only tools + prefill | ✅ |

## Provider webhooks (public, signature-verified, idempotent — never trusted input)

| Endpoint | Notes | Status |
| --- | --- | --- |
| `POST /api/v1/webhooks/payments/gcash` · `/maya` | payment state transitions; local stubs only | 🚧 |

## Still open (tracked)

- Pagination defaults + `sort` allowlists per collection (plan-level detail).
- Sign-up vs invite-only account creation for staff (IAM plan).
- Rate-limit buckets and thresholds for public/auth endpoints.
- API reference generation from this contract (ADR-0009-style generated artifact).
