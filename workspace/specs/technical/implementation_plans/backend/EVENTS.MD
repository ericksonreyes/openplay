# Events implementation plan

The `events` module: scheduled events — organized venue activities players register for — plus Open Play as the first fully defined format. Event occurrences occupy resources in the same conflict space as reservations, and registrations claim capacity atomically.

## Sources

- [Scheduled events](../../../domain/specifications/SCHEDULED_EVENTS.MD) — formats, registration, capacity, fees, standings
- [Open-play sessions](../../../domain/specifications/OPEN_PLAY_SESSIONS.MD) — the first format's participation rules
- [Concurrency and resource conflicts](../../../domain/specifications/CONCURRENCY_AND_RESOURCE_CONFLICTS.MD) — atomic capacity claims
- [Platforms and payments](../../../domain/specifications/PLATFORMS_AND_PAYMENTS.MD) — fee timing, approval, holds
- [Memberships](../../../domain/specifications/MEMBERSHIPS.MD) — benefits apply to eligible registrations

## Deliverables

- **Event entity**: activity, venue-defined format, schedule, registration window, numeric capacity limit and unit (individual participants, group seats, teams), inherited or explicitly overridden fee basis and price, payment timing rule (full / deposit / later / at venue), and a status lifecycle (`draft` → `published` → registration `open`/`closed` → `complete`/`cancelled`). The Business Owner sets a default fee basis before the first paid event.
- **Series**: recurring events with configurable repeat rules, date exceptions, and edits to the full series or a single occurrence. Exact repeat patterns and series horizons remain open — build the structure so rules can land per format.
- **Resource assignment**: each occurrence occupies its assigned resources for its scheduled time plus buffer — the same exclusion-constraint space as reservations in [Booking](BOOKING.MD), so an event and a private reservation can never double-book a resource.
- **Registration**: atomic capacity claims — `SELECT ... FOR NO KEY UPDATE` on the event row, check remaining capacity, write — with `NOWAIT` for contested last places. Individual, group, and named-team registration with per-event team-size and roster rules; duplicate registrations are impossible; guest registration follows the guest-booking rules when enabled.
- **Waitlists**: event-level opt-in after the organizer sets a response deadline; queue order is preserved, and an opening is offered to the next eligible player for acceptance through the normal registration flow. Group/team eligibility remains open.
- **Payment timing**: upfront payment or deposit keeps the registration pending under a temporary capacity hold and confirms only after server-side verification; failure or expiry releases the place. Payment-later registrations confirm with amount and due time displayed and follow venue grace/no-show policy. Approval-required events hold capacity while pending and collect no payment before approval.
- **Open Play format**: individual registration with a participant limit, delivered as a format configuration — zero format-specific code paths. Sessions show open/full/cancelled and remaining places.
- **Results and standings**: opt-in per event; authorized organizers enter or correct results; event-specific scoring and ranking rules compute standings, with no universal sport preset; standings visibility follows the event's rules.
- **Cancellation**: venue-initiated cancellation applies refund rules through [Commerce](COMMERCE.MD) and triggers notifications; cancelled events accept no registrations.
- **Audit streams** `event.*` and `registration.*`; permissions enforced per owner/manager/delegated staff and organizer roles.
- Public listing data — published, indexable events — exposed to [Public content](PUBLIC_CONTENT.MD).

## Dependencies

- [Foundation](FOUNDATION.MD), [Tenant data](TENANT_DATA.MD), [Identity & access](IDENTITY_AND_ACCESS.MD).
- [Venue catalog](VENUE_CATALOG.MD) — venues, resources, activities, closures affecting scheduling.
- [Booking](BOOKING.MD) — the shared resource-conflict space and the hold pattern.
- [Commerce](COMMERCE.MD) — fee collection, holds, refunds, membership benefits at pricing time.

## Acceptance checks

- Concurrent registrations never exceed capacity or duplicate; group and team counts are enforced.
- Pending-until-paid registrations release the place on expiry or failure; pay-later registrations show amount and due time.
- An event waitlist does not consume capacity or charge a player; an available place is offered in queue order and registration requires acceptance before the configured deadline.
- An event occurrence blocks a conflicting reservation — and vice versa.
- Standings compute from recorded results under the event's configured rules and stay within visibility rules.
- Open Play works entirely through format configuration.
- `event.*`/`registration.*` audit events commit with each action; RLS isolation holds.

## Open decisions

- Exact recurrence patterns and series horizon.
- Exact team-size/roster rules and group/team capacity counting.
- Scoring presets, tie-breaks, result corrections, standings visibility.
- Event-specific payment deadlines.
- Waitlist eligibility for group/team registrations — [Scheduled events](../../../domain/specifications/SCHEDULED_EVENTS.MD) and [open product decisions](../../../domain/decisions/OPEN_PRODUCT_DECISIONS.MD).
