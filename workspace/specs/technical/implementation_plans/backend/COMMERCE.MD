# Commerce implementation plan

Everything that moves money or grants paid entitlements, as four cooperating modules in `services/backend/`: `payments`, `memberships`, `rentals`, and `disputes`. Provider integrations sit behind port/adapter boundaries with deterministic stubs for tests — domain code never calls a vendor SDK directly.

## Sources

- [Platforms and payments](../../../domain/specifications/PLATFORMS_AND_PAYMENTS.MD) — methods, holds, verification, grace periods, approval
- [Memberships](../../../domain/specifications/MEMBERSHIPS.MD) — plans, benefits, billing, in-person identification
- [Equipment rentals](../../../domain/specifications/EQUIPMENT_RENTALS.MD) — catalog, stock, rental lifecycle
- [Disputes](../../../domain/specifications/DISPUTES.MD) — dispute model, handling, escalation
- [Private reservations](../../../domain/specifications/PRIVATE_RESERVATIONS.MD) — the default refund policy
- [Guest booking](../../../domain/specifications/GUEST_BOOKING.MD) — guest payment and membership-verification rules
- [Internal service security](../../security/INTERNAL_SERVICE_SECURITY.MD) — webhook verification, receipt privacy
- [Concurrency and resource conflicts](../../../domain/specifications/CONCURRENCY_AND_RESOURCE_CONFLICTS.MD) — stock/capacity claims, idempotency
- [Identifiers](../../IDENTIFIERS.MD) — SQID masking on transactional records

## Deliverables

### `payments`

- Payment records on the transactional identifier pattern: internal bigint + SQID public id + display reference number. Itemized charges; a status lifecycle kept deliberately separate from booking/event/rental confirmation — a record can be confirmed while payment is still due.
- Payment-method configuration per business: integrated checkout, direct transfer with venue account details and instructions, and pay-at-venue.
- **Integrated checkout** (GCash/Maya behind provider port/adapters; a deterministic stub adapter serves E2E): create checkout → provider redirect → signed webhook/callback arrives → verify signature server-side → process idempotently → confirm and release the hold. The arrival event commits in its own transaction before processing, per [Audit logging](../../security/AUDIT_LOGGING.MD). A browser redirect is never proof of payment.
- **Direct transfer**: payment pending while held; the player submits a transaction reference and optional receipt image (private storage, controlled access — never a public route); authorized staff match the transfer against the venue's account records; a screenshot alone never confirms. Rejection or hold expiry releases the hold.
- **Pay-at-venue**: confirm with amount due; staff record collection; a grace period (15-minute default, venue-configurable) runs from scheduled start or pickup; overdue falls to venue policy; a resource whose use has started is never reopened for rebooking.
- **Refunds**: execute through the provider adapter or a recorded manual path for transfers, driven by the cancellation policy evaluated in [Booking](BOOKING.MD); refund status is tracked.
- **Idempotency and reconciliation**: idempotency keys on checkout and submissions; duplicate webhooks have a single effect; a payment verified after its hold expired routes to refund/reconciliation rather than silently claiming the resource.
- Public webhook endpoints on their own rate-limit bucket — public route, verified payloads only.

### `memberships`

- Membership plans: scope (selected venues or all venues in the business), eligibility, price, term, optional expiration, one-time vs recurring billing (recurring requires player consent and a payment method that supports repeat charges), and benefits (discounts, earlier booking window).
- Membership records: activation per plan policy, status, expiration; the benefits engine applies eligible benefits automatically when [Booking](BOOKING.MD), [Events](EVENTS.MD), or `rentals` price a transaction — never in UI code.
- Member identification: QR code resolving to the membership record (identifier only — scanning still checks venue eligibility and active status), optional member photo for authorized verifiers, guest membership verification per the guest rules. A membership is an entitlement, not a stored-value wallet.
- Renewals: automatic where the method supports it; manual renewal for direct transfer and pay-at-venue; expiry handling.

### `rentals`

- Equipment catalog with activity associations and owner-set prices; stock quantities maintained by managers and staff.
- Rentals as add-on or standalone: quantity claims are atomic against stock (`FOR NO KEY UPDATE` on the inventory row), covering rental interval plus pickup/return windows; checkout and return recording; uncollected equipment releases per no-show policy; itemized charges flow through `payments`.

### `disputes`

- Dispute records on a player's or verified guest's own booking, registration, rental, or payment: category, the player's account, attachments in private storage, and a configurable open window.
- Status flow `open` → `under review` → `resolved`/`escalated`; every response and status change recorded so both sides see one history. Venue responses come from managers and delegated staff; refund decisions stay owner-only.
- Evidence is pulled from attendance records, payment verification records, and the audit log — not ad-hoc claims.
- Opening a dispute changes nothing: no mutation to booking, payment, or rental state until an authorized action happens through the owning flow.
- Multi-tenant escalation to the Platform Administrator with purpose-limited, audited access.

## Dependencies

- [Foundation](FOUNDATION.MD), [Tenant data](TENANT_DATA.MD), [Identity & access](IDENTITY_AND_ACCESS.MD).
- Consumed by [Booking](BOOKING.MD) and [Events](EVENTS.MD), which orchestrate holds and confirmation through the payment service.

## Acceptance checks

- Confirmation requires server-side verification; a duplicate webhook processes once; a screenshot never marks paid.
- Grace expiry applies venue policy; started resources never reopen; checked-out equipment stays unavailable until returned.
- Refunds follow the policy shown before payment, through provider or manual path.
- Benefits auto-apply only for eligible records at covered venues; a guest gets benefits only after verification; a QR alone never grants them.
- Concurrent rental requests never exceed stock; checkout/return lifecycle completes.
- A dispute changes no state by itself; escalation is audited with `metadata.purpose`.
- Money records expose only SQIDs externally — no sequential ids leak.

## Open decisions

- Checkout-hold and transfer-verification deadlines, payment fees, provider refund mechanics, reconciliation detail, GCash/Maya integration specifics, no-show fees — [Platforms and payments](../../../domain/specifications/PLATFORMS_AND_PAYMENTS.MD) and [open product decisions](../../../domain/specifications/OPEN_PRODUCT_DECISIONS.MD).
- Membership renewal intervals, failed-payment retries, expiration-vs-term interaction, all-venues scope semantics — [Memberships](../../../domain/specifications/MEMBERSHIPS.MD).
- Item-level vs quantity tracking, deposits, late/damage/loss policy — [Equipment rentals](../../../domain/specifications/EQUIPMENT_RENTALS.MD).
- Dispute deadlines, category routing, collection pauses, reopening — [Disputes](../../../domain/specifications/DISPUTES.MD).
