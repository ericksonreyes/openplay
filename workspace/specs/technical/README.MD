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

## Technical guidance

- [Identifier strategy](IDENTIFIERS.MD)
- [Public content delivery](PUBLIC_CONTENT_DELIVERY.MD)
- [Security and access control](security/README.MD)
- [User experience guidance](user_experience/README.MD)
