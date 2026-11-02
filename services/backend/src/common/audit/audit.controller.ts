import { Controller, Get, Param, Query } from '@nestjs/common';
import { ScopedPrisma } from '../../prisma/scoped-prisma.service';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { parseListQuery } from '../list-query';

/**
 * Read-side of the event-sourced audit log. A record's history is a stream
 * keyed (stream_type, stream_id); sequence orders it. Tenant-RLS scopes
 * visibility automatically.
 */
@Controller('audit')
export class AuditController {
  constructor(private readonly scoped: ScopedPrisma) {}

  @Get(':streamType/:streamId')
  @RequirePermissions('bookings.manage')
  async stream(
    @Param('streamType') streamType: string,
    @Param('streamId') streamId: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    const list = parseListQuery(query, {
      dateField: 'occurredAt',
      sortable: { sequence: 'sequence', occurred_at: 'occurredAt' },
      search: ['eventType'],
    });
    const events = await this.scoped.client.auditEvent.findMany({
      where: { streamType, streamId, ...(list.where ?? {}) },
      orderBy: list.orderBy ?? { sequence: 'asc' },
    });
    return events.map((e) => ({
      type: 'audit-event',
      id: e.id,
      attributes: {
        sequence: Number(e.sequence),
        stream_type: e.streamType,
        event_type: e.eventType,
        actor_id: e.actorId,
        actor_kind: e.actorKind,
        payload: e.payload,
        occurred_at: e.occurredAt,
      },
    }));
  }
}
