# Test Scenarios

The business flows automation must keep green. Each scenario lists its cheapest proving layer (unit = no DB; feature = backend module through HTTP; RLS = database level; integration = cross-module on the running backend; E2E = browser). ✅ = automated coverage exists; everything is unmarked — nothing is implemented yet.

## Golden path — discovery to attendance

The product spine. Every step is independently automatable; the full chain is the P0 E2E flow.

| ✅ | # | Step | Assertions | Level |
| --- | --- | --- | --- | --- |
| | 1 | Player signs up (platform scope) | user created with platform scope, can sign in | feature — IAM |
| | 2 | Player browses businesses, venues, availability | published data only, no private fields | feature + E2E — `golden-chain`, `player-portal` |
| | 3 | Player creates a private reservation | resource held, state `pending_payment` or `confirmed` per venue rule | feature + E2E |
| | 4 | Player pays via integrated checkout (stub) | server-side verification → `paid`, reservation `confirmed`, hold released | integration + E2E |
| | 5 | Player checks in at the venue | attendance `arrived`, booking stays valid | E2E — `venue-ops` |
| | 6 | Booking completes, audit trail intact | `reservation.*` events in sequence on the audit stream | integration |

## Concurrency and conflict

| ✅ | Scenario | Expected | Level |
| --- | --- | --- | --- |
| | Two players submit for the same slot | exactly one wins; loser gets unavailable + refreshed availability | RLS/integration + E2E race |
| | Event registrations exceed capacity | atomic capacity claim; no overbook; group/team counts enforced | feature |
| | Equipment rental exceeds stock | no over-rental; quantity claim is atomic | feature |
| | Payment hold expires before payment | hold released; resource bookable again | integration |
| | Payment succeeds after hold expiry | no silent reclaim — routes to refund/reconciliation | integration |
| | Reminder due, two worker replicas | `FOR UPDATE SKIP LOCKED` — each reminder claimed once | integration |

## Payment verification and states

| ✅ | Scenario | Expected | Level |
| --- | --- | --- | --- |
| | Integrated checkout completes | confirmation only after server-side provider verification; redirect alone is not proof | integration + E2E |
| | Duplicate provider webhook | processed once — no duplicate confirmation or charge | integration |
| | Direct transfer submitted with reference | pending until authorized staff verifies against venue account; screenshot alone is not proof | feature + E2E |
| | Pay-at-venue booking | confirmed with payment due; collected on-site by staff | E2E |
| | Unpaid balance past grace period | venue overdue/cancellation policy applies; started resources never reopen | integration |
| | Cancellation inside refund window | default policy applies; venue override shown before payment | feature |
| | Repeated checkout retries | idempotency key — no duplicate reservations or payments | integration |

## Tenancy and access control

| ✅ | Scenario | Expected | Level |
| --- | --- | --- | --- |
| | Business A queries Business B's data | zero rows at the database level | RLS |
| | Request with unset tenant context | zero rows — fail closed | RLS |
| | Player queries another player's booking | denied — player-row scope only | RLS + feature |
| | Platform Administrator reads tenant data | allowed, audit event with `purpose` recorded | feature + integration |
| | Write attempt with foreign `tenant_id` | blocked by `WITH CHECK` | RLS |
| | Venue staff act outside delegated scope | denied at the application layer | feature |
| | Public endpoint response | allowlisted fields only — no bookings, contacts, payments, notes | contract |
| | Audit immutability | app role cannot UPDATE/DELETE `audit_events` | RLS/integration |

## Persona journeys

| ✅ | Scenario | Expected | Level |
| --- | --- | --- | --- |
| | Business onboarding → platform approval | business cannot publish or take bookings until approved (multi-tenant) | E2E — `bootstrap`, `platform-admin` |
| | Venue setup | resources, activities, rules, payment methods, closures configured | E2E — `venue-admin` |
| | Staff invite → accept → scoped access | staff sees only assigned venues and delegated actions | E2E — `venue-admin` |
| | Guest booking | no account; verification unlocks booking details; same availability/payment rules | E2E — `player-portal` |
| | Membership purchase + benefit | eligible reservation gets member benefit automatically; guest path needs sign-in or verification | feature + E2E |
| | Event lifecycle | create → register → capacity enforcement → results/standings → cancel with refund rules | feature + E2E |
| | Check-in and no-show | arrival recorded; unmarked booking becomes no-show per window; attendance feeds disputes | E2E — `venue-ops` |
| | Closure over booked dates | affected bookings listed; venue cancel/move with notifications | E2E — `venue-ops` |
| | Recurring reservation | per-occurrence checks; conflicts reported, never silently booked | feature + E2E |
| | Dispute → venue response → resolution | status tracked; dispute alone changes no booking/payment state; escalation audited | feature + E2E |
| | Waiver required | booking/check-in blocked until acknowledged; minor needs guardian consent | feature + E2E |
| | Reminder notifications | due reminder sends via Mailpit; cancelled booking skips; restart recovers pending | integration |

## Optional AI assistant

| ✅ | Scenario | Expected | Level |
| --- | --- | --- | --- |
| | Read-only question (stub provider) | answer only from caller-permitted data | feature |
| | Prefill booking form | draft returned to UI; submission re-checks availability/price — no hold created | feature + E2E |
| | Provider disabled | no AI calls; form-based flows unaffected | feature |
| | BYOK key handling | stored ciphertext only; never in responses, logs, or audit | feature |
