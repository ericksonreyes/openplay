# ADR-0010: Use Prisma for NestJS Backend Persistence

## Status

Accepted

## Context

The NestJS backend implementation uses PostgreSQL with transaction-scoped RLS context. Every protected request must set its verified actor and tenant context with `SET LOCAL` before any data query, and schema changes must preserve RLS policies and audit constraints.

## Decision

Use Prisma with PostgreSQL for NestJS data access and Prisma Migrate for that implementation's migration set.

- Run protected request database work inside an interactive Prisma transaction. Set RLS context with `SET LOCAL` through the transaction client, and use only that transaction client for the request's data queries.
- Treat Prisma Migrate migrations as the source of schema changes; do not use `db push` or runtime schema synchronization for tracked environments.
- Express PostgreSQL-specific features, including RLS policies, constraints, and extensions, explicitly in SQL migration files.
- Keep Prisma access and table ownership inside their backend modules; cross-module access continues through permission-checked services.

## Reasons

- Prisma provides a generated, typed client and a migration workflow for the NestJS/PostgreSQL backend.
- Interactive transactions let the backend set `SET LOCAL` context and keep it attached to the queries that RLS evaluates.
- Explicit migrations make RLS policy and audit-schema changes reviewable.

## Consequences

- Protected request queries must use the transaction-scoped Prisma client; using the global client would bypass the request context.
- Tests for RLS and PostgreSQL-specific behavior must run against PostgreSQL rather than relying only on an in-memory substitute.
- Prisma CLI/client and PostgreSQL package versions are pinned during backend scaffolding.

## Alternatives considered

### TypeORM

TypeORM integrates closely with NestJS, but the project selects Prisma's generated client and Prisma Migrate workflow.

### Kysely

Kysely offers typed SQL with direct control, but would require more backend integration and repository conventions than Prisma for the selected NestJS stack.
