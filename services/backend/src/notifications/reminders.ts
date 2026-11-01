/**
 * Reminder claim/finalize primitives shared by the reminder worker
 * (src/worker.ts) and unit tests. All functions take a transaction client;
 * callers are responsible for the `app.is_system` context and commit.
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { RequestActor } from '../common/auth/actor';
import { AuditService } from '../common/audit/audit.service';
import { newId } from '../common/ids/uuid';

/** Minimal raw-SQL surface so specs can mock the transaction. */
export interface SqlTx {
  $queryRaw<T = unknown>(query: Prisma.Sql): Promise<T>;
  $executeRaw(query: Prisma.Sql): Promise<number>;
}

type Tx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export const CLAIM_BATCH_SIZE = 50;
/** A 'claimed' row older than this is presumed abandoned (worker crash). */
export const CLAIM_STALE_MS = 5 * 60_000;

export interface DueReminderRow {
  id: string;
  tenant_id: string;
  stream_type: string;
  stream_id: string;
  recipient_user_id: string | null;
  recipient_address: string | null;
  channel: string;
  kind: string;
  payload: Record<string, unknown>;
  idempotency_key: string;
}

/**
 * Claims up to `limit` due reminders: SELECT ... FOR UPDATE SKIP LOCKED so
 * concurrent workers never take the same row, then marks them 'claimed'
 * inside the same transaction. Stale 'claimed' rows (crashed worker) are
 * re-claimed after CLAIM_STALE_MS.
 */
export async function claimDueReminders(
  tx: SqlTx,
  limit = CLAIM_BATCH_SIZE,
): Promise<DueReminderRow[]> {
  const rows = await tx.$queryRaw<DueReminderRow[]>(Prisma.sql`
    SELECT "id", "tenant_id", "stream_type", "stream_id", "recipient_user_id",
           "recipient_address", "channel", "kind", "payload", "idempotency_key"
    FROM "reminders"
    WHERE "due_at" <= now()
      AND (
        "status" = 'pending'
        OR ("status" = 'claimed'
            AND "claimed_at" < now() - (${CLAIM_STALE_MS} * interval '1 millisecond'))
      )
    ORDER BY "due_at"
    LIMIT ${limit}
    FOR UPDATE SKIP LOCKED
  `);
  if (rows.length === 0) {
    return rows;
  }
  const ids = rows.map((r) => r.id);
  await tx.$executeRaw(Prisma.sql`
    UPDATE "reminders"
    SET "status" = 'claimed', "claimed_at" = now(), "updated_at" = now()
    WHERE "id" = ANY(${ids}::uuid[])
  `);
  return rows;
}

/**
 * Marks a claimed reminder 'sent' and records the notification row in the
 * same transaction. The idempotency_key is shared, so a replayed send is a
 * no-op at the database level even if the worker retries.
 */
export async function markReminderSent(tx: SqlTx, row: DueReminderRow): Promise<void> {
  await tx.$executeRaw(Prisma.sql`
    UPDATE "reminders"
    SET "status" = 'sent', "sent_at" = now(), "updated_at" = now()
    WHERE "id" = ${row.id}::uuid
  `);
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "notifications"
      ("id", "tenant_id", "recipient_user_id", "recipient_address", "channel",
       "kind", "payload", "status", "idempotency_key", "sent_at", "created_at", "updated_at")
    VALUES (
      ${newId()}::uuid, ${row.tenant_id}::uuid, ${row.recipient_user_id}::uuid,
      ${row.recipient_address}, ${row.channel}, ${row.kind},
      ${JSON.stringify(row.payload)}::jsonb, 'sent', ${row.idempotency_key},
      now(), now(), now())
    ON CONFLICT ("idempotency_key") DO NOTHING
  `);
}

/**
 * Terminal failure: commits reminder.status='failed' plus a 'reminder.failed'
 * audit event in the caller's (catch's own) transaction, per AUDIT_LOGGING.
 * Never touches booking/payment/event/rental state.
 */
export async function markReminderFailed(
  tx: Tx,
  audit: AuditService,
  actor: RequestActor,
  row: DueReminderRow,
  error: string,
): Promise<void> {
  await tx.$executeRaw(Prisma.sql`
    UPDATE "reminders"
    SET "status" = 'failed', "failed_at" = now(), "error" = ${error},
        "updated_at" = now()
    WHERE "id" = ${row.id}::uuid
  `);
  await audit.append(tx, actor, {
    streamType: 'reminder',
    streamId: row.id,
    eventType: 'reminder.failed',
    tenantId: row.tenant_id,
    payload: {
      stream_type: row.stream_type,
      stream_id: row.stream_id,
      channel: row.channel,
      kind: row.kind,
      error,
    },
  });
}
