# Test Accounts

Canonical test identities shared by the E2E bootstrap, screenshot capture scripts, and manual local testing. These are the names every suite may rely on — change them here and everywhere at once.

All credentials are **local-development only**. Demo emails use the reserved `demo.openplay.test` domain; fixtures must never contain real personal data.

## Canonical seeds

Present on every environment, including `--fresh` E2E worlds — they are not demo fixtures and are not gated by the demo-seed flag.

| Scope | Identifier | Role | Notes |
| --- | --- | --- | --- |
| platform | `platform.admin` | Platform Administrator | Approves businesses, manages tenants and platform settings |
| — | permission/role catalog | — | Canonical role and permission definitions, not a user |

## Demo fixture accounts

Created by the demo seeder in development, or built through the real UI by `tests/e2e/bootstrap.spec.ts` on a fresh world.

Business `acme` — "Acme Sports Club" (tenant code `acme`):

| Scope | Identifier | Role | Purpose |
| --- | --- | --- | --- |
| tenant `acme` | `acme.owner` | Business Owner | Venue configuration, policies, refunds, provider keys |
| tenant `acme` | `acme.manager` | Venue Manager | Daily operations, reservations, events, check-in |
| tenant `acme` | `acme.staff` | Venue Staff | Delegated front-desk tasks only |

Business `bayside` — "Bayside Courts" (tenant code `bayside`): a second tenant so cross-tenant isolation is testable.

| Scope | Identifier | Role | Purpose |
| --- | --- | --- | --- |
| tenant `bayside` | `bayside.owner` | Business Owner | Second-tenant data for RLS and cross-tenant-denial tests |

Platform-scope users:

| Scope | Identifier | Role | Purpose |
| --- | --- | --- | --- |
| platform | `jane.player` | Player | Main booking persona — reservations, events, membership |
| platform | `pio.player` | Player | Second player — races, disputes, other-player denial |

Guests have no account: guest-booking tests use verified contact details (for example `guest.demo@demo.openplay.test`) captured during the guest flow.

## Credentials

| Field | Value |
| --- | --- |
| Shared password | `demo-pass-123` — local development only, never reused elsewhere |
| Player sign-in | email form: `<identifier>@demo.openplay.test` |
| Tenant sign-in | tenant code (`acme` / `bayside`) + username + password |

## Rules

- These identities are the contract between `bootstrap.spec.ts`, the screenshot capture scripts, and any manual testing notes — the bootstrap asserts these exact end states.
- Suites that need additional users create them through real flows with generated names (`E2E-<timestamp>`), never by assuming extra fixtures exist.
- `SEED_DEMO=false` worlds contain only the canonical seeds; everything else is built by the bootstrap.
- Fixture names, emails, and phone numbers must be clearly demo data — no real names, real addresses, or production-like PII.

## Related specifications

- [Testing](README.MD) — pyramid, stage order, run instructions
- [Test scenarios](TEST_SCENARIOS.MD) — the flows these accounts exercise
- [ADR-0008](../technical/decisions/0008-e2e-testing-with-playwright.MD) — isolated world and bootstrap approach
- [Identity & Access](../technical/security/IDENTITY_AND_ACCESS.MD) — scope model these accounts follow
