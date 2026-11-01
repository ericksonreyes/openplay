-- app.is_public read arm: anonymous context may read published-facing rows
-- only (USING gain; WITH CHECK unchanged — no public writes).
-- Public-facing tables are guarded by a `published`/status condition plus
-- the venue→tenant publication chain. tenants gains a profile `details`
-- column for Business Profile Pages.

ALTER TABLE "tenants" ADD COLUMN "details" JSONB NOT NULL DEFAULT '{}';

-- Recreate each table's scope_isolation with a public read arm.
-- Base arm (all policies): platform/system bypass + tenant match.

DROP POLICY IF EXISTS scope_isolation ON "tenants";
CREATE POLICY scope_isolation ON "tenants"
  USING (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR (current_setting('app.is_public', true) = 'true'
        AND "published" AND "status" = 'active')
  )
  WITH CHECK (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

-- helper: venue chain is published+active when its tenant is.
-- (inlined per table — policy bodies must be static SQL)

DROP POLICY IF EXISTS scope_isolation ON "venues";
CREATE POLICY scope_isolation ON "venues"
  USING (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR (current_setting('app.is_public', true) = 'true'
        AND "status" = 'active'
        AND EXISTS (SELECT 1 FROM "tenants" t
                    WHERE t."id" = "venues"."tenant_id"
                      AND t."published" AND t."status" = 'active'))
  )
  WITH CHECK (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

DROP POLICY IF EXISTS scope_isolation ON "venue_resources";
CREATE POLICY scope_isolation ON "venue_resources"
  USING (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR (current_setting('app.is_public', true) = 'true'
        AND "status" = 'active'
        AND EXISTS (SELECT 1 FROM "venues" v JOIN "tenants" t ON t."id" = v."tenant_id"
                    WHERE v."id" = "venue_resources"."venue_id"
                      AND v."status" = 'active' AND t."published" AND t."status" = 'active'))
  )
  WITH CHECK (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

DROP POLICY IF EXISTS scope_isolation ON "venue_activities";
CREATE POLICY scope_isolation ON "venue_activities"
  USING (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR (current_setting('app.is_public', true) = 'true'
        AND "status" = 'active'
        AND EXISTS (SELECT 1 FROM "tenants" t
                    WHERE t."id" = "venue_activities"."tenant_id"
                      AND t."published" AND t."status" = 'active'))
  )
  WITH CHECK (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

DROP POLICY IF EXISTS scope_isolation ON "venue_prices";
CREATE POLICY scope_isolation ON "venue_prices"
  USING (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR (current_setting('app.is_public', true) = 'true'
        AND EXISTS (SELECT 1 FROM "tenants" t
                    WHERE t."id" = "venue_prices"."tenant_id"
                      AND t."published" AND t."status" = 'active'))
  )
  WITH CHECK (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

DROP POLICY IF EXISTS scope_isolation ON "venue_closures";
CREATE POLICY scope_isolation ON "venue_closures"
  USING (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR (current_setting('app.is_public', true) = 'true'
        AND "status" = 'scheduled'
        AND EXISTS (SELECT 1 FROM "tenants" t
                    WHERE t."id" = "venue_closures"."tenant_id"
                      AND t."published" AND t."status" = 'active'))
  )
  WITH CHECK (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

DROP POLICY IF EXISTS scope_isolation ON "venue_facility_rules";
CREATE POLICY scope_isolation ON "venue_facility_rules"
  USING (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR (current_setting('app.is_public', true) = 'true'
        AND "status" = 'published' AND "visibility" = 'public'
        AND EXISTS (SELECT 1 FROM "tenants" t
                    WHERE t."id" = "venue_facility_rules"."tenant_id"
                      AND t."published" AND t."status" = 'active'))
  )
  WITH CHECK (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

-- Busy/free data for the public slot grid: resource→venue→tenant chain.
DROP POLICY IF EXISTS scope_isolation ON "resource_allocations";
CREATE POLICY scope_isolation ON "resource_allocations"
  USING (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR (current_setting('app.is_public', true) = 'true'
        AND EXISTS (SELECT 1 FROM "venue_resources" r
                    JOIN "venues" v ON v."id" = r."venue_id"
                    JOIN "tenants" t ON t."id" = v."tenant_id"
                    WHERE r."id" = "resource_allocations"."resource_id"
                      AND v."status" = 'active' AND t."published" AND t."status" = 'active'))
  )
  WITH CHECK (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

DROP POLICY IF EXISTS scope_isolation ON "event_series";
CREATE POLICY scope_isolation ON "event_series"
  USING (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR (current_setting('app.is_public', true) = 'true'
        AND "status" = 'active'
        AND EXISTS (SELECT 1 FROM "tenants" t
                    WHERE t."id" = "event_series"."tenant_id"
                      AND t."published" AND t."status" = 'active'))
  )
  WITH CHECK (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

DROP POLICY IF EXISTS scope_isolation ON "events";
CREATE POLICY scope_isolation ON "events"
  USING (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR (current_setting('app.is_public', true) = 'true'
        AND "visibility" = 'public'
        AND "status" IN ('published','registration_open','registration_closed','complete','cancelled')
        AND EXISTS (SELECT 1 FROM "venues" v JOIN "tenants" t ON t."id" = v."tenant_id"
                    WHERE v."id" = "events"."venue_id"
                      AND v."status" = 'active' AND t."published" AND t."status" = 'active'))
  )
  WITH CHECK (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );
