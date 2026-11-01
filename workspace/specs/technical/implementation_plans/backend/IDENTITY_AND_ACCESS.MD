# Identity & access implementation plan

Two cooperating pieces inside `services/backend/`:

- **`iam`** — the identity module: users, credentials, roles, permission catalog, token issuance, sign-in and recovery. It is the sole JWT signer and owns its tables outright ([ADR-0007](../../decisions/0007-iam-as-backend-module.MD)).
- **`tenants`** — the business-account lifecycle: business records, onboarding states, platform approval. IAM never owns the tenant entity; it learns each `tenant_id` through provisioning, per the IAM spec boundary.

## Sources

- [ADR-0007](../../decisions/0007-iam-as-backend-module.MD) — IAM as a backend module
- [Identity & access](../../security/IDENTITY_AND_ACCESS.MD) — scopes, uniqueness, recovery, accountability
- [JWT signing keys](../../security/JWT_SIGNING_KEYS.MD) — RS256 distribution, `JWT_SECRET` fallback rules
- [JWT invalidation](../../security/JWT_INVALIDATION.MD) — Redis blacklist, `exp`-only fallback
- [Internal service security](../../security/INTERNAL_SERVICE_SECURITY.MD) — auth endpoint safeguards
- [Business onboarding and verification](../../../domain/specifications/BUSINESS_ONBOARDING_AND_VERIFICATION.MD) — lifecycle states, approval gate, staff invites
- [User personas](../../../domain/specifications/USER_PERSONAS.MD), [deployment model](../../../domain/specifications/DEPLOYMENT_MODEL.MD) — scope shapes
- [Test accounts](../../../testing/TEST_ACCOUNTS.MD) — canonical seed identities

## Deliverables

### `iam` module

- User store: globally unique UUIDv7 user ids, credentials hashed and never logged, `(scope, username)` and `(scope, email)` uniqueness. Email is optional for tenant staff.
- Scope model: `platform` scope (players, Platform Administrators — email is the identifier) vs `tenant` scope (Business Owners, managers, staff — tenant code or subdomain + username). The same person may hold identities in several scopes; they are distinct user ids.
- Role and permission catalog as canonical seed data, plus per-scope role assignments and staff venue-assignment records.
- Sign-in and recovery endpoints: scope-aware resolution, rate-limited, non-revealing errors. Recovery: email-first for platform scope; tenant-first then `(tenant, identifier)` for tenant scope; owner-initiated reset for staff without email. Reset tokens are single-use, short-lived, bound to `(scope, user_id)`.
- Token issuance: RS256 signing from `JWT_PRIVATE_KEY`; startup logs the resolved signing mode; `JWT_SECRET` symmetric fallback is for local development only and never used when a key pair exists. Claims carry `iss`, `aud`, `exp`, `iat`, `jti`, `sub` (user UUIDv7), `tenant_id` where applicable, `roles`, `permissions`, and venue assignments. Keep lifetimes short.
- Revocation: accepted default is `exp`-only validation; revoked tokens remain valid until expiry. Redis can be added when a deployment needs immediate revocation; IAM then writes `jwt:blacklist:<jti>` with TTL equal to remaining token lifetime and validators check the shared backend-owned Redis instance.
- Verification guards for the whole backend: signature → `iss`/`aud`/`exp` → blacklist check when configured → claims → role/permission policy decorators. Client-supplied tenant, role, or permission fields are never trusted; 401 vs 403 behavior is consistent.
- Staff invite flow: owner/manager invites → invitee accepts → scoped user created with venue assignments. This is the path the E2E bootstrap exercises.
- Authentication lookups (sign-in, issuance, recovery) run under the `app.is_system` service context — no user context exists before sign-in — while user rows still carry `tenant_id` and RLS applies.

### `tenants` module

- Business/tenant entity: tenant code, public business details, contact confirmation, owner link.
- Lifecycle: `setup` → `awaiting_review` → `active` ↔ `suspended`. In multi-tenant mode only `active` businesses can publish profiles or accept public bookings — enforced where those actions are attempted, not just hidden in UI.
- Installation modes: multi-tenant requires Platform Administrator approval; a single-company installation initializes its business and owner without the review step.
- Onboarding endpoints: business submission, owner account creation, and the platform-admin review/approve/suspend/restore API the platform portal consumes. Suspension and restoration record a reason.
- Tenant provisioning into `iam`: creating a business makes its `tenant_id` available as an authorization scope.

## Dependencies

- [Foundation](FOUNDATION.MD) — request pipeline, seeds, env validation (key material).
- [Tenant data](TENANT_DATA.MD) — user/tenant tables follow the same RLS and audit rules; auth lookups use `app.is_system`.

## Acceptance checks

- Sign-in resolves `(scope, identifier)` per scope; identical usernames in different scopes are distinct users; recovery never reveals existence; reset tokens are single-use.
- JWT matrix: bad signature, wrong `iss`/`aud`, expired, revoked `jti`, and missing token produce correct 401/403; `exp`-only fallback is logged when Redis is absent.
- Blacklist entries carry TTL = remaining lifetime when Redis exists.
- Multi-tenant gate: an unapproved or suspended business cannot publish or take public bookings; approve/suspend/restore produce audit events.
- Invite → accept → scoped access works end to end; owner-initiated staff reset works without staff email.
- No other module writes user or credential tables — the boundary holds in review and module linting.
- Auth endpoints are rate-limited; errors do not confirm which accounts or emails exist.

## Open decisions

- Token lifetimes.
- The fine-grained permission catalog contents (delegation granularity) — [open product decisions](../../../domain/specifications/OPEN_PRODUCT_DECISIONS.MD).
- Tenant-code format and collision rules.
