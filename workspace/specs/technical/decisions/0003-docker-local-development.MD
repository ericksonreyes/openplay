# ADR-0003: Use Docker for Local Development

## Status

Proposed

## Context

The stack has a Next.js public site, separate React player, venue, and Platform Administrator portals, and a NestJS backend. Each service owns its Dockerfiles, `docker-compose.yml`, environment example, and `install.sh`. A root `install.sh` can start the services together in the local development environment.

Each service keeps every image definition in its own `docker/` directory — one `<service>.Dockerfile` per Compose service, following the ShipperBridge `docker-compose.yml` pattern where application and infrastructure services alike build from their own Dockerfiles.

The proposed workflow uses these patterns:

- Docker Compose builds and runs the application and supporting tools.
- Development containers mount project files so edits are available without copying source into a running container.
- Persistent database data uses a named Docker volume. Npm caches and installed packages can use host bind mounts.
- One-off containers run tasks such as installing dependencies and database migrations.
- The install script creates local configuration only when it is missing, builds images, starts containers, and runs setup tasks.

OpenPlay currently has no Docker Compose file, installer, or application services. Its local-development skill describes files and services that are not present, so this ADR proposes a target rather than documenting an existing stack.

## Decision

Use Docker Engine and Docker Compose as the standard local development environment.

- Give the public site, each portal, and the backend separate Compose files, environment examples, and installer scripts.
- Give every Compose service its own Dockerfile in the service's `docker/` directory — including infrastructure such as PostgreSQL, Mailpit, and Ollama. Thin `FROM` wrappers are expected; they pin versions and give each image a place for configuration and init scripts. Do not run stack services from bare `image:` references.
- Keep the root `install.sh` as an orchestrator. It runs the backend installer first, then the public-site, player-portal, venue-portal, and platform-portal installers. Do not add a unified root Compose file.
- Pin Docker image versions in the `FROM` line of each `docker/*.Dockerfile` after selecting compatible runtimes and tools for OpenPlay. Do not use floating `latest` tags.
- Name every container `${DOCKER_CONTAINER_PREFIX:-openplay}-<service>` so containers are identifiable by stack and the prefix can change per checkout.
- Set `init: true` on application and utility containers, `tty: true` on interactive utility containers, and `restart: unless-stopped` on services expected to stay running.
- Mount each service's source into its development containers and use its framework's watch or reload mode. Use the `:delegated` mount flag on source bind mounts.
- Keep database services and their persistent data volumes with the backend. The frontends must use the backend API and must not connect directly to backend data stores.
- Use a backend-owned named Docker volume for PostgreSQL data.
- Give each Node.js service an `npm` utility container. Run package installation with `docker compose run --rm npm install`.
- Use Vite and React Router for the three standalone React portals; their test runner is Vitest.
- Bind-mount each service directory into its app and `npm` containers. This puts that service's `node_modules/` on the host file system so IDEs can index packages and provide suggestions.
- Store each service's npm download cache in its ignored `storage/npm/` directory. Keep `node_modules/` and `storage/npm/` out of Git.
- Configure the npm utility container so files it creates remain readable and manageable from the host. Use host user and group IDs where the operating system requires them.
- Run package installation, migrations, and similar setup tasks in the service's utility containers. Do not require contributors to install application runtimes on the host.
- Give each service a tracked example environment file with safe local defaults. Its installer may create that service's `.env` when missing, but must preserve an existing `.env`.
- Make each installer repeatable. The root installer checks Docker and Compose, then runs service installers in order. Each service installer prepares its environment, builds its images, starts its services, waits for dependencies, runs setup tasks, and reports the result.
- Use the ShipperBridge installer format: green banner blocks around every message, `[Y/n]` prompts, numbered `[N/M]` steps, a `Skipped.` banner for conditional steps, a `--quick` flag for non-interactive runs, and an elapsed-time summary. Only the root installer asks questions; it forwards the answers to service installers as `--fresh-db` and `--rebuild` flags.
- Preserve local data during normal setup and shutdown. The installer's fresh-database prompt is the only data-reset path — it names the affected volume and defaults to no. The `--quick` path never removes volumes.
- Keep credentials and production secrets out of images, committed environment files, and logs.

## Draft frontend and backend files

The following examples show the proposed local-development shape. They assume a Next.js public site, three React portals, a NestJS backend, Node.js, and npm with a `package-lock.json`. Replace sample commands with the package scripts for each service before implementation.

Proposed layout:

```text
services/public-site/
  docker/public-site.Dockerfile
  docker/npm.Dockerfile
  docker-compose.yml
  install.sh
  .env.example
  .dockerignore
  .gitignore
  storage/npm/ (created locally)
services/player-portal/
  docker/player-portal.Dockerfile
  docker/npm.Dockerfile
  docker-compose.yml
  install.sh
  .env.example
  .dockerignore
  .gitignore
  storage/npm/ (created locally)
services/venue-portal/
  (same service-owned files as player-portal, with venue-portal.Dockerfile)
services/platform-portal/
  (same service-owned files as player-portal, with platform-portal.Dockerfile)
services/backend/
  docker/backend.Dockerfile
  docker/npm.Dockerfile
  docker/postgres.Dockerfile
  docker/reminder-worker.Dockerfile
  docker/mailpit.Dockerfile
  docker/ollama.Dockerfile
  docker-compose.yml
  install.sh
  .env.example
  .dockerignore
  .gitignore
  storage/npm/ (created locally)
install.sh
```

Every tag below is a draft version family, not a final image pin — `<pinned-version>` markers are placeholders. Select and record exact tags or digests in each `docker/*.Dockerfile` before implementation. There are no `image:` references for stack services; the Dockerfile is the single place that records each version.

`services/public-site/.env.example`:

```dotenv
DOCKER_CONTAINER_PREFIX=openplay
PUBLIC_SITE_PORT=3000
BACKEND_INTERNAL_URL=http://openplay-backend:8000
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Each React portal has its own `.env.example` with its local port and backend API URL. Local ports are 3001 for the player portal, 3002 for the venue portal, and 3003 for the Platform Administrator portal. Port `3004` remains a preferred local port for a future service; it is currently unassigned.

```dotenv
DOCKER_CONTAINER_PREFIX=openplay
PORTAL_PORT=3001
BACKEND_API_URL=http://localhost:8000
```

`services/backend/.env.example`:

```dotenv
DOCKER_CONTAINER_PREFIX=openplay
BACKEND_PORT=8000
POSTGRES_DB=openplay
POSTGRES_USER=openplay
POSTGRES_PASSWORD=local-development-only
# Optional AI profile: containerized Ollama, or a host-installed Ollama on macOS
OLLAMA_HOST=http://ollama:11434
# Encrypts BYOK provider keys before they reach Postgres; generate a 32-byte key
AI_PROVIDER_ENCRYPTION_KEY=generate-32-byte-base64-key
```

The sample database password is for local development only. Do not reuse it in shared or production environments. Each service installer creates its `.env` from its own `.env.example` only when `.env` is missing.

Add the following `.dockerignore` to each app image build context so local dependencies, build output, secrets, and Git data do not enter the images:

```text
node_modules
.next
dist
coverage
.env*
.git
*.pem
storage/npm
```

Add `node_modules/` and `storage/npm/` to each service's `.gitignore`. Do not mount a named Docker volume over `node_modules/`; it must remain visible in the host service directory for IDE indexing.

Each service `.gitignore` includes:

```gitignore
node_modules/
storage/npm/
```

### Public-site image

`services/public-site/docker/public-site.Dockerfile`:

```dockerfile
FROM node:22-alpine

WORKDIR /app
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]
```

### Portal image

Use this development image pattern for each React portal. Its development command must listen on `0.0.0.0` so the host can reach it.

`services/player-portal/docker/player-portal.Dockerfile` (use the same pattern for the venue and Platform Administrator portals):

```dockerfile
FROM node:22-alpine

WORKDIR /app
EXPOSE 3001
CMD ["npm", "run", "dev"]
```

### Backend image

`services/backend/docker/backend.Dockerfile`:

```dockerfile
FROM node:22-alpine

