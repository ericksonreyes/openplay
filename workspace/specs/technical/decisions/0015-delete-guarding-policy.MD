# ADR-0015: Delete Guarding — Friendly Conflicts, Database as Last Line

## Status

Accepted

## Context

A delete-path inventory found three weak spots:

- **Application layer** — every delete service calls `db.*.delete()`
  with no reference checks; removing a facility with active
  reservations silently succeeds.
- **Database layer** — FK coverage is thin. `memberships.plan_id`
  RESTRICTs plan deletes (good); `venues → venue_resources` CASCADEs
  (deleting a venue silently removes its facilities — a foot-gun for
  multi-venue tenants); most other references (`reservations`,
  `venue_prices`, `rentals`, `consent_records`,
  `event_registrations`) have no FK at all, so deletes orphan rows.
- **Error surface** — Prisma `P2003` violations fall through the
  exception filter as `500 Internal server error`, not a readable
  conflict.

## Decision

1. **Application checks come first.** Delete services check for
   active/dependent records before deleting and raise
   `409 ConflictException` with a plain-language message ("Court D has
   12 upcoming reservations — cancel them or schedule a closure
   instead").
2. **P2003 → 409.** The global exception filter maps Prisma foreign-key
   violations to `409 CONFLICT` with a generic friendly detail, so the
   DB constraint never produces a raw 500.
3. **Venues, facilities, and activities with history are never
   deletable.** Any reservations/events on record → `409` naming the
   record's retirement verb — audit and attendance records depend on
   the row. Deletes are draft/never-used records only (non-`draft`
   rows or draft rows with links are rejected before `delete()`).
   Upcoming bookings still surface the actionable message first
   ("cancel them or schedule a closure").

   Retirement verbs match each entity's lifecycle language: venues
   and facilities use Commission / Decommission / Recommission
   (`status: archived`); activities, facility rules, and waivers use
   Publish / Unpublish (waiver docs retire via "Retire waiver";
   closures cancel via "Cancel closure" and are never deletable). `archived` displays as "decommissioned" for
   venues/facilities; activity and document flows show the raw
   status.

4. **Prices lifecycle on `active`, not `status`.** `venue_prices`
   has no status column — `active: true` is "published",
   `active: false` is "unpublished". Deleting a published price →
   `409` "unpublish it instead"; unpublished prices are deletable
   (prices are leaf records — nothing references them).
5. **DB constraints remain the last line.** Keep `RESTRICT` on
   membership plans; the `venues → venue_resources` CASCADE stays
   documented as a known foot-gun — mitigated by the history +
   facilities checks above.
5. **Frontend stays confirm-gated.** ADR-0013 requires `confirm` text
   on destructive row actions, so users see the conflict message only
   after a deliberate confirm.

## Alternatives considered

- **Cascade everywhere** — simplest but loses referential integrity
  signals and deletes real records (reservations, consent evidence)
  silently.
- **FKs on every soft reference** — heavier migration work; the
   application-level checks give equivalent protection with better
   error messages, so FKs are only added where a foot-gun exists
   already (plan members).

## Guard matrix (audit + regression checklist)

UI delete gating mirrors the backend — but the backend 409 is the
enforcement; UI gating is cosmetic only (no action → the 409 teaches).

| Entity | UI shows Delete when | Backend `delete*` rejects when |
|---|---|---|
| Venue | `status = draft` | bookings+events > 0 → decommission; facilities > 0 → remove first |
| Facility | `status = draft` | upcoming bookings → cancel/close; bookings+events > 0 → decommission |
| Activity | `status = draft` | `status != draft` → unpublish; linked bookings/events/prices > 0 → unpublish |
| Price | never (publish/unpublish only) | `active = true` → unpublish |
| Equipment | `status = draft` | `status != draft` → decommission; open rentals → return/cancel; rental history > 0 → decommission |
| Facility rule | `status = draft` | `status != draft` → unpublish; acknowledgments recorded → archive |
| Waiver doc | `status = draft` | `status != draft` → retire; signatures recorded → archive |
| Closure | never (cancel only) | always → "cancel it instead" (DELETE is 409); holidays toggle Publish/Unpublish (scheduled↔cancelled) |
| Membership plan | always | members on plan → reassign (P2003 → 409 fallback) |
| Others (generic CrudPage) | `canDelete` prop, default true | serializer-level guards only |

Status transitions shown in UI (when-gated):

| Entity | draft | active | archived / unpublished |
|---|---|---|---|
| Venue | Activate venue | Decommission venue | Recommission venue |
| Facility | Commission facility | Decommission facility | Recommission facility |
| Equipment | Commission equipment | Decommission equipment | Recommission equipment |
| Activity | Publish activity | Unpublish activity | Publish activity |
| Price (`active` flag) | — | Unpublish price | Publish price |
| Facility rule | Publish | Unpublish | Publish |
| Waiver doc | Publish waiver | Retire waiver | — |
| Closure | — | — | Cancel closure (scheduled only) |
| Waiver version | Publish | Retire | — |

## Consequences

- Deleting a referenced facility/venue/plan now surfaces a readable
  `409` in the portal instead of silent success or a raw `500`.
- Delete services need a reference-check helper per entity (count of
  active dependents) before `delete()`.
