-- Runs once on first database creation (postgres initdb hook).
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Non-superuser application role used for RLS-scoped queries (TENANT_DATA).
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'openplay_app') THEN
    CREATE ROLE openplay_app NOLOGIN;
  END IF;
END
$$;
