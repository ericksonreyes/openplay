# Tenant data implementation plan

The data-layer contract every backend module obeys: tenant-scoped tables, request-scoped RLS context, and the append-only audit event stream. This plan delivers the primitives and guardrails — domain tables arrive with their own module plans.

## Sources

- [ADR-0005](../../decisions/0005-postgresql-row-level-security.MD) — RLS as the second isolation layer
- [Row-level security](../../security/ROW_LEVEL_SECURITY.MD) — mechanism, context settings, policy pattern, test checklist
- [Audit logging](../../security/AUDIT_LOGGING.MD) — event-stream schema and rules
- [Identifiers](../../IDENTIFIERS.MD) — UUIDv7, SQID, reference numbers
- [Internal service security](../../security/INTERNAL_SERVICE_SECURITY.MD) — protected-data rules

## Deliverables

### Schema conventions

- Every tenant-owned table carries `tenant_id` (UUIDv7, `NOT NULL`) plus an index. Children without their own `tenant_id` gate through `EXISTS` on the parent.
- Every tenant-owned table runs `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`.
- Public-facing tables carry a `published` flag for the `app.is_public` read path.
- Identifier conventions enforced in migrations: UUIDv7 entity ids; internal bigint + SQID public id + display reference number on transactional records.
- `openplay_app` non-superuser runtime role (created in the postgres initdb hook); migrations grant only needed privileges — `audit_events` gets `INSERT` and `SELECT` only.

### Request context plumbing

- After JWT verification, all database work for a request runs inside one transaction that begins with `SET LOCAL`:
  - `app.actor_id` — user UUIDv7 from `sub`
  - `app.tenant_id` — business scope from the verified claim
  - `app.is_platform` — Platform Administrator only
  - `app.is_system` — worker/console bypass, set explicitly and greppably
  - `app.is_public` — anonymous public reads
- A NestJS interceptor opens the transaction and sets the context before the handler runs; values come only from verified claims, never request input. Code paths that skip the context transaction see zero rows — fail closed, not error-with-data.
- Workers and console commands use an explicit `app.is_system` path and still record the initiating user and business for audit.

### Policy helpers

- A migration helper that emits the canonical policy shape (`USING` + `WITH CHECK` covering platform/system bypass, tenant match, and player-row scope where a table has one) so each new table gets a correct policy by default.
- An automated check — runnable now, a CI gate later — listing tenant-owned tables missing `ENABLE`/`FORCE`, policies, or the `tenant_id` index. A new table cannot ship silently unguarded.

### Audit event stream

- The `audit_events` table per the spec schema: UUIDv7 `id`, nullable `tenant_id`, `stream_type`/`stream_id`, `sequence` bigint, `event_type`, `actor_id`, `actor_kind`, `on_behalf_of`, `payload`/`metadata` jsonb, `occurred_at`, with `UNIQUE(stream_type, stream_id, sequence)` as the ordering and idempotency primitive.
- An append helper every module uses. It enforces: write in the same transaction as the action; `metadata.purpose` required when a platform actor touches tenant data; no secrets in `payload`/`metadata`.
- The external-arrival pattern for webhooks and jobs: the arrival event commits in its own transaction before work starts; terminal failures record their committed-failure event in the catch's transaction. Never audit attempts that rolled back.
- Read access: owners read their own business's rows via RLS; Platform Administrators read all; no application path can update or delete.

## Dependencies

- [Foundation](FOUNDATION.MD) — the request pipeline this context hooks into, and the migration runner these conventions execute through.

## Acceptance checks

- RLS isolation suite: cross-tenant read and write return zero rows; unset context denies; `WITH CHECK` blocks a foreign `tenant_id`; a player sees only their own rows; `app.is_system` reaches any tenant.
- Audit suite: event commits with the action; rolled-back action leaves no event; the app role cannot `UPDATE`/`DELETE`/`TRUNCATE`; platform access without `purpose` is rejected; concurrent writers cannot claim the same `sequence`.
- The table-lint check reports a deliberately unguarded test table.
- Migrations apply cleanly on the postgres container with the initdb-created role and extensions.

## Open decisions

- Whether assigned-venue scoping moves into RLS or stays in the application layer.
- `published` flag vs dedicated snapshot tables for public content.
- Exact run-time setting names and the full in-scope table list.
- The guest-booking read path: `app.is_system` lookup vs a dedicated guest setting.
- Audit retention, archival, and export format.

All tracked in [Row-level security](../../security/ROW_LEVEL_SECURITY.MD) and [Audit logging](../../security/AUDIT_LOGGING.MD).
