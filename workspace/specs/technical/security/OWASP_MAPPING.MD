# OWASP Top 10 (2021) Mapping

Where each category lands in this codebase — the mechanism that addresses it,
the test evidence, and honest gaps. This is a local-development POC, so some
categories are deliberately out of scope; the point of this table is that the
scope was *chosen*, not missed.

Enforcement is layered: NestJS guards and pipes are the first layer, PostgreSQL
row-level security is the database backstop, the audit log records what
happened, and CI checks (tooling still open) screen code and images before they
run.

| Category | Posture | Mechanism | Test evidence |
| --- | --- | --- | --- |
| A01 Broken Access Control | Enforced | Default-deny API: every non-public endpoint requires a verified JWT plus role/permission checks; tenant scope enforced in queries and again by RLS (`USING`/`WITH CHECK`); guests reach a booking only after verification; public endpoints return allowlisted fields only. | Cross-tenant RLS tests (read/write denied, unset context returns zero rows); guard tests for 401/403; public-endpoint field allowlist tests. |
| A02 Cryptographic Failures | Enforced, deployment gap noted | IAM is the sole JWT issuer (RS256): services hold `JWT_PUBLIC_KEY` only; no service stores credentials — IAM owns them; secrets never written to logs or audit rows; local sample DB password is marked local-only. HTTPS is required for client-facing traffic but TLS termination is a deployment decision. | JWT signature/issuer/audience/expiry tests; config review confirms no private keys or real secrets outside IAM. |
| A03 Injection | Enforced | All database access is through the backend ORM with bound parameters — frontends never connect; request payloads pass DTO validation before use; `WITH CHECK` blocks writes carrying a foreign `tenant_id`. | Validation-pipe tests for malformed and oversized input; review gate for any raw SQL. |
| A04 Insecure Design | Enforced by spec | Threat boundaries are specified: public/protected/private access model, defense in depth (guards + RLS), server-side payment verification, idempotent holds, and purpose-limited platform access — the design is reviewed before code. | Spec review against the security documents; abuse cases covered in acceptance criteria. |
| A05 Security Misconfiguration | Enforced for local stack | Every service ships `.env.example` with no real secrets; CORS is an explicit allowlist; PostgreSQL is not published to the host; Mailpit binds to localhost only; backend data stores sit on a private Docker network with no public route. | Compose review: no database host port, Mailpit bound to `127.0.0.1`; env-file scan confirms examples carry placeholders only. |
| A06 Vulnerable and Outdated Components | Mechanism chosen, CI tooling open | Images and packages are pinned (`package-lock`, pinned tags in ADR-0003, minimum 7-day-old releases preferred). `npm audit`, Dependabot/Renovate, and image scanning (Trivy/Grype) are candidates; no CI workflow is selected yet. | Lockfile presence checks today; automated scan results once CI tooling is decided. |
| A07 Identification and Authentication Failures | Enforced | RS256 tokens with `iss`/`aud`/`exp`/`iat`/`jti`; Redis blacklist for revocation with a documented `exp`-only fallback; rate limits and non-revealing errors on sign-in and recovery; guest booking requires the verification flow. | Auth tests: bad signature, expired token, wrong audience, revoked `jti`; rate-limit tests on public auth endpoints. |
| A08 Software and Data Integrity Failures | Enforced | Payment-provider callbacks are verified server-side and processed idempotently; lockfiles and pinned images control what code ships; migrations run through the backend-owned pipeline; audit rows are append-only. | Webhook verification and duplicate-notification tests; audit immutability test (no UPDATE/DELETE/TRUNCATE grant). |
| A09 Security Logging and Monitoring Failures | Enforced | `audit_events` is append-only and written in the same transaction as the action; sign-ins, denials, guest verification, payment verification, and platform cross-business access (with `purpose`) are logged; no secrets in log fields. | Same-transaction audit write test; grant test proves the app role cannot modify audit rows; `purpose` required on platform access entries. |
| A10 Server-Side Request Forgery | Enforced by design | The backend fetches no client-supplied URLs; outbound calls go only to configured providers (payments, SMTP). If a future feature must fetch a user-supplied URL (for example a membership verification link or remote image), it needs a destination allowlist and private-IP blocking first. | Code review confirms no user-controlled fetch targets; allowlist test required before any future fetch feature ships. |

## Security test inventory

| Suite | What it proves |
| --- | --- |
| RLS isolation tests | Cross-tenant reads and writes return nothing at the database level; unset context is a deny; `WITH CHECK` blocks foreign `tenant_id` writes; a player sees only their own rows; `app.is_system` workers can reach any tenant. |
| Auth/JWT tests | Signature, issuer, audience, and expiry are enforced; revoked tokens on the Redis blacklist are rejected; the documented `exp`-only fallback behaves correctly when Redis is down. |
| Guard and permission tests | Every protected endpoint enforces role and permission claims; client-supplied tenant, role, or permission fields are never trusted; 401 versus 403 behavior is correct. |
| Public endpoint tests | Only allowlisted fields are returned; rate limits apply; private booking details, guest contacts, and payment records are absent. |
| Guest verification tests | A guest reaches booking details only after completing the verification flow; an unverified request is denied. |
| Payment webhook tests | Provider callbacks are verified, processed once under idempotency, and a paid-after-expiry charge routes to refund/reconciliation rather than silently claiming a slot. |
| Audit log tests | The audit row commits with its action; the app role cannot update or delete audit rows; platform access entries carry a `purpose`; no secret values appear in logged fields. |
| Input validation tests | Malformed, oversized, or wrong-typed payloads are rejected before reaching business logic or SQL. |
| Configuration checks | No database port published to the host; `.env.example` files contain placeholders only; Mailpit SMTP is internal-only and its UI is localhost-bound. |
| Dependency and image scanning | Known-vulnerable packages and images are blocked — tool selection (`npm audit`, Dependabot/Renovate, Trivy/Grype) remains an open CI decision. |

## Related specifications

- [OpenPlay API and Service Security](./INTERNAL_SERVICE_SECURITY.MD)
- [Row-Level Security](./ROW_LEVEL_SECURITY.MD)
- [Audit Logging](./AUDIT_LOGGING.MD)
- [Identity & Access](./IDENTITY_AND_ACCESS.MD)
- [JWT Signing Keys](./JWT_SIGNING_KEYS.MD)
- [JWT Invalidation](./JWT_INVALIDATION.MD)
