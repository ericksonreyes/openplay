/**
 * Demo seed for the notifications module: one pending notification for the
 * `acme` demo tenant plus one pending reminder due ~30s out (for the local
 * reminder-worker / Mailpit flow in ADR-0003). Idempotent — safe to re-run.
 *
 * Run: `tsx prisma/seed-notifications.ts` (or `docker compose run --rm npm
 * exec tsx prisma/seed-notifications.ts`). Requires the 000000000005
 * migration and the acme demo tenant (SEED_DEMO seed).
 */
import { PrismaClient } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const acme = await prisma.tenant.findUnique({ where: { code: 'acme' } });
  if (!acme) {
    console.log('acme tenant not found — run `npm run db:seed` with SEED_DEMO=true first');
    return;
  }

  await prisma.$executeRaw`
    INSERT INTO "notifications"
      ("id", "tenant_id", "recipient_user_id", "recipient_address", "channel",
       "kind", "payload", "status", "idempotency_key", "created_at", "updated_at")
    VALUES (
      ${uuidv7()}::uuid, ${acme.id}::uuid, NULL, 'acme.owner@demo.openplay.test',
      'in_app', 'venue.alert', ${JSON.stringify({ link: 'https://openplay.local/app' })}::jsonb,
      'pending', 'demo:acme:welcome', now(), now())
    ON CONFLICT ("idempotency_key") DO NOTHING
  `;

  await prisma.$executeRaw`
    INSERT INTO "reminders"
      ("id", "tenant_id", "stream_type", "stream_id", "recipient_user_id",
       "recipient_address", "channel", "kind", "payload", "due_at", "status",
       "idempotency_key", "created_at", "updated_at")
    VALUES (
      ${uuidv7()}::uuid, ${acme.id}::uuid, 'booking', ${uuidv7()}::uuid, NULL,
      'acme.owner@demo.openplay.test', 'email', 'reminder.upcoming_reservation',
      ${JSON.stringify({ link: 'https://openplay.local/app' })}::jsonb,
      now() + interval '30 seconds', 'pending', 'demo:acme:reminder', now(), now())
    ON CONFLICT ("idempotency_key") DO NOTHING
  `;

  console.log('notifications demo seed applied (1 notification, 1 reminder for acme)');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
