# End-to-end testing implementation plan

Playwright browser E2E at the repo root, run against the real Docker stack with an isolated test world. The world is built through the product's own flows — never seeded around the onboarding chain. E2E is opt-in: it needs the running stack and is not part of a normal install.

## Sources

- [ADR-0008](../../decisions/0008-e2e-testing-with-playwright.MD) — the isolated world and stage-ordered approach
- [Testing](../../../testing/README.MD) — test pyramid and persona stage order
- [Test scenarios](../../../testing/TEST_SCENARIOS.MD) — the flows suites must prove
- [Test accounts](../../../testing/TEST_ACCOUNTS.MD) — canonical seeds and demo fixtures
- [Internal service security](../../security/INTERNAL_SERVICE_SECURITY.MD) — deterministic provider stubs

## Deliverables

- **Playwright at the root**: a pinned dev dependency at repo root — never inside a service. Suites live in `tests/e2e/*.spec.ts` with shared helpers in `tests/e2e/lib/`; per-channel base URLs in the Playwright config.
- **Isolated world**: `services/backend/docker-compose.e2e.yml` adds a separate `postgres-e2e` container with its own volume and repoints the backend's database settings. The development database is physically untouchable; reset is a volume removal, not `DROP` on a shared database.
- **Bootstrap suite**: `tests/e2e/bootstrap.spec.ts` builds the world through the real UI — business onboarding → Platform Administrator approval → venue configuration → staff invite and accept → player signup. Steps are create-if-absent so the suite is idempotent.
- **Seed contract**: canonical seeds (`platform.admin`, permission catalog) always present; demo fixtures gated behind `SEED_DEMO` so `--fresh` worlds start empty. [Test accounts](../../../testing/TEST_ACCOUNTS.MD) identities are the contract the bootstrap asserts.
- **Stage runner** `scripts/e2e.sh`: health gates before each stage, per-suite timing, service log tails on failure, and `--fresh` to rebuild the world. Stages run in persona order: bootstrap (fresh only) → canary (`login-negatives`) → `platform-admin` → `venue-admin` → `player-portal` → `golden-chain` → `payments` → `venue-ops`. A failure at stage N means later stages never had a chance — that ordering is the point.
- **Deterministic stubs**: GCash/Maya stub adapters with signed stub callbacks, the AI stub provider, and Mailpit — E2E never touches a real external API.
- **Failure artifacts**: screenshots and traces under `tests/e2e/`, kept out of Git.
- **Suite inventory**: specs map to [Test scenarios](../../../testing/TEST_SCENARIOS.MD); the RLS-isolation and field-allowlist cases live at the feature/SQL layer per the test pyramid — E2E covers persona journeys, not every edge.

## Dependencies

- [Local development](LOCAL_DEVELOPMENT.MD) — the running stack and the Compose overlay mechanism.
- Frontend and backend plans as their surfaces land; suites grow stage by stage with the product.

## Acceptance checks

- `scripts/e2e.sh --fresh` on a clean stack: bootstrap builds the world, then stages pass in order; a stage failure halts with logs attached.
- The development volume is provably untouched — the E2E database is a different container and volume.
- Stubs are deterministic across runs; failure artifacts are captured and gitignored.
- Suite names and coverage trace back to the scenario inventory.

## Open decisions

- Suite granularity inside stages and retry policy.
- CI wiring and schedule once CI tooling is chosen.
- Trace/artifact retention — tracked alongside the pyramid in [Testing](../../../testing/README.MD).
