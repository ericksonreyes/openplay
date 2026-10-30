---
name: new-service
description: Scaffold a new OpenPlay service — directory, env template, Dockerfile, compose entry, service map, in one change
argument-hint: "<service-name> e.g. iam"
allowed-tools:
  - read
  - grep
  - glob
  - edit
  - write
  - exec
---

Scaffold a service into the OpenPlay monorepo. All steps land in ONE change — never partially.

First check whether a new service is even needed: OpenPlay is a modular monolith, so the default move is a **module inside `services/backend/`**, not a new deployable. A real service needs an architectural reason — the recorded escape hatches are `services/iam/` (ADR-0007) and `services/ai-agent/` (ADR-0006). If you're adding a module instead, follow the backend's module-boundary rules in `workspace/specs/technical/implementation_plans/backend/README.MD`.

## Checklist

1. **Plan and inventory** — add the entry to `SERVICE_MAP.md` (`name`, `description`, `location`, `stack`, `port`) and a matching plan in `workspace/specs/technical/implementation_plans/<name>/` in the same change.
2. **Directory** — `services/<name>/` with `docker/`, `docker-compose.yml`, `install.sh`, `.env.example`, `.dockerignore`, `.gitignore` (`node_modules/`, `storage/npm/`).
3. **`.env.example`** — `DOCKER_CONTAINER_PREFIX`, the service's port, and backend URLs. Container-to-container calls use Compose DNS (`http://openplay-backend:3100`); browser-side URLs use `http://localhost:3100`. Safe local defaults only, never real secrets.
4. **Dockerfiles** — one `docker/<name>.Dockerfile` per Compose service, including any infrastructure — thin `FROM` wrappers with pinned versions; no bare `image:` references. `.dockerignore` excludes `node_modules`, build output, `.env*`, `.git`, `*.pem`, `storage/npm`.
5. **Compose** — follow ADR-0003 conventions: `${DOCKER_CONTAINER_PREFIX:-openplay}-<name>` container names; `init: true`; `tty: true` on utilities; `restart: unless-stopped` on daemons; `:delegated` source mounts plus `./storage/npm` npm cache; `127.0.0.1` port binds; join the external `openplay-local-api` network for API access; put optional services behind a Compose `profiles:` entry. Verify with `docker compose config -q`.
6. **`install.sh`** — non-interactive bannered `[N/M]`-step runner: copy `.env` only if missing → prepare `storage/npm` and check/create `openplay-local-api` → optional `--rebuild` → `docker compose run --rm npm install` → `docker compose up -d`. Accept flags only; the root installer asks the questions.
7. **Test runner** — the service ships a working `npm test` from scaffolding (Jest or Vitest per `workspace/specs/testing/README.MD`).
8. **Verify** — run the new `install.sh`, confirm idempotency on re-run, check `docker compose ps` health and the health endpoint.

## Rules

- Match sibling conventions exactly — consistency across the service family is the point.
- Update `SERVICE_MAP.md`, the root `install.sh` service order (if applicable), and `implementation_plans/` in the same change.
- No secrets in `.env.example`; watch/reload modes are the local runtime — the whole stack is dev-mode.
