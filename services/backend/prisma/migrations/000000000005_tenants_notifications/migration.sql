-- tenants + notifications module tables.
-- Sources: implementation_plans/backend/IDENTITY_AND_ACCESS.MD ('tenants'
-- module section) and implementation_plans/backend/NOTIFICATIONS.MD.
-- The `tenants`, `iam_*`, and `audit_events` tables already exist; this
-- migration only adds the new tenant-owned records.

-- ---------- tenant_applications ----------
-- Public business-onboarding submissions. One row per tenant; stores the
-- owner contact captured by POST /tenants for the platform review step.
CREATE TABLE "tenant_applications" (
  "id"          UUID         NOT NULL,
  "tenant_id"   UUID         NOT NULL,
  "owner_name"  TEXT         NOT NULL,
  "owner_email" TEXT         NOT NULL,
  "message"     TEXT,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tenant_applications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tenant_applications_tenant" UNIQUE ("tenant_id"),
  CONSTRAINT "tenant_applications_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE
);

-- ---------- notifications ----------
-- Durable notification records; delivery status is recorded per send.
CREATE TABLE "notifications" (
  "id"                UUID         NOT NULL,           -- UUIDv7
  "tenant_id"         UUID         NOT NULL,
  "recipient_user_id" UUID,                            -- iam_users.id when known
  "recipient_address" TEXT,                            -- email/phone/device token
  "channel"           TEXT         NOT NULL,           -- email | sms | push | in_app
  "kind"              TEXT         NOT NULL,           -- template key, e.g. booking.confirmation
  "payload"           JSONB        NOT NULL DEFAULT '{}',
  "status"            TEXT         NOT NULL DEFAULT 'pending', -- pending | sent | failed | cancelled
  "idempotency_key"   TEXT         NOT NULL,
  "sent_at"           TIMESTAMPTZ,
  "failed_at"         TIMESTAMPTZ,
  "error"             TEXT,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notifications_idempotency" UNIQUE ("idempotency_key"),
  CONSTRAINT "notifications_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE
);
CREATE INDEX "notifications_tenant" ON "notifications" ("tenant_id");
CREATE INDEX "notifications_tenant_created" ON "notifications" ("tenant_id", "created_at");

-- ---------- reminders ----------
-- Scheduled sends claimed by the reminder worker via
-- SELECT ... FOR UPDATE SKIP LOCKED; never a second scheduler in the API.
CREATE TABLE "reminders" (
  "id"                UUID         NOT NULL,           -- UUIDv7
  "tenant_id"         UUID         NOT NULL,
  "stream_type"       TEXT         NOT NULL,           -- e.g. 'booking', 'event'
  "stream_id"         UUID         NOT NULL,           -- the referenced record
  "recipient_user_id" UUID,
  "recipient_address" TEXT,
  "channel"           TEXT         NOT NULL,           -- email | sms | push | in_app
  "kind"              TEXT         NOT NULL,           -- template key, e.g. reminder.upcoming_reservation
  "payload"           JSONB        NOT NULL DEFAULT '{}',
  "due_at"            TIMESTAMPTZ  NOT NULL,
  "status"            TEXT         NOT NULL DEFAULT 'pending', -- pending | claimed | sent | failed | cancelled
  "idempotency_key"   TEXT         NOT NULL,
  "claimed_at"        TIMESTAMPTZ,
  "sent_at"           TIMESTAMPTZ,
  "failed_at"         TIMESTAMPTZ,
  "error"             TEXT,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "reminders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reminders_idempotency" UNIQUE ("idempotency_key"),
  CONSTRAINT "reminders_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE
);
CREATE INDEX "reminders_tenant" ON "reminders" ("tenant_id");
CREATE INDEX "reminders_due" ON "reminders" ("status", "due_at");

-- ---------- row-level security (all tenant-owned) ----------
SELECT openplay_apply_tenant_rls('tenant_applications');
SELECT openplay_apply_tenant_rls('notifications');
SELECT openplay_apply_tenant_rls('reminders');
