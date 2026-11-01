# Technical Specifications

This section records technical decisions and guidance for building OpenPlay. Product behavior belongs in the domain specifications; these documents describe technical choices and constraints.

## Decisions

- [ADR-0001: Separate the Public Site and Portal Frontends](decisions/0001-web-application-framework.MD) — selects Next.js for public pages and separate React portals.
- [ADR-0002: Use Tailwind CSS Across the Web Frontends](decisions/0002-tailwind-css-for-styling.MD) — selects Tailwind CSS for all four frontends.
- [ADR-0003: Use Docker for Local Development](decisions/0003-docker-local-development.MD) — proposes service-owned Compose files and a root installer.
- [ADR-0004: Use NestJS for Backend APIs](decisions/0004-nestjs-backend-api.MD) — selects NestJS as the API layer for all frontends.
- [ADR-0005: Use PostgreSQL Row-Level Security for Tenant Isolation](decisions/0005-postgresql-row-level-security.MD) — selects RLS plus append-only audit logging for tenant data.
- [ADR-0006: Run the AI Assistant as a NestJS Module with Ollama Support](decisions/0006-ai-assistant-runtime.MD) — assistant lives in the backend; Ollama is backend-owned optional infrastructure.
- [ADR-0007: Keep Identity & Access as a Backend Module](decisions/0007-iam-as-backend-module.MD) — IAM is a module in the NestJS backend, not a separate service.
- [ADR-0008: E2E Testing with Playwright Against an Isolated World](decisions/0008-e2e-testing-with-playwright.MD) — browser E2E in persona-ordered stages on an isolated database built through real flows.
- [ADR-0009: Documentation Visuals Are Generated Artifacts](decisions/0009-docs-as-generated-artifacts.MD) — screenshots and recordings come from Playwright capture scripts, never manual.
- [ADR-0010: Use Prisma for Backend Persistence](decisions/0010-prisma-backend-persistence.MD) — selects Prisma and Prisma Migrate with transaction-bound RLS context.
- [ADR-0011: Use JSON:API for Backend Envelopes](decisions/0011-jsonapi-api-envelope.MD) — request/response media type, `{data}` success shape, and `errors[]` error contract.
- [ADR-0012: Rotating Refresh Tokens for Sessions](decisions/0012-rotating-refresh-tokens.MD) — short-lived JWTs + single-use rotating refresh tokens in `auth_tokens`; dual revocation on sign-out.

## Technical guidance

- [AI governance](AI_GOVERNANCE.MD)
- [Identifier strategy](IDENTIFIERS.MD)
- [Backend API contract](API_CONTRACT.MD) — REST + JSON:API endpoint inventory every frontend consumes.
- [Public content delivery](PUBLIC_CONTENT_DELIVERY.MD)
- [Security and access control](security/README.MD)
- [User experience guidance](user_experience/README.MD)

## Implementation plans

- [Implementation plans index](implementation_plans/README.MD) — per-service build plans that turn the decisions above into working software.
