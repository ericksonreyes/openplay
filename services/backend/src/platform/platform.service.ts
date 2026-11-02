import { Injectable } from '@nestjs/common';
import { ActorContextService } from '../common/auth/actor-context.service';
import { AuditService } from '../common/audit/audit.service';
import { RecordNotFoundException } from '../common/errors/api-error';
import { ScopedPrisma } from '../prisma/scoped-prisma.service';

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: ScopedPrisma,
    private readonly actorContext: ActorContextService,
    private readonly audit: AuditService,
  ) {}

  async listUsers(filter: { tenantId?: string; scope?: string }) {
    const tx = this.prisma.client;
    const users = await tx.iamUser.findMany({
      where: {
        ...(filter.scope ? { scope: filter.scope } : {}),
        ...(filter.tenantId ? { tenantId: filter.tenantId } : {}),
      },
      include: { roles: { include: { role: true } }, tenant: { select: { code: true } } },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    return users.map((u) => ({
      type: 'user',
      id: u.id,
      attributes: {
        scope: u.scope,
        username: u.username,
        email: u.email,
        display_name: u.displayName,
        tenant_code: u.tenant?.code ?? null,
        roles: u.roles.map((r) => r.role.key),
        suspended: u.suspendedAt !== null,
        created_at: u.createdAt,
      },
    }));
  }

  async getUser(id: string) {
    const tx = this.prisma.client;
    const u = await tx.iamUser.findFirst({ where: { id } });
    if (!u) throw new RecordNotFoundException();
    const roles = await tx.iamUserRole.findMany({
      where: { userId: u.id },
      include: { role: true },
    });
    return {
      type: 'user' as const,
      id: u.id,
      attributes: {
        scope: u.scope,
        username: u.username,
        email: u.email,
        display_name: u.displayName,
        roles: roles.map((r) => r.role.key),
        suspended: u.suspendedAt !== null,
        suspended_at: u.suspendedAt,
        created_at: u.createdAt,
      },
    };
  }

  async setSuspended(id: string, suspended: boolean) {
    const actor = this.actorContext.actor;
    const tx = this.prisma.client;
    const user = await tx.iamUser.findUnique({ where: { id } });
    if (!user) throw new RecordNotFoundException();
    await tx.iamUser.update({
      where: { id },
      data: { suspendedAt: suspended ? new Date() : null },
    });
    await this.audit.append(tx, actor, {
      streamType: 'user',
      streamId: id,
      eventType: suspended ? 'user.suspended' : 'user.unsuspended',
      tenantId: user.tenantId ?? undefined,
      payload: { user_id: id, scope: user.scope },
      metadata: { purpose: 'platform administration' },
    });
    return { type: 'user', id, attributes: { suspended } };
  }
}
