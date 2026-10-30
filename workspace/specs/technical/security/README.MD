# Security & Access Control

This note shows how a service validates JWT claims and enforces roles and permissions after Identity & Access issues the token.

## Goals

- Keep authentication stateless.
- Trust only signed JWT claims.
- Use roles for coarse-grained access gates.
- Use permissions for finer-grained endpoint or action checks.
- Reject any client-supplied role headers or body fields as a source of truth.

## Middleware / Policy Flow

```text
Incoming request
        │
        ▼
Bearer token extracted
        │
        ▼
JWT signature verified against the IAM public key
        │   (`JWT_PUBLIC_KEY` env var, or an optional JWKS endpoint on IAM)
        │
        ├── validate iss, aud, exp, and tenant scope
        ├── read roles and permissions from the signed claims
        ▼
Service middleware / guard
        │
        ▼
Route or action policy
        ├── require role(s)
        ├── require permission(s)
        └── deny with 401 or 403 when validation fails
```

## Example Authorization Rule

A payout execution endpoint may require both:

- Role: `Tenant Administrator`
- Permission: `payout.execute`

That means the service should:

- verify the JWT signature first
- confirm the token issuer and audience are valid
- trust the `roles` and `permissions` claims only after signature verification
- reject the request with `403 Forbidden` if the role or permission is missing

## Example Policy Pseudocode

```text
if not verifySignature(jwt, jwks):
    return 401 Unauthorized

claims = decode(jwt)

if claims.iss != "openplay-identity-access":
    return 401 Unauthorized

if claims.aud != "openplay-api":
    return 401 Unauthorized

if claims.exp is expired:
    return 401 Unauthorized

if claims.tenant_id != request.tenant_id:
    return 403 Forbidden

if "Tenant Administrator" not in claims.roles:
    return 403 Forbidden

if "payout.execute" not in claims.permissions:
    return 403 Forbidden

allow request
```

## Tenant Isolation in Depth

The JWT `tenant_id` claim and application-level scoping (tenant filters in queries and policy checks) are the first-class isolation contract. PostgreSQL additionally enforces the boundary **inside the database** via row-level security — see [Row-Level Security](./ROW_LEVEL_SECURITY.MD) and [ADR-0005](../decisions/0005-postgresql-row-level-security.MD):

- Every tenant-owned table has `ENABLE` + `FORCE ROW LEVEL SECURITY` and a policy pinned to `current_setting('app.tenant_id')` — a forgotten application scope fails closed to an empty set instead of leaking rows. Tables without their own `tenant_id` gate via `EXISTS` on the parent.
- The backend sets the tenant context from the verified JWT claim after authentication, using `SET LOCAL` inside the request's transaction; it never trusts request input.
- The runtime connects as `openplay_app`, a non-superuser role — PostgreSQL superusers bypass RLS unconditionally, so isolation only works on a bound role.
- Worker and console paths bypass via an explicit `app.is_system` setting — a greppable decision, not ambient privilege.
- Every protected action is recorded in an append-only audit log; see [Audit Logging](./AUDIT_LOGGING.MD).
- RLS answers only "is this row in the caller's scope?" Roles, permissions, and venue assignment remain application concerns; RLS is the net, not the mechanism.

## Notes

- Services should not infer access from request headers alone.
- Services should not trust unverified client input for identity or authorization.
- More sensitive actions can require both a role and a permission at the same time.