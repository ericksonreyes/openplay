# Venue portal implementation plan

The venue-operations app in `services/venue-portal/` (React + Tailwind, local port 3002). It serves the tenant scope: Business Owners, venue managers, and delegated staff sign in with tenant code + username. Every screen honors delegated permissions — a staff member sees only their assigned venues and delegated actions.

## Sources

- [ADR-0001](../../decisions/0001-web-application-framework.MD) — React venue portal, separate app
- [ADR-0002](../../decisions/0002-tailwind-css-for-styling.MD) — Tailwind CSS
- [ADR-0003](../../decisions/0003-docker-local-development.MD) — service-owned Compose file, Dockerfile, `.env.example`, installer
- [ADR-0004](../../decisions/0004-nestjs-backend-api.MD) — protected endpoints; the backend owns all rules
- [Business onboarding and verification](../../../domain/specifications/BUSINESS_ONBOARDING_AND_VERIFICATION.MD), [venue resources and activities](../../../domain/specifications/VENUE_RESOURCES_AND_ACTIVITIES.MD), [facility use rules](../../../domain/specifications/FACILITY_USE_RULES.MD), [venue closures and blackouts](../../../domain/specifications/VENUE_CLOSURES_AND_BLACKOUTS.MD), [waivers and consent](../../../domain/specifications/WAIVERS_AND_CONSENT.MD), [private reservations](../../../domain/specifications/PRIVATE_RESERVATIONS.MD), [scheduled events](../../../domain/specifications/SCHEDULED_EVENTS.MD), [check-in and attendance](../../../domain/specifications/CHECK_IN_AND_ATTENDANCE.MD), [equipment rentals](../../../domain/specifications/EQUIPMENT_RENTALS.MD), [memberships](../../../domain/specifications/MEMBERSHIPS.MD), [platforms and payments](../../../domain/specifications/PLATFORMS_AND_PAYMENTS.MD), [disputes](../../../domain/specifications/DISPUTES.MD), [business profile pages](../../../domain/specifications/BUSINESS_PROFILE_PAGES.MD), [AI assistant](../../../domain/specifications/AI_ASSISTANT.MD)
- [User personas](../../../domain/specifications/USER_PERSONAS.MD) — owner/manager/staff permission boundaries
- [Identity & access](../../security/IDENTITY_AND_ACCESS.MD) — tenant scope, staff sign-in, owner-initiated reset
- [AI governance](../../AI_GOVERNANCE.MD) — provider settings, failure notices, on/off behavior
- [User experience](../../user_experience/README.MD)

## Areas

### Onboarding and business setup

- Business profile and account setup during onboarding; verification state shown until the business is active.
- Business settings: policies, payment methods and transfer instructions, booking rules, cancellation/refund policy, guest-checkout toggle, publish/unpublish controls for the Business Profile Page.

### Venue configuration

- Venues, bookable resources, and activity associations; operating hours, reservation durations, start-time increments, buffers, booking horizons, prices — owner-set values with manager maintenance inside them.
- Facility Use Rules editor scoped to business/venue/activity/resource, with public vs internal marking.
- Versioned waiver documents with scope and requirement settings (before booking, check-in, or first visit).
- Closures/blackouts including recurring patterns — creation shows the affected existing bookings and events before saving and offers keep/move/cancel per record.

### Operations

- Schedule and availability calendar per resource.
- Reservation management: review, approve (when request-approval is enabled), move, cancel; pending approval queue with hold expiry.
- Event management: create/publish/cancel events and series, registration lists, capacity monitoring, results entry for standings.
- Check-in desk: QR scan or manual lookup, arrival recording within venue windows, no-show marking per venue settings.
- Rentals: stock levels, checkout and return recording, uncollected-equipment release.
- Transfer verification queue: match submitted references against the venue's account records — a screenshot alone never confirms; authorized roles only.
- Dispute queue: respond, change status, resolve or escalate; refund decisions stay with the Business Owner.

### Membership and guests

- Membership plan administration (scope, price, term/interval, benefits) and membership operations.
- In-person member verification: scan the member QR or review the secure record; confirm venue eligibility and active status; optional photo assist for authorized verifiers. Record who verified.
- Guest membership verification against venue records with the same proof rules.

### Staff and access

- Invite and assign managers and staff to venues; delegate permissions; owner-initiated password reset for staff without email.
- The portal hides actions a user cannot take — but the backend remains the enforcement; hidden UI is never access control.

### Assistant and provider settings (optional)

- Assistant on/off per business, provider selection (Ollama or hosted BYOK), optional ordered fallback, per-tenant token budget.
- BYOK key entry is write-only — enter and replace, never read back; changes are audit-logged without the key.
- Persistent provider failures surface the "assistant unavailable: check your AI provider key" notice to owners and managers, once per failure episode.
- Staff-facing assistant panel scoped to the user's assigned venues and permissions; suggestions stay suggestions.

### Audit and notifications

- The business's own audit event view (owner/manager scope); players and guests never appear here.
- Operational alerts: new reservations/registrations, transfer evidence awaiting review, cancellations, deadlines — linked to the relevant record.

## Platform pieces

- React app scaffold with Tailwind and shared design tokens; same router/build-tool decision as the player portal — decide once and apply to both.
- Typed API client for the portal endpoint contract; tenant code + username sign-in; venue-assignment context for staff views.
- Dense operational layouts that still meet the UX principles (clarity, feedback, error prevention) — schedule grids and queues are the core screens.
- npm scripts: `dev` on `0.0.0.0:3002`, `test` (Vitest + Testing Library, jsdom), `build`, `lint`.
- Health/readiness response for installer status checks.

## Dependencies

- [Local development](../tooling/LOCAL_DEVELOPMENT.MD) — Compose, Dockerfile, `.env.example`, installer.
- Every backend module plan — this portal is the management surface for [identity & access](../backend/IDENTITY_AND_ACCESS.MD) (staff), [venue catalog](../backend/VENUE_CATALOG.MD), [booking](../backend/BOOKING.MD), [events](../backend/EVENTS.MD), [commerce](../backend/COMMERCE.MD), [notifications](../backend/NOTIFICATIONS.MD), [public content](../backend/PUBLIC_CONTENT.MD) (profile publishing), and [AI assistant](../backend/AI_ASSISTANT.MD) (provider settings).

## Acceptance checks

- Venue setup completes through the real UI: resources, rules, payment methods, membership plans, waivers, closures, staff — matching the `venue-admin` stage in [testing](../../../testing/README.MD).
- Staff see only assigned venues and delegated actions; price/policy/staff controls are owner-only.
- Transfer verification requires authorized staff and never accepts a screenshot alone.
- A closure over booked dates lists affected records before saving.
- BYOK keys are write-only and never rendered; provider failure notices dedupe per episode.
- `npm test` runs a Vitest suite that exits non-zero on failure.

## Open decisions

- Portal router/build tool — shared with [player portal](../player-portal/PLAYER_PORTAL.MD), tracked in [ADR-0003](../../decisions/0003-docker-local-development.MD).
- Delegation granularity (who may change/cancel bookings, verify transfers), verification evidence and approval criteria, Business Profile Page fields — [open product decisions](../../../domain/specifications/OPEN_PRODUCT_DECISIONS.MD).
- Facility-rule precedence across scopes and acknowledgment requirements — [Facility Use Rules](../../../domain/specifications/FACILITY_USE_RULES.MD).
- Ollama allowlist, budget defaults, failover notification recipients — [AI governance](../../AI_GOVERNANCE.MD).
