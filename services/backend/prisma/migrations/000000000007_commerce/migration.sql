-- COMMERCE: payments, refunds, membership plans + memberships, equipment
-- items + rentals, disputes + dispute messages, and the per-tenant
-- reference counters behind PAY-/REF-/MBR-/RNT-/DSP- display labels.
--
-- Transactional tables use the bigint + SQID pattern (IDENTIFIERS.MD):
-- the bigint PK never leaves the service; `stream_id` (UUIDv7) anchors
-- audit events and dispute subject links. Money is integer minor units
-- (centavos) in `amount_cents`.
--
-- Cross-module columns (reservation_id, event subjects, member/payer/
-- renter/opener ids) are plain UUIDs — the booking/events schema is built
-- in parallel; the orchestrator wires FKs later.
--
-- RLS: tenant-owned tables get the canonical policy; tables holding
-- player-owned rows (payments, memberships, equipment_rentals, disputes)
-- additionally match `*_id = app.actor_id` so a player sees only their
-- own records. refunds / dispute_messages gate via EXISTS on their
-- parent. Default privileges (000000000002) already grant CRUD to
-- openplay_app.

-- ---------- reference_counters ----------
CREATE TABLE "reference_counters" (
  "tenant_id" UUID   NOT NULL,
  "kind"      TEXT   NOT NULL,  -- payment | refund | membership | rental | dispute
  "value"     BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT "reference_counters_pkey" PRIMARY KEY ("tenant_id", "kind")
);
CREATE INDEX "reference_counters_tenant" ON "reference_counters" ("tenant_id");

-- ---------- payments ----------
CREATE TABLE "payments" (
  "id"                   BIGSERIAL    NOT NULL,
  "stream_id"            UUID         NOT NULL,
  "tenant_id"            UUID         NOT NULL,
  "payer_id"             UUID         NOT NULL,
  "reference"            TEXT         NOT NULL,
  "purpose"              TEXT         NOT NULL DEFAULT 'reservation',
  "reservation_id"       UUID,                                  -- booking module (parallel) — no FK yet
  "membership_id"        BIGINT,
  "rental_id"            BIGINT,
  "amount_cents"         INTEGER      NOT NULL,                 -- minor units (centavos)
  "currency"             TEXT         NOT NULL DEFAULT 'PHP',
  "method"               TEXT         NOT NULL,                 -- gcash | maya | direct_transfer | pay_at_venue
  "status"               TEXT         NOT NULL DEFAULT 'initiated',
  "provider"             TEXT,
  "provider_checkout_id" TEXT,
  "provider_payment_id"  TEXT,
  "checkout_url"         TEXT,
  "checkout_expires_at"  TIMESTAMPTZ,
  "idempotency_key"      TEXT,
  "captured_at"          TIMESTAMPTZ,
  "failure_reason"       TEXT,
  "details"              JSONB,                                 -- itemized charges incl. platform fee line
  "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payments_stream" UNIQUE ("stream_id"),
  CONSTRAINT "payments_reference" UNIQUE ("tenant_id", "reference"),
  CONSTRAINT "payments_idempotency" UNIQUE ("tenant_id", "idempotency_key"),
  CONSTRAINT "payments_amount" CHECK ("amount_cents" >= 0),
  CONSTRAINT "payments_purpose" CHECK ("purpose" IN ('reservation','event','membership','rental')),
  CONSTRAINT "payments_method" CHECK ("method" IN ('gcash','maya','direct_transfer','pay_at_venue')),
  CONSTRAINT "payments_status" CHECK ("status" IN (
    'initiated','awaiting_verification','captured','failed','cancelled','expired',
    'partially_refunded','refunded'))
);
CREATE INDEX "payments_tenant" ON "payments" ("tenant_id");
CREATE INDEX "payments_payer" ON "payments" ("payer_id");
CREATE INDEX "payments_status_idx" ON "payments" ("status");
CREATE INDEX "payments_reservation_idx" ON "payments" ("reservation_id");
CREATE INDEX "payments_checkout_idx" ON "payments" ("provider_checkout_id");

