/**
 * Venue-catalog demo fixtures for the 'acme' tenant: one venue, two
 * resources, one activity (linked to both resources), and one facility rule.
 * Runnable via `tsx prisma/seed-venue-catalog.ts`. Idempotent — existing
 * records (matched by deterministic names/codes) are left untouched.
 *
 * Uses raw SQL so it works before the generated Prisma client includes the
 * venue_catalog models (schema merge happens in the orchestrator step).
 */
import { PrismaClient } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';

const prisma = new PrismaClient();

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

async function tenantIdFor(tx: Tx, code: string): Promise<string> {
  const existing = await tx.$queryRaw<[{ id: string }]>`
    SELECT id FROM tenants WHERE code = ${code} LIMIT 1
  `;
  if (existing[0]) return existing[0].id;
  const id = uuidv7();
  await tx.$executeRaw`
    INSERT INTO tenants (id, code, name, status, published, created_at, updated_at)
    VALUES (${id}::uuid, ${code}, 'Acme Sports Club', 'active', true, now(), now())
  `;
  return id;
}

async function ensureVenue(tx: Tx, tenantId: string): Promise<string> {
  const existing = await tx.$queryRaw<[{ id: string }]>`
    SELECT id FROM venues WHERE tenant_id = ${tenantId}::uuid AND name = 'Acme Main Hall' LIMIT 1
  `;
  if (existing[0]) return existing[0].id;
  const id = uuidv7();
  await tx.$executeRaw`
    INSERT INTO venues (id, tenant_id, name, timezone, status, address, details, created_at, updated_at)
    VALUES (
      ${id}::uuid, ${tenantId}::uuid, 'Acme Main Hall', 'Asia/Manila', 'active',
      ${JSON.stringify({ line1: '123 Court St', city: 'Makati', country: 'PH' })}::jsonb,
      ${JSON.stringify({ description: 'Demo venue' })}::jsonb,
      now(), now()
    )
  `;
  return id;
}

async function ensureResource(tx: Tx, tenantId: string, venueId: string, name: string, type: string): Promise<string> {
  const existing = await tx.$queryRaw<[{ id: string }]>`
    SELECT id FROM venue_resources
    WHERE tenant_id = ${tenantId}::uuid AND venue_id = ${venueId}::uuid AND name = ${name} LIMIT 1
  `;
  if (existing[0]) return existing[0].id;
  const id = uuidv7();
  const settings =
    type === 'court'
      ? JSON.stringify({ buffer_minutes: 10, increment_minutes: 30, duration_minutes: 60 })
      : JSON.stringify({ buffer_minutes: 0 });
  await tx.$executeRaw`
    INSERT INTO venue_resources
      (id, tenant_id, venue_id, name, resource_type, status, capacity, settings, created_at, updated_at)
    VALUES (${id}::uuid, ${tenantId}::uuid, ${venueId}::uuid, ${name}, ${type}, 'active', 4, ${settings}::jsonb, now(), now())
  `;
  return id;
}

async function ensureActivity(tx: Tx, tenantId: string, code: string, name: string): Promise<string> {
  const existing = await tx.$queryRaw<[{ id: string }]>`
    SELECT id FROM venue_activities WHERE tenant_id = ${tenantId}::uuid AND code = ${code} LIMIT 1
  `;
  if (existing[0]) return existing[0].id;
  const id = uuidv7();
  await tx.$executeRaw`
    INSERT INTO venue_activities (id, tenant_id, name, code, status, description, created_at, updated_at)
    VALUES (${id}::uuid, ${tenantId}::uuid, ${name}, ${code}, 'active', 'Demo activity', now(), now())
  `;
  return id;
}

async function ensureLink(tx: Tx, tenantId: string, activityId: string, resourceId: string): Promise<void> {
  await tx.$executeRaw`
    INSERT INTO venue_activity_resources (tenant_id, activity_id, resource_id)
    VALUES (${tenantId}::uuid, ${activityId}::uuid, ${resourceId}::uuid)
    ON CONFLICT DO NOTHING
  `;
}

async function ensureFacilityRule(tx: Tx, tenantId: string, venueId: string): Promise<void> {
  const existing = await tx.$queryRaw<[{ id: string }]>`
    SELECT id FROM venue_facility_rules
    WHERE tenant_id = ${tenantId}::uuid AND title = 'No outside food or drinks' LIMIT 1
  `;
  if (existing[0]) return;
  await tx.$executeRaw`
    INSERT INTO venue_facility_rules
      (id, tenant_id, venue_id, title, body, visibility, requires_acknowledgment, status, version, created_at, updated_at)
    VALUES (
      ${uuidv7()}::uuid, ${tenantId}::uuid, ${venueId}::uuid,
      'No outside food or drinks', 'Outside food and beverages are not allowed inside the courts.',
      'public', false, 'published', 1, now(), now()
    )
  `;
}

async function main(): Promise<void> {
  // Seed runs as openplay_app; claim system context (same mechanism as
  // RlsContextInterceptor) so RLS lets the fixtures in.
  const tenantId = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.is_system', 'true', true)`;
    const tid = await tenantIdFor(tx, 'acme');
    const venueId = await ensureVenue(tx, tid);
    const courtA = await ensureResource(tx, tid, venueId, 'Court A', 'court');
    const courtB = await ensureResource(tx, tid, venueId, 'Court B', 'court');
    const activityId = await ensureActivity(tx, tid, 'pickleball', 'Pickleball');
    await ensureLink(tx, tid, activityId, courtA);
    await ensureLink(tx, tid, activityId, courtB);
    await ensureFacilityRule(tx, tid, venueId);
    return tid;
  });
  void tenantId;
  console.log('venue-catalog demo fixtures applied for tenant "acme"');
}

main().finally(() => prisma.$disconnect());
