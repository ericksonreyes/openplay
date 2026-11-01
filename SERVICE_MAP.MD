# Service Map

This file lists the services in `services/` and acts as the canonical inventory for the code repositories in this workspace.

Each entry should use a simple per-service record with these fields:

- `name`
- `description`
- `location`
- `stack` (optional)
- `port` (local development port, optional)

## Services

All entries below are **scaffolded** — each service directory under `services/` contains its Compose stack, Dockerfiles, `.env.example`, installer, and a skeleton app. Domain features land with the implementation plans in `workspace/specs/technical/implementation_plans/`. Architecture references: [ADR-0001](workspace/specs/technical/decisions/0001-web-application-framework.MD) (separate frontends), [ADR-0004](workspace/specs/technical/decisions/0004-nestjs-backend-api.MD) (shared backend API), and [ADR-0003](workspace/specs/technical/decisions/0003-docker-local-development.MD) (per-service Docker files).

### Channels (frontends)

#### Public Site

- `name`: public-site
- `description`: Public-facing site — published Business Profile Pages, venue information, public event listings, and discovery. Reads only through the backend's read-only public endpoints.
- `location`: `services/public-site/`
- `stack`: Next.js + Tailwind CSS
- `port`: 3000

#### Player Portal

- `name`: player-portal
- `description`: Player/participant app — reservations, event registration, memberships, rentals, payments, and guest-booking access.
- `location`: `services/player-portal/`
- `stack`: React + Tailwind CSS
- `port`: 3001

#### Venue Portal

- `name`: venue-portal
- `description`: Business Owner, venue manager, and staff app — schedules, bookings, events, equipment, memberships, facility rules, and business settings.
- `location`: `services/venue-portal/`
- `stack`: React + Tailwind CSS
- `port`: 3002

#### Platform Portal

- `name`: platform-portal
- `description`: Platform Administrator app — business onboarding, tenant management, and platform settings (multi-tenant deployments).
- `location`: `services/platform-portal/`
- `stack`: React + Tailwind CSS
- `port`: 3003

### Backend

#### Backend API

- `name`: backend
- `description`: NestJS implementation of the shared backend — owns PostgreSQL access, domain rules, permissions, tenant isolation (RLS), audit logging, payments, notification scheduling, and IAM/JWT issuance for the NestJS stack. Includes optional `notifications` and `ai` Compose profiles.
- `location`: `services/backend/`
- `stack`: NestJS + TypeScript + PostgreSQL
- `port`: 8000

## Notes

- PostgreSQL, Mailpit, and infrastructure are owned by the backend Compose file. Frontends call the NestJS API over `openplay-local-api`; no browser frontend connects directly to PostgreSQL.
- Port `3004` remains a preferred local port for a future service; it is currently unassigned.
- Mailpit's local web interface is bound to `127.0.0.1:8025` when the `notifications` profile is enabled.
