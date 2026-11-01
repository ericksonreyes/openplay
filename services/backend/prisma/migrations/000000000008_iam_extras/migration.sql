-- iam extras (backend/IDENTITY_AND_ACCESS.MD 'iam' section): single-use
-- credential tokens and staff venue assignments.

-- ---------- auth_tokens ----------
-- Single-use credential material for recovery (30 min) and staff invites
-- (72 h). Only the SHA-256 hash is persisted; the raw token travels in the
-- notification payload. Bound to (scope, user_id) via the FK: scope is a
-- property of the parent iam_users row.
--
-- RLS decision: credential rows are never readable by tenant actors — every
-- lookup/issue/consume path (sign-up is exempt; recovery, reset, invite,
-- accept) runs under SystemContextService (`app.is_system`). The policy is
-- therefore platform/system-only and deliberately omits the tenant EXISTS
-- clause used by iam_user_roles; the FK still enforces that a token always
-- references an existing user.
CREATE TABLE "auth_tokens" (
  "id"          UUID         NOT NULL,
  "user_id"     UUID         NOT NULL,
  "kind"        TEXT         NOT NULL,           -- 'recovery' | 'invite'
  "token_hash"  TEXT         NOT NULL,
  "expires_at"  TIMESTAMPTZ  NOT NULL,
  "consumed_at" TIMESTAMPTZ,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "auth_tokens_token_hash" UNIQUE ("token_hash"),
  CONSTRAINT "auth_tokens_user_fk"
    FOREIGN KEY ("user_id") REFERENCES "iam_users" ("id") ON DELETE CASCADE
);
CREATE INDEX "auth_tokens_user" ON "auth_tokens" ("user_id");
CREATE INDEX "auth_tokens_lookup" ON "auth_tokens" ("kind", "token_hash");

ALTER TABLE "auth_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auth_tokens" FORCE ROW LEVEL SECURITY;
CREATE POLICY scope_isolation ON "auth_tokens"
  USING (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
  )
  WITH CHECK (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
  );

-- ---------- staff_venue_assignments ----------
-- Which venues a tenant-scope staff user may operate. Populates the
-- `venue_ids` JWT claim (TokenService.issue). No tenant_id column —
-- tenancy is inherited from the parent user row, gated by EXISTS on
-- iam_users (same shape as iam_user_roles).
CREATE TABLE "staff_venue_assignments" (
  "user_id"  UUID NOT NULL,
  "venue_id" UUID NOT NULL,
  CONSTRAINT "staff_venue_assignments_pkey" PRIMARY KEY ("user_id", "venue_id"),
  CONSTRAINT "staff_venue_assignments_user_fk"
    FOREIGN KEY ("user_id") REFERENCES "iam_users" ("id") ON DELETE CASCADE,
  CONSTRAINT "staff_venue_assignments_venue_fk"
    FOREIGN KEY ("venue_id") REFERENCES "venues" ("id") ON DELETE CASCADE
);
CREATE INDEX "staff_venue_assignments_venue" ON "staff_venue_assignments" ("venue_id");

ALTER TABLE "staff_venue_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff_venue_assignments" FORCE ROW LEVEL SECURITY;
CREATE POLICY scope_isolation ON "staff_venue_assignments"
  USING (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR EXISTS (
      SELECT 1 FROM "iam_users" u
      WHERE u."id" = "staff_venue_assignments"."user_id"
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
      WHERE u."id" = "staff_venue_assignments"."user_id"
        AND u."tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    )
  );

-- ---------- notifications.tenant_id ----------
-- Auth mail for platform-scope users (recovery) has no tenant. The column
-- becomes nullable; NULL rows are still invisible to tenant actors because
-- `tenant_id = app.tenant_id` never matches NULL — platform/system only.
-- NOTE for the schema owner: relax `Notification.tenantId` to `String?`
-- when merging prisma/models/iam_extras.prisma.fragment.
ALTER TABLE "notifications" ALTER COLUMN "tenant_id" DROP NOT NULL;
