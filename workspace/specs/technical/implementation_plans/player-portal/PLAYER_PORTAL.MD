# Player portal implementation plan

The player-facing app in `services/player-portal/` (React + Tailwind, local port 3001). It serves signed-in players (platform scope, email sign-in) and guests completing or managing a booking without an account. Form-based flows are the default; the optional assistant only supplements them.

## Sources

- [ADR-0001](../../decisions/0001-web-application-framework.MD) — React player portal, separate app
- [ADR-0002](../../decisions/0002-tailwind-css-for-styling.MD) — Tailwind CSS
- [ADR-0003](../../decisions/0003-docker-local-development.MD) — service-owned Compose file, Dockerfile, `.env.example`, installer
- [ADR-0004](../../decisions/0004-nestjs-backend-api.MD) — protected endpoints; the backend owns all rules
- [ADR-0006](../../decisions/0006-ai-assistant-runtime.MD) — assistant integration shape
- [Private reservations](../../../domain/specifications/PRIVATE_RESERVATIONS.MD), [guest booking](../../../domain/specifications/GUEST_BOOKING.MD), [recurring reservations](../../../domain/specifications/RECURRING_RESERVATIONS.MD), [scheduled events](../../../domain/specifications/SCHEDULED_EVENTS.MD), [open-play sessions](../../../domain/specifications/OPEN_PLAY_SESSIONS.MD), [equipment rentals](../../../domain/specifications/EQUIPMENT_RENTALS.MD), [memberships](../../../domain/specifications/MEMBERSHIPS.MD), [platforms and payments](../../../domain/specifications/PLATFORMS_AND_PAYMENTS.MD), [waivers and consent](../../../domain/specifications/WAIVERS_AND_CONSENT.MD), [check-in and attendance](../../../domain/specifications/CHECK_IN_AND_ATTENDANCE.MD), [disputes](../../../domain/specifications/DISPUTES.MD), [notifications](../../../domain/specifications/NOTIFICATIONS.MD), [AI assistant](../../../domain/specifications/AI_ASSISTANT.MD)
- [AI governance](../../AI_GOVERNANCE.MD) — UX discipline, session-only chat, fallback rules
- [Internal service security](../../security/INTERNAL_SERVICE_SECURITY.MD) — guest verification and protected-data rules
- [User experience](../../user_experience/README.MD)

## Areas

### Identity

- Platform-scope sign-up and sign-in with email; scope-aware password recovery.
- JWT handling against the backend's protected endpoints; revoked or expired tokens return to sign-in.
- Optional account creation after a guest booking, linked by proving control of the booking's verified contact method.

### Booking flows

- Private reservation: discover → select resource and time → review applicable facility rules → acknowledge required waivers → choose a payment method → confirm. Availability and price are informational until the backend revalidates at submission.
- Recurring reservations: pattern and end date, per-occurrence conflict report (never a silent partial series), single-occurrence or remaining-series cancellation.
- Event registration: individual, group-seat, and named-team flows with roster handling; Open Play sessions show remaining places and a full state.
- Equipment rental: add-on to a reservation or event, or standalone with pickup/return windows.
- Guest checkout (unauthenticated routes): the same flows minus account features, collecting only the contact details needed for confirmation.
- Guest booking access: secure link or one-time code to the booking's contact; view and manage only that booking — no lookup that could expose another person's booking.

### Money

- Integrated checkout redirect and return; confirmation comes only from the backend's server-side verification — the UI never treats a redirect as proof.
- Direct transfer: submit a transaction reference and optional receipt image; show pending-verification status.
- Pay-at-venue: show the outstanding amount, due time, and grace period.
- Cancellation paths show the applicable refund policy before committing.
- Disputes: open a categorized dispute on the user's own booking, registration, rental, or payment; follow status and venue responses.

### Membership

- Browse plans (venue scope, price, term or billing interval, benefits); purchase with recurring-billing consent where applicable.
- Membership status, benefits, expiration, and the member QR code for in-person verification.
- Signed-in benefits apply automatically; a guest claims membership only through the verification flow.

### Everyday screens

- Bookings and rentals list, detail views with payment status and due times, attendance history, check-in QR display.
- In-app notifications linked to the relevant page.

### Assistant panel (optional)

- Rendered only when the business enables it and `GET /assistant/status` reports available; otherwise the classic form path shows with no dead end.
- Session-only chat (nothing persists); read-only answers; prefill renders as the normal unsaved form for human review and submission.
- Web Speech dictate (explicit mic tap, `SpeechRecognition`, hidden where unsupported) and optional read-aloud (`speechSynthesis`); no external voice providers.

## Platform pieces

- Vite + React Router app scaffold with Tailwind and shared design tokens; Vitest is the portal test runner.
- Typed API client for the portal endpoint contract; all calls carry the JWT or guest verification — the portal never trusts client-supplied tenant, role, or permission fields.
- Mobile-first responsive layouts; player-facing flows are also the mobile-viewport capture target for generated docs.
- npm scripts: `dev` on `0.0.0.0:3001`, `test` (Vitest + Testing Library, jsdom), `build`, `lint`.
- Health/readiness response for installer status checks.

## Dependencies

- [Local development](../tooling/LOCAL_DEVELOPMENT.MD) — Compose, Dockerfile, `.env.example`, installer.
- [Identity & access](../backend/IDENTITY_AND_ACCESS.MD) — sign-up, sign-in, recovery.
- [Booking](../backend/BOOKING.MD), [events](../backend/EVENTS.MD), [commerce](../backend/COMMERCE.MD), [notifications](../backend/NOTIFICATIONS.MD), [public content](../backend/PUBLIC_CONTENT.MD) (browse surfaces) — the feature APIs.
- [AI assistant](../backend/AI_ASSISTANT.MD) — the assistant endpoints and status probe.

## Acceptance checks

- The golden path runs end to end: sign up → book → pay (stub) → see confirmation → show check-in QR — matching [test scenarios](../../../testing/TEST_SCENARIOS.MD).
- Guest checkout completes an eligible booking without an account; guest access opens only after verification.
- A signed-in member sees benefits applied automatically; a guest does not until verified.
- Assistant off or unavailable leaves every form flow working.
- `npm test` runs a Vitest suite that exits non-zero on failure.

## Open decisions

- Local CORS policy — tracked in [ADR-0003](../../decisions/0003-docker-local-development.MD) open details.
- Guest contact fields, verification method, link/code expiry, and eligible booking types — [Guest booking](../../../domain/specifications/GUEST_BOOKING.MD).
- How guests complete verification inside the assistant chatbot — [Guest booking](../../../domain/specifications/GUEST_BOOKING.MD).
- Dispute deadlines and withdrawal — [Disputes](../../../domain/specifications/DISPUTES.MD).
