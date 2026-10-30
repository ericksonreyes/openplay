---
name: api-security
description: OpenPlay security model — JWT RS256 issuance/validation, blacklist policy, public edge vs service mesh, env var conventions
allowed-tools:
  - read
  - grep
  - glob
  - edit
  - write
---

Security invariants for any endpoint, auth flow, or service-to-service call in OpenPlay.

## Canonical sources

- `workspace/specs/technical/security/IDENTITY_AND_ACCESS.MD` — IAM ownership and token model
- `workspace/specs/technical/security/JWT_INVALIDATION.MD` — blacklist + fallback posture
- `workspace/specs/technical/security/INTERNAL_SERVICE_SECURITY.MD` — exposure model
- `workspace/specs/technical/security/JWT_SIGNING_KEYS.MD` — key handling

## Invariants

- **IAM is the sole JWT issuer.** RS256; IAM holds `JWT_PRIVATE_KEY`, every other service gets `JWT_PUBLIC_KEY` only. `JWT_SECRET` exists solely as a local/test fallback — never wire it into service-to-service auth.
- **Claims**: `sub` (IAM user UUIDv7), `tenant_id` for tenant scope (platform-scope users carry no business `tenant_id`), `roles`, `permissions`, venue assignments, `iss`, `aud`, `exp`, `iat`, `jti`.
- **Revocation**: shared Redis blacklist keyed `jwt:blacklist:<jti>` when configured. Redis is not in the base stack yet — until it is, validation is `exp`-only (the documented fallback); the gap is logged and observable, and sensitive operations may still fail closed.
- **Exposure model**: the NestJS backend on 3100 is the only API edge — public endpoints (public-content prefix, auth entry points, verified provider webhooks, guest verification) are rate-limited and field-allowlisted; everything else is JWT-protected. Private infrastructure (PostgreSQL, Ollama, Mailpit) has no public route or host port — internal networks only.
- **Sync calls** preserve the caller's verified claims and scope — no component may gain more access than the user who initiated the request. **Async flows** authenticate as a service identity carrying an on-behalf-of user ID — never put live JWTs in events or jobs.
- `created_by`/`updated_by` columns store `sub`, not display names.

## Environment contract

The backend's `.env.example` carries the auth vars (`JWT_PUBLIC_KEY`, `JWT_PRIVATE_KEY` for the `iam` module as sole signer, `JWT_ALGORITHM=RS256`, `JWT_TTL`; `JWT_SECRET` exists only as the local fallback). Expected issuer/audience per the security specs: `iss=openplay-identity-access`, `aud=openplay-api`. Don't invent parallel auth env vars — extend the canonical set.

## When writing endpoints

Default deny: new endpoints are JWT-protected unless explicitly public (the public-content prefix, sign-in/recovery, provider webhooks, guest verification). Validate `tenant_id` scoping on every tenant-owned resource — a valid token from tenant A must not read tenant B's data, and RLS is the fail-closed backstop.

Public endpoints run on dedicated rate-limit buckets and return allowlisted fields only — never bookings, guest contacts, payment records, or internal notes. Provider webhooks verify signatures and process idempotently; a browser redirect is never proof of payment.
