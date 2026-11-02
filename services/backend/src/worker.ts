/**
 * Reminder worker (implementation plan: backend/NOTIFICATIONS.MD; ADR-0003
 * "Local reminder simulation"). Runs under the `notifications` compose
 * profile via `npm run worker:dev`; the API process never starts a scheduler.
 *
 * Each scan claims due reminders inside a system-context transaction using
 * SELECT ... FOR UPDATE SKIP LOCKED (safe for --scale reminder-worker=N),
 * sends via SMTP (Mailpit locally), then records sent/failed. A terminal
 * failure commits reminder.status='failed' plus a 'reminder.failed' audit
 * event in its own transaction. Never mutates booking/payment/event state.
 */
import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as nodemailer from 'nodemailer';
import { RequestActor } from './common/auth/actor';
import { AuditService } from './common/audit/audit.service';
import { SystemContextService } from './common/context/system-context.service';
import { PrismaService } from './prisma/prisma.service';
import { loadEnv } from './config/env';
import {
  claimDueReminders,
  CLAIM_BATCH_SIZE,
  DueReminderRow,
  markReminderFailed,
  markReminderSent,
} from './notifications/reminders';
import { renderNotification } from './notifications/templates';

const systemActor: RequestActor = {
  roles: [],
  permissions: [],
  venueIds: [],
  isPlatform: false,
  isSystem: true,
  isPublic: false,
};

const int = (name: string, fallback: number): number => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = new Logger('ReminderWorker');
  const prisma = new PrismaClient();
  const audit = new AuditService(new SystemContextService(prisma as unknown as PrismaService));
  const scanIntervalMs = int('REMINDER_SCAN_INTERVAL_MS', 5000);

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'mailpit',
    port: int('SMTP_PORT', 1025),
    secure: false,
  });
  const mailFrom = process.env.MAIL_FROM ?? 'no-reply@openplay.local';

  /** Claims a batch under app.is_system; locks are released at commit. */
  const claim = () =>
    prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.is_system', 'true', true)`;
      return claimDueReminders(tx);
    });

  const finalizeSent = (row: DueReminderRow) =>
    prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.is_system', 'true', true)`;
      await markReminderSent(tx, row);
    });

  const finalizeFailed = (row: DueReminderRow, error: string) =>
    prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.is_system', 'true', true)`;
      await markReminderFailed(tx, audit, systemActor, row, error);
    });

  const deliver = async (row: DueReminderRow): Promise<void> => {
    const message = renderNotification(row.kind, row.payload);
    if (row.channel === 'email') {
      if (!row.recipient_address) {
        throw new Error('email reminder has no recipient_address');
      }
      await transport.sendMail({
        from: mailFrom,
        to: row.recipient_address,
        subject: message.subject,
        text: message.text,
        headers: { 'X-Idempotency-Key': row.idempotency_key },
      });
    }
    // in_app notices are record-only; sms/push are deferred per spec.
  };

  const scan = async (): Promise<void> => {
    const claimed = await claim();
    for (const row of claimed) {
      try {
        await deliver(row);
        await finalizeSent(row);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        logger.warn(`reminder ${row.id} failed: ${detail}`);
        try {
          await finalizeFailed(row, detail);
        } catch (auditError) {
          logger.error(`reminder ${row.id}: failed to record failure: ${auditError}`);
        }
      }
    }
    if (claimed.length > 0) {
      logger.log(`processed ${claimed.length} reminder(s)`);
    }
  };

  logger.log(
    `reminder worker started (db=${env.databaseUrl.split('@').pop()}, ` +
      `interval=${scanIntervalMs}ms, batch=${CLAIM_BATCH_SIZE})`,
  );
  setInterval(() => {
    void scan().catch((error) => logger.error(`scan failed: ${error}`));
  }, scanIntervalMs);
  void scan().catch((error) => logger.error(`scan failed: ${error}`));
}

main().catch((error) => {
  console.error('reminder worker fatal error', error);
  process.exit(1);
});
