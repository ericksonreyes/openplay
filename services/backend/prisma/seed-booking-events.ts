/**
 * Booking/events demo fixtures for the 'acme' tenant: one published Open Play
 * event (occupying Court A) and one confirmed reservation on Court B, owned
 * by a seeded demo player account.
 * Runnable via `tsx prisma/seed-booking-events.ts`. Idempotent — records are
 * matched by deterministic identifiers and left untouched when present.
 *
 * Uses raw SQL so it works before the generated Prisma client includes the
 * booking/events models (schema merge happens in the orchestrator step).
 */
import { PrismaClient } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';

const prisma = new PrismaClient();

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

const DEMO_EVENT_ID = '01950000-0000-7000-8000-0000000000e1';
const DEMO_RESERVATION_UUID = '01950000-0000-7000-8000-0000000000b1';
const DEMO_PLAYER_ID = '01950000-0000-7000-8000-0000000000d1';

async function lookup(tx: Tx, sql: string): Promise<string | null> {
  const rows = await tx.$queryRawUnsafe<[{ id: string }]>(sql);
  return rows[0]?.id ?? null;
}

async function ensurePlayer(tx: Tx, tenantId: string): Promise<string> {
  const existing = await lookup(
    tx,
    `SELECT id FROM iam_users WHERE scope = 'platform' AND username = 'demo.player' LIMIT 1`,
  );
  if (existing) return existing;
  await tx.$executeRaw`
    INSERT INTO iam_users (id, scope, username, display_name, tenant_id, created_at, updated_at)
    VALUES (${DEMO_PLAYER_ID}::uuid, 'platform', 'demo.player', 'Demo Player', NULL, now(), now())
    ON CONFLICT DO NOTHING
  `;
  void tenantId;
  return DEMO_PLAYER_ID;
}

async function ensureEvent(tx: Tx, tenantId: string, venueId: string, resourceId: string, activityId: string | null): Promise<void> {
  const existing = await lookup(tx, `SELECT id FROM events WHERE id = '${DEMO_EVENT_ID}' LIMIT 1`);
  if (existing) return;
  const startsAt = new Date(Date.now() + 3 * 24 * 3_600_000);
  startsAt.setUTCMinutes(0, 0, 0);
  const endsAt = new Date(startsAt.getTime() + 2 * 3_600_000);
  await tx.$executeRaw`
    INSERT INTO events (
      id, tenant_id, venue_id, activity_id, name, description, format, status, visibility,
      starts_at, ends_at, buffer_minutes, capacity, capacity_unit, fee_cents, currency,
      fee_basis, payment_timing, waitlist_enabled, results_enabled, details, created_at, updated_at
    ) VALUES (
      ${DEMO_EVENT_ID}::uuid, ${tenantId}::uuid, ${venueId}::uuid, ${activityId}::uuid,
      'Open Play — Pickleball Evening', 'Demo open-play session', 'open_play', 'published', 'public',
      ${startsAt}, ${endsAt}, 10, 12, 'participant', 0, 'USD',
      'participant', 'free', true, false, ${JSON.stringify({ resource_ids: [resourceId] })}::jsonb,
      now(), now()
    )
  `;
  await tx.$executeRaw`
    INSERT INTO resource_allocations
      (id, tenant_id, resource_id, owner_type, owner_id, starts_at, ends_at, expires_at, created_at)
    VALUES (
      ${uuidv7()}::uuid, ${tenantId}::uuid, ${resourceId}::uuid, 'event', ${DEMO_EVENT_ID}::uuid,
      ${startsAt}, ${new Date(endsAt.getTime() + 10 * 60_000)}, NULL, now()
    )
  `;
}

async function ensureReservation(tx: Tx, tenantId: string, venueId: string, resourceId: string, activityId: string | null, playerId: string): Promise<void> {
  const existing = await lookup(tx, `SELECT uuid AS id FROM reservations WHERE uuid = '${DEMO_RESERVATION_UUID}' LIMIT 1`);
  if (existing) return;
  const startsAt = new Date(Date.now() + 2 * 24 * 3_600_000);
  startsAt.setUTCMinutes(0, 0, 0);
  const endsAt = new Date(startsAt.getTime() + 3_600_000);
  await tx.$executeRaw`
    INSERT INTO reservations (
      uuid, tenant_id, venue_id, resource_id, activity_id, player_id, status,
      starts_at, ends_at, buffer_minutes, party_size, payment_state, created_by, created_at, updated_at
    ) VALUES (
      ${DEMO_RESERVATION_UUID}::uuid, ${tenantId}::uuid, ${venueId}::uuid, ${resourceId}::uuid,
      ${activityId}::uuid, ${playerId}::uuid, 'confirmed',
      ${startsAt}, ${endsAt}, 10, 2, 'none', ${playerId}::uuid, now(), now()
    )
  `;
  await tx.$executeRaw`
    UPDATE "reservations"
    SET "reference_no" = 'RES-' || lpad("id"::text, 6, '0')
    WHERE "uuid" = ${DEMO_RESERVATION_UUID}::uuid
  `;
  await tx.$executeRaw`
    INSERT INTO resource_allocations
      (id, tenant_id, resource_id, owner_type, owner_id, starts_at, ends_at, expires_at, created_at)
    VALUES (
      ${uuidv7()}::uuid, ${tenantId}::uuid, ${resourceId}::uuid, 'reservation', ${DEMO_RESERVATION_UUID}::uuid,
      ${startsAt}, ${new Date(endsAt.getTime() + 10 * 60_000)}, NULL, now()
    )
  `;
}

async function main(): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.is_system', 'true', true)`;
    const tenantId = await lookup(tx, `SELECT id FROM tenants WHERE code = 'acme' LIMIT 1`);
    if (!tenantId) throw new Error('tenant "acme" not found — run seed-venue-catalog first');
    const venueId = await lookup(tx, `SELECT id FROM venues WHERE tenant_id = '${tenantId}' AND name = 'Acme Main Hall' LIMIT 1`);
    const courtA = await lookup(tx, `SELECT id FROM venue_resources WHERE tenant_id = '${tenantId}' AND name = 'Court A' LIMIT 1`);
    const courtB = await lookup(tx, `SELECT id FROM venue_resources WHERE tenant_id = '${tenantId}' AND name = 'Court B' LIMIT 1`);
    const activityId = await lookup(tx, `SELECT id FROM venue_activities WHERE tenant_id = '${tenantId}' AND code = 'pickleball' LIMIT 1`);
    if (!venueId || !courtA || !courtB) {
      throw new Error('venue resources not found — run seed-venue-catalog first');
    }
    const playerId = await ensurePlayer(tx, tenantId);
    await ensureEvent(tx, tenantId, venueId, courtA, activityId);
    await ensureReservation(tx, tenantId, venueId, courtB, activityId, playerId);
  });
  console.log('booking/events demo fixtures applied for tenant "acme"');
}

main().finally(() => prisma.$disconnect());
