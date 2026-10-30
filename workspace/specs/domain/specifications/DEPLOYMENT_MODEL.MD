# Deployment model

- OpenPlay should support a single-company installation, where the Business Owner administers that company's venues, and a multi-tenant service, where each Business Owner is limited to their own business and venues.
- The Platform Administrator is a platform-level persona for multi-tenant deployments only; it is separate from each Business Owner.
- The product-level account boundaries are defined here. The technical tenant-isolation design uses PostgreSQL row-level security with an append-only audit log; see [ADR-0005](../../technical/decisions/0005-postgresql-row-level-security.MD) and [Row-Level Security](../../technical/security/ROW_LEVEL_SECURITY.MD).