-- ---------- refunds ----------
CREATE TABLE "refunds" (
  "id"                 BIGSERIAL    NOT NULL,
  "stream_id"          UUID         NOT NULL,
  "tenant_id"          UUID         NOT NULL,
  "payment_id"         BIGINT       NOT NULL,
  "reference"          TEXT         NOT NULL,
  "amount_cents"       INTEGER      NOT NULL,
  "status"             TEXT         NOT NULL DEFAULT 'requested',
  "reason"             TEXT,
  "provider_refund_id" TEXT,
  "requested_by"       UUID         NOT NULL,
  "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "refunds_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "refunds_stream" UNIQUE ("stream_id"),
  CONSTRAINT "refunds_reference" UNIQUE ("tenant_id", "reference"),
  CONSTRAINT "refunds_payment" FOREIGN KEY ("payment_id")
    REFERENCES "payments" ("id") ON DELETE RESTRICT,
  CONSTRAINT "refunds_amount" CHECK ("amount_cents" > 0),
  CONSTRAINT "refunds_status" CHECK ("status" IN ('requested','recorded','succeeded','failed','rejected'))
);
CREATE INDEX "refunds_tenant" ON "refunds" ("tenant_id");
CREATE INDEX "refunds_payment_idx" ON "refunds" ("payment_id");
CREATE INDEX "refunds_status_idx" ON "refunds" ("status");

-- ---------- membership_plans (tenant-owned catalog) ----------
CREATE TABLE "membership_plans" (
  "id"                    UUID         NOT NULL,                -- UUIDv7
  "tenant_id"             UUID         NOT NULL,
  "venue_id"              UUID,                                  -- NULL = all venues in the business
  "include_future_venues" BOOLEAN      NOT NULL DEFAULT false,
  "name"                  TEXT         NOT NULL,
  "description"           TEXT,
  "price_cents"           INTEGER      NOT NULL,
  "currency"              TEXT         NOT NULL DEFAULT 'PHP',
  "term_days"             INTEGER,
  "expires_at"            TIMESTAMPTZ,
  "term_end_rule"         TEXT         NOT NULL DEFAULT 'term',  -- term | fixed_expiration | earliest
  "billing_type"          TEXT         NOT NULL DEFAULT 'one_time',
  "interval_days"         INTEGER,
  "benefits"              JSONB        NOT NULL DEFAULT '{}',
  "eligibility"           JSONB,
  "status"                TEXT         NOT NULL DEFAULT 'draft',
  "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"            TIMESTAMP(3) NOT NULL,
  CONSTRAINT "membership_plans_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "membership_plans_price" CHECK ("price_cents" >= 0),
  CONSTRAINT "membership_plans_term" CHECK ("term_days" IS NULL OR "term_days" > 0),
  CONSTRAINT "membership_plans_interval" CHECK ("interval_days" IS NULL OR "interval_days" > 0),
  CONSTRAINT "membership_plans_billing" CHECK ("billing_type" IN ('one_time','recurring')),
  CONSTRAINT "membership_plans_rule" CHECK ("term_end_rule" IN ('term','fixed_expiration','earliest')),
  CONSTRAINT "membership_plans_status" CHECK ("status" IN ('draft','active','archived'))
);
CREATE INDEX "membership_plans_tenant" ON "membership_plans" ("tenant_id");
CREATE INDEX "membership_plans_venue_idx" ON "membership_plans" ("venue_id");

