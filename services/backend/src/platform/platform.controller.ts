import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ActorContextService } from '../common/auth/actor-context.service';
import { AuditService } from '../common/audit/audit.service';
import { RequirePermissions } from '../common/auth/require-permissions.decorator';
import { ParseUuidPipe } from '../common/ids/parse-id.pipes';
import { ScopedPrisma } from '../prisma/scoped-prisma.service';
import { PlatformService } from './platform.service';

/** Platform-scope administration: users, audit read, settings. */
@Controller('platform')
export class PlatformController {
  constructor(
    private readonly platform: PlatformService,
    private readonly prisma: ScopedPrisma,
    private readonly actorContext: ActorContextService,
    private readonly audit: AuditService,
  ) {}

  @Get('users')
  @RequirePermissions('platform.settings.manage')
  users(@Query('tenant_id') tenantId?: string, @Query('scope') scope?: string) {
    return this.platform.listUsers({ tenantId, scope });
  }

  @Post('users/:id/suspend')
  @RequirePermissions('platform.settings.manage')
  suspend(@Param('id', ParseUuidPipe) id: string) {
    return this.platform.setSuspended(id, true);
  }

  @Post('users/:id/unsuspend')
  @RequirePermissions('platform.settings.manage')
  unsuspend(@Param('id', ParseUuidPipe) id: string) {
    return this.platform.setSuspended(id, false);
  }

  /**
   * Cross-tenant audit read — AUDIT_LOGGING requires an explicit purpose
   * recorded alongside platform access; refuse the query without one.
   */
  @Get('audit-events')
  @RequirePermissions('platform.tenants.manage')
  async auditEvents(
    @Query('purpose') purpose: string | undefined,
    @Query('stream_type') streamType?: string,
    @Query('stream_id') streamId?: string,
    @Query('tenant_id') tenantId?: string,
    @Query('limit') limit?: string,
  ) {
    if (!purpose?.trim()) {
      throw new BadRequestException('purpose query param is required for audit reads');
    }
    const actor = this.actorContext.actor;
    const tx = this.prisma.client;
    const events = await tx.auditEvent.findMany({
      where: {
        ...(streamType ? { streamType } : {}),
        ...(streamId ? { streamId } : {}),
        ...(tenantId ? { tenantId } : {}),
      },
      orderBy: [{ occurredAt: 'desc' }],
      take: Math.min(Math.max(parseInt(limit ?? '50', 10) || 50, 1), 200),
    });
    await this.audit.append(tx, actor, {
      streamType: 'audit_read',
      streamId: actor.userId!,
      eventType: 'audit.read',
      tenantId: undefined,
      payload: {
        purpose,
        filters: { stream_type: streamType, stream_id: streamId, tenant_id: tenantId },
      },
      metadata: { purpose },
    });
    return events.map((e) => ({
      type: 'audit-event',
      id: e.id,
      attributes: {
        tenant_id: e.tenantId,
        stream_type: e.streamType,
        stream_id: e.streamId,
        sequence: String(e.sequence),
        event_type: e.eventType,
        actor_id: e.actorId,
        actor_kind: e.actorKind,
        payload: e.payload,
        metadata: e.metadata,
        occurred_at: e.occurredAt,
      },
    }));
  }

  @Get('settings')
  @RequirePermissions('platform.settings.manage')
  async settings() {
    const rows = await this.prisma.client.platformSetting.findMany();
    return rows.map((r) => ({
      type: 'platform-setting',
      id: r.key,
      attributes: { value: r.value, updated_at: r.updatedAt },
    }));
  }

  @Patch('settings/:key')
  @RequirePermissions('platform.settings.manage')
  async setSetting(@Param('key') key: string, @Body() body: Record<string, unknown>) {
    if (!key || key.length > 100) throw new BadRequestException('invalid setting key');
    const actor = this.actorContext.actor;
    const tx = this.prisma.client;
    const value = body?.value ?? {};
    const row = await tx.platformSetting.upsert({
      where: { key },
      create: { key, value: value as object, updatedBy: actor.userId },
      update: { value: value as object, updatedBy: actor.userId },
    });
    await this.audit.append(tx, actor, {
      streamType: 'platform_setting',
      streamId: actor.userId!,
      eventType: 'platform_setting.updated',
      tenantId: undefined,
      payload: { key, value },
      metadata: { purpose: 'platform admin' },
    });
    return { type: 'platform-setting', id: row.key, attributes: { value: row.value, updated_at: row.updatedAt } };
  }
}
