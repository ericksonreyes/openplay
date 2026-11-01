/**
 * Commerce demo fixtures for the 'acme' tenant: one active membership
 * plan, one equipment item, and one captured payment. Runnable via
 * `tsx prisma/seed-commerce.ts`. Idempotent — existing records (matched
 * by deterministic names/references) are left untouched.
 *
 * Uses raw SQL so it works before the generated Prisma client includes
 * the commerce models (schema merge happens in the orchestrator step).
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

async function ensureMembershipPlan(tx: Tx, tenantId: string): Promise<string> {
  const existing = await tx.$queryRaw<[{ id: string }]>`
    SELECT id FROM membership_plans
    WHERE tenant_id = ${tenantId}::uuid AND name = 'Acme Monthly' LIMIT 1
  `;
  if (existing[0]) return existing[0].id;
  const id = uuidv7();
  await tx.$executeRaw`
    INSERT INTO membership_plans
      (id, tenant_id, venue_id, include_future_venues, name, description,
       price_cents, currency, term_days, term_end_rule, billing_type,
       interval_days, benefits, status, created_at, updated_at)
    VALUES (
      ${id}::uuid, ${tenantId}::uuid, NULL, true, 'Acme Monthly',
      'All-venues monthly membership (demo)',
      50000, 'PHP', 30, 'term', 'recurring', 30,
      ${JSON.stringify({ discount_pct: 10, early_booking_days: 3 })}::jsonb,
      'active', now(), now()
    )
  `;
  return id;
}

async function ensureEquipmentItem(tx: Tx, tenantId: string): Promise<string> {
  const existing = await tx.$queryRaw<[{ id: string }]>`
    SELECT id FROM equipment_items
    WHERE tenant_id = ${tenantId}::uuid AND name = 'Demo Paddle Set' LIMIT 1
  `;
  if (existing[0]) return existing[0].id;
  const id = uuidv7();
  await tx.$executeRaw`
    INSERT INTO equipment_items
      (id, tenant_id, name, description, total_stock, price_cents, currency,
       unit, status, created_at, updated_at)
    VALUES (
      ${id}::uuid, ${tenantId}::uuid, 'Demo Paddle Set',
      'Four paddles + balls', 6, 15000, 'PHP', 'booking', 'active',
      now(), now()
    )
  `;
  return id;
}

async function ensureCapturedPayment(tx: Tx, tenantId: string): Promise<void> {
  const existing = await tx.$queryRaw<[{ id: bigint }]>`
    SELECT id FROM payments
    WHERE tenant_id = ${tenantId}::uuid AND reference = 'PAY-00001' LIMIT 1
  `;
  if (existing[0]) return;
  await tx.$executeRaw`
    INSERT INTO payments
      (stream_id, tenant_id, payer_id, reference, purpose, amount_cents,
       currency, method, status, provider, provider_checkout_id,
       provider_payment_id, checkout_url, captured_at, details,
       created_at, updated_at)
    VALUES (
      ${uuidv7()}::uuid, ${tenantId}::uuid, ${uuidv7()}::uuid, 'PAY-00001',
      'membership', 50000, 'PHP', 'gcash', 'captured', 'gcash',
      'chk_gcash_demo', 'pay_gcash_demo',
      'https://stub.pay.local/gcash/checkout/chk_gcash_demo', now(),
      ${JSON.stringify({ line_items: [{ label: 'Acme Monthly', amount_cents: 50000 }] })}::jsonb,
      now(), now()
    )
  `;
  await tx.$executeRaw`
    INSERT INTO reference_counters (tenant_id, kind, value)
    VALUES (${tenantId}::uuid, 'payment', 1)
    ON CONFLICT (tenant_id, kind) DO NOTHING
  `;
}

async function main(): Promise<void> {
  // Seed runs as openplay_app; claim system context (same mechanism as
  // RlsContextInterceptor) so RLS lets the fixtures in.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.is_system', 'true', true)`;
    const tenantId = await tenantIdFor(tx, 'acme');
    await ensureMembershipPlan(tx, tenantId);
    await ensureEquipmentItem(tx, tenantId);
    await ensureCapturedPayment(tx, tenantId);
  });
  console.log('commerce demo fixtures applied for tenant "acme"');
}

main().finally(() => prisma.$disconnect());
