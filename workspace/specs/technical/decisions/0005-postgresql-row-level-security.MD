# ADR-0005: Use PostgreSQL Row-Level Security for Tenant Isolation

## Status

Accepted

## Context

OpenPlay supports a multi-tenant deployment where each Business Owner's data must stay inside their own business, while Platform Administrators may reach any business's data for authorized support tasks. Application-level scoping alone can be forgotten in one query and leak rows. Every protected action must also be recorded for audit.

## Decision

Use PostgreSQL row-level security (RLS) as a second isolation layer inside the database, behind the NestJS permission checks.

- The backend copies verified JWT claims into request-scoped settings (`app.actor_id`, `app.tenant_id`, `app.is_platform`) with `SET LOCAL` inside the request's transaction. Values never come from request input.
- Every tenant-owned table carries an indexed `tenant_id`, runs `ENABLE` + `FORCE ROW LEVEL SECURITY`, and defines read and write policies. No matching policy means no rows.
- Tables with venue-scoped records also enforce assigned-venue visibility in RLS using active assignment rows loaded inside the request transaction; NestJS services perform the matching permission checks. The backend sets the resulting venue scope transaction-locally.
- The application connects as `openplay_app`, a non-superuser role.
- Platform Administrator access uses `app.is_platform`; backend workers and console paths use an explicit `app.is_system` bypass.
- Public-facing tables use a `published` flag and a public-read policy; the API field allowlist still controls which columns leave the backend.
- Verified guest reads use a dedicated context containing an opaque verified-contact ID, never the general `app.is_system` bypass.
- Every protected action writes a row to the append-only `audit_events` table in the same transaction. Business Owners read their own business's audit rows; Platform Administrators read all rows; audit rows cannot be updated or deleted through the application.
- Mechanism, scope matrix, and test requirements: [Row-Level Security](../security/ROW_LEVEL_SECURITY.MD) and [Audit Logging](../security/AUDIT_LOGGING.MD).

## Reasons

- A forgotten application scope fails closed to an empty set instead of leaking another business's rows.
- One database with per-row policies keeps the single-company and multi-tenant deployments on the same code path.
- `SET LOCAL` is transaction-scoped, so tenant context cannot leak between pooled connections.
- Writing audit rows in the same transaction guarantees the log matches what actually committed.

## Consequences

- All data access for a request must run inside a transaction that has the tenant context set. Code paths that skip it see zero rows.
- Every new tenant table needs `tenant_id`, an index, and policies; a checklist or automated check must catch tables that ship without RLS.
- RLS does not replace role or action-permission checks in NestJS. Venue assignment is checked in both places; RLS remains the fail-closed backstop.
- Connection poolers that share sessions must not leak settings; `SET LOCAL` is the required form.
- Prisma and Prisma Migrate are selected by [ADR-0010](0010-prisma-backend-persistence.MD). Audit retention and the exact table list remain open.

## Alternatives considered

### Application-level scoping only

Tenant filters in queries work until one query forgets the filter. It stays as the first layer, but alone it cannot fail closed. Not selected as the only control.

### Schema- or database-per-tenant

Stronger isolation, but it multiplies migrations, backups, and operational work, and it complicates the single-company deployment. Not selected; it can be revisited if tenant scale demands it.