WORKDIR /app
EXPOSE 8000
CMD ["npm", "run", "dev"]
```

The backend development command must listen on `0.0.0.0:8000` so the frontends and the host can reach it.

`services/backend/docker/reminder-worker.Dockerfile` reuses the same base with the worker entrypoint — a separate Dockerfile per service, not a shared `image:` reference:

```dockerfile
FROM node:22-alpine

WORKDIR /app
CMD ["npm", "run", "worker:dev"]
```

### Infrastructure images

Backend-owned infrastructure also builds from thin per-service Dockerfiles so versions live in `docker/` and each image has a place for configuration:

`services/backend/docker/postgres.Dockerfile` — the initdb hook is where extensions such as `btree_gist` (needed for reservation exclusion constraints) and RLS roles get installed:

```dockerfile
FROM postgres:17-alpine

# COPY docker/postgres/initdb/ /docker-entrypoint-initdb.d/
```

`services/backend/docker/mailpit.Dockerfile`:

```dockerfile
FROM axllent/mailpit:<pinned-version>
```

`services/backend/docker/ollama.Dockerfile`:

```dockerfile
FROM ollama/ollama:<pinned-version>
```

### npm utility images

Each service builds an `npm` utility image from its own `docker/npm.Dockerfile`. The image provides Node.js and npm. The Compose service mounts the service directory at `/app`, so `npm install` writes `node_modules/` into the host directory.

Each service owns a `docker/npm.Dockerfile` with this pattern:

```dockerfile
FROM node:22-alpine

