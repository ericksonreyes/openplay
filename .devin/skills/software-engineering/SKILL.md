---
name: software-engineering
description: OpenPlay engineering conventions — modular NestJS monolith, module table ownership, RLS + audit stream, ports/adapters for providers, testing disciplines, identifier policy
allowed-tools:
  - read
  - grep
  - glob
  - edit
  - write
  - exec
---

You are implementing or reviewing OpenPlay application code. Load these conventions before writing anything.

## Canonical sources (read first)

- `workspace/specs/technical/README.MD` — technical index: decisions, guidance, implementation plans
- `workspace/specs/technical/implementation_plans/README.MD` — per-service build plans and module boundaries
- `SERVICE_MAP.md` — service inventory; every `services/` dir maps to one service
- `workspace/specs/technical/IDENTIFIERS.MD` — ID policy
- `workspace/specs/technical/security/README.MD` — JWT/claims model and policy flow
- `workspace/specs/technical/AI_GOVERNANCE.MD` — AI invariants when touching the assistant module
- `workspace/specs/testing/README.MD` — test pyramid and per-service runners

## Invariants

- **The backend is a NestJS modular monolith.** Its modules own their tables; cross-module calls go through permission-checked services under the caller's context. Browser frontends never connect to a data store.
- **`iam` has a hard boundary** — it is the sole JWT signer (RS256) and owns users, credentials, and roles. The tenant/business lifecycle lives in its own module; IAM learns `tenant_id` through provisioning.
- **Defense in depth, fail closed.** NestJS guards verify JWT + role/permission first; PostgreSQL row-level security is the backstop (`SET LOCAL app.actor_id`/`app.tenant_id`/`app.is_platform`/`app.is_system`/`app.is_public` inside the request's transaction). Values come only from verified claims — never request input.
- **Deterministic business rules live in backend modules** — pricing, conflicts, capacity, refunds, verification. Never in frontends, the assistant module, or ad-hoc SQL.
- **Audit stream, not full event sourcing.** Current-state tables plus append-only `audit_events` written in the same transaction as the action; past-tense events, `UNIQUE(stream_type, stream_id, sequence)`. External arrivals (webhooks, jobs) commit their arrival event in a separate transaction before work; never audit rolled-back attempts.
- **Ports and adapters for providers.** Payment providers (GCash/Maya) and AI providers (Ollama/hosted BYOK) sit behind ports with deterministic test stubs — domain code never calls a vendor SDK directly.
- **AI assistant constraints.** Read-only tools plus unsaved prefill only; tools run under the caller's claims; no writes, no internet grounding, session-only history. See `AI_GOVERNANCE.MD` and the `ai-agent-boundary` skill.
- **Identifiers**: entities use UUIDv7; transactional records use internal bigint + SQID public masking; `JOB-1001`-style codes are display reference numbers, never API identifiers; `created_by`/`updated_by` store the IAM user UUIDv7; undecodable external ids are 404s.
- **Testing**: business rules must be deterministic and unit-testable — Jest (`@nestjs/testing` + supertest for feature/API) in the backend, `next/jest` for public-site, Vitest for the React portals, Playwright for E2E. Every service ships a working `npm test` from scaffolding.

## Runtime policy

- **Node.js/TypeScript for the NestJS, Next.js, and React services.** NestJS `npm run dev` (watch) listens on `0.0.0.0:8000`; the reminder worker uses `npm run worker:dev`. Public site and React SPAs use ports 3000–3003. Port `3004` remains a preferred local port for a future service; it is currently unassigned. App ports bind to `127.0.0.1`; Mailpit UI binds to `127.0.0.1:8025`; no PostgreSQL host port by default.
- **Docker per ADR-0003.** Each service owns its `docker-compose.yml`, `docker/*.Dockerfile` for every Compose service (app and infrastructure — thin `FROM` wrappers, pinned versions, no `image:` refs), `.env.example`, `install.sh`, and `storage/npm/` cache. No unified root Compose file — root `install.sh` orchestrates per-service installers.
- **Container conventions.** `${DOCKER_CONTAINER_PREFIX:-openplay}-<service>` names; `init: true`, `tty: true` on utilities, `restart: unless-stopped`; `:delegated` source bind mounts so watch/reload works and `node_modules/` stays host-visible; `docker compose run --rm npm <cmd>` for one-off tasks.
- **Networks.** Frontends reach the API over external `openplay-local-api` (backend alias `openplay-backend`); `backend_data`/`backend_notifications` remain internal-only.
- **Optional profiles.** `notifications` (reminder-worker + Mailpit) and `ai` (Ollama) stay out of the base stack.
- **Data safety.** `--quick` never resets data; the confirmed `--fresh-db` path is the only volume-removal route.
- Local dev POC is the target — no production deployment shape is decided yet.

## Before finishing

When adding/renaming a service: update `services/`, `SERVICE_MAP.md`, its `.env.example`, its installer, and `workspace/specs/technical/implementation_plans/` in the same change. Run a link check if you touched docs.
