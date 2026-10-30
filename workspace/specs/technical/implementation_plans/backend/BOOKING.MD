# Booking implementation plan

The `booking` module: availability computation and the reservation lifecycle — private, guest, and recurring — plus check-in/attendance and waiver-consent records. This is the product spine and holds the most contested writes in the system.

## Sources

- [Private reservations](../../../domain/specifications/PRIVATE_RESERVATIONS.MD) — lifecycle, cancellation/refund policy
- [Guest booking](../../../domain/specifications/GUEST_BOOKING.MD) — account-free booking and protected access
- [Recurring reservations](../../../domain/specifications/RECURRING_RESERVATIONS.MD) — series rules
- [Concurrency and resource conflicts](../../../domain/specifications/CONCURRENCY_AND_RESOURCE_CONFLICTS.MD) — the atomicity contract and PostgreSQL mechanisms
- [Check-in and attendance](../../../domain/specifications/CHECK_IN_AND_ATTENDANCE.MD) — arrival, no-show, evidence
- [Waivers and consent](../../../domain/specifications/WAIVERS_AND_CONSENT.MD) — consent recording
- [Platforms and payments](../../../domain/specifications/PLATFORMS_AND_PAYMENTS.MD) — holds, approval, payment-state interplay

## Deliverables

- **Availability engine**: computes the bookable grid for a resource and date from operating hours, start-time increments, duration, turnover buffer, closures, event occupancy, and existing reservations. Results are informational — every submission revalidates.
- **Reservations**: lifecycle states (`pending_approval` → `pending_payment`/`confirmed` → `completed`/`cancelled`/`no_show`), instant booking by default, request-based approval as a venue option. Player, guest, owner, manager, and delegated-staff endpoints each under their permission scope.
- **Conflict guarantee**: an exclusion constraint on `(resource_id, time_range)` including buffer via `btree_gist` — PostgreSQL itself rejects overlapping inserts. Transaction-scoped advisory lock on `resource_id` is the documented fallback; `FOR UPDATE NOWAIT` for contested claims. Events occupy the same conflict space through [Events](EVENTS.MD).
- **Holds**: temporary resource claims during checkout, approval, or transfer-verification windows. Holds expire deterministically; failure or expiry releases the slot; a payment arriving after expiry routes to refund/reconciliation — never a silent reclaim. Submissions carry idempotency keys. The hold expiry/idempotency pattern is defined once here and reused by events and rentals for their own hold types.
- **Guest booking**: minimal contact capture, time-limited secure link or one-time code to the verified contact, access scoped to exactly that booking, and optional later account linking after proving control of the contact method. No lookup can reveal another person's booking.
- **Recurring series**: pattern expansion with an end date or occurrence limit; every occurrence is availability-checked; conflicting dates are reported with alternatives — never a silently partial series. Single-occurrence and remaining-series cancellation; per-occurrence independence for payment, cancellation, and benefits; venue limits on horizon and eligible resources.
- **Check-in/attendance**: booking QR code (identifies the booking only — not a payment or membership credential), venue-configured arrival and no-show windows, staff scan or manual lookup, attendance record, no-show marking manual or automatic per venue settings. Guests check in through the same flow after verification. An unmarked booking never silently becomes a charge.
- **Consent records**: waiver acknowledgment required before the protected action completes; the record stores participant (or guardian + minor participant), waiver version, timestamp, and covered action; immutable once written; guests recorded against their verified contact reference.
- **Cancellation policy evaluation**: defaults — full refund ≥24h before start, none for later cancel or no-show, full on venue cancel — with venue overrides resolved and surfaced before payment. Evaluation happens here; refund execution is [Commerce](COMMERCE.MD)'s.
- **Audit streams** `reservation.*`, `attendance.*`, `consent.*` in order per stream; guest actors recorded via contact reference in `metadata`.
- Player-portal, venue-portal, and guest-facing endpoints; booking records expose evidence (attendance, payment status) to disputes in [Commerce](COMMERCE.MD).

## Dependencies

- [Foundation](FOUNDATION.MD), [Tenant data](TENANT_DATA.MD), [Identity & access](IDENTITY_AND_ACCESS.MD).
- [Venue catalog](VENUE_CATALOG.MD) — operating settings, rules, closures, waiver requirements.
- [Commerce](COMMERCE.MD) — payment holds, verification, refunds (booking orchestrates; commerce executes money movement).

## Acceptance checks

- Two concurrent submissions for the same slot: exactly one wins; the loser gets unavailable + refreshed availability ([test scenarios](../../../testing/TEST_SCENARIOS.MD)).
- Hold expiry releases the slot; a late webhook routes to reconciliation; retried submissions never duplicate.
- Guest booking completes without an account; details open only after verification; no enumeration path exists.
- A recurring series reports conflicts with alternatives; occurrences cancel independently.
- Check-in records arrival by QR or lookup; the no-show window marks correctly; required waivers block booking until acknowledged, including guardian consent for minors.
- `reservation.*` audit events commit in order with each action; player-row scope holds at RLS level.

## Open decisions

- Guest contact fields, verification method, link/code expiry, eligible booking types, abuse limits — [Guest booking](../../../domain/specifications/GUEST_BOOKING.MD).
- Self check-in, arrival/no-show windows, attendance retention — [Check-in and attendance](../../../domain/specifications/CHECK_IN_AND_ATTENDANCE.MD).
- Consent period and covered booking types — [Waivers and consent](../../../domain/specifications/WAIVERS_AND_CONSENT.MD).
- Recurrence patterns, series horizon and pricing, skipped-occurrence visibility — [Recurring reservations](../../../domain/specifications/RECURRING_RESERVATIONS.MD).
- No-show fee policy and time-zone handling — [open product decisions](../../../domain/specifications/OPEN_PRODUCT_DECISIONS.MD).
