-- TENANT_DATA foundation: tenants entity, append-only audit_events stream,
-- openplay_app runtime role, and the canonical RLS policy helper.
-- Runs as the migration (superuser) connection; the app runtime connects
-- as openplay_app afterwards.

-- ---------- tenants (business lifecycle lives in the tenants module) ----------
CREATE TABLE "tenants" (
  "id"         UUID         NOT NULL,
  "code"       TEXT         NOT NULL,
  "name"       TEXT         NOT NULL,
  "status"     TEXT         NOT NULL DEFAULT 'setup', -- setup | awaiting_review | active | suspended
  "published"  BOOLEAN      NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tenants_code" ON "tenants" ("code");

-- ---------- audit_events (append-only event stream; spec: AUDIT_LOGGING.MD) ----------
CREATE TABLE "audit_events" (
  "id"           UUID        NOT NULL,           -- UUIDv7
  "tenant_id"    UUID,                            -- NULL = platform-level event
  "stream_type"  TEXT        NOT NULL,
  "stream_id"    UUID        NOT NULL,
  "sequence"     BIGINT      NOT NULL,
  "event_type"   TEXT        NOT NULL,
  "actor_id"     UUID,
  "actor_kind"   TEXT        NOT NULL,
  "on_behalf_of" UUID,
  "payload"      JSONB       NOT NULL,
  "metadata"     JSONB       NOT NULL,
  "occurred_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "audit_events_stream_order" UNIQUE ("stream_type", "stream_id", "sequence")
);
CREATE INDEX "audit_events_tenant" ON "audit_events" ("tenant_id");

-- ---------- openplay_app runtime role ----------
-- Password matches OPENPLAY_APP_PASSWORD in .env (local development only).
ALTER ROLE openplay_app LOGIN PASSWORD 'local-development-only';
GRANT USAGE ON SCHEMA public TO openplay_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO openplay_app;
-- The audit stream is append-only for the app role: no UPDATE/DELETE/TRUNCATE.
REVOKE UPDATE, DELETE, TRUNCATE ON "audit_events" FROM openplay_app;
-- Future tables default to full CRUD; tighten per-table (like audit_events)
-- in the migration that creates them.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO openplay_app;

-- ---------- canonical tenant-isolation policy helper ----------
-- Emits the standard policy: platform/system bypass + tenant match.
-- Child tables without tenant_id should instead gate via EXISTS on a parent;
-- write those policies explicitly.
CREATE OR REPLACE FUNCTION openplay_apply_tenant_rls(tbl regclass, tenant_col name DEFAULT 'tenant_id')
RETURNS void AS $$
BEGIN
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', tbl);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', tbl);
  EXECUTE format('DROP POLICY IF EXISTS scope_isolation ON %s', tbl);
  EXECUTE format(
    'CREATE POLICY scope_isolation ON %s
       USING (
         current_setting(''app.is_platform'', true) = ''true''
         OR current_setting(''app.is_system'', true) = ''true''
         OR %I = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid
       )
       WITH CHECK (
         current_setting(''app.is_platform'', true) = ''true''
         OR current_setting(''app.is_system'', true) = ''true''
         OR %I = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid
       )',
    tbl, tenant_col, tenant_col);
END;
$$ LANGUAGE plpgsql;

-- tenants: the tenant column IS the primary key.
SELECT openplay_apply_tenant_rls('tenants', 'id');

-- iam_users: tenant match + actors may read their own user row.
ALTER TABLE "iam_users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "iam_users" FORCE ROW LEVEL SECURITY;
CREATE POLICY scope_isolation ON "iam_users"
  USING (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR "id" = NULLIF(current_setting('app.actor_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

-- iam_user_roles gates through its parent user row.
ALTER TABLE "iam_user_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "iam_user_roles" FORCE ROW LEVEL SECURITY;
CREATE POLICY scope_isolation ON "iam_user_roles"
  USING (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR EXISTS (
      SELECT 1 FROM "iam_users" u
      WHERE u."id" = "iam_user_roles"."user_id"
        AND (
          u."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
          OR u."id" = NULLIF(current_setting('app.actor_id', true), '')::uuid
        )
    )
  )
  WITH CHECK (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR EXISTS (
      SELECT 1 FROM "iam_users" u
      WHERE u."id" = "iam_user_roles"."user_id"
        AND u."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    )
  );

-- audit_events: tenant match on read; same for write (WITH CHECK) so a
-- request can only append inside its own scope or under platform/system.
SELECT openplay_apply_tenant_rls('audit_events');
