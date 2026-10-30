# Testing

Test strategy, scenario inventory, and run instructions for the OpenPlay stack. This is the plan to grow automated coverage — not a claim about what exists today. Nothing is implemented yet.

## What belongs here

- The test pyramid as it maps onto this codebase — what layer covers what.
- The scenario inventory: business flows that must stay green ([TEST_SCENARIOS.MD](TEST_SCENARIOS.MD)).
- The canonical test accounts every suite may rely on ([TEST_ACCOUNTS.MD](TEST_ACCOUNTS.MD)).
- How to run what exists and the environment quirks.

## Test pyramid for this stack

| Level | Scope | Tooling | Runs against |
| --- | --- | --- | --- |
| Unit | One class/function, no DB | Per-framework runner — see below | code |
| Feature/API | One NestJS module through its routes — auth, tenant scope, validation, state | Jest + supertest against a test database | backend + Postgres |
| RLS isolation | Tenant boundary at the database — cross-tenant deny, unset context deny, `WITH CHECK`, player-row scope, `app.is_system` bypass | SQL tests or service-level tests that skip application scoping | Postgres |
| Contract | Public-endpoint field allowlist; webhook payload shape and signature verification | Feature tests + static checks | code |
| Integration | Cross-module flows: hold → payment verify → confirm; duplicate webhooks; reminder claiming (`FOR UPDATE SKIP LOCKED`); audit event written with the action | Jest against the running backend stack | backend + Postgres |
| Smoke | Stack health after bring-up | `install.sh` status checks | running stack |
| Browser E2E | Persona journeys end-to-end | Playwright ([ADR-0008](../technical/decisions/0008-e2e-testing-with-playwright.MD)) | full stack |

## Unit test runners per framework

Every service ships a working unit-test setup from scaffolding — an empty or skipped suite is acceptable, a missing runner is not. Each service exposes `npm test` (unit suite) and runs it through its npm utility container: `docker compose run --rm npm run test`.

| Service | Framework | Runner | Why |
| --- | --- | --- | --- |
| `backend` | NestJS + TypeScript | **Jest** via `@nestjs/testing` | The framework's default; first-class DI/testing module support |
| `public-site` | Next.js | **Jest** via `next/jest` | The framework's officially supported runner |
| `player-portal` | React | **Vitest** | Default pairing with a Vite build; ESM-native and fast |
| `venue-portal` | React | **Vitest** | Same as above |
| `platform-portal` | React | **Vitest** | Same as above |

Rules:

- Component tests on the frontends use Testing Library conventions (queries by role/text, no implementation-detail selectors).
- The portal runner follows the portal build tool once it is chosen — if a portal does not use Vite, Jest is the fallback so every service still has a runner.
- React portals keep their DOM environment (`jsdom` or `happy-dom`) configured; the backend and public site use the Node environment.
- Unit tests never touch the database, network, or Docker — anything that does belongs to the feature/API layer up the pyramid.
- `npm test` exits non-zero on failure so `scripts/test.sh` and CI can gate on it; a `--watch` variant is for development only.

## Browser E2E run order

`scripts/e2e.sh` runs suites in **persona order** — the same order the product itself onboards: a business cannot take bookings until the platform approves it, a venue exists, and a player signed up. A failure at stage N means the journey never had a chance.

| Stage | Suites | What it proves |
| --- | --- | --- |
| 0 — World *(only under `--fresh`)* | `bootstrap` | business onboarding → platform approval → venue configuration → staff invite/accept → player signup, on an empty database |
| 0 — Canary | `login-negatives` | health gates pass, scope resolution and sign-in work — a fast check before opening the journey |
| 1 — Platform | `platform-admin` | business lifecycle: onboard, approve, suspend, restore (multi-tenant only) |
| 2 — Venue setup | `venue-admin` | resources and activities, facility rules, payment methods, membership plans, waivers, closures, staff assignments |
| 3 — Player | `player-portal` | signup, browse and search, private reservation, event registration, guest booking, membership purchase, equipment rental |
| 4 — Journey | `golden-chain` | discover → book → pay → check-in → attend — the spine assembled from what the earlier stages proved; concurrency races on contested slots |
| 5 — Money | `payments` | integrated-checkout verification, direct-transfer review, pay-at-venue collection, hold expiry, refunds, disputes |
| 6 — Operations | `venue-ops` | check-in and no-show marking, closures, recurring reservations, disputes handling |

## How to run

- `./scripts/test.sh` — unit and feature/API suites per service (planned; the per-service npm utility containers run them — see [ADR-0003](../technical/decisions/0003-docker-local-development.MD)).
- `scripts/e2e.sh` — browser suites in stage order against the running stack (opt-in, needs the full stack up).
- `scripts/e2e.sh --fresh` — isolated `postgres-e2e` world; bootstrap builds every identity through the real UI.
- `scripts/screenshots/` — Playwright capture scripts that regenerate documentation visuals ([ADR-0009](../technical/decisions/0009-docs-as-generated-artifacts.MD)).

## Environment quirks to respect

- E2E uses deterministic stubs for GCash, Maya, the AI provider, and Mailpit — never real external APIs.
- Payment-provider callbacks are verified and idempotent in the backend; tests use signed stub callbacks, not browser redirects.
- Failure screenshots/traces land under `tests/e2e/` and stay out of Git.
- The development database is untouchable by E2E — all destructive-path cases run on `postgres-e2e`.
