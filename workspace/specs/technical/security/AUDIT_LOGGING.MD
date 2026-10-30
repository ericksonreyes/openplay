# Audit Logging

This document describes how OpenPlay records protected actions so every change can be traced later. The audit log is an **event stream**: each action appends a named domain event to the stream of the entity it touched, in the style of event sourcing. Current-state tables still exist — the stream is the authoritative history, not the only state. It is append-only and tenant-scoped; see [Row-Level Security](./ROW_LEVEL_SECURITY.MD) for the isolation model it builds on.

## Goals

- Record every protected action: who did it, what changed, when, and on which business's data.
- Keep a replayable, ordered history per entity — the state of a reservation or payment can be derived by folding its stream.
- Make audit records tamper-resistant inside the database.
- Let Business Owners review their own business's activity and Platform Administrators review activity across the platform.

## Event model

Actions append a row to the `audit_events` table. Draft schema:

```sql
CREATE TABLE audit_events (
  id           uuid PRIMARY KEY,           -- UUIDv7
  tenant_id    uuid,                        -- NULL = platform-level event
  stream_type  text NOT NULL,               -- 'reservation', 'payment', 'membership'
  stream_id    uuid NOT NULL,               -- the entity this event belongs to
  sequence     bigint NOT NULL,             -- per-stream ordering
  event_type   text NOT NULL,               -- 'reservation.approved'
  actor_id     uuid,                        -- IAM user ID (sub); NULL for system
  actor_kind   text NOT NULL,               -- platform|business|player|guest|system
  on_behalf_of uuid,                        -- user/business that initiated a background job
  payload      jsonb NOT NULL,              -- the fact: what changed
  metadata     jsonb NOT NULL,              -- request_id, jti, source, purpose
  occurred_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (stream_type, stream_id, sequence)
);
```

Three properties make this an event stream rather than a flat log:

- **Events are facts in past tense** — `payment.captured`, not "updated payment status to captured".
- **`UNIQUE(stream_type, stream_id, sequence)` gives optimistic ordering** — two writers racing the same stream cannot both claim the next sequence number, which is the storage-level idempotency primitive.
- **State is derivable** — folding a stream produces the entity's current state, so the state table can be checked against history or rebuilt from it.

Example: a reservation requiring approval, paid via GCash —

```text
reservation/0192…c7  seq 1  reservation.requested    actor: player
reservation/0192…c7  seq 2  reservation.approved     actor: venue_manager
reservation/0192…c7  seq 3  reservation.confirmed    actor: system (on payment.captured)
reservation/0192…c7  seq 4  reservation.cancelled    actor: player

payment/0192…e1      seq 1  payment.initiated        actor: player
payment/0192…e1      seq 2  payment.captured         actor: system (webhook wh-4471)
payment/0192…e1      seq 3  payment.refund_requested actor: system
```

`metadata.purpose` is required on Platform Administrator events that touch a business's data.

## Rules

- The event is written in the **same transaction** as the action. The two commit or roll back together — an action is never logged as done when it rolled back.
- The application role can INSERT and SELECT only. UPDATE, DELETE, and TRUNCATE are never granted, so events cannot be changed or removed through the application.
- Payloads never store secrets: no passwords, tokens, payment credentials, or BYOK provider keys. Store references and redacted fields only.
- Background work appends with `actor_kind = 'system'` and fills `on_behalf_of`; live JWTs never travel into jobs or events.
- Guests and failed sign-ins have no `actor_id`; record the verified contact reference or request ID in `metadata` instead.
- This is event-sourcing *format* for audit — not full event sourcing. If a bounded context later adopts real event sourcing (events as the only state), the same stream format applies.

## What gets logged

- All mutations on protected resources, as stream events: `reservation.*`, `registration.*`, `event.*`, `payment.*`, `membership.*`, `equipment.*`, `facility_rules.*`, `staff.*`, `profile.*`, and `provider_settings.*` (never the key value itself).
- Security events on an `auth` stream: sign-in success and failure, denied privileged actions, guest verification, and payment verification.
- Platform Administrator access to a business's data, always with `metadata.purpose`.
- Routine list and detail reads are not logged. Sensitive reads — a Platform Administrator viewing a business's data, a guest opening a booking, payment detail views — are logged.

## Access to the log

- Row-level security scopes the table: Business Owners read their own business's rows; Platform Administrators read all rows; players and guests have no read access. A player-facing "my activity" view is an open decision.
- No endpoint or UI may modify audit rows.

## Open decisions

- Retention period, archival, and export format.
- Whether the set of audited reads expands, and the threshold for "sensitive."
- Whether streams later ship to a separate store for tamper evidence, and whether any bounded context adopts full event sourcing.

## Related specifications

- [Row-Level Security](./ROW_LEVEL_SECURITY.MD)
- [OpenPlay API and Service Security](./INTERNAL_SERVICE_SECURITY.MD)
- [Identity & Access](./IDENTITY_AND_ACCESS.MD)
- [Concurrency and resource conflicts](../../domain/specifications/CONCURRENCY_AND_RESOURCE_CONFLICTS.MD)
