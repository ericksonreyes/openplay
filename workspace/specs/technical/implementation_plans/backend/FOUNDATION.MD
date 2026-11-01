# Backend foundation implementation plan

The application shell in `services/backend/` — the NestJS bootstrap and the conventions every other NestJS plan builds on (local port 8000). This plan produces a running, health-checked API with no domain features yet.

## Sources

- [ADR-0004](../../decisions/0004-nestjs-backend-api.MD) — NestJS + TypeScript for the backend
- [ADR-0010](../../decisions/0010-prisma-backend-persistence.MD) — Prisma and Prisma Migrate with transaction-bound RLS context
- [ADR-0003](../../decisions/0003-docker-local-development.MD) — env vars, ports, Dockerfiles, installer contract
- [Testing](../../../testing/README.MD) — Jest via `@nestjs/testing`; `npm test` contract
- [Test accounts](../../../testing/TEST_ACCOUNTS.MD) — canonical seeds vs `SEED_DEMO` fixtures
- [Internal service security](../../security/INTERNAL_SERVICE_SECURITY.MD) — default-deny, CORS allowlist, non-revealing errors
- [Identifiers](../../IDENTIFIERS.MD) — UUIDv7 / SQID / reference-number boundary rules

## Deliverables

- NestJS TypeScript app with one `src/` folder per module and a module registry; new modules register in one place.
- Typed env validation at boot covering `DATABASE_*`, `JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY`/`JWT_SECRET`, `OLLAMA_HOST`, `AI_PROVIDER_ENCRYPTION_KEY`, and port settings. Missing required values fail the boot loudly; the resolved JWT signing mode is logged at startup.
- Request pipeline, in order: CORS allowlist → body size limits → JWT verification guard → role/permission policy → tenant-context transaction (from [Tenant data](TENANT_DATA.MD)) → handler → typed error response carrying `code`, `message`, and `request_id`. Existence-checking errors never reveal whether a record exists.
- `request_id` generated per request, echoed in responses and logs, propagated into audit `metadata`.
- Health endpoints: `GET /health` (process up) and `GET /health/ready` (database reachable) — the installer status checks and `docker compose --wait` poll these.
- Prisma/PostgreSQL data-access layer and Prisma Migrate runnable as `npm run db:migrate` (the command the backend installer invokes). Protected request queries use the transaction-scoped Prisma client after RLS context is set.
- Seed framework: canonical seeds always (`platform.admin` + permission/role catalog); demo fixtures gated behind `SEED_DEMO`. One seed command serves the installer, E2E, and manual testing.
- Shared identifier helpers: UUIDv7 generation, bigint↔SQID codec (per-scope salt config), display reference-number column convention. An undecodable SQID or malformed UUID in a request is a `404`, never a `500`.
- Structured logging with `request_id`; secrets (passwords, tokens, BYOK keys, payment credentials) can never enter log fields.
- npm scripts: `dev` (watch mode on `0.0.0.0:8000`), `worker:dev` (the entry the reminder-worker container runs), `db:migrate`, `test` (Jest), `lint`, `build`.
- Docker pieces per ADR-0003: `docker/backend.Dockerfile`, `docker/npm.Dockerfile`, `docker/postgres.Dockerfile` with initdb hooks (`btree_gist` extension, `openplay_app` non-superuser role), plus the backend `docker-compose.yml` services.
- Graceful shutdown, bounded connection pool, and a default statement timeout so one bad query cannot hold the pool.

## Dependencies

- [Local development](../tooling/LOCAL_DEVELOPMENT.MD) — the stack shape this service joins; its compose file, Dockerfiles, `.env.example`, and installer follow that template.

## Acceptance checks

- `docker compose up -d backend` serves `/health` and `/health/ready`; installer status checks pass.
- Boot fails fast and visibly on missing env; the startup log shows the resolved JWT signing mode.
- `docker compose run --rm backend npm run db:migrate` works from the installer step.
- `npm test` runs a Jest suite that exits non-zero on failure; one feature test hits `/health` through HTTP.
- An undecodable SQID or malformed UUID in a request path returns `404`.
- Canonical seeds exist after install; `SEED_DEMO=false` produces only canonical data.

## Open decisions

- Local CORS origin list, optional PostgreSQL host port, npm file-ownership mapping — open in [ADR-0003](../../decisions/0003-docker-local-development.MD).
