# ADR-0007: Keep Identity & Access as a Backend Module

## Status

Accepted

## Context

[Identity & Access](../security/IDENTITY_AND_ACCESS.MD) originally described IAM as a dedicated microservice owning users, roles, credentials, and token issuance. The NestJS implementation keeps IAM inside its modular-monolith backend ([ADR-0004](0004-nestjs-backend-api.MD)).

This ADR defines the IAM boundary in the NestJS implementation.

## Decision

IAM is a **module inside the NestJS backend** — not a separate service — while keeping the same ownership boundaries:

- The NestJS `iam` module owns identity operations and is the sole JWT signer (RS256).
- Scope resolution (`platform` vs `tenant`), `(scope, username)` and `(scope, email)` uniqueness, sign-in, and password recovery all live in the module.
- Authentication lookups run under a service context (`app.is_system`), since no user context exists before sign-in; user records still carry `tenant_id` where applicable.
- Every invariant in the security specs is unchanged: `JWT_PUBLIC_KEY` verification elsewhere, the claims contract, the Redis blacklist, and `sub`-based accountability.
- The module keeps a hard boundary — its own tables, no other module writing to the user store — so it can be extracted into `services/iam/` later if the split becomes justified.

## Reasons

- One deployable matches the modular-monolith start; the split cost (network calls, discovery, key distribution, another Compose stack) buys nothing yet.
- All security invariants are identical whether IAM is a module or a service — they concern key custody and claims, not process placement.
- Token validation elsewhere never calls IAM: `JWT_PUBLIC_KEY` + blacklist checks work the same in both shapes.

## Consequences

- The module boundary is enforced in code review: no other Nest module writes identity tables or issues JWTs.
- A later split means extracting the module into `services/iam/` — mostly a deployment change, since the claims contract and key model stay identical.
- The earlier "dedicated microservice" wording in [Identity & Access](../security/IDENTITY_AND_ACCESS.MD) is superseded by this ADR.

## Alternatives considered

### Separate IAM service now

Cleaner network boundary and independent scaling, but premature for a system that has no services yet. Deferred, not rejected.
