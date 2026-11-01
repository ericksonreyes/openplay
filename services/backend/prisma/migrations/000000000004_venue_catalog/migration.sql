-- VENUE_CATALOG: venues, bookable resources, activities, base prices,
-- facility use rules, closures/internal-use blocks, and versioned waiver
-- documents. Every table is tenant-owned and gets the canonical RLS policy.
-- Default privileges (000000000002) already grant CRUD to openplay_app.

-- ---------- venues ----------
CREATE TABLE "venues" (
  "id"         UUID         NOT NULL,             -- UUIDv7
  "tenant_id"  UUID         NOT NULL,
  "name"       TEXT         NOT NULL,
  "timezone"   TEXT         NOT NULL DEFAULT 'UTC',
  "status"     TEXT         NOT NULL DEFAULT 'active', -- draft | active | archived
  "address"    JSONB,                                -- {line1, line2, city, region, postalCode, country, lat, lng}
  "details"    JSONB,                                -- description, amenities, contact, images
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "venues_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "venues_tenant" ON "venues" ("tenant_id");

-- ---------- venue_resources (courts, rooms, fields, spaces) ----------
CREATE TABLE "venue_resources" (
  "id"            UUID         NOT NULL,
  "tenant_id"     UUID         NOT NULL,
  "venue_id"      UUID         NOT NULL,
  "name"          TEXT         NOT NULL,
  "resource_type" TEXT         NOT NULL,            -- court | room | field | space | ...
  "status"        TEXT         NOT NULL DEFAULT 'active',
  "capacity"      INTEGER,
  "settings"      JSONB,                            -- buffer_minutes, increment_minutes, horizon_days, duration_minutes
  "details"       JSONB,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "venue_resources_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "venue_resources_venue" FOREIGN KEY ("venue_id")
    REFERENCES "venues" ("id") ON DELETE CASCADE
);
CREATE INDEX "venue_resources_tenant" ON "venue_resources" ("tenant_id");
CREATE INDEX "venue_resources_venue_idx" ON "venue_resources" ("venue_id");

-- ---------- venue_activities (sport-agnostic activity definitions) ----------
CREATE TABLE "venue_activities" (
  "id"          UUID         NOT NULL,
  "tenant_id"   UUID         NOT NULL,
  "name"        TEXT         NOT NULL,
  "code"        TEXT         NOT NULL,              -- tenant-local slug
  "status"      TEXT         NOT NULL DEFAULT 'active',
  "description" TEXT,
  "details"     JSONB,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "venue_activities_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "venue_activities_code" UNIQUE ("tenant_id", "code")
);
CREATE INDEX "venue_activities_tenant" ON "venue_activities" ("tenant_id");

-- ---------- venue_activity_resources (which resources host which activities) ----------
CREATE TABLE "venue_activity_resources" (
  "tenant_id"   UUID NOT NULL,
  "activity_id" UUID NOT NULL,
  "resource_id" UUID NOT NULL,
  CONSTRAINT "venue_activity_resources_pkey" PRIMARY KEY ("activity_id", "resource_id"),
  CONSTRAINT "venue_activity_resources_activity" FOREIGN KEY ("activity_id")
    REFERENCES "venue_activities" ("id") ON DELETE CASCADE,
  CONSTRAINT "venue_activity_resources_resource" FOREIGN KEY ("resource_id")
    REFERENCES "venue_resources" ("id") ON DELETE CASCADE
);
CREATE INDEX "venue_activity_resources_tenant" ON "venue_activity_resources" ("tenant_id");

-- ---------- venue_prices (base rates) ----------
CREATE TABLE "venue_prices" (
  "id"           UUID         NOT NULL,
  "tenant_id"    UUID         NOT NULL,
  "venue_id"     UUID,
  "resource_id"  UUID,
  "activity_id"  UUID,
  "label"        TEXT         NOT NULL,
  "amount_cents" INTEGER      NOT NULL,
  "currency"     TEXT         NOT NULL DEFAULT 'USD',
  "unit"         TEXT         NOT NULL DEFAULT 'hour', -- hour | booking | day
  "active"       BOOLEAN      NOT NULL DEFAULT true,
  "details"      JSONB,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "venue_prices_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "venue_prices_tenant" ON "venue_prices" ("tenant_id");

-- ---------- venue_facility_rules ----------
CREATE TABLE "venue_facility_rules" (
  "id"                       UUID         NOT NULL,
  "tenant_id"                UUID         NOT NULL,
  "venue_id"                 UUID,
  "resource_id"              UUID,
  "activity_id"              UUID,
  "title"                    TEXT         NOT NULL,
  "body"                     TEXT         NOT NULL,
  "visibility"               TEXT         NOT NULL DEFAULT 'internal', -- public | internal
  "requires_acknowledgment"  BOOLEAN      NOT NULL DEFAULT false,
  "status"                   TEXT         NOT NULL DEFAULT 'draft', -- draft | published | unpublished
  "version"                  INTEGER      NOT NULL DEFAULT 1,
  "created_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"               TIMESTAMP(3) NOT NULL,
  CONSTRAINT "venue_facility_rules_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "venue_facility_rules_tenant" ON "venue_facility_rules" ("tenant_id");

-- ---------- venue_closures (closures + internal-use blocks via "kind") ----------
CREATE TABLE "venue_closures" (
  "id"          UUID         NOT NULL,
  "tenant_id"   UUID         NOT NULL,
  "venue_id"    UUID,
  "resource_id" UUID,
  "kind"        TEXT         NOT NULL DEFAULT 'closure', -- closure | internal_use
  "starts_at"   TIMESTAMPTZ  NOT NULL,
  "ends_at"     TIMESTAMPTZ  NOT NULL,
  "recurrence"  JSONB,                                   -- {rule, exceptions[]}
  "reason"      TEXT,
  "status"      TEXT         NOT NULL DEFAULT 'scheduled', -- scheduled | cancelled
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "venue_closures_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "venue_closures_window" CHECK ("ends_at" > "starts_at")
);
CREATE INDEX "venue_closures_tenant" ON "venue_closures" ("tenant_id");

-- ---------- venue_waiver_documents ----------
CREATE TABLE "venue_waiver_documents" (
  "id"                      UUID         NOT NULL,
  "tenant_id"               UUID         NOT NULL,
  "venue_id"                UUID,
  "resource_id"             UUID,
  "activity_id"             UUID,
  "title"                   TEXT         NOT NULL,
  "status"                  TEXT         NOT NULL DEFAULT 'draft', -- draft | active | retired
  "current_version"         INTEGER      NOT NULL DEFAULT 0,
  "reacknowledge_on_update" BOOLEAN      NOT NULL DEFAULT false,
  "created_at"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"              TIMESTAMP(3) NOT NULL,
  CONSTRAINT "venue_waiver_documents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "venue_waiver_documents_tenant" ON "venue_waiver_documents" ("tenant_id");

-- ---------- venue_waiver_versions (immutable text history) ----------
CREATE TABLE "venue_waiver_versions" (
  "id"          UUID         NOT NULL,
  "tenant_id"   UUID         NOT NULL,
  "document_id" UUID         NOT NULL,
  "version"     INTEGER      NOT NULL,
  "body"        TEXT         NOT NULL,
  "status"      TEXT         NOT NULL DEFAULT 'draft', -- draft | published | retired
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "venue_waiver_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "venue_waiver_versions_document" FOREIGN KEY ("document_id")
    REFERENCES "venue_waiver_documents" ("id") ON DELETE CASCADE,
  CONSTRAINT "venue_waiver_versions_doc_version" UNIQUE ("document_id", "version")
);
CREATE INDEX "venue_waiver_versions_tenant" ON "venue_waiver_versions" ("tenant_id");

-- ---------- RLS: every table is tenant-owned ----------
SELECT openplay_apply_tenant_rls('venues');
SELECT openplay_apply_tenant_rls('venue_resources');
SELECT openplay_apply_tenant_rls('venue_activities');
SELECT openplay_apply_tenant_rls('venue_activity_resources');
SELECT openplay_apply_tenant_rls('venue_prices');
SELECT openplay_apply_tenant_rls('venue_facility_rules');
SELECT openplay_apply_tenant_rls('venue_closures');
SELECT openplay_apply_tenant_rls('venue_waiver_documents');
SELECT openplay_apply_tenant_rls('venue_waiver_versions');
