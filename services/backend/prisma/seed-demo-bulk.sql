-- Bulk demo data for exercising pagination, filters, and search across the
-- portals. Requires the 'acme' demo tenant (run `npm run db:seed` with
-- SEED_DEMO=true first). Idempotent: skipped entirely once bulk guest
-- contacts exist. Run with:
--   docker compose exec -T postgres psql -U openplay -d openplay -f /seed/seed-demo-bulk.sql
-- (or `cat prisma/seed-demo-bulk.sql | docker compose exec -T postgres psql -U openplay -d openplay`)

SET app.is_system = 'true';

DO $$
DECLARE
  t    uuid := (SELECT id FROM tenants WHERE code = 'acme');
  v    uuid := (SELECT id FROM venues WHERE tenant_id = t ORDER BY created_at LIMIT 1);
  ra   uuid;
  rb   uuid;
  act  uuid := (SELECT id FROM venue_activities WHERE tenant_id = t ORDER BY created_at LIMIT 1);
  plan uuid := (SELECT id FROM membership_plans WHERE tenant_id = t ORDER BY created_at LIMIT 1);
  i    int;
  pid  uuid;
  pay  bigint;
  day  int;
  st   text;
  fn   text[] := ARRAY['Ava','Miguel','Sofia','Rico','Lena','Marco','Ivy','Noel','Kai','Rosa','Jude','Tessa','Paolo','Mira','Nadia','Ezra'];
  ln   text[] := ARRAY['Santos','Reyes','Cruz','Garcia','Lim','Tan','Ong','Dela Rosa','Navarro','Aquino','Flores','Ramos','Uy','Velasco','Mendoza','Torres'];
  pids uuid[] := '{}';
  gids uuid[] := '{}';
  iids uuid[] := '{}';
  eids uuid[] := '{}';
  res_uuids uuid[] := '{}';
  pay_ids bigint[] := '{}';
  statuses text[];
  cats text[] := ARRAY['payment','no_show','cancellation','equipment','service'];
  dst  text[] := ARRAY['open','under_review','escalated','resolved'];
  nkd  text[] := ARRAY['reservation.reminder','reservation.confirmed','payment.receipt','event.update','membership.expiring','rental.due'];
