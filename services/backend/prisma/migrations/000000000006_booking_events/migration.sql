-- BOOKING + EVENTS: reservations (hold -> confirm lifecycle), guest contacts,
-- recurring templates, the shared resource_allocations conflict space,
-- consent records, events/series/registrations/results, and check-ins.
-- Default privileges (000000000002) already grant CRUD to openplay_app.
--
-- Concurrency: resource_allocations carries an exclusion constraint on
-- (resource_id, tstzrange) via btree_gist, so PostgreSQL itself rejects any
-- overlapping claim — reservations and events share this one conflict space.
-- Hold expiry is lazy: claim paths delete expired allocation rows (and mark
-- expired-hold reservations) inside the same transaction before inserting.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------- guest_contacts (verified-contact identity for guest bookings) ----------
CREATE TABLE "guest_contacts" (
  "id"                     UUID         NOT NULL,
  "tenant_id"              UUID         NOT NULL,
  "name"                   TEXT         NOT NULL,
  "email"                  TEXT,
  "phone"                  TEXT,
  "access_token_hash"      TEXT         NOT NULL,
  "verification_code_hash" TEXT,
  "verified_at"            TIMESTAMPTZ,
  "token_expires_at"       TIMESTAMPTZ  NOT NULL,
  "created_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"             TIMESTAMP(3) NOT NULL,
  CONSTRAINT "guest_contacts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "guest_contacts_tenant" ON "guest_contacts" ("tenant_id");

-- ---------- reservations ----------
CREATE TABLE "reservations" (
  "id"               BIGSERIAL    NOT NULL,
  "uuid"             UUID         NOT NULL,
  "reference_no"     TEXT,
  "tenant_id"        UUID         NOT NULL,
  "venue_id"         UUID         NOT NULL,
  "resource_id"      UUID         NOT NULL,
  "activity_id"      UUID,
  "player_id"        UUID,
  "guest_contact_id" UUID,
  "series_id"        UUID,
  "status"           TEXT         NOT NULL DEFAULT 'hold',
  "starts_at"        TIMESTAMPTZ  NOT NULL,
  "ends_at"          TIMESTAMPTZ  NOT NULL,
  "buffer_minutes"   INTEGER      NOT NULL DEFAULT 0,
  "party_size"       INTEGER      NOT NULL DEFAULT 1,
  "hold_expires_at"  TIMESTAMPTZ,
  "no_show_marked_at" TIMESTAMPTZ,
  "cancellation"     JSONB,                    -- resolved policy + outcome
  "payment_state"    TEXT         NOT NULL DEFAULT 'none',
  "notes"            TEXT,
  "idempotency_key"  TEXT,
  "created_by"       UUID,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "reservations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reservations_uuid" UNIQUE ("uuid"),
  CONSTRAINT "reservations_reference_no" UNIQUE ("tenant_id", "reference_no"),
  CONSTRAINT "reservations_idempotency" UNIQUE ("idempotency_key"),
  CONSTRAINT "reservations_window" CHECK ("ends_at" > "starts_at"),
  CONSTRAINT "reservations_subject" CHECK (
    "player_id" IS NOT NULL OR "guest_contact_id" IS NOT NULL
  )
);
CREATE INDEX "reservations_tenant" ON "reservations" ("tenant_id");
CREATE INDEX "reservations_player" ON "reservations" ("player_id");
CREATE INDEX "reservations_guest_contact" ON "reservations" ("guest_contact_id");
CREATE INDEX "reservations_resource_starts" ON "reservations" ("resource_id", "starts_at");
CREATE INDEX "reservations_hold_expiry" ON "reservations" ("status", "hold_expires_at");

-- ---------- reservation_participants ----------
CREATE TABLE "reservation_participants" (
  "id"               UUID         NOT NULL,
  "tenant_id"        UUID         NOT NULL,
  "reservation_id"   BIGINT       NOT NULL,
  "kind"             TEXT         NOT NULL DEFAULT 'participant',
  "user_id"          UUID,
  "name"             TEXT,
  "is_minor"         BOOLEAN      NOT NULL DEFAULT false,
  "guardian_user_id" UUID,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reservation_participants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reservation_participants_reservation" FOREIGN KEY ("reservation_id")
    REFERENCES "reservations" ("id") ON DELETE CASCADE
);
CREATE INDEX "reservation_participants_tenant" ON "reservation_participants" ("tenant_id");
CREATE INDEX "reservation_participants_reservation" ON "reservation_participants" ("reservation_id");

-- ---------- recurring_reservation_templates ----------
CREATE TABLE "recurring_reservation_templates" (
  "id"          UUID         NOT NULL,
  "tenant_id"   UUID         NOT NULL,
  "venue_id"    UUID         NOT NULL,
  "resource_id" UUID         NOT NULL,
  "player_id"   UUID,
  "rule"        JSONB        NOT NULL, -- {freq, interval, byWeekday[], until|count, startTime, durationMinutes}
  "status"      TEXT         NOT NULL DEFAULT 'active', -- active | ended | cancelled
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recurring_reservation_templates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "recurring_reservation_templates_tenant" ON "recurring_reservation_templates" ("tenant_id");
CREATE INDEX "recurring_reservation_templates_player" ON "recurring_reservation_templates" ("player_id");

-- ---------- resource_allocations (shared conflict space) ----------
CREATE TABLE "resource_allocations" (
  "id"          UUID         NOT NULL,
  "tenant_id"   UUID         NOT NULL,
  "resource_id" UUID         NOT NULL,
  "owner_type"  TEXT         NOT NULL, -- reservation | event
  "owner_id"    UUID         NOT NULL, -- reservations.uuid or events.id
  "starts_at"   TIMESTAMPTZ  NOT NULL, -- buffered window
  "ends_at"     TIMESTAMPTZ  NOT NULL,
  "expires_at"  TIMESTAMPTZ,           -- set for holds; lazily swept
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "resource_allocations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "resource_allocations_window" CHECK ("ends_at" > "starts_at"),
  CONSTRAINT "resource_allocations_no_overlap" EXCLUDE USING gist (
    "resource_id" WITH =,
    tstzrange("starts_at", "ends_at", '[)') WITH &&
  )
);
CREATE INDEX "resource_allocations_tenant" ON "resource_allocations" ("tenant_id");
CREATE INDEX "resource_allocations_resource_starts" ON "resource_allocations" ("resource_id", "starts_at");
CREATE INDEX "resource_allocations_owner" ON "resource_allocations" ("owner_type", "owner_id");
CREATE INDEX "resource_allocations_expiry" ON "resource_allocations" ("expires_at") WHERE "expires_at" IS NOT NULL;

-- ---------- consent_records (append-only) ----------
CREATE TABLE "consent_records" (
  "id"                    UUID         NOT NULL,
  "tenant_id"             UUID         NOT NULL,
  "kind"                  TEXT         NOT NULL, -- facility_rule | waiver
  "facility_rule_id"      UUID,
  "facility_rule_version" INTEGER,
  "waiver_document_id"    UUID,
  "waiver_version_id"     UUID,
  "user_id"               UUID,
  "guest_contact_id"      UUID,
  "participant_name"      TEXT,
  "guardian_user_id"      UUID,
  "covered_action"        TEXT         NOT NULL, -- reservation | event_registration | check_in
  "covered_id"            UUID,
  "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "consent_records_tenant" ON "consent_records" ("tenant_id");
CREATE INDEX "consent_records_user" ON "consent_records" ("user_id");
CREATE INDEX "consent_records_guest_contact" ON "consent_records" ("guest_contact_id");
CREATE INDEX "consent_records_waiver_doc" ON "consent_records" ("waiver_document_id");
CREATE INDEX "consent_records_facility_rule" ON "consent_records" ("facility_rule_id");
-- Consent is immutable once written.
REVOKE UPDATE, DELETE, TRUNCATE ON "consent_records" FROM openplay_app;

-- ---------- event_series ----------
CREATE TABLE "event_series" (
  "id"         UUID         NOT NULL,
  "tenant_id"  UUID         NOT NULL,
  "name"       TEXT         NOT NULL,
  "rule"       JSONB        NOT NULL, -- {freq, interval, byWeekday[], until|count, exceptions[]}
  "status"     TEXT         NOT NULL DEFAULT 'active', -- active | ended | cancelled
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "event_series_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "event_series_tenant" ON "event_series" ("tenant_id");

-- ---------- events ----------
CREATE TABLE "events" (
  "id"                     UUID         NOT NULL,
  "tenant_id"              UUID         NOT NULL,
  "venue_id"               UUID         NOT NULL,
  "activity_id"            UUID         NULL,
  "series_id"              UUID         NULL,
  "name"                   TEXT         NOT NULL,
  "description"            TEXT,
  "format"                 TEXT         NOT NULL DEFAULT 'open_play',
  "status"                 TEXT         NOT NULL DEFAULT 'draft',
  "visibility"             TEXT         NOT NULL DEFAULT 'public', -- public | internal
  "starts_at"              TIMESTAMPTZ  NOT NULL,
  "ends_at"                TIMESTAMPTZ  NOT NULL,
  "buffer_minutes"         INTEGER      NOT NULL DEFAULT 0,
  "capacity"               INTEGER      NOT NULL,
  "capacity_unit"          TEXT         NOT NULL DEFAULT 'participant',
  "fee_cents"              INTEGER      NOT NULL DEFAULT 0,
  "currency"               TEXT         NOT NULL DEFAULT 'USD',
  "fee_basis"              TEXT         NOT NULL DEFAULT 'participant',
  "payment_timing"         TEXT         NOT NULL DEFAULT 'free', -- free | full | deposit | later | at_venue
  "registration_opens_at"  TIMESTAMPTZ,
  "registration_closes_at" TIMESTAMPTZ,
  "waitlist_enabled"       BOOLEAN      NOT NULL DEFAULT false,
  "results_enabled"        BOOLEAN      NOT NULL DEFAULT false,
  "cancellation_reason"    TEXT,
  "details"                JSONB,
  "created_by"             UUID,
  "created_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"             TIMESTAMP(3) NOT NULL,
  CONSTRAINT "events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "events_window" CHECK ("ends_at" > "starts_at"),
  CONSTRAINT "events_capacity" CHECK ("capacity" > 0)
);
CREATE INDEX "events_tenant" ON "events" ("tenant_id");
CREATE INDEX "events_venue_starts" ON "events" ("venue_id", "starts_at");
CREATE INDEX "events_status_starts" ON "events" ("status", "starts_at");

-- ---------- event_registrations ----------
CREATE TABLE "event_registrations" (
  "id"                BIGSERIAL    NOT NULL,
  "uuid"              UUID         NOT NULL,
  "reference_no"      TEXT,
  "tenant_id"         UUID         NOT NULL,
  "event_id"          UUID         NOT NULL,
  "player_id"         UUID,
  "guest_contact_id"  UUID,
  "kind"              TEXT         NOT NULL DEFAULT 'individual', -- individual | group | team
  "team_name"         TEXT,
  "roster"            JSONB,
  "seats"             INTEGER      NOT NULL DEFAULT 1,
  "status"            TEXT         NOT NULL DEFAULT 'confirmed',
  "waitlist_position" INTEGER,
  "payment_state"     TEXT         NOT NULL DEFAULT 'none',
  "amount_due_cents"  INTEGER      NOT NULL DEFAULT 0,
  "due_at"            TIMESTAMPTZ,
  "hold_expires_at"   TIMESTAMPTZ,
  "idempotency_key"   TEXT,
  "registered_at"     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "event_registrations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "event_registrations_uuid" UNIQUE ("uuid"),
  CONSTRAINT "event_registrations_reference_no" UNIQUE ("tenant_id", "reference_no"),
  CONSTRAINT "event_registrations_idempotency" UNIQUE ("idempotency_key"),
  CONSTRAINT "event_registrations_subject" CHECK (
    "player_id" IS NOT NULL OR "guest_contact_id" IS NOT NULL
  )
);
CREATE INDEX "event_registrations_tenant" ON "event_registrations" ("tenant_id");
CREATE INDEX "event_registrations_event_status" ON "event_registrations" ("event_id", "status");
CREATE INDEX "event_registrations_player" ON "event_registrations" ("player_id");
CREATE INDEX "event_registrations_guest_contact" ON "event_registrations" ("guest_contact_id");
-- One active registration per player per event (re-registration after cancel
-- stays possible; guests dedupe on guest_contact_id).
CREATE UNIQUE INDEX "event_registrations_player_active" ON "event_registrations" ("event_id", "player_id")
  WHERE "player_id" IS NOT NULL AND "status" IN ('pending', 'confirmed', 'waitlisted');
CREATE UNIQUE INDEX "event_registrations_guest_active" ON "event_registrations" ("event_id", "guest_contact_id")
  WHERE "guest_contact_id" IS NOT NULL AND "status" IN ('pending', 'confirmed', 'waitlisted');

-- ---------- event_results ----------
CREATE TABLE "event_results" (
  "id"              UUID         NOT NULL,
  "tenant_id"       UUID         NOT NULL,
  "event_id"        UUID         NOT NULL,
  "registration_id" BIGINT,
  "label"           TEXT,
  "result"          JSONB        NOT NULL, -- {placement?, score?, wins?, losses?, ...}
  "recorded_by"     UUID,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "event_results_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "event_results_tenant" ON "event_results" ("tenant_id");
CREATE INDEX "event_results_event" ON "event_results" ("event_id");

-- ---------- check_ins (arrival + no-show attendance evidence) ----------
CREATE TABLE "check_ins" (
  "id"                UUID        NOT NULL,
  "tenant_id"         UUID        NOT NULL,
  "venue_id"          UUID,
  "reservation_uuid"  UUID,
  "registration_uuid" UUID,
  "subject_user_id"   UUID,
  "guest_contact_id"  UUID,
  "outcome"           TEXT        NOT NULL DEFAULT 'arrived', -- arrived | no_show
  "method"            TEXT        NOT NULL DEFAULT 'manual',  -- qr | manual | self
  "recorded_by"       UUID,
  "recorded_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "check_ins_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "check_ins_tenant" ON "check_ins" ("tenant_id");
CREATE INDEX "check_ins_reservation" ON "check_ins" ("reservation_uuid");
CREATE INDEX "check_ins_registration" ON "check_ins" ("registration_uuid");

-- ---------- RLS ----------
-- Tenant-owned tables get the canonical policy.
SELECT openplay_apply_tenant_rls('guest_contacts');
SELECT openplay_apply_tenant_rls('recurring_reservation_templates');
SELECT openplay_apply_tenant_rls('resource_allocations');
SELECT openplay_apply_tenant_rls('event_series');
SELECT openplay_apply_tenant_rls('events');
SELECT openplay_apply_tenant_rls('event_results');

-- Player-owned and guest-owned rows additionally allow the owning player
-- (app.actor_id) or the verified guest contact (app.guest_contact_id) to see
-- their own rows. Writers must still satisfy the CHECK clause.
ALTER TABLE "reservations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reservations" FORCE ROW LEVEL SECURITY;
CREATE POLICY scope_isolation ON "reservations"
  USING (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR "player_id" = NULLIF(current_setting('app.actor_id', true), '')::uuid
    OR "guest_contact_id" = NULLIF(current_setting('app.guest_contact_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR "player_id" = NULLIF(current_setting('app.actor_id', true), '')::uuid
    OR "guest_contact_id" = NULLIF(current_setting('app.guest_contact_id', true), '')::uuid
  );

ALTER TABLE "reservation_participants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reservation_participants" FORCE ROW LEVEL SECURITY;
CREATE POLICY scope_isolation ON "reservation_participants"
  USING (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR "user_id" = NULLIF(current_setting('app.actor_id', true), '')::uuid
    OR EXISTS (
      SELECT 1 FROM "reservations" r
      WHERE r."id" = "reservation_participants"."reservation_id"
        AND (
          r."player_id" = NULLIF(current_setting('app.actor_id', true), '')::uuid
          OR r."guest_contact_id" = NULLIF(current_setting('app.guest_contact_id', true), '')::uuid
        )
    )
  )
  WITH CHECK (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR "user_id" = NULLIF(current_setting('app.actor_id', true), '')::uuid
  );

ALTER TABLE "event_registrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "event_registrations" FORCE ROW LEVEL SECURITY;
CREATE POLICY scope_isolation ON "event_registrations"
  USING (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR "player_id" = NULLIF(current_setting('app.actor_id', true), '')::uuid
    OR "guest_contact_id" = NULLIF(current_setting('app.guest_contact_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR "player_id" = NULLIF(current_setting('app.actor_id', true), '')::uuid
    OR "guest_contact_id" = NULLIF(current_setting('app.guest_contact_id', true), '')::uuid
  );

ALTER TABLE "consent_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "consent_records" FORCE ROW LEVEL SECURITY;
CREATE POLICY scope_isolation ON "consent_records"
  USING (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR "user_id" = NULLIF(current_setting('app.actor_id', true), '')::uuid
    OR "guardian_user_id" = NULLIF(current_setting('app.actor_id', true), '')::uuid
    OR "guest_contact_id" = NULLIF(current_setting('app.guest_contact_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR "user_id" = NULLIF(current_setting('app.actor_id', true), '')::uuid
    OR "guardian_user_id" = NULLIF(current_setting('app.actor_id', true), '')::uuid
    OR "guest_contact_id" = NULLIF(current_setting('app.guest_contact_id', true), '')::uuid
  );

ALTER TABLE "check_ins" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "check_ins" FORCE ROW LEVEL SECURITY;
CREATE POLICY scope_isolation ON "check_ins"
  USING (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR "subject_user_id" = NULLIF(current_setting('app.actor_id', true), '')::uuid
    OR "guest_contact_id" = NULLIF(current_setting('app.guest_contact_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR "subject_user_id" = NULLIF(current_setting('app.actor_id', true), '')::uuid
  );
