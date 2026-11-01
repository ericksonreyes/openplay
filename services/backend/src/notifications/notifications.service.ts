import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RequestActor } from '../common/auth/actor';
import { RecordNotFoundException } from '../common/errors/api-error';
import { ScopedPrisma } from '../prisma/scoped-prisma.service';

interface NotificationRow {
  id: string;
  tenant_id: string;
  recipient_user_id: string | null;
  recipient_address: string | null;
  channel: string;
  kind: string;
  payload: Record<string, unknown>;
  status: string;
  idempotency_key: string;
  sent_at: Date | null;
  failed_at: Date | null;
  error: string | null;
  created_at: Date;
}

const resource = (n: NotificationRow) => ({
  type: 'notifications',
  id: n.id,
  attributes: {
    recipient_user_id: n.recipient_user_id,
    channel: n.channel,
    kind: n.kind,
    payload: n.payload,
    status: n.status,
    sent_at: n.sent_at,
    error: n.error,
    created_at: n.created_at,
  },
});

const COLUMNS = Prisma.sql`
  "id", "tenant_id", "recipient_user_id", "recipient_address", "channel",
  "kind", "payload", "status", "idempotency_key", "sent_at", "failed_at",
  "error", "created_at"
`;

@Injectable()
export class NotificationsService {
  constructor(private readonly scoped: ScopedPrisma) {}

  /** Tenant-scoped list; RLS also enforces isolation server-side. */
  async list(actor: RequestActor, opts: { status?: string; limit?: number }) {
    if (!actor.tenantId) {
      throw new RecordNotFoundException();
    }
    const limit = Math.min(Math.max(opts.limit ?? 25, 1), 100);
    const rows = opts.status
      ? await this.scoped.client.$queryRaw<NotificationRow[]>(Prisma.sql`
          SELECT ${COLUMNS} FROM "notifications"
          WHERE "tenant_id" = ${actor.tenantId}::uuid AND "status" = ${opts.status}
          ORDER BY "created_at" DESC
          LIMIT ${limit}
        `)
      : await this.scoped.client.$queryRaw<NotificationRow[]>(Prisma.sql`
          SELECT ${COLUMNS} FROM "notifications"
          WHERE "tenant_id" = ${actor.tenantId}::uuid
          ORDER BY "created_at" DESC
          LIMIT ${limit}
        `);
    return rows.map(resource);
  }

  async get(actor: RequestActor, id: string) {
    if (!actor.tenantId) {
      throw new RecordNotFoundException();
    }
    const [row] = await this.scoped.client.$queryRaw<NotificationRow[]>(Prisma.sql`
      SELECT ${COLUMNS} FROM "notifications"
      WHERE "id" = ${id}::uuid AND "tenant_id" = ${actor.tenantId}::uuid
      LIMIT 1
    `);
    if (!row) {
      throw new RecordNotFoundException();
    }
    return resource(row);
  }
}