BEGIN
  IF t IS NULL OR v IS NULL THEN
    RAISE EXCEPTION 'acme tenant/venue missing — run `npm run db:seed` with SEED_DEMO=true first';
  END IF;

  SELECT id INTO ra FROM venue_resources WHERE tenant_id = t AND name ILIKE '%A%' ORDER BY created_at LIMIT 1;
  SELECT id INTO rb FROM venue_resources WHERE tenant_id = t AND id <> ra ORDER BY created_at LIMIT 1;
  IF ra IS NULL THEN
    SELECT id INTO ra FROM venue_resources WHERE tenant_id = t ORDER BY created_at LIMIT 1;
  END IF;
  rb := COALESCE(rb, ra);

  IF EXISTS (SELECT 1 FROM notifications WHERE idempotency_key = 'bulk-notif-001') THEN
    RAISE NOTICE 'bulk demo data already seeded — skipping';
    RETURN;
  END IF;

  -- Extra tenants for the platform Tenants list (search + status filter).
  FOR i IN 1..8 LOOP
    INSERT INTO tenants (id, code, name, status, published, details, created_at, updated_at)
    VALUES (gen_random_uuid(),
            'bulk-' || lower((ARRAY['skyline','harbor','northgate','fairway','summit','riverside','parkview','greenfield'])[i]),
            (ARRAY['Skyline Sports Club','Harbor Paddle Center','Northgate Athletic Club','Fairway Courts','Summit Rec Center','Riverside Club','Parkview Complex','Greenfield Arena'])[i],
            CASE WHEN i % 5 = 0 THEN 'suspended' ELSE 'active' END,
            i % 4 <> 0,
            jsonb_build_object('description', 'Bulk-seeded tenant for UI testing'),
            now() - (i || ' days')::interval, now())
    ON CONFLICT (code) DO NOTHING;
  END LOOP;

  -- Player users (platform scope) for the platform Users list + reservation subjects.
  FOR i IN 1..16 LOOP
    pid := gen_random_uuid();
    INSERT INTO iam_users (id, scope, username, email, display_name, suspended_at, created_at, updated_at)
    VALUES (pid, 'platform',
            'bulk.player' || lpad(i::text, 2, '0'),
            'bulk.player' || lpad(i::text, 2, '0') || '@demo.openplay.test',
            fn[1 + ((i - 1) % 16)] || ' ' || ln[1 + ((i * 5 - 1) % 16)],
            CASE WHEN i IN (5, 11) THEN now() - (i || ' days')::interval END,
            now() - (i || ' days')::interval, now());
    pids := pids || pid;
  END LOOP;

  -- Tenant-scoped staff users (fill the venue Staff page), each with a role.
  FOR i IN 1..9 LOOP
    pid := gen_random_uuid();
    INSERT INTO iam_users (id, scope, username, display_name, tenant_id, suspended_at, created_at, updated_at)
    VALUES (pid, 'tenant',
            'bulk.staff' || lpad(i::text, 2, '0'),
            fn[1 + ((i * 3) % 16)] || ' ' || ln[1 + ((i * 7) % 16)] || ' (Staff)',
            t,
            CASE WHEN i = 7 THEN now() - interval '10 days' END,
            now() - (i * 2 || ' days')::interval, now());
    INSERT INTO iam_user_roles (user_id, role_id)
    SELECT pid, id FROM iam_roles
    WHERE key = CASE WHEN i <= 2 THEN 'venue.manager' ELSE 'venue.staff' END
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Guest contacts (customers) — every 4th has no email for filter variety.
  FOR i IN 1..30 LOOP
    pid := gen_random_uuid();
    INSERT INTO guest_contacts (id, tenant_id, name, email, phone, created_at, updated_at)
    VALUES (pid, t,
            fn[1 + (i % 16)] || ' ' || ln[1 + ((i * 3) % 16)],
            CASE WHEN i % 4 <> 0 THEN 'guest' || lpad(i::text, 2, '0') || '@demo.openplay.test' END,
            CASE WHEN i % 3 <> 0 THEN '+63917' || lpad((1000000 + i * 7331)::text, 7, '0') END,
            now() - (i || ' days')::interval, now());
    gids := gids || pid;
  END LOOP;

  -- Reservations: every status, past + future, alternating players/guests and resources.
  statuses := ARRAY['confirmed','confirmed','confirmed','pending_approval','approved','completed','completed','cancelled','no_show','declined','hold','pending_approval'];
  FOR i IN 1..45 LOOP
    st := statuses[1 + (i % 12)];
    day := (i * 37 % 70) - 40;                       -- -40 .. +29 days
    pid := gen_random_uuid();
    INSERT INTO reservations
      (uuid, reference_no, tenant_id, venue_id, resource_id, activity_id,
       player_id, guest_contact_id, status, starts_at, ends_at, party_size,
       payment_state, notes, created_at, updated_at)
    VALUES
      (pid, 'BULK-R' || lpad(i::text, 4, '0'), t, v,
       CASE WHEN i % 2 = 0 THEN ra ELSE rb END, act,
       CASE WHEN i % 3 <> 0 THEN pids[1 + (i % 16)] END,
       CASE WHEN i % 3 = 0 THEN gids[1 + (i % 30)] END,
       st,
       now() + (day || ' days')::interval + ((i % 8) || ' hours')::interval,
       now() + (day || ' days')::interval + (((i % 8) + 1) || ' hours')::interval,
       1 + (i % 4),
       CASE WHEN st IN ('confirmed', 'completed') THEN 'paid'
            WHEN st = 'pending_approval' THEN 'pending_payment'
            ELSE 'none' END,
       CASE WHEN i % 6 = 0 THEN 'Bulk seed note ' || i END,
       now() - ((40 - LEAST(i, 40)) || ' days')::interval, now());
    res_uuids := res_uuids || pid;
  END LOOP;

  -- Payments: all statuses and methods.
  FOR i IN 1..36 LOOP
    INSERT INTO payments
      (stream_id, tenant_id, payer_id, reference, purpose, reservation_id,
       amount_cents, method, status, provider, captured_at, failure_reason,
       created_at, updated_at)
    VALUES
      (gen_random_uuid(), t, pids[1 + (i % 16)],
       'BULK-PAY-' || lpad(i::text, 4, '0'),
       (ARRAY['reservation','reservation','event','membership','rental'])[1 + (i % 5)],
       CASE WHEN i % 5 < 3 THEN res_uuids[1 + (i % array_length(res_uuids, 1))] END,
       5000 + (i * 137 % 40) * 1000,
       (ARRAY['gcash','maya','direct_transfer','pay_at_venue'])[1 + (i % 4)],
       (ARRAY['captured','captured','captured','initiated','awaiting_verification','failed','refunded','expired','cancelled'])[1 + (i % 9)],
       (ARRAY['stub','stub','manual'])[1 + (i % 3)],
       CASE WHEN i % 9 IN (0, 1, 2) THEN now() - (i || ' hours')::interval END,
       CASE WHEN i % 9 = 5 THEN 'card_declined' END,
       now() - (i * 2 || ' days')::interval, now())
    RETURNING id INTO pay;
    pay_ids := pay_ids || pay;
  END LOOP;

  -- Memberships across statuses (uses the existing plan if present).
  IF plan IS NOT NULL THEN
    FOR i IN 1..14 LOOP
      INSERT INTO memberships
        (stream_id, tenant_id, plan_id, member_id, reference, status,
         starts_at, ends_at, auto_renew, qr_token, created_at, updated_at)
      VALUES
        (gen_random_uuid(), t, plan, pids[1 + (i % 16)],
         'BULK-MEM-' || lpad(i::text, 3, '0'),
         (ARRAY['active','active','active','pending','paused','expired','cancelled'])[1 + (i % 7)],
         now() - (i * 9 || ' days')::interval,
         now() + ((30 - i * 3) || ' days')::interval,
         i % 3 = 0,
         'bulk-qr-' || i,
         now() - (i * 9 || ' days')::interval, now());
    END LOOP;
  END IF;

  -- Events: published/public mix plus drafts and cancelled for filters.
  FOR i IN 1..18 LOOP
    pid := gen_random_uuid();
    INSERT INTO events
      (id, tenant_id, venue_id, activity_id, name, description, format, status,
       visibility, starts_at, ends_at, capacity, fee_cents, payment_timing,
       created_at, updated_at)
    VALUES
      (pid, t, v, act,
       (ARRAY['Open Play','Sunrise Rally','Evening Ladder','Weekend Social','Skills Clinic','Mini Tournament'])[1 + (i % 6)] || ' #' || i,
       'Bulk-seeded event for UI testing.',
       (ARRAY['open_play','tournament','clinic'])[1 + (i % 3)],
       (ARRAY['published','published','published','registration_open','complete','draft','cancelled'])[1 + (i % 7)],
       CASE WHEN i % 4 = 0 THEN 'members' ELSE 'public' END,
       now() + ((i * 11 % 50) - 20 || ' days')::interval,
       now() + ((i * 11 % 50) - 20 || ' days')::interval + interval '2 hours',
       8 + (i % 5) * 4,
       (i % 4) * 25000,
       CASE WHEN i % 4 = 0 THEN 'free' ELSE 'online' END,
       now() - (i || ' days')::interval, now());
    eids := eids || pid;
  END LOOP;

  -- Event registrations on the published events.
  FOR i IN 1..20 LOOP
    INSERT INTO event_registrations
      (uuid, reference_no, tenant_id, event_id, player_id, guest_contact_id,
       kind, seats, status, payment_state, registered_at, created_at, updated_at)
    VALUES
      (gen_random_uuid(), 'BULK-ER' || lpad(i::text, 4, '0'), t,
       eids[1 + (i % array_length(eids, 1))],
       CASE WHEN i % 3 <> 0 THEN pids[1 + (i % 16)] END,
       CASE WHEN i % 3 = 0 THEN gids[1 + (i % 30)] END,
       'individual', 1 + (i % 2),
       (ARRAY['confirmed','confirmed','confirmed','pending','cancelled','waitlisted'])[1 + (i % 6)],
       CASE WHEN i % 6 < 3 THEN 'paid' ELSE 'none' END,
       now() - (i || ' days')::interval, now(), now());
  END LOOP;

  -- Equipment catalog.
  FOR i IN 1..15 LOOP
    pid := gen_random_uuid();
    INSERT INTO equipment_items
      (id, tenant_id, venue_id, name, description, total_stock, price_cents,
       unit, status, created_at, updated_at)
    VALUES
      (pid, t, v,
       (ARRAY['Racket','Ball Hopper','Ball Tube','Basket of Balls','Ball Machine','Net Post','Scorecard Pack','Cone Set','Agility Ladder','Practice Target'])[1 + (i % 10)] || ' ' || i,
       'Bulk-seeded equipment item.',
       2 + (i % 6),
       (i % 6) * 15000,
       (ARRAY['booking','day','hour'])[1 + (i % 3)],
       (ARRAY['active','active','active','draft','archived'])[1 + (i % 5)],
       now() - (i || ' days')::interval, now());
    iids := iids || pid;
  END LOOP;

  -- Equipment rentals across statuses.
  FOR i IN 1..18 LOOP
    INSERT INTO equipment_rentals
      (stream_id, tenant_id, item_id, renter_id, reference, quantity, status,
       starts_at, ends_at, amount_cents, created_at, updated_at)
    VALUES
      (gen_random_uuid(), t, iids[1 + (i % 15)], pids[1 + (i % 16)],
       'BULK-RENT-' || lpad(i::text, 3, '0'), 1 + (i % 3),
       (ARRAY['reserved','reserved','checked_out','returned','released','cancelled'])[1 + (i % 6)],
       now() + ((i * 5 % 30) - 15 || ' days')::interval,
       now() + ((i * 5 % 30) - 15 || ' days')::interval + interval '4 hours',
       (i % 6) * 15000,
       now() - (i || ' days')::interval, now());
  END LOOP;

  -- Disputes across categories and statuses.
  FOR i IN 1..10 LOOP
    INSERT INTO disputes
      (stream_id, tenant_id, opener_id, reference, category, subject_type,
       subject_id, account, status, resolution, resolved_at, created_at, updated_at)
    VALUES
      (gen_random_uuid(), t, pids[1 + (i % 16)],
       'BULK-DSP-' || lpad(i::text, 3, '0'),
       cats[1 + (i % 5)],
       (ARRAY['reservation','payment','event','rental'])[1 + (i % 4)],
       'bulk-subject-' || i,
       'Demo dispute about ' || cats[1 + (i % 5)] || ' #' || i,
       dst[1 + (i % 4)],
       CASE WHEN dst[1 + (i % 4)] = 'resolved' THEN 'resolved in favor of guest' END,
       CASE WHEN dst[1 + (i % 4)] = 'resolved' THEN now() - (i || ' days')::interval END,
       now() - (i * 3 || ' days')::interval, now());
  END LOOP;

  -- Notifications across kinds, channels, and statuses.
  FOR i IN 1..34 LOOP
    INSERT INTO notifications
      (id, tenant_id, recipient_user_id, recipient_address, channel, kind,
       payload, status, idempotency_key, sent_at, failed_at, error,
       created_at, updated_at)
    VALUES
      (gen_random_uuid(), t, pids[1 + (i % 16)],
       'user' || i || '@demo.openplay.test',
       (ARRAY['in_app','email','sms'])[1 + (i % 3)],
       nkd[1 + (i % 6)],
       jsonb_build_object('link', 'https://openplay.local/app', 'n', i),
       (ARRAY['sent','sent','sent','pending','failed'])[1 + (i % 5)],
       'bulk-notif-' || lpad(i::text, 3, '0'),
       CASE WHEN i % 5 < 3 THEN now() - (i || ' hours')::interval END,
       CASE WHEN i % 5 = 4 THEN now() - (i || ' hours')::interval END,
       CASE WHEN i % 5 = 4 THEN 'mailbox unavailable' END,
       now() - (i || ' days')::interval, now());
  END LOOP;

  -- Waiver documents.
  FOR i IN 1..6 LOOP
    INSERT INTO venue_waiver_documents
      (id, tenant_id, venue_id, title, status, current_version,
       reacknowledge_on_update, created_at, updated_at)
    VALUES
      (gen_random_uuid(), t, v,
       (ARRAY['General Liability','Court Safety','Junior Player','Equipment Use','Event Participation','Photo Release'])[i] || ' Waiver',
       (ARRAY['published','published','draft','archived','published','draft'])[i],
       i,
       i % 2 = 0,
       now() - (i * 4 || ' days')::interval, now());
  END LOOP;

  -- Audit events for the platform Audit events list.
  FOR i IN 1..40 LOOP
    INSERT INTO audit_events
      (id, tenant_id, stream_type, stream_id, sequence, event_type,
       actor_id, actor_kind, payload, metadata, occurred_at)
    VALUES
      (gen_random_uuid(), t,
       (ARRAY['reservation','payment','membership','rental','event'])[1 + (i % 5)],
       res_uuids[1 + (i % array_length(res_uuids, 1))],
       i,
       (ARRAY['created','confirmed','cancelled','captured','updated','no_show_marked','refunded'])[1 + (i % 7)],
       pids[1 + (i % 16)],
       (ARRAY['player','staff','system'])[1 + (i % 3)],
       jsonb_build_object('n', i), '{}'::jsonb,
       now() - ((i * 7) || ' hours')::interval);
  END LOOP;

  RAISE NOTICE 'bulk demo data seeded';
