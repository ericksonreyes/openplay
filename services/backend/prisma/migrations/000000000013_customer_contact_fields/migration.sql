ALTER TABLE "iam_users" ADD COLUMN "phone" TEXT;
ALTER TABLE "guest_contacts" ADD COLUMN "notes" TEXT;

-- Tenant-owned staff notes about player accounts.
CREATE TABLE "customer_notes" (
  "id"         uuid PRIMARY KEY,
  "tenant_id"  uuid NOT NULL,
  "player_id"  uuid NOT NULL,
  "note"       TEXT NOT NULL DEFAULT '',
  "updated_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "customer_notes_player" UNIQUE ("tenant_id", "player_id")
);
CREATE INDEX "customer_notes_tenant" ON "customer_notes" ("tenant_id");
