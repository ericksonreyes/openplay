# Implementation Plans

Build plans that turn the accepted decisions and domain specifications into working services. Each plan says what to build, what it depends on, and how to know it is done. These plans are targets — nothing is implemented yet.

## Conventions

- One folder per service in [SERVICE_MAP.md](../../../../SERVICE_MAP.md), plus `tooling/` for cross-service work that no single service owns.
- Each folder has a `README.MD` index page. Plans live in dedicated files beside it.
- Every plan lists its sources (decisions, domain specifications, security documents), the work to build, dependencies on other plans, acceptance checks, and the open decisions it must not silently make.
- Plans do not replace the specifications. Product behavior stays in the [domain specifications](../../domain/specifications/README.MD); decisions stay in [decisions](../decisions/). A plan that needs a new decision links the open question instead of deciding it.
- When a service is added, renamed, or removed, update this index and `SERVICE_MAP.md` in the same change.

## Structure

| Folder | Service | Stack | Local port |
| --- | --- | --- | --- |
| [public-site/](public-site/) | public-site | Next.js + Tailwind | 3000 |
| [player-portal/](player-portal/) | player-portal | React + Tailwind | 3001 |
| [venue-portal/](venue-portal/) | venue-portal | React + Tailwind | 3002 |
| [platform-portal/](platform-portal/) | platform-portal | React + Tailwind | 3003 |
| [backend/](backend/) | backend | NestJS + TypeScript + PostgreSQL | 8000 |
| [tooling/](tooling/) | cross-service | Docker, Playwright | — |

## Build order

Plans are sequenced by dependency, not by folder:

1. [Local development](tooling/LOCAL_DEVELOPMENT.MD) and [foundation](backend/FOUNDATION.MD) — the stack must run before anything else exists.
2. [Tenant data](backend/TENANT_DATA.MD) and [identity & access](backend/IDENTITY_AND_ACCESS.MD) — every later module needs request context, RLS, and sign-in.
3. Domain modules in onboarding order: [venue catalog](backend/VENUE_CATALOG.MD), [booking](backend/BOOKING.MD), [events](backend/EVENTS.MD), [commerce](backend/COMMERCE.MD), then [notifications](backend/NOTIFICATIONS.MD).
4. Edge-facing modules: [public content](backend/PUBLIC_CONTENT.MD), then the optional [AI assistant](backend/AI_ASSISTANT.MD).
5. Frontends once their API surface exists. The public site depends only on public content; the portals track their backend modules.
6. [End-to-end testing](tooling/END_TO_END_TESTING.MD) and [docs generation](tooling/DOCS_GENERATION.MD) start with the first real UI. Unit-test runners ship from scaffolding — testing is not a later phase.

## Source map

| Decision | Plans that implement it |
| --- | --- |
| [ADR-0001: Separate frontends](../decisions/0001-web-application-framework.MD) | All four frontend plans |
| [ADR-0002: Tailwind CSS](../decisions/0002-tailwind-css-for-styling.MD) | All four frontend plans |
| [ADR-0003: Docker local development](../decisions/0003-docker-local-development.MD) | [Local development](tooling/LOCAL_DEVELOPMENT.MD) |
| [ADR-0004: NestJS backend](../decisions/0004-nestjs-backend-api.MD) | All backend plans |
| [ADR-0005: PostgreSQL RLS](../decisions/0005-postgresql-row-level-security.MD) | [Tenant data](backend/TENANT_DATA.MD) |
| [ADR-0006: AI assistant runtime](../decisions/0006-ai-assistant-runtime.MD) | [AI assistant](backend/AI_ASSISTANT.MD) |
| [ADR-0007: IAM as backend module](../decisions/0007-iam-as-backend-module.MD) | [Identity & access](backend/IDENTITY_AND_ACCESS.MD) |
| [ADR-0008: Playwright E2E](../decisions/0008-e2e-testing-with-playwright.MD) | [End-to-end testing](tooling/END_TO_END_TESTING.MD) |
| [ADR-0009: Generated documentation](../decisions/0009-docs-as-generated-artifacts.MD) | [Docs generation](tooling/DOCS_GENERATION.MD) |
| [ADR-0010: Prisma persistence](../decisions/0010-prisma-backend-persistence.MD) | All backend plans |
