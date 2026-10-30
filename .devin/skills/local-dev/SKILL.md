---
name: local-dev
description: OpenPlay local Docker runbook — install, per-service stacks, profiles, dev-mode hot reload, troubleshooting
allowed-tools:
  - read
  - grep
  - glob
  - exec
---

Runbook for the local stack. The target shape is defined by `workspace/specs/technical/decisions/0003-docker-local-development.MD` (ADR-0003) and the build plan in `workspace/specs/technical/implementation_plans/tooling/LOCAL_DEVELOPMENT.MD`. Five services: `backend` (NestJS, 3100), `public-site` (Next.js, 3000), and the React portals `player-portal`, `venue-portal`, `platform-portal` (3001–3003).

## Setup

```bash
./install.sh            # interactive: confirm → fresh-database? → rebuild? → runs each service installer
./install.sh --quick    # non-interactive; never resets data
```

The root installer is the only interactive script. It runs the backend installer first, then the four frontend installers, forwarding answers as `--fresh-db`/`--rebuild` flags. Service installers (`services/<name>/install.sh`) are non-interactive bannered `[N/M]`-step runners. The confirmed fresh-database prompt — or an explicit `--fresh-db` — is the only path that removes `backend_postgres_data`; `--quick` never does.

## Per-service stacks

Each service owns `docker-compose.yml`, `docker/*.Dockerfile` (one per Compose service, infrastructure included — no bare `image:` refs), `.env.example`, `install.sh`, and `storage/npm/`. There is no unified root Compose file; run Compose inside `services/<name>/`.

```bash
cd services/backend
docker compose up -d                                  # backend API + postgres
docker compose --profile notifications up -d          # + reminder-worker + mailpit
docker compose --profile ai up -d ollama              # + ollama (optional local model)
docker compose exec ollama ollama pull <model>
```

## Networks and ports

`openplay-local-api` is the only shared network — external, created by the backend installer, with the backend reachable as `openplay-backend`. Every frontend joins it. `backend_data` and `backend_notifications` are internal-only. Ports: frontends 3000–3003, backend 3100 — all bound to `127.0.0.1`. Mailpit UI on `127.0.0.1:8025` (SMTP stays internal). No PostgreSQL host port by default.

## Live editing

Source dirs bind-mount into dev containers with `:delegated`; framework watch modes do the reload — backend `npm run dev`, worker `npm run worker:dev`, public-site `next dev`, portals on their dev servers. `node_modules/` stays host-visible for IDE indexing (never a named volume); the npm cache lives in gitignored `storage/npm/`. One-off tasks run in each service's npm utility container:

```bash
docker compose run --rm npm install
docker compose run --rm backend npm run db:migrate
```

## Optional services / memory pressure

The base stack excludes optional infrastructure — profiles are the lever:

- `notifications` — reminder-worker plus Mailpit for local email capture.
- `ai` — containerized Ollama. On macOS prefer a host-installed Ollama: containers cannot use Metal/GPU, so leave the profile off and set `OLLAMA_HOST=http://host.docker.internal:11434` in the backend `.env`. Hosted BYOK providers need no Ollama at all.
- If the box is tight, run fewer frontends — each portal is an independent Compose stack.

## Troubleshooting

- `cd services/<name> && docker compose ps` — healthcheck status per stack.
- `docker compose logs -f <service>` — structured logs carry `request_id`.
- `curl localhost:3100/health` and `/health/ready` — process and database readiness.
- `docker compose config -q` — validate a service's Compose file after edits.
- "Network openplay-local-api not found" → run `services/backend/install.sh` first.
- Stale `node_modules/` or image → re-run that service's `install.sh --rebuild`.