WORKDIR /app
ENTRYPOINT ["npm"]
```

The utility image does not copy the app source or install packages during image build. The service's Compose file provides the bind mount and npm cache path.

### Public-site Compose file

The public-site Compose file starts only the Next.js site. It joins a shared local API network that the backend installer creates. The site can reach the backend API on this network but cannot reach PostgreSQL.

`services/public-site/docker-compose.yml`:

```yaml
services:
  public-site:
    init: true
    restart: unless-stopped
    build:
      context: .
      dockerfile: docker/public-site.Dockerfile
    command: ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]
    container_name: "${DOCKER_CONTAINER_PREFIX:-openplay}-public-site"
    ports:
      - "127.0.0.1:${PUBLIC_SITE_PORT:-3000}:3000"
    environment:
      BACKEND_INTERNAL_URL: ${BACKEND_INTERNAL_URL:-http://openplay-backend:8000}
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://localhost:8000}
    volumes:
      - .:/app:delegated
    networks:
      - openplay-local-api

  npm:
    init: true
    tty: true
    build:
      context: .
      dockerfile: docker/npm.Dockerfile
    container_name: "${DOCKER_CONTAINER_PREFIX:-openplay}-public-site-npm"
    volumes:
      - .:/app:delegated
      - ./storage/npm:/root/.npm

networks:
  openplay-local-api:
    external: true
    name: openplay-local-api

```

### React-portal Compose template

Each portal has its own Compose file and npm utility container. This example shows the player portal. The venue and Platform Administrator Compose files use the same pattern with their own service names and local ports.

`services/player-portal/docker-compose.yml`:

```yaml
services:
  player-portal:
    init: true
    restart: unless-stopped
    build:
      context: .
      dockerfile: docker/player-portal.Dockerfile
    command: ["npm", "run", "dev"]
    container_name: "${DOCKER_CONTAINER_PREFIX:-openplay}-player-portal"
    ports:
      - "127.0.0.1:${PORTAL_PORT:-3001}:3001"
    environment:
      API_BASE_URL: ${API_BASE_URL:-http://localhost:8000}
    volumes:
      - .:/app:delegated
    networks:
      - openplay-local-api

  npm:
    init: true
    tty: true
    build:
      context: .
      dockerfile: docker/npm.Dockerfile
    container_name: "${DOCKER_CONTAINER_PREFIX:-openplay}-player-portal-npm"
    volumes:
      - .:/app:delegated
      - ./storage/npm:/root/.npm

networks:
  openplay-local-api:
    external: true
    name: openplay-local-api
```

The portal's development server must listen on `0.0.0.0:3001`. Use the matching port and image names in the other portal Compose files. The React build tool determines how the browser API URL is provided; `BACKEND_API_URL` is a placeholder until that tool is selected.

### Backend Compose file

The backend Compose file starts the backend API and its infrastructure. PostgreSQL is on a private backend network and has a backend-owned named data volume. It is not published to the host by default. The optional notification profile adds the reminder worker and Mailpit.

`services/backend/docker-compose.yml`:

```yaml
services:
  backend:
    init: true
    restart: unless-stopped
    build:
      context: .
      dockerfile: docker/backend.Dockerfile
    command: ["npm", "run", "dev"]
    container_name: "${DOCKER_CONTAINER_PREFIX:-openplay}-backend"
    ports:
      - "127.0.0.1:${BACKEND_PORT:-8000}:8000"
    environment:
      PORT: "8000"
      DATABASE_HOST: postgres
      DATABASE_PORT: "5432"
      DATABASE_NAME: ${POSTGRES_DB:-openplay}
      DATABASE_USER: ${POSTGRES_USER:-openplay}
      DATABASE_PASSWORD: ${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in .env}
    volumes:
      - .:/app:delegated
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      openplay-local-api:
        aliases:
          - openplay-backend
      backend_data:

  npm:
    init: true
    tty: true
    build:
      context: .
      dockerfile: docker/npm.Dockerfile
    container_name: "${DOCKER_CONTAINER_PREFIX:-openplay}-backend-npm"
    volumes:
      - .:/app:delegated
      - ./storage/npm:/root/.npm

  postgres:
    init: true
    restart: unless-stopped
    build:
      context: .
      dockerfile: docker/postgres.Dockerfile
    container_name: "${DOCKER_CONTAINER_PREFIX:-openplay}-postgres"
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-openplay}
      POSTGRES_USER: ${POSTGRES_USER:-openplay}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in .env}
    volumes:
      - backend_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \"$${POSTGRES_USER}\" -d \"$${POSTGRES_DB}\""]
      interval: 5s
      timeout: 5s
      retries: 10
    networks:
      - backend_data

  reminder-worker:
    profiles:
      - notifications
    init: true
    build:
      context: .
      dockerfile: docker/reminder-worker.Dockerfile
    command: ["npm", "run", "worker:dev"]
    container_name: "${DOCKER_CONTAINER_PREFIX:-openplay}-reminder-worker"
    environment:
      REMINDER_SCAN_INTERVAL_MS: "5000"
      SMTP_HOST: mailpit
      SMTP_PORT: "1025"
      DATABASE_HOST: postgres
      DATABASE_PORT: "5432"
      DATABASE_NAME: ${POSTGRES_DB:-openplay}
      DATABASE_USER: ${POSTGRES_USER:-openplay}
      DATABASE_PASSWORD: ${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in .env}
    volumes:
      - .:/app:delegated
    depends_on:
      postgres:
        condition: service_healthy
      mailpit:
        condition: service_started
    networks:
      - backend_data
      - backend_notifications

  mailpit:
    profiles:
      - notifications
    init: true
    restart: unless-stopped
    build:
      context: .
      dockerfile: docker/mailpit.Dockerfile
    container_name: "${DOCKER_CONTAINER_PREFIX:-openplay}-mailpit"
    ports:
      - "127.0.0.1:8025:8025"
    networks:
      - backend_notifications

  ollama:
    profiles:
      - ai
    init: true
    restart: unless-stopped
    build:
      context: .
      dockerfile: docker/ollama.Dockerfile
    container_name: "${DOCKER_CONTAINER_PREFIX:-openplay}-ollama"
    volumes:
      - ollama_models:/root/.ollama
    networks:
      - backend_data

networks:
  openplay-local-api:
    external: true
    name: openplay-local-api
  backend_data:
    internal: true
  backend_notifications:
    internal: true

volumes:
  backend_postgres_data:
  ollama_models:
```

The backend installer creates the `openplay-local-api` network before it starts Compose. The backend Compose file and all four frontend Compose files use that external network, so each stack can be managed on its own. The backend API has the shared network alias `openplay-backend`. The backend API and reminder worker join `backend_data`; PostgreSQL also joins that private network. No frontend can reach the database directly. Browsers call the backend's published local port. The Next.js server uses `BACKEND_INTERNAL_URL` to call the backend over the shared network.

Every service — the backend API, the `npm` utility, PostgreSQL, the reminder worker, Mailpit, and Ollama — builds from its own `docker/*.Dockerfile`, and every container is named `${DOCKER_CONTAINER_PREFIX}-<service>` (default prefix `openplay`).

### Local reminder simulation

The optional `notifications` profile adds a reminder worker and Mailpit to the backend stack. The worker builds from its own `docker/reminder-worker.Dockerfile` and runs the worker entrypoint instead of the API command. Only the worker runs the reminder scheduler; the API must not start a second scheduler.

The worker reads due reminders from persistent backend records. It claims each reminder atomically with `SELECT ... FOR UPDATE SKIP LOCKED` inside a transaction, so two worker replicas never claim the same row:

```sql
SELECT id FROM reminders
WHERE due_at <= now() AND status = 'pending'
ORDER BY due_at
LIMIT 50
FOR UPDATE SKIP LOCKED;
```

The second worker skips rows the first already locked, so each due reminder is processed exactly once per batch. It then checks that the reservation or event is still active, sends the message through Mailpit, and records the delivery result. Use an idempotency key for each scheduled reminder so retries or multiple workers do not send duplicates. A failed notification must not change booking, event, payment, or rental status.

After running the backend installer or root installer, start the optional local services from `services/backend`:

```sh
docker compose --profile notifications up -d reminder-worker mailpit
docker compose --profile notifications logs -f reminder-worker
```

Open Mailpit at `http://localhost:8025` to inspect captured email. The SMTP port is available only to backend containers. Bind the web interface to localhost, and do not configure a real email or SMS provider in this local profile.

Create each reminder in the same database transaction as its booking or event change, or use a transactional outbox. For a quick test, add a development-only seed command that creates a reminder due about 30 seconds later. Its example invocation could be `docker compose exec backend npm run reminders:demo -- --due-in=30s`. Keep the 5-second scan interval as a local test setting; it does not decide the real reminder timing policy.

Test that a cancelled booking is skipped, a stopped worker sends pending reminders after restart, and two worker replicas do not send the same reminder twice. To test two workers, run `docker compose --profile notifications up -d --scale reminder-worker=2 reminder-worker`. SMS can use a test adapter that records messages without sending them. Use fake contact data and keep message content within the privacy rules in [Notifications](../../domain/specifications/NOTIFICATIONS.MD).

Use the persistent database as the source of truth for reminders. NestJS's `@nestjs/schedule` can poll for due records in the worker process, while `FOR UPDATE SKIP LOCKED` inside a transaction ensures that only one worker claims each record. Do not use only in-memory timers, because container restarts would lose them. A queue such as BullMQ can be considered later if delivery volume or retry needs justify adding Redis to the backend stack.

### Local AI model (optional)

The `ai` profile runs Ollama as backend-owned infrastructure for the optional assistant ([ADR-0006](0006-ai-assistant-runtime.MD)). It joins only the private `backend_data` network — the model has no public route and no host port — and `ollama_models` holds downloaded model data.

```sh
docker compose --profile ai up -d ollama
docker compose exec ollama ollama pull <model>
```

The backend reaches it at `OLLAMA_HOST=http://ollama:11434`. On macOS, containers cannot use Metal/GPU acceleration, so larger models run slowly; a host-installed Ollama is faster — leave the container stopped and set `OLLAMA_HOST=http://host.docker.internal:11434` in the backend `.env`. The assistant works with a hosted provider without Ollama at all, and the base stack does not require the `ai` profile.

### Backend installer

Service installers are non-interactive step runners — they print bannered, numbered steps and take flags instead of asking questions. The root installer collects the answers and forwards them.

`services/backend/install.sh`:

```sh
#!/bin/sh

green='\e[1;32m%s\e[0m\n'

set -eu

SERVICE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$SERVICE_DIR"

FRESH_DB=false
REBUILD=false
for arg in "$@"; do
  case "$arg" in
    --fresh-db) FRESH_DB=true ;;
    --rebuild)  REBUILD=true ;;
  esac
done

printf "$green" "#######################################################################"
printf "$green" "# "
printf "$green" "# OpenPlay Backend Installer"
printf "$green" "# "
printf "$green" "#######################################################################"

echo ""
printf "$green" "#######################################################################"
printf "$green" "# "
printf "$green" "# [1/6] Copying default environment file."
printf "$green" "# "
if [ ! -f .env ]; then
  cp .env.example .env
  printf "$green" "# Copied .env"
else
  printf "$green" "# File .env already exists."
fi
printf "$green" "# "
printf "$green" "#######################################################################"

echo ""
printf "$green" "#######################################################################"
printf "$green" "# "
printf "$green" "# [2/6] Preparing npm cache and shared API network."
printf "$green" "# "
printf "$green" "#######################################################################"
mkdir -p storage/npm
if ! docker network inspect openplay-local-api >/dev/null 2>&1; then
  docker network create openplay-local-api
fi

echo ""
if [ "$FRESH_DB" = true ]; then
  printf "$green" "#######################################################################"
  printf "$green" "# "
  printf "$green" "# [3/6] Shutting down containers and deleting backend_postgres_data."
  printf "$green" "# "
  printf "$green" "#######################################################################"
  docker compose down -v
else
  printf "$green" "#######################################################################"
  printf "$green" "# "
  printf "$green" "# [3/6] Shutting down existing backend containers."
  printf "$green" "# "
  printf "$green" "#######################################################################"
  docker compose down
fi

echo ""
if [ "$REBUILD" = true ]; then
  printf "$green" "#######################################################################"
  printf "$green" "# "
  printf "$green" "# [4/6] Rebuilding docker images."
  printf "$green" "# "
  printf "$green" "#######################################################################"
  rm -Rf node_modules/
  docker compose build
else
  printf "$green" "#######################################################################"
  printf "$green" "# "
  printf "$green" "# [4/6] Rebuilding docker images. Skipped."
  printf "$green" "# "
  printf "$green" "#######################################################################"
fi

echo ""
printf "$green" "#######################################################################"
printf "$green" "# "
printf "$green" "# [5/6] Installing dependencies, starting PostgreSQL, running migrations."
printf "$green" "# "
printf "$green" "#######################################################################"
docker compose run --rm npm install --no-audit
docker compose up -d --wait postgres
docker compose run --rm backend npm run db:migrate

echo ""
printf "$green" "#######################################################################"
printf "$green" "# "
printf "$green" "# [6/6] Starting the backend API as a daemon."
printf "$green" "# "
printf "$green" "#######################################################################"
docker compose up -d backend
```

Replace `npm run db:migrate` with the migration command configured for the NestJS backend. This script starts only backend-owned infrastructure and the backend API. The `--fresh-db` flag is the only path that removes the `backend_postgres_data` volume; without it, `docker compose down` keeps data. Compose builds images lazily on first `up`/`run`, so skipping step 4 is safe — `--rebuild` forces a clean image and `node_modules/` rebuild.

### Public-site installer

`services/public-site/install.sh`:

```sh
#!/bin/sh

green='\e[1;32m%s\e[0m\n'

set -eu

SERVICE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$SERVICE_DIR"

REBUILD=false
for arg in "$@"; do
  case "$arg" in
    --rebuild) REBUILD=true ;;
  esac
done

printf "$green" "#######################################################################"
printf "$green" "# "
printf "$green" "# OpenPlay Public Site Installer"
printf "$green" "# "
printf "$green" "#######################################################################"

echo ""
printf "$green" "#######################################################################"
printf "$green" "# "
printf "$green" "# [1/5] Copying default environment file."
printf "$green" "# "
if [ ! -f .env ]; then
  cp .env.example .env
  printf "$green" "# Copied .env"
else
  printf "$green" "# File .env already exists."
fi
printf "$green" "# "
printf "$green" "#######################################################################"

echo ""
printf "$green" "#######################################################################"
printf "$green" "# "
printf "$green" "# [2/5] Preparing npm cache and checking the shared API network."
printf "$green" "# "
printf "$green" "#######################################################################"
mkdir -p storage/npm
if ! docker network inspect openplay-local-api >/dev/null 2>&1; then
  printf '%s\n' "Run services/backend/install.sh first to create the shared API network." >&2
  exit 1
fi

echo ""
if [ "$REBUILD" = true ]; then
  printf "$green" "#######################################################################"
  printf "$green" "# "
  printf "$green" "# [3/5] Rebuilding docker images."
  printf "$green" "# "
  printf "$green" "#######################################################################"
  rm -Rf node_modules/
  docker compose build
else
  printf "$green" "#######################################################################"
  printf "$green" "# "
  printf "$green" "# [3/5] Rebuilding docker images. Skipped."
  printf "$green" "# "
  printf "$green" "#######################################################################"
fi

echo ""
printf "$green" "#######################################################################"
printf "$green" "# "
printf "$green" "# [4/5] Installing Node.js dependencies."
printf "$green" "# "
printf "$green" "#######################################################################"
docker compose run --rm npm install --no-audit

echo ""
printf "$green" "#######################################################################"
printf "$green" "# "
printf "$green" "# [5/5] Starting the public site as a daemon."
printf "$green" "# "
printf "$green" "#######################################################################"
docker compose up -d public-site
```

### React portal installer template

Each portal has its own installer. Use this template for `services/player-portal/install.sh`, `services/venue-portal/install.sh`, and `services/platform-portal/install.sh`. Set the service name and banner to match the portal.

```sh
#!/bin/sh

green='\e[1;32m%s\e[0m\n'

set -eu

SERVICE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$SERVICE_DIR"

REBUILD=false
for arg in "$@"; do
  case "$arg" in
    --rebuild) REBUILD=true ;;
  esac
done

printf "$green" "#######################################################################"
printf "$green" "# "
printf "$green" "# OpenPlay Player Portal Installer"
printf "$green" "# "
printf "$green" "#######################################################################"

# Same [1/5]–[5/5] steps as the public-site installer, ending with:
docker compose up -d player-portal
```

The backend installer must run first so the shared network and backend API are available to all frontends.

### Root installer

The root installer is the only interactive script. It asks the questions, then runs each service installer with the matching flags. `--quick` skips every prompt and preserves all data — it never passes `--fresh-db`.

`install.sh`:

```sh
#!/bin/sh

green='\e[1;32m%s\e[0m\n'

set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$ROOT_DIR"

QUICK_MODE=false
for arg in "$@"; do
  case "$arg" in
    --quick) QUICK_MODE=true ;;
  esac
done

clear

if [ "$QUICK_MODE" = true ]; then
  printf "$green" "#######################################################################"
  printf "$green" "# "
  printf "$green" "# OpenPlay Installer (Quick Mode)"
  printf "$green" "# "
  printf "$green" "#######################################################################"
  choice="Y"
  fresh_database="N"
  rebuild="N"
else
  printf "$green" "#######################################################################"
  printf "$green" "# "
  printf "$green" "# OpenPlay Installer."
  printf "$green" "# "
  printf "$green" "# This requires the following to be installed on your computer:"
  printf "$green" "# 1. Docker - https://www.docker.com/"
  printf "$green" "# "
  printf "$green" "# Do you want to install OpenPlay on your computer? [Y/n]"
  printf "$green" "# "
  printf "$green" "#######################################################################"
  read -r choice
fi

if [ "$choice" = "Y" ]; then
  SECONDS=0

  if [ "$QUICK_MODE" = false ]; then
    printf "$green" "#######################################################################"
    printf "$green" "# "
    printf "$green" "# Do you want a fresh database? [y/N]"
    printf "$green" "# "
    printf "$green" "# This will:"
    printf "$green" "# 1. Stop the backend containers."
    printf "$green" "# 2. Delete the backend_postgres_data volume."
    printf "$green" "# "
    printf "$green" "#######################################################################"
    read -r fresh_database

    printf "$green" "#######################################################################"
    printf "$green" "# "
    printf "$green" "# Do you want to rebuild project dependencies? [Y/n]"
    printf "$green" "# "
    printf "$green" "# This will:"
    printf "$green" "# 1. Delete node_modules/ folders."
    printf "$green" "# 2. Rebuild docker images."
    printf "$green" "# "
    printf "$green" "#######################################################################"
    read -r rebuild
  fi

  backend_flags=""
  [ "$fresh_database" = "Y" ] && backend_flags="$backend_flags --fresh-db"
  [ "$rebuild" = "Y" ] && backend_flags="$backend_flags --rebuild"
  frontend_flags=""
  [ "$rebuild" = "Y" ] && frontend_flags="--rebuild"

  echo ""
  printf "$green" "#######################################################################"
  printf "$green" "# "
  printf "$green" "# [1/6] Checking Docker."
  printf "$green" "# "
  printf "$green" "#######################################################################"
  docker compose version >/dev/null
  docker info >/dev/null

  echo ""
  printf "$green" "#######################################################################"
  printf "$green" "# "
  printf "$green" "# [2/6] Installing the backend."
  printf "$green" "# "
  printf "$green" "#######################################################################"
  ./services/backend/install.sh $backend_flags

  step=3
  for service in public-site player-portal venue-portal platform-portal; do
    echo ""
    printf "$green" "#######################################################################"
    printf "$green" "# "
    printf "$green" "# [$step/6] Installing $service."
    printf "$green" "# "
    printf "$green" "#######################################################################"
    ./services/"$service"/install.sh $frontend_flags
    step=$((step + 1))
  done

  t=$SECONDS
  echo ""
  printf "$green" "#######################################################################"
  printf "$green" "# "
  printf "$green" "# OpenPlay installed!"
  printf "$green" "# Done in $(( t / 60 )) minutes and $(( t % 60 )) seconds."
  printf "$green" "# "
  printf "$green" "#######################################################################"

  for service in backend public-site player-portal venue-portal platform-portal; do
    (cd "services/$service" && docker compose ps)
  done
fi
```

The root installer checks Docker, asks for confirmation, runs the backend installer before the four frontend installers, and reports each stack's status. Service installers preserve existing `.env` files. The fresh-database prompt is the only data-reset path — it names `backend_postgres_data` before deleting it, defaults to no, and is never triggered by `--quick`.

## Reasons

- Docker gives contributors a consistent runtime without requiring the same language tools on every host.
- Purpose-built images keep runtime and development-tool dependencies clear.
- Bind mounts and watch modes support a fast edit-and-test cycle.
- Named volumes preserve local data while Compose manages the supporting services.
- The root installer coordinates setup while each service keeps control of its own stack.

## Consequences

- Contributors need Docker Engine and Docker Compose.
- The first setup may take time while Docker builds images and installs dependencies.
- Each service must document its development command, Compose file, ports, health checks, and required environment variables.
- A service installer and its Compose file must change when that service's setup steps change. The root installer must change when install order changes.
- Add each frontend and the backend to `SERVICE_MAP.md` when scaffolding its service directory.
- The current local-development skill must be updated when this proposal is accepted and implemented.

## Alternatives considered

### Install runtimes and dependencies on the host

This can make some commands faster, but it requires contributors to install and manage compatible runtime versions. Docker remains the standard so local environments behave more consistently.

### Remove all volumes during setup

This can produce a clean database, but it can also erase useful local data. Data removal must require a separate, confirmed action.

## Open details

- Any additional services and which ones are optional.
- Whether other optional or resource-heavy services need Compose profiles.
- NestJS module boundaries and database environment-variable names.
- Whether additional backend infrastructure, such as a cache, is needed.
- The local CORS policy for frontend-to-backend browser requests.
- Whether developers need an optional host port for PostgreSQL.
- Reminder timing, delivery channels, providers, and retry limits.
- How npm utility containers map file ownership to the host operating system.
- Exact base-image tags or digests.
- Installer flags and the final setup and migration commands.
