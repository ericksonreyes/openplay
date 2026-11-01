-- Platform admin surface: user suspension flag + platform-owned settings.

ALTER TABLE "iam_users" ADD COLUMN "suspended_at" TIMESTAMPTZ;

CREATE TABLE "platform_settings" (
  "key"        TEXT         NOT NULL,
  "value"      JSONB        NOT NULL DEFAULT '{}',
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by" UUID,
  CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key")
);

-- Platform-owned: no tenant arm; only platform/system contexts may touch it.
ALTER TABLE "platform_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_settings" FORCE ROW LEVEL SECURITY;
CREATE POLICY scope_isolation ON "platform_settings"
  USING (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
  )
  WITH CHECK (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
  );

GRANT SELECT, INSERT, UPDATE ON "platform_settings" TO openplay_app;