-- ---------- memberships (player-owned, transactional) ----------
CREATE TABLE "memberships" (
  "id"         BIGSERIAL    NOT NULL,
  "stream_id"  UUID         NOT NULL,
  "tenant_id"  UUID         NOT NULL,
  "plan_id"    UUID         NOT NULL,
  "member_id"  UUID         NOT NULL,
  "reference"  TEXT         NOT NULL,
  "status"     TEXT         NOT NULL DEFAULT 'pending',
  "starts_at"  TIMESTAMPTZ,
  "ends_at"    TIMESTAMPTZ,
  "auto_renew" BOOLEAN      NOT NULL DEFAULT false,
  "qr_token"   TEXT         NOT NULL,
  "payment_id" BIGINT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "memberships_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "memberships_stream" UNIQUE ("stream_id"),
  CONSTRAINT "memberships_reference" UNIQUE ("tenant_id", "reference"),
  CONSTRAINT "memberships_qr" UNIQUE ("qr_token"),
  CONSTRAINT "memberships_plan" FOREIGN KEY ("plan_id")
    REFERENCES "membership_plans" ("id") ON DELETE RESTRICT,
  CONSTRAINT "memberships_window" CHECK ("ends_at" IS NULL OR "starts_at" IS NULL OR "ends_at" > "starts_at"),
  CONSTRAINT "memberships_status" CHECK ("status" IN ('pending','active','paused','expired','cancelled'))
);
CREATE INDEX "memberships_tenant" ON "memberships" ("tenant_id");
CREATE INDEX "memberships_member" ON "memberships" ("member_id");
CREATE INDEX "memberships_status_idx" ON "memberships" ("status");

-- ---------- equipment_items (tenant-owned catalog + stock) ----------
CREATE TABLE "equipment_items" (
  "id"          UUID         NOT NULL,
  "tenant_id"   UUID         NOT NULL,
  "venue_id"    UUID,
  "activity_id" UUID,
  "name"        TEXT         NOT NULL,
  "description" TEXT,
  "total_stock" INTEGER      NOT NULL DEFAULT 0,
  "price_cents" INTEGER,
  "currency"    TEXT         NOT NULL DEFAULT 'PHP',
  "unit"        TEXT         NOT NULL DEFAULT 'booking',
  "status"      TEXT         NOT NULL DEFAULT 'active',        -- draft | active | archived
  "details"     JSONB,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "equipment_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "equipment_items_stock" CHECK ("total_stock" >= 0),
  CONSTRAINT "equipment_items_price" CHECK ("price_cents" IS NULL OR "price_cents" >= 0),
  CONSTRAINT "equipment_items_status" CHECK ("status" IN ('draft','active','archived'))
);
CREATE INDEX "equipment_items_tenant" ON "equipment_items" ("tenant_id");
CREATE INDEX "equipment_items_venue_idx" ON "equipment_items" ("venue_id");

-- ---------- equipment_rentals (player-owned, transactional) ----------
CREATE TABLE "equipment_rentals" (
  "id"                    BIGSERIAL    NOT NULL,
  "stream_id"             UUID         NOT NULL,
  "tenant_id"             UUID         NOT NULL,
  "item_id"               UUID         NOT NULL,
  "renter_id"             UUID         NOT NULL,
  "reservation_id"        UUID,                                  -- booking module — no FK yet
  "reference"             TEXT         NOT NULL,
  "quantity"              INTEGER      NOT NULL,
  "status"                TEXT         NOT NULL DEFAULT 'reserved',
  "starts_at"             TIMESTAMPTZ  NOT NULL,
  "ends_at"               TIMESTAMPTZ  NOT NULL,
  "pickup_window_minutes" INTEGER      NOT NULL DEFAULT 15,
  "return_window_minutes" INTEGER      NOT NULL DEFAULT 15,
  "amount_cents"          INTEGER,
  "currency"              TEXT         NOT NULL DEFAULT 'PHP',
  "payment_id"            BIGINT,
  "checked_out_at"        TIMESTAMPTZ,
  "returned_at"           TIMESTAMPTZ,
  "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"            TIMESTAMP(3) NOT NULL,
  CONSTRAINT "equipment_rentals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "equipment_rentals_stream" UNIQUE ("stream_id"),
  CONSTRAINT "equipment_rentals_reference" UNIQUE ("tenant_id", "reference"),
  CONSTRAINT "equipment_rentals_item" FOREIGN KEY ("item_id")
    REFERENCES "equipment_items" ("id") ON DELETE RESTRICT,
  CONSTRAINT "equipment_rentals_qty" CHECK ("quantity" > 0),
  CONSTRAINT "equipment_rentals_window" CHECK ("ends_at" > "starts_at"),
  CONSTRAINT "equipment_rentals_amount" CHECK ("amount_cents" IS NULL OR "amount_cents" >= 0),
  CONSTRAINT "equipment_rentals_status" CHECK ("status" IN
    ('reserved','checked_out','returned','released','cancelled'))
);
CREATE INDEX "equipment_rentals_tenant" ON "equipment_rentals" ("tenant_id");
CREATE INDEX "equipment_rentals_renter" ON "equipment_rentals" ("renter_id");
CREATE INDEX "equipment_rentals_item_idx" ON "equipment_rentals" ("item_id");
CREATE INDEX "equipment_rentals_status_idx" ON "equipment_rentals" ("status");
CREATE INDEX "equipment_rentals_reservation_idx" ON "equipment_rentals" ("reservation_id");
-- Stock enforcement: overlap check for active claims on the same item.
CREATE INDEX "equipment_rentals_claim_idx" ON "equipment_rentals" ("item_id", "status")
  WHERE "status" IN ('reserved','checked_out');

-- ---------- disputes (player/guest-opened, transactional) ----------
CREATE TABLE "disputes" (
  "id"           BIGSERIAL    NOT NULL,
  "stream_id"    UUID         NOT NULL,
  "tenant_id"    UUID         NOT NULL,
  "opener_id"    UUID         NOT NULL,
  "reference"    TEXT         NOT NULL,
  "category"     TEXT         NOT NULL,
  "subject_type" TEXT         NOT NULL,                         -- reservation | event | rental | payment
  "subject_id"   TEXT         NOT NULL,                         -- subject stream_id or public id
  "account"      TEXT         NOT NULL,
  "status"       TEXT         NOT NULL DEFAULT 'open',
  "resolution"   TEXT,
  "attachments"  JSONB,                                         -- private-storage object refs
  "opened_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at"  TIMESTAMPTZ,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "disputes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "disputes_stream" UNIQUE ("stream_id"),
  CONSTRAINT "disputes_reference" UNIQUE ("tenant_id", "reference"),
  CONSTRAINT "disputes_category" CHECK ("category" IN
    ('payment','no_show','cancellation','equipment','service')),
  CONSTRAINT "disputes_subject" CHECK ("subject_type" IN
    ('reservation','event','rental','payment')),
  CONSTRAINT "disputes_status" CHECK ("status" IN ('open','under_review','resolved','escalated'))
);
CREATE INDEX "disputes_tenant" ON "disputes" ("tenant_id");
CREATE INDEX "disputes_opener" ON "disputes" ("opener_id");
CREATE INDEX "disputes_status_idx" ON "disputes" ("status");

-- ---------- dispute_messages (shared history; child of disputes) ----------
CREATE TABLE "dispute_messages" (
  "id"          UUID         NOT NULL,
  "tenant_id"   UUID         NOT NULL,
  "dispute_id"  BIGINT       NOT NULL,
  "author_id"   UUID,                                         -- NULL = system
  "author_side" TEXT         NOT NULL,                        -- player | venue | platform | system
  "kind"        TEXT         NOT NULL DEFAULT 'response',     -- response | status_change
  "body"        TEXT         NOT NULL,
  "attachments" JSONB,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dispute_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "dispute_messages_dispute" FOREIGN KEY ("dispute_id")
    REFERENCES "disputes" ("id") ON DELETE CASCADE,
  CONSTRAINT "dispute_messages_side" CHECK ("author_side" IN ('player','venue','platform','system')),
  CONSTRAINT "dispute_messages_kind" CHECK ("kind" IN ('response','status_change'))
);
CREATE INDEX "dispute_messages_tenant" ON "dispute_messages" ("tenant_id");
CREATE INDEX "dispute_messages_dispute_idx" ON "dispute_messages" ("dispute_id");

-- ---------- RLS ----------
-- Pure tenant-owned tables: canonical policy.
SELECT openplay_apply_tenant_rls('membership_plans');
SELECT openplay_apply_tenant_rls('equipment_items');

-- reference_counters: display-label counters only. Players minting their
-- own payment/membership/rental/dispute references must bump the owning
-- tenant's counter, so any authenticated actor may read/write counters.
-- Compromise only degrades a display sequence — never record identity.
ALTER TABLE "reference_counters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reference_counters" FORCE ROW LEVEL SECURITY;
CREATE POLICY scope_isolation ON "reference_counters"
  USING (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR NULLIF(current_setting('app.actor_id', true), '') IS NOT NULL
  )
  WITH CHECK (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR NULLIF(current_setting('app.actor_id', true), '') IS NOT NULL
  );

-- Player-owned tables: tenant scope OR the owning player column matching
-- app.actor_id; WITH CHECK allows the player to write their own row
-- (their tenant claim is empty — the row's tenant_id is the business's).
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments" FORCE ROW LEVEL SECURITY;
CREATE POLICY scope_isolation ON "payments"
  USING (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR "payer_id" = NULLIF(current_setting('app.actor_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR "payer_id" = NULLIF(current_setting('app.actor_id', true), '')::uuid
  );

ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memberships" FORCE ROW LEVEL SECURITY;
CREATE POLICY scope_isolation ON "memberships"
  USING (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR "member_id" = NULLIF(current_setting('app.actor_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR "member_id" = NULLIF(current_setting('app.actor_id', true), '')::uuid
  );

ALTER TABLE "equipment_rentals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "equipment_rentals" FORCE ROW LEVEL SECURITY;
CREATE POLICY scope_isolation ON "equipment_rentals"
  USING (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR "renter_id" = NULLIF(current_setting('app.actor_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR "renter_id" = NULLIF(current_setting('app.actor_id', true), '')::uuid
  );

ALTER TABLE "disputes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "disputes" FORCE ROW LEVEL SECURITY;
CREATE POLICY scope_isolation ON "disputes"
  USING (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR "opener_id" = NULLIF(current_setting('app.actor_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR "opener_id" = NULLIF(current_setting('app.actor_id', true), '')::uuid
  );

-- refunds: child table — gate through the parent payment's visibility
-- (tenant staff or the paying player). A refund is never created by a
-- player, so WITH CHECK keeps tenant/platform/system only.
ALTER TABLE "refunds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "refunds" FORCE ROW LEVEL SECURITY;
CREATE POLICY scope_isolation ON "refunds"
  USING (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR EXISTS (
      SELECT 1 FROM "payments" p
      WHERE p."id" = "refunds"."payment_id"
        AND p."payer_id" = NULLIF(current_setting('app.actor_id', true), '')::uuid
    )
  )
  WITH CHECK (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

-- dispute_messages: child table — visible to the tenant and to the
-- dispute's opener; the opener may append responses to their own dispute.
ALTER TABLE "dispute_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dispute_messages" FORCE ROW LEVEL SECURITY;
CREATE POLICY scope_isolation ON "dispute_messages"
  USING (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR EXISTS (
      SELECT 1 FROM "disputes" d
      WHERE d."id" = "dispute_messages"."dispute_id"
        AND d."opener_id" = NULLIF(current_setting('app.actor_id', true), '')::uuid
    )
  )
  WITH CHECK (
    current_setting('app.is_platform', true) = 'true'
    OR current_setting('app.is_system', true) = 'true'
    OR "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR EXISTS (
      SELECT 1 FROM "disputes" d
      WHERE d."id" = "dispute_messages"."dispute_id"
        AND d."opener_id" = NULLIF(current_setting('app.actor_id', true), '')::uuid
    )
  );
