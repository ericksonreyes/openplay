# Platform portal implementation plan

The Platform Administrator app in `services/platform-portal/` (React + Tailwind, local port 3003). It exists only in multi-tenant deployments — a single-company installation has no Platform Administrator persona and no need for this app. Administrators operate the platform; they do not run any business's venues.

## Sources

- [ADR-0001](../../decisions/0001-web-application-framework.MD) — React Platform Administrator portal, separate app
- [ADR-0002](../../decisions/0002-tailwind-css-for-styling.MD) — Tailwind CSS
- [ADR-0003](../../decisions/0003-docker-local-development.MD) — service-owned Compose file, Dockerfile, `.env.example`, installer
- [ADR-0004](../../decisions/0004-nestjs-backend-api.MD) — protected endpoints; the backend owns all rules
- [ADR-0005](../../decisions/0005-postgresql-row-level-security.MD) — `app.is_platform` cross-tenant scope, purpose-limited audit
- [Business onboarding and verification](../../../domain/specifications/BUSINESS_ONBOARDING_AND_VERIFICATION.MD) — account states, approval gate
- [Deployment model](../../../domain/specifications/DEPLOYMENT_MODEL.MD) — single-company vs multi-tenant
- [User personas](../../../domain/specifications/USER_PERSONAS.MD) — Platform Administrator boundaries
- [Disputes](../../../domain/specifications/DISPUTES.MD) — escalation to the platform
- [Identity & access](../../security/IDENTITY_AND_ACCESS.MD) — platform scope
- [Row-level security](../../security/ROW_LEVEL_SECURITY.MD), [audit logging](../../security/AUDIT_LOGGING.MD) — `is_platform` scope and `metadata.purpose`
- [User experience](../../user_experience/README.MD)

## Areas

### Identity

- Platform-scope sign-in (email) with the same JWT contract as other portals.
- This portal's users live in the platform scope only — a Platform Administrator is not a tenant user.

### Business lifecycle

- Business account list and detail: state (being set up, awaiting review, active, suspended), owner, venues summary.
- Review and approve businesses awaiting review; suspend and restore with a recorded reason. Approval is the gate that lets a business publish its profile and accept public bookings.
- No routine access to venue transactions — the portal is for account administration, not venue operations.

### Purpose-limited support access

- Cross-business data access requires an authorized support task: the UI captures the purpose before opening a tenant's data, and the backend records `metadata.purpose` on the audit event.
- Read-oriented support views; platform admins do not change business prices, policies, schedules, refunds, or transfer verification.

### Dispute escalation

- Escalated disputes queue: unresolved player disputes raised to the platform in multi-tenant deployments. Involvement is logged like other cross-business access.

### Platform administration

- Platform-wide settings and the defaults venues may override — the top of the platform/business/venue precedence chain.
- The role and permission catalog as reference data (canonical seed content).
- Platform-wide audit view across businesses, honoring the purpose-limited rules.

## Platform pieces

- React app scaffold with Tailwind and shared design tokens; same router/build-tool decision as the other portals.
- Typed API client for the platform-admin endpoint contract.
- Clear visual framing whenever a view is cross-business: the admin always knows when they are inside a support task, on which business, and why.
- npm scripts: `dev` on `0.0.0.0:3003`, `test` (Vitest + Testing Library, jsdom), `build`, `lint`.
- Health/readiness response for installer status checks.

## Dependencies

- [Local development](../tooling/LOCAL_DEVELOPMENT.MD) — Compose, Dockerfile, `.env.example`, installer.
- [Identity & access](../backend/IDENTITY_AND_ACCESS.MD) — platform sign-in and the business lifecycle it administers.
- [Tenant data](../backend/TENANT_DATA.MD) — the `is_platform` scope and purpose-required audit reads this portal triggers.
- [Commerce](../backend/COMMERCE.MD) — the dispute escalation surface.

## Acceptance checks

- The `platform-admin` stage in [testing](../../../testing/README.MD) passes: onboard → approve → suspend → restore on the real UI.
- A business cannot publish or take public bookings until approved (multi-tenant).
- Every cross-business access is purpose-limited and produces an audit event carrying `metadata.purpose`.
- Platform admins cannot reach venue transactions outside an authorized support task.
- `npm test` runs a Vitest suite that exits non-zero on failure.

## Open decisions

- Portal router/build tool — shared decision with the other portals, tracked in [ADR-0003](../../decisions/0003-docker-local-development.MD).
- Business verification evidence, approval criteria, and onboarding steps — [open product decisions](../../../domain/specifications/OPEN_PRODUCT_DECISIONS.MD).
- Escalation timing and which dispute categories reach the platform — [Disputes](../../../domain/specifications/DISPUTES.MD).
- Whether a player-facing "my activity" audit view later adds a surface here or in the player portal — [Audit logging](../../security/AUDIT_LOGGING.MD).
