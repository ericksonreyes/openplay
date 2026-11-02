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
    recipient_address: n.recipient_address,
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
  async list(
    actor: RequestActor,
    opts: {
      status?: string;
      limit?: number;
      from?: string;
      to?: string;
      q?: string;
      sort?: string;
    },
  ) {
    if (!actor.tenantId) {
      throw new RecordNotFoundException();
    }
    const limit = Math.min(Math.max(opts.limit ?? 25, 1), 100);
    const conds = [Prisma.sql`"tenant_id" = ${actor.tenantId}::uuid`];
    if (opts.status) conds.push(Prisma.sql`"status" = ${opts.status}`);
    if (opts.from) conds.push(Prisma.sql`"created_at" >= ${opts.from + 'T00:00:00Z'}::timestamptz`);
    if (opts.to) conds.push(Prisma.sql`"created_at" < (${opts.to + 'T00:00:00Z'}::timestamptz + interval '1 day')`);
    if (opts.q) {
      const needle = `%${opts.q}%`;
      conds.push(Prisma.sql`("recipient_address" ILIKE ${needle} OR "kind" ILIKE ${needle})`);
    }
    const sortable: Record<string, string> = {
      channel: 'channel', kind: 'kind', status: 'status',
      recipient_address: 'recipient_address', created_at: 'created_at',
      sent_at: 'sent_at',
    };
    const desc = (opts.sort ?? '').startsWith('-');
    const key = desc ? (opts.sort ?? '').slice(1) : (opts.sort ?? '');
    const col = sortable[key] ?? 'created_at';
    const dir = opts.sort ? (desc ? Prisma.sql`DESC` : Prisma.sql`ASC`) : Prisma.sql`DESC`;
    const rows = await this.scoped.client.$queryRaw<NotificationRow[]>(Prisma.sql`
      SELECT ${COLUMNS} FROM "notifications"
      WHERE ${Prisma.join(conds, ' AND ')}
      ORDER BY ${Prisma.raw(col)} ${dir}
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
