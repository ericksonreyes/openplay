# ADR-0012: Rotating Refresh Tokens for Sessions

## Status

Accepted

## Context

Access tokens are short-lived RS256 JWTs (`JWT_TTL`, 15 minutes) verified statelessly. Before this decision there was no session continuation: when the JWT expired, every portal forced a fresh sign-in, which made the ops portals unusable during a normal shift. Options:

1. **Longer-lived access tokens** — simple, but a stolen JWT stays valid for its full TTL; revocation only covers `sign-out` via the blacklist, not theft.
2. **Sliding session in Redis** — server-side session state for every request; heavier than needed while Redis is already a soft dependency.
3. **Rotating refresh tokens** — the OAuth 2.0 pattern: a short-lived JWT plus a long-lived opaque refresh token, rotated on every use.

## Decision

Sessions use short-lived JWT access tokens plus **single-use rotating refresh tokens**.

- `POST /auth/sign-in` and `/auth/sign-up` return `refresh_token` alongside `token` in the session resource attributes.
- Refresh tokens are opaque credentials stored **hashed** in `auth_tokens` (`kind = 'refresh'`), the same table and machinery as recovery/invite tokens — `AuthFlowService.issueToken` / `findUsableToken` / `consumeToken` are reused unchanged.
- `POST /auth/refresh` accepts `{ data: { type: "session", attributes: { refresh_token } } }`, verifies the hash is usable (unconsumed + unexpired), consumes it, and returns a new access token **and** a new refresh token — single-use rotation.
- TTL is 7 days (`REFRESH_TOKEN_TTL_MS`); the access-token TTL stays short.
- `POST /auth/sign-out` blacklists the access-token jti **and** consumes a presented `refresh_token`, ending the session on both sides.
- Reuse of a consumed or expired refresh token → `401 UNAUTHENTICATED` — indistinguishable from invalid, matching the credential-error posture elsewhere.
- Sessions end on suspension: `loadSession` refuses users with `suspendedAt`, so a suspended user cannot refresh.

## Consequences

- Frontends store two tokens and silently refresh once per 401 (single-flight) — the standard bearer-token UX with no user-visible interruptions up to 7 days of inactivity.
- Rotation bounds a stolen refresh token to one redemption before detection (the legitimate client then sees an invalid token and re-authenticates).
- `auth_tokens` grows one row per rotation; rows are self-expiring and consumed, so a periodic cleanup of `consumed_at`/expired rows is a cheap follow-up.
- Guest booking (anonymous `guest_contacts`) is unaffected — no refresh path there.

## Alternatives rejected

- **Long-lived JWTs** (option 1): simplest but unbounded exposure on theft and forces sign-out to cover the whole TTL via blacklist growth.
- **Server-side Redis sessions** (option 2): requires Redis for correctness, not just revocation; no payoff at current scale.

## References

- `services/backend/src/iam/sign-in.controller.ts` — `signIn`, `refresh`, `loadSession`, `sessionResponse`, `REFRESH_TOKEN_TTL_MS`
- `services/backend/src/iam/auth-flow.service.ts` — token issuance/lookup/consume shared with recovery/invite
- `services/backend/src/iam/sign-out.controller.ts` — dual revocation
- [ADR-0003](0003-jwt-claims-and-access-decisions.MD) — claim shapes and `exp`-based blacklist TTL
- `services/{venue,player,platform}-portal/src/lib/api.ts` — silent-refresh retry in the shared clients
