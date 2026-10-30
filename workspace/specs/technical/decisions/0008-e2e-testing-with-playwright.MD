# ADR-0008: E2E Testing with Playwright Against an Isolated World

## Status

Accepted

## Context

OpenPlay has four frontends and one backend. End-to-end tests must verify real user flows — including the onboarding chain itself (business onboarding → platform approval → venue setup → staff invite → player signup → first booking) — without touching the developer's local database. Payment providers, AI, and email must be deterministic in tests.

## Decision

Use Playwright for browser E2E tests, run against the real Docker stack with an isolated test world.

- Suites live in `tests/e2e/` as Playwright specs (`*.spec.ts`) with shared helpers in `tests/e2e/lib/`. Playwright is a pinned dev dependency at the repo root — not inside any service.
- The E2E world is **isolated**: a `docker-compose.e2e.yml` overlay in `services/backend/` adds a separate `postgres-e2e` container (own volume) and repoints the backend's database settings to it. The development database is physically untouchable; reset is a volume removal, not `DROP` on a shared database.
- The world is **built through real flows**, not seeded: `tests/e2e/bootstrap.spec.ts` performs business onboarding → Platform Administrator approval → venue configuration (resources, rules, payment methods) → staff invite and accept → player signup — the product's own provisioning path, run through the real UI. Steps are create-if-absent so the suite is idempotent.
- Canonical data (Platform Administrator account, permission catalog) is seeded; demo fixtures are gated behind a `SEED_DEMO`-style flag so `--fresh` runs start empty.
- A stage-ordered runner (`scripts/e2e.sh`) runs suites in persona order — platform, venue setup, player, journey, money — with health gates before each stage, per-suite timing, and service log tails on failure. A failure at stage N means the journey never had a chance, which is the point of the ordering.
- Deterministic stubs: payment providers (GCash/Maya), the AI provider, and email (Mailpit) run in stub/test mode for E2E — provider integrations are not exercised against real external APIs.
- Failure screenshots and traces are captured for debugging and kept out of Git.
- E2E is opt-in — it needs the running stack and is not part of the normal install.

## Reasons

- Building the world through the real UI exercises the onboarding chain itself — the product's first user journey — instead of silently depending on fixture state.
- An isolated database means E2E can assert freely (including destructive-path cases like hold expiry and cancellations) with zero risk to dev data.
- Persona-stage ordering turns the test report into a product tour and localizes failures to the stage that broke.
- Playwright doubles as the screenshot-capture toolchain for generated documentation ([ADR-0009](0009-docs-as-generated-artifacts.MD)) — one browser dependency serves both.

## Consequences

- Playwright becomes a repo-root dev dependency once the first frontend lands.
- The seed flag is the contract separating canonical seeds from demo fixtures; new seeders must respect it.
- Fresh runs cost provisioning time — that wait is itself part of the test.
- The E2E overlay and runner belong to the backend's Docker stack; frontend Compose files stay unchanged.
- Browser E2E is the slowest, most expensive layer — it covers persona journeys, not every edge case; unit and feature/API tests carry the bulk ([Testing](../../testing/README.MD)).

## Alternatives considered

### Seed the test database with demo fixtures

Faster to start, but suites then depend on state they never constructed, and the onboarding chain gets exercised by no test. Rejected — the world is built through real flows.

### Playwright per service

Each frontend owning its own E2E setup fragments the world and duplicates the harness. The suite is cross-channel by nature — one persona journey touches several apps — so it lives at the root. Rejected.
