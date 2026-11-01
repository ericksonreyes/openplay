import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { RequestActor } from '../common/auth/actor';
import { AuditService } from '../common/audit/audit.service';
import { SystemContextService } from '../common/context/system-context.service';
import { RecordNotFoundException } from '../common/errors/api-error';
import { newId } from '../common/ids/uuid';
import { ScopedPrisma } from '../prisma/scoped-prisma.service';
import { TenantSubmission, TransitionInput } from './tenants.validation';

type TenantRow = {
  id: string;
  code: string;
  name: string;
  status: string;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
};

interface ApplicationRow {
  owner_name: string;
  owner_email: string;
  message: string | null;
  created_at: Date;
}

const tenantResource = (t: TenantRow) => ({
  type: 'tenants',
  id: t.id,
  attributes: {
    code: t.code,
    name: t.name,
    status: t.status,
    published: t.published,
    details: (t as { details?: unknown }).details ?? {},
    created_at: t.createdAt,
    updated_at: t.updatedAt,
  },
});

@Injectable()
export class TenantsService {
  constructor(
    private readonly scoped: ScopedPrisma,
    private readonly system: SystemContextService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Public onboarding submission. Creates the tenant in `awaiting_review`
   * plus its application row and a `tenant.submitted` audit event — all in
   * one system-context transaction (no request actor exists yet). Duplicate
   * codes get the same response shape so existence is never revealed.
   */
  async submit(input: TenantSubmission, actor: RequestActor) {
    return this.system.run(async (tx) => {
      const existing = await tx.tenant.findUnique({ where: { code: input.code } });
      if (existing) {
        // Non-revealing: same acceptance shape, no record created.
        return {
          type: 'tenant_submission',
          id: newId(),
          attributes: { status: 'received' },
        };
      }

      const id = newId();
      await tx.tenant.create({
        data: { id, code: input.code, name: input.name, status: 'awaiting_review' },
      });
      await tx.$executeRaw`
        INSERT INTO "tenant_applications"
          ("id", "tenant_id", "owner_name", "owner_email", "message", "created_at", "updated_at")
        VALUES (
          ${newId()}::uuid, ${id}::uuid, ${input.ownerName}, ${input.ownerEmail},
          ${input.message ?? null}, now(), now())
      `;
      await this.audit.append(tx, actor, {
        streamType: 'tenant',
        streamId: id,
        eventType: 'tenant.submitted',
        tenantId: id,
        payload: {
          code: input.code,
          name: input.name,
          owner_name: input.ownerName,
          owner_email: input.ownerEmail,
        },
      });
      return {
        type: 'tenant_submission',
        id,
        attributes: { status: 'received' },
      };
    });
  }

  /** The calling tenant actor's own business (RLS scopes it regardless). */
  async current(actor: RequestActor) {
    if (!actor.tenantId) {
      throw new RecordNotFoundException();
    }
    const tenant = await this.scoped.client.tenant.findUnique({
      where: { id: actor.tenantId },
    });
    if (!tenant) {
      throw new RecordNotFoundException();
    }
    return tenantResource(tenant);
  }

  /**
   * Owner-editable business profile fields. Only `name` and `details` are
   * writable here; status/published are platform-owned transitions.
   */
  async updateCurrent(actor: RequestActor, patch: { name?: string; details?: unknown }) {
    if (!actor.tenantId) {
      throw new RecordNotFoundException();
    }
    const tx = this.scoped.client;
    const tenant = await tx.tenant.findUnique({ where: { id: actor.tenantId } });
    if (!tenant) {
      throw new RecordNotFoundException();
    }
    const data: Record<string, unknown> = {};
    if (patch.name !== undefined) {
      const name = patch.name.trim();
      if (!name || name.length > 200) {
        throw new BadRequestException('name is required (max 200 chars)');
      }
      data.name = name;
    }
    if (patch.details !== undefined) {
      if (patch.details === null || typeof patch.details !== 'object' || Array.isArray(patch.details)) {
        throw new BadRequestException('details must be an object');
      }
      data.details = { ...(tenant.details as object), ...(patch.details as object) };
    }
    const updated = await tx.tenant.update({ where: { id: tenant.id }, data });
    await this.audit.append(tx, actor, {
      streamType: 'tenant',
      streamId: tenant.id,
      eventType: 'tenant.updated',
      tenantId: tenant.id,
      payload: { fields: Object.keys(data) },
    });
    return tenantResource(updated);
  }

  async listForPlatform(status?: string) {
    const tenants = await this.scoped.client.tenant.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return tenants.map(tenantResource);
  }

  /** Platform review view: business record plus its onboarding application. */
  async getForPlatform(id: string) {
    const tenant = await this.scoped.client.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new RecordNotFoundException();
    }
    const [application] = await this.scoped.client.$queryRaw<ApplicationRow[]>`
      SELECT "owner_name", "owner_email", "message", "created_at"
      FROM "tenant_applications"
      WHERE "tenant_id" = ${id}::uuid
      LIMIT 1
    `;
    const resource = tenantResource(tenant);
    return {
      ...resource,
      attributes: {
        ...resource.attributes,
        application: application
          ? {
              owner_name: application.owner_name,
              owner_email: application.owner_email,
              message: application.message,
              submitted_at: application.created_at,
            }
          : null,
      },
    };
  }

  /**
   * approve | suspend | restore — audited on the request transaction so the
   * status change and its event commit together. `metadata.purpose` is set
   * for platform actors per AUDIT_LOGGING.
   */
  async transition(
    id: string,
    action: 'approve' | 'suspend' | 'restore',
    input: TransitionInput,
    actor: RequestActor,
  ) {
    const tx = this.scoped.client;
    const tenant = await tx.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new RecordNotFoundException();
    }

    const allowed: Record<typeof action, { from: string[]; to: string; event: string }> = {
      approve: { from: ['setup', 'awaiting_review'], to: 'active', event: 'tenant.approved' },
      suspend: { from: ['active'], to: 'suspended', event: 'tenant.suspended' },
      restore: { from: ['suspended'], to: 'active', event: 'tenant.restored' },
    };
    const rule = allowed[action];
    if (!rule.from.includes(tenant.status)) {
      throw new ConflictException(
        `cannot ${action} a tenant in status '${tenant.status}'`,
      );
    }

    const updated = await tx.tenant.update({
      where: { id },
      data: { status: rule.to },
    });
    await this.audit.append(tx, actor, {
      streamType: 'tenant',
      streamId: id,
      eventType: rule.event,
      tenantId: id,
      payload: {
        code: tenant.code,
        previous_status: tenant.status,
        status: rule.to,
        ...(input.reason ? { reason: input.reason } : {}),
      },
      metadata: { purpose: input.purpose },
    });
    return tenantResource(updated);
  }
}
