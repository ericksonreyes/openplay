# Identity & Access (IAM)

This document describes the responsibilities of Identity & Access and how user identity is scoped across OpenPlay. IAM runs as a dedicated module inside the NestJS backend — see [ADR-0007](../decisions/0007-iam-as-backend-module.MD); the ownership boundaries below are identical whether it is a module or a separate service.

## Goals

- Centralize ownership of identity data in one component.
- Keep username uniqueness scoped to the boundary the user belongs to, not global.
- Give every other part of the system a consistent way to identify and authorize users without owning identity data.

## Responsibilities

Identity & Access (IAM) is a dedicated backend module that owns all of the following for the entire platform:

- **Users** — user accounts, credentials, and authentication for every tenant and for platform-level users.
- **Roles** — role definitions and role assignments.
- **Token issuance** — signing JWTs with its private key; see [JWT Signing Keys](./JWT_SIGNING_KEYS.MD).

IAM does **not** own the Tenant entity. The tenant record — business details, subscription, plan, lifecycle — belongs
to platform management. IAM learns a `tenant_id` as an authorization scope via provisioning (a tenant-created event
or call from platform management) and manages users and roles within that scope.

Nothing else stores user accounts or credentials. Every other component trusts the claims issued by IAM.

## Tenant-Scoped Usernames

A username is only unique **within the scope it belongs to** — it is not globally unique across the platform.

```text
Tenant A          Tenant B          Platform
   │                 │                 │
erickson          erickson          erickson
   │                 │                 │
   └── three distinct identities, each unique in its own scope ──┘
```

This means:

- `erickson` in Tenant A and `erickson` in Tenant B are **different users**.
- Platform-level users live in their own scope, so `erickson` at the platform level is again a distinct identity.
- Authentication always resolves the pair `(scope, username)`, never the username alone.

## Identity Rules

- The uniqueness constraint is `(tenant_id, username)` for tenant users and `(scope, username)` generally. The same rule applies to email: `(scope, email)` is unique where an email exists — email is **not** globally unique.
- Every user also has a **globally unique internal user ID** (UUIDv7); services should reference users by this ID, not by username.
- Tokens issued by IAM carry both the user ID and the tenant scope claim, so downstream services can disambiguate identical usernames.
- No service may infer identity from username alone — a username without a scope is ambiguous.

## Scopes and Sign-In Identifiers

There are two scope kinds:

- **`platform` scope** — Players and Platform Administrators. A player books across many businesses and is not bound to one tenant; their token carries a platform scope instead of a business `tenant_id`.
- **`tenant` scope** — Business Owners, venue managers, and staff. Their token carries the business `tenant_id`.

Sign-in identifiers differ by scope:

- **Platform users** sign in with **email** — for players the email *is* the identifier; there is no separate username.
- **Tenant users** sign in with **tenant code (or business subdomain) + username** — the code resolves the scope first, then username and password resolve inside it.
- The same person may hold identities in several scopes (a player who is also staff at a venue). These are distinct user IDs — separate accounts, not linked identities.
- Email is optional for tenant staff; when present it is unique only within that tenant.

## Password Recovery

Recovery is scope-aware — never global:

- **Platform scope (players, admins):** email-first recovery. The email uniquely identifies the account within the platform scope, so the flow is a normal self-serve reset.
- **Tenant scope (business users):** the request names the tenant first (code or subdomain), then resolves `(tenant_id, email-or-username)`. Requiring the scope up front also prevents recovery flows from disclosing which businesses an email belongs to.
- **Owner-initiated reset:** a Business Owner or venue manager can trigger a password reset for their staff — the operational path for staff who have no email on file.
- Reset tokens are single-use, short-lived, and bound to `(scope, user_id)`.
- Recovery responses never confirm whether an email or username exists in a scope — same non-revealing rule as sign-in.

## Accountability

Audit fields across the platform use the IAM user ID:

- `created_by`, `updated_by`, and similar accountability columns store the user's UUIDv7 from the token's `sub` claim — never the username.
- Tenant and other entity identifiers follow the platform-wide rules in [Identifiers](../IDENTIFIERS.MD).

## Notes

- Tenant business data (venues, bookings, settings) stays in the tenant's bounded contexts; IAM owns only the identity and access side.
- Role names may also repeat across tenants — roles are defined and assigned per scope, the same way usernames are.
- Authentication lookups (sign-in, token issuance, recovery) run under a service context — no user context exists before sign-in. User records still carry `tenant_id` where applicable and follow the same row-level security model.