# Row-Level Security for Tenant Data

This document describes how OpenPlay keeps each business's data separate inside PostgreSQL. It uses **row-level security (RLS)** — a PostgreSQL feature that checks every row against a policy before returning or changing it. It applies to the NestJS backend API; see [ADR-0004](../decisions/0004-nestjs-backend-api.MD). Frontends never reach the database.

## Goals

- Keep each business's rows invisible to every other business.
- Give Business Owners full access to their own business's data.
- Give Platform Administrators access to any business's data for authorized support tasks, with every access recorded.
- Make the database enforce the boundary so a forgotten scope in application code fails closed.
- Record every protected action in an audit log; see [Audit Logging](./AUDIT_LOGGING.MD).

## How it fits with application security

Two layers, in depth:

1. **Application layer.** NestJS guards verify the JWT and check role, permission, tenant, and venue scope before a query runs.
2. **Database layer.** RLS policies check every row a query touches. If the first layer has a bug, this layer still blocks cross-tenant access.

RLS answers one question: may this connection see or change this row? Roles, permissions, and assigned-venue limits remain application concerns. RLS is the net, not the mechanism.

## Request-scoped tenant context

Every authenticated request runs its database work inside one transaction:

1. The backend verifies the JWT and reads `sub`, `tenant_id`, `roles`, and `permissions`.
2. It opens a transaction and copies verified claims into run-time settings with `SET LOCAL`:

```text
SET LOCAL app.actor_id    = '<sub claim>'        -- IAM user ID (UUIDv7)
SET LOCAL app.tenant_id   = '<tenant_id claim>'  -- business scope
SET LOCAL app.is_platform = 'true'               -- only for Platform Administrator
```

3. All queries for that request run inside the transaction. `SET LOCAL` ends when the transaction ends, so settings cannot leak between pooled connections.

Rules:

- The values come only from the verified JWT — never from headers, body fields, or URL parameters.
- A missing or empty setting matches no rows. An unset context is a deny, not an error page with data.
- Backend workers and console paths bypass tenant policies with `SET LOCAL app.is_system = 'true'`. The bypass is explicit and greppable, not ambient privilege. Workers still record the user and business that started the work for audit.
- Public and guest requests carry no actor context; see the published-data and guest sections below.

## Who can see which rows

| Persona | Database scope |
|---|---|
| Platform Administrator | All rows in all businesses (`app.is_platform`). Every use is purpose-limited and recorded in the audit log. |
| Business Owner | All rows where `tenant_id` matches their business. |
| Venue Manager / Venue Staff | Same tenant boundary. The narrower assigned-venue limit is enforced in the application layer. |
| Player / participant | Only their own records — rows where the player reference matches `app.actor_id`. |
| Guest | No row-level identity. The API completes guest verification first, then reads the specific record under application control. |
| Public site | Only published rows; see below. |

In a single-company deployment there is only one tenant; the same code path and policies apply unchanged.

## Table and policy requirements

- Every tenant-owned table has a `tenant_id` column (UUIDv7, `NOT NULL`) and an index on it.
- Every tenant-owned table runs `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`. `FORCE` binds even the table owner.
- The application connects as `openplay_app`, a non-superuser role — superusers always bypass RLS.
- Policies cover reads and writes. `WITH CHECK` stops a request from writing a row under another business's `tenant_id`.
- A child table without its own `tenant_id` gates access through `EXISTS` on its parent table.
- Enabling RLS with no matching policy is a default deny — a table is never quietly open.

Example policy for a tenant-owned table that also has player-owned rows:

```sql
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations FORCE ROW LEVEL SECURITY;

CREATE POLICY scope_isolation ON reservations
  USING (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR player_id = NULLIF(current_setting('app.actor_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );
```

`current_setting(name, true)` returns NULL instead of raising an error when a setting is unset, and `NULLIF(..., '')` turns an empty string into NULL so the `uuid` cast cannot fail. Either way the comparison fails and the row is denied.

## Published data for the public site

The public site reads only through read-only API endpoints ([ADR-0004](../decisions/0004-nestjs-backend-api.MD)). At the database level:

- Public-facing queries run with `SET LOCAL app.is_public = 'true'`.
- Public-facing tables (business profiles, venue summaries, event listings) carry a `published` flag; a policy allows `app.is_public` connections to read published rows only.
- RLS limits which rows are returned. It cannot hide individual columns — the API field allowlist still decides which fields leave the backend.

## Audit logging

All actions are recorded in the append-only `audit_events` table; details are in [Audit Logging](./AUDIT_LOGGING.MD). Two requirements intersect with RLS:

- The audit row is written in the same transaction as the action, so the action and its audit record commit or roll back together.
- `audit_events` is tenant-scoped: Business Owners read their own business's rows and Platform Administrators read all rows. The application role receives INSERT and SELECT only — UPDATE, DELETE, and TRUNCATE are never granted, so audit rows cannot be changed through the application.

## Test and migration checklist

- A test proves a request for one tenant cannot read, update, or delete another tenant's rows at the database level.
- A test proves `WITH CHECK` blocks writing a row under a foreign `tenant_id`.
- A test proves one player's context cannot read another player's booking.
- A test proves an unset context returns zero rows.
- A test proves a worker context (`app.is_system`) reaches rows in any tenant.
- An automated check lists tenant-owned tables missing `ENABLE`/`FORCE ROW LEVEL SECURITY` so a new table cannot ship without a policy.
- `tenant_id` is indexed on every tenant table — RLS adds a tenant predicate to every query.

## Open decisions

- The ORM and migration tool for the NestJS backend.
- Whether assigned-venue scoping for managers and staff also moves into RLS (for example `EXISTS` on a staff-assignment table) or stays in the application layer.
- How published content reaches public-facing tables — a `published` flag on shared tables is the current plan; dedicated snapshot tables are the alternative.
- Exact run-time setting names and the full list of tables in scope.
- The guest-booking read path: a service-scoped lookup under `app.is_system`, or a dedicated guest setting.

## Related specifications

- [ADR-0005: Use PostgreSQL Row-Level Security for Tenant Isolation](../decisions/0005-postgresql-row-level-security.MD)
- [Audit Logging](./AUDIT_LOGGING.MD)
- [OpenPlay API and Service Security](./INTERNAL_SERVICE_SECURITY.MD)
- [Identity & Access](./IDENTITY_AND_ACCESS.MD)
- [Identifiers](../IDENTIFIERS.MD)
