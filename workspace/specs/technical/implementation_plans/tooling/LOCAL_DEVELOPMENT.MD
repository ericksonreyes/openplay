# Local development implementation plan

The Docker development stack defined by ADR-0003 — the plan every service's scaffolding follows. Its draft files in the ADR are the target shape: service-owned Compose files, one `docker/<name>.Dockerfile` per Compose service (infra included), bannered installers, no bare `image:` references.

## Sources

- [ADR-0003](../../decisions/0003-docker-local-development.MD) — the full target shape, draft Compose/Dockerfile/installer files, and open details
- [SERVICE_MAP.md](../../../../../SERVICE_MAP.md) — the five services and their ports
- [OWASP mapping](../../security/OWASP_MAPPING.MD) — A05 configuration checks: no published database port, localhost-bound Mailpit, placeholder-only `.env.example`

## Deliverables

- **Per-service layout** under `services/<name>/`: `docker/` with a Dockerfile per Compose service, `docker-compose.yml`, `install.sh`, `.env.example`, `.dockerignore`, `.gitignore`, and `storage/npm/` (created locally).
- **Dockerfiles for everything**: app images, `npm` utility image, `postgres.Dockerfile` (initdb hooks for `btree_gist` and the `openplay_app` role), `mailpit.Dockerfile`, `ollama.Dockerfile`, `reminder-worker.Dockerfile`. Thin `FROM` wrappers pin versions — no floating `latest` tags.
- **Networks**: `openplay-local-api` (external; created by the backend installer; the backend joins it with the `openplay-backend` alias), plus internal-only `backend_data` and `backend_notifications`. Frontends reach the API over the shared network; nothing but the backend reaches PostgreSQL.
- **Volumes**: `backend_postgres_data` for database data, `ollama_models` for model data. `node_modules/` stays a host-visible bind mount for IDE indexing — never hidden under a named volume; the npm cache lives in `storage/npm/`.
- **Container conventions**: `${DOCKER_CONTAINER_PREFIX:-openplay}-<service>` names; `init: true` on app/utility containers, `tty: true` on interactive utilities, `restart: unless-stopped` on long-running services; `:delegated` on source mounts.
- **Ports**: frontends 3000–3003 and NestJS backend 8000, bound to `127.0.0.1`; Mailpit UI on `127.0.0.1:8025`; no PostgreSQL host port by default. Port `3004` remains a preferred local port for a future service; it is currently unassigned.
- **Profiles**: `notifications` (reminder-worker + Mailpit) and `ai` (Ollama) keep optional services out of the base stack.
- **Installers**: root `install.sh` is the only interactive script — `[Y/n]` install confirm, `[y/N]` fresh-database prompt that names `backend_postgres_data`, `[Y/n]` rebuild, `--quick` non-interactive (never resets data). It runs the backend installer first, then the four frontends. Service installers are non-interactive `[N/M]`-step runners taking `--fresh-db`/`--rebuild` flags, repeatable, creating `.env` only when missing.
- **npm utility containers**: `docker compose run --rm npm install` writes host-readable `node_modules/`; setup tasks run in containers — contributors need Docker, not runtimes.
- **Smoke checks**: the root installer ends with per-stack `docker compose ps` so the result is visible.

## Dependencies

None — this is the first plan to execute. Each service plan adds its own Compose file and Dockerfiles through this template; the backend plans add their infrastructure to `services/backend/`.

## Acceptance checks

- `./install.sh` from a clean checkout brings up backend plus all four frontends; `--quick` runs unattended; a re-run is idempotent and preserves `.env` and data.
- The only data-reset paths are the confirmed prompt and an explicit `--fresh-db` flag — `--quick` can never trigger one.
- No bare `image:` references in stack Compose files; no published database port; Mailpit UI bound to localhost.
- NestJS-stack frontend containers resolve `http://openplay-backend:8000` over `openplay-local-api`; no browser frontend can reach PostgreSQL directly.
- `docker compose run --rm npm install` leaves host-manageable `node_modules/`.

## Open decisions

- Exact base-image tags/digests per service.
- Optional PostgreSQL host port for external tooling.
- The local CORS origin list for browser calls.
- npm container file-ownership mapping per host OS.
- Whether shared infrastructure (for example a cache) joins later — tracked in [ADR-0003](../../decisions/0003-docker-local-development.MD).