END $$;

-- ---------- venue catalog expansion (venues, facilities, activities, prices, rules, closures) ----------
DO $$
DECLARE
  t    uuid := (SELECT id FROM tenants WHERE code = 'acme');
  main uuid := (SELECT id FROM venues WHERE tenant_id = t AND name = 'Acme Main Hall' LIMIT 1);
  east uuid;
  roof uuid;
  annex uuid;
  rc uuid;
  rd uuid;
  studio uuid;
  gym uuid;
  lane1 uuid;
  field uuid;
  badm uuid;
  futsal uuid;
  tt uuid;
  existing_act uuid := (SELECT id FROM venue_activities WHERE tenant_id = t ORDER BY created_at LIMIT 1);
  i int;
  statuses text[] := ARRAY['active','active','maintenance','active','active','active'];
BEGIN
  IF t IS NULL OR main IS NULL THEN
    RAISE EXCEPTION 'acme tenant/venue missing — run `npm run db:seed` with SEED_DEMO=true first';
  END IF;
  IF EXISTS (SELECT 1 FROM venues WHERE tenant_id = t AND name = 'Acme East Wing') THEN
    RAISE NOTICE 'catalog bulk data already seeded — skipping';
    RETURN;
  END IF;

  -- Venues (3).
  east  := gen_random_uuid(); roof := gen_random_uuid(); annex := gen_random_uuid();
  INSERT INTO venues (id, tenant_id, name, timezone, status, address, details, created_at, updated_at)
  VALUES
    (east,  t, 'Acme East Wing',      'Asia/Manila', 'active', jsonb_build_object('line1','45 East Ave','city','Makati','country','PH'), jsonb_build_object('description','East wing courts'), now() - interval '30 days', now()),
    (roof,  t, 'Acme Rooftop Courts', 'Asia/Manila', 'active', jsonb_build_object('line1','88 Sky Rd','city','Makati','country','PH'),   jsonb_build_object('description','Outdoor rooftop facilities'), now() - interval '20 days', now()),
    (annex, t, 'Acme Annex',          'Asia/Manila', 'draft',  jsonb_build_object('line1','12 Annex St','city','Makati','country','PH'), jsonb_build_object('description','Annex opening soon'), now() - interval '10 days', now());

  -- Facilities (venue_resources): 6 new across the venues.
  rc     := gen_random_uuid(); rd := gen_random_uuid();
  studio := gen_random_uuid(); gym := gen_random_uuid();
  lane1  := gen_random_uuid(); field := gen_random_uuid();
  INSERT INTO venue_resources (id, tenant_id, venue_id, name, resource_type, status, capacity, settings, created_at, updated_at)
  VALUES
    (gen_random_uuid(), t, main, 'Court C',       'court', 'active',      4, jsonb_build_object('buffer_minutes',10,'increment_minutes',30,'duration_minutes',60), now() - interval '6 days', now()),
    (gen_random_uuid(), t, main, 'Court D',       'court', 'active',      4, jsonb_build_object('buffer_minutes',10,'increment_minutes',30,'duration_minutes',60), now() - interval '5 days', now()),
    (gen_random_uuid(), t, east, 'Studio Room 1', 'room',  'maintenance', 12, jsonb_build_object('buffer_minutes',0),  now() - interval '4 days', now()),
    (gen_random_uuid(), t, east, 'Gym Floor',     'gym',   'active',      40, jsonb_build_object('buffer_minutes',0),  now() - interval '3 days', now()),
    (gen_random_uuid(), t, roof, 'Pool Lane 1',   'lane',  'active',      2, jsonb_build_object('buffer_minutes',0),  now() - interval '2 days', now()),
    (gen_random_uuid(), t, roof, 'Outdoor Field', 'field', 'active',      22, jsonb_build_object('buffer_minutes',15,'increment_minutes',30,'duration_minutes',60), now() - interval '1 day', now());
  SELECT id INTO rc     FROM venue_resources WHERE tenant_id = t AND name = 'Court C';
  SELECT id INTO rd     FROM venue_resources WHERE tenant_id = t AND name = 'Court D';
  SELECT id INTO studio FROM venue_resources WHERE tenant_id = t AND name = 'Studio Room 1';
  SELECT id INTO gym    FROM venue_resources WHERE tenant_id = t AND name = 'Gym Floor';
  SELECT id INTO lane1  FROM venue_resources WHERE tenant_id = t AND name = 'Pool Lane 1';
  SELECT id INTO field  FROM venue_resources WHERE tenant_id = t AND name = 'Outdoor Field';

  -- Activities (3 new) + resource links.
  badm := gen_random_uuid(); futsal := gen_random_uuid(); tt := gen_random_uuid();
  INSERT INTO venue_activities (id, tenant_id, name, code, status, description, created_at, updated_at)
  VALUES
    (badm,   t, 'Badminton',     'badminton',     'active', 'Racquet sport for singles and doubles.', now(), now()),
    (futsal, t, 'Futsal',        'futsal',        'active', 'Five-a-side indoor football.',           now(), now()),
    (tt,     t, 'Table Tennis',  'table-tennis',  'active', 'Casual and league table play.',          now(), now());
  INSERT INTO venue_activity_resources (tenant_id, activity_id, resource_id)
  VALUES
    (t, badm,   rc), (t, badm, rd),
    (t, futsal, gym), (t, futsal, field),
    (t, tt,     studio),
    (t, existing_act, rc);

  -- Prices (5).
  INSERT INTO venue_prices (id, tenant_id, venue_id, resource_id, activity_id, label, amount_cents, currency, unit, active, created_at, updated_at)
  VALUES
    (gen_random_uuid(), t, main, rc,     NULL,  'Court C hourly',      25000, 'PHP', 'hour',    true,  now(), now()),
    (gen_random_uuid(), t, main, rd,     NULL,  'Court D hourly',      25000, 'PHP', 'hour',    true,  now(), now()),
    (gen_random_uuid(), t, east, studio, tt,    'Table tennis hour',   18000, 'PHP', 'hour',    true,  now(), now()),
    (gen_random_uuid(), t, east, gym,    futsal,'Futsal match (90m)',  60000, 'PHP', 'booking', true,  now(), now()),
    (gen_random_uuid(), t, roof, lane1,  NULL,  'Lane swim hour',      12000, 'PHP', 'hour',    false, now(), now());

  -- Facility rules (4).
  INSERT INTO venue_facility_rules
    (id, tenant_id, venue_id, resource_id, title, body, visibility,
     requires_acknowledgment, status, version, created_at, updated_at)
  VALUES
    (gen_random_uuid(), t, NULL, NULL,  'Proper sports attire required',
     'Players must wear non-marking shoes and sports attire on all courts.',
     'public', true,  'published', 1, now(), now()),
    (gen_random_uuid(), t, NULL, NULL,  'No food or glass on court',
     'Food, glass containers, and smoking are prohibited inside playing areas.',
     'public', true,  'published', 1, now(), now()),
    (gen_random_uuid(), t, east, gym,   'Gym floor booking etiquette',
     'Return nets and equipment to storage after your session.',
     'public', false, 'published', 2, now(), now()),
    (gen_random_uuid(), t, NULL, NULL,  'Staff-only maintenance window note',
     'Maintenance closures take precedence over member bookings.',
     'internal', false, 'draft',    1, now(), now());

  -- Closures (4): venue-wide holiday, facility maintenance, internal use, cancelled.
  INSERT INTO venue_closures
    (id, tenant_id, venue_id, resource_id, kind, starts_at, ends_at, reason, status, created_at, updated_at)
  VALUES
    (gen_random_uuid(), t, main, NULL, 'closure',
     now() + interval '14 days', now() + interval '15 days',
     'Independence Day — venue closed', 'scheduled', now(), now()),
    (gen_random_uuid(), t, main, rc, 'closure',
     now() + interval '5 days', now() + interval '5 days 6 hours',
     'Court C resurfacing', 'scheduled', now(), now()),
    (gen_random_uuid(), t, east, gym, 'internal_use',
     now() + interval '3 days', now() + interval '3 days 3 hours',
     'Staff training session', 'scheduled', now(), now()),
    (gen_random_uuid(), t, roof, lane1, 'closure',
     now() + interval '7 days', now() + interval '7 days 2 hours',
     'Lane rope replacement (superseded)', 'cancelled', now(), now());

  RAISE NOTICE 'catalog bulk data seeded';
END $$;

-- ---------- consent records (waiver versions + acknowledgments/signatures) ----------
DO $$
DECLARE
  t    uuid := (SELECT id FROM tenants WHERE code = 'acme');
  i    int;
  players uuid[] := (SELECT array_agg(x.id) FROM (SELECT id FROM iam_users WHERE scope='platform' AND tenant_id IS NULL ORDER BY created_at LIMIT 12) x);
  guests  uuid[] := (SELECT array_agg(id) FROM guest_contacts WHERE tenant_id = t LIMIT 10);
  r1 uuid := (SELECT id FROM venue_facility_rules WHERE tenant_id = t AND title = 'Proper sports attire required');
  r2 uuid := (SELECT id FROM venue_facility_rules WHERE tenant_id = t AND title = 'No food or glass on court');
  r3 uuid := (SELECT id FROM venue_facility_rules WHERE tenant_id = t AND title = 'Gym floor booking etiquette');
  w1 uuid := (SELECT id FROM venue_waiver_documents WHERE tenant_id = t AND title = 'General Liability Waiver');
  w2 uuid := (SELECT id FROM venue_waiver_documents WHERE tenant_id = t AND title = 'Court Safety Waiver');
  v1 uuid; v2 uuid;
  guardian uuid := (SELECT id FROM iam_users WHERE scope='platform' AND tenant_id IS NULL LIMIT 1);
  minors text[] := ARRAY['Jamie Santos','Alex Cruz','Nico Lim','Sam Villanueva'];
BEGIN
  IF t IS NULL THEN
    RAISE EXCEPTION 'acme tenant missing';
  END IF;
  IF EXISTS (SELECT 1 FROM consent_records WHERE tenant_id = t) THEN
    RAISE NOTICE 'consent bulk data already seeded — skipping';
    RETURN;
  END IF;

  -- Published versions for the two active waiver documents.
  v1 := gen_random_uuid(); v2 := gen_random_uuid();
  INSERT INTO venue_waiver_versions (id, tenant_id, document_id, version, body, status, created_at)
  VALUES
    (v1, t, w1, 1, 'General Liability Waiver v1 — by participating you accept the venue rules and assume ordinary risk of play.', 'published', now() - interval '40 days'),
    (v2, t, w2, 2, 'Court Safety Waiver v2 — updated footwear requirement and minors clause.', 'published', now() - interval '12 days');

  -- Facility rule acknowledgments: 12 across 3 published rules.
  FOR i IN 1..12 LOOP
    INSERT INTO consent_records
      (id, tenant_id, kind, facility_rule_id, facility_rule_version,
       user_id, guest_contact_id, participant_name, guardian_user_id,
       covered_action, covered_id, created_at)
    VALUES
      (gen_random_uuid(), t, 'facility_rule',
       CASE i % 3 WHEN 0 THEN r1 WHEN 1 THEN r2 ELSE r3 END,
       CASE i % 3 WHEN 0 THEN 1 WHEN 1 THEN 1 ELSE 2 END,
       CASE WHEN i % 4 <> 0 THEN players[(i % array_length(players,1)) + 1] END,
       CASE WHEN i % 4 = 0 THEN guests[(i % array_length(guests,1)) + 1] END,
       NULL, NULL,
       'reservation', NULL,
       now() - (i * 3 || ' hours')::interval);
  END LOOP;

  -- Waiver signatures: 9 adults + 3 minors with guardian.
  FOR i IN 1..9 LOOP
    INSERT INTO consent_records
      (id, tenant_id, kind, waiver_document_id, waiver_version_id,
       user_id, guest_contact_id, participant_name, guardian_user_id,
       covered_action, covered_id, created_at)
    VALUES
      (gen_random_uuid(), t, 'waiver',
       CASE WHEN i % 3 = 0 THEN w2 ELSE w1 END,
       CASE WHEN i % 3 = 0 THEN v2 ELSE v1 END,
       CASE WHEN i % 4 <> 0 THEN players[(i % array_length(players,1)) + 1] END,
       CASE WHEN i % 4 = 0 THEN guests[(i % array_length(guests,1)) + 1] END,
       NULL, NULL,
       'reservation', NULL,
       now() - (i * 7 || ' hours')::interval);
  END LOOP;
  FOR i IN 1..3 LOOP
    INSERT INTO consent_records
      (id, tenant_id, kind, waiver_document_id, waiver_version_id,
       user_id, guest_contact_id, participant_name, guardian_user_id,
       covered_action, covered_id, created_at)
    VALUES
      (gen_random_uuid(), t, 'waiver', w1, v1,
       NULL, NULL,
       minors[i], guardian,
       'reservation', NULL,
       now() - (i * 11 || ' hours')::interval);
  END LOOP;

  RAISE NOTICE 'consent bulk data seeded';
END $$;

-- ---------- today's front-desk bookings (dashboard/schedule grid demo) ----------
DO $$
DECLARE
  t    uuid := (SELECT id FROM tenants WHERE code = 'acme');
  v    uuid;
  facs uuid[];
  pids uuid[];
  gids uuid[];
  i    int;
  st   text;
  sts  text[] := ARRAY[
    'confirmed','confirmed','confirmed','confirmed','confirmed',
    'confirmed','confirmed','confirmed','confirmed','confirmed',
    'approved','pending_approval','completed','no_show','cancelled'];
BEGIN
  IF t IS NULL THEN
    RAISE EXCEPTION 'acme tenant missing';
  END IF;
  IF EXISTS (SELECT 1 FROM reservations WHERE tenant_id = t AND reference_no LIKE 'DESK-%') THEN
    RAISE NOTICE 'desk-today data already seeded — skipping';
    RETURN;
  END IF;

  SELECT id INTO v FROM venues WHERE tenant_id = t ORDER BY created_at LIMIT 1;
  SELECT array_agg(id ORDER BY name) INTO facs FROM venue_resources WHERE tenant_id = t;
  SELECT array_agg(id) INTO pids FROM (SELECT id FROM iam_users WHERE scope = 'platform' AND tenant_id IS NULL ORDER BY created_at LIMIT 10) x;
  SELECT array_agg(id) INTO gids FROM guest_contacts WHERE tenant_id = t LIMIT 10;

  FOR i IN 1..15 LOOP
    st := sts[i];
    INSERT INTO reservations
      (uuid, reference_no, tenant_id, venue_id, resource_id, activity_id,
       player_id, guest_contact_id, status, starts_at, ends_at, party_size,
       payment_state, notes, created_at, updated_at)
    VALUES
      (gen_random_uuid(), 'DESK-' || lpad(i::text, 3, '0'), t, v,
       facs[1 + ((i - 1) % array_length(facs, 1))], NULL,
       CASE WHEN i % 4 <> 0 THEN pids[1 + ((i - 1) % array_length(pids, 1))] END,
       CASE WHEN i % 4 = 0 THEN gids[1 + ((i - 1) % array_length(gids, 1))] END,
       st,
       CURRENT_DATE + ((6 + i) || ' hours')::interval,
       CURRENT_DATE + ((6 + i) || ' hours')::interval + interval '1 hour',
       1 + (i % 4),
       CASE WHEN st IN ('confirmed', 'completed') THEN 'paid'
            WHEN st = 'pending_approval' THEN 'pending_payment'
            ELSE 'none' END,
       NULL,
       now() - interval '2 days', now());
  END LOOP;

  RAISE NOTICE 'desk-today seeded';
END $$;
