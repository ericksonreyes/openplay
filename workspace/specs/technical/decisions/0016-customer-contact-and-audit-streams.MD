# ADR-0016: Customer Contact Fields, Tenant-Owned Notes, and Global Audit Sequences

## Status

Accepted

## Context

Two decisions landed together:

1. The front desk needs to reach customers by phone. `iam_users`
   (member accounts) had no phone field at all — only guest contacts
   did. Staff also need free-text notes about customers, and notes a
   venue writes about a player must not pollute the player's global
   identity record.
2. While wiring audit events for these mutations we hit a latent
   bug: `AuditService.append` computed `sequence` as `MAX+1` inside
   the caller's tenant-RLS transaction. Streams shared across tenants
   (e.g. `iam_user`, where `user.registered` is written with NULL
   tenant) had invisible earlier events, so `next` recomputed to 1
   and the insert failed the unique constraint.

## Decision

1. **`iam_users.phone`** — nullable, staff-editable via
   `PATCH /reservations/players/:id` (`bookings.manage`). Player
   account writes go through `system.run` because player rows are
   platform-scope; the *audit event* is still attributed to the
   staff actor's tenant.
2. **Member notes are tenant-owned.** `customer_notes`
   (`tenant_id + player_id`, upsert) — a venue's notes about a
   customer belong to that tenant, never to the player's account.
   Guests keep notes inline on `guest_contacts.notes`.
3. **Every mutation writes an event-sourced audit row** —
   `iam_user.phone_updated` (`{from,to}`), `customer_note.updated`,
   `guest_contact.updated` (`{changed,…}`), appended in the caller's
   transaction so change and event commit together.
4. **Audit sequence is computed globally.** `append` reads
   `MAX(sequence)` under `app.is_system` so it sees the whole stream
   regardless of RLS; the insert still runs in the caller's tx.

## Consequences

- Staff can maintain phone + notes on both customer kinds from the
  Customers page; all changes are attributable via `audit_events`.
- Cross-tenant audit streams (`iam_user`, anything NULL-tenant) can
  no longer collide on sequence — the visibility bug is fixed for
  all streams, not just these.
- The staff-invite / registration streams (`iam_user`) keep their
  canonical single-stream ordering; sequence is never per-tenant.
