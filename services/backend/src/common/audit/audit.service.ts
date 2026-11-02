import { BadRequestException, Injectable } from '@nestjs/common';
import { SystemContextService } from '../context/system-context.service';
import { PrismaClient } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import { RequestActor } from '../auth/actor';

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

const SECRET_KEYS = /password|secret|token|private[_-]?key|authorization|credential|api[_-]?key/i;

export interface AuditEventInput {
  streamType: string;
  streamId: string;
  eventType: string;
  tenantId?: string;
  onBehalfOf?: string;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

const containsSecretKeys = (value: unknown, depth = 0): boolean => {
  if (depth > 6 || value === null || typeof value !== 'object') {
    return false;
  }
  return Object.entries(value as Record<string, unknown>).some(
    ([k, v]) => SECRET_KEYS.test(k) || containsSecretKeys(v, depth + 1),
  );
};

/**
 * Appends to the audit event stream inside the caller's transaction.
 * The action and its event commit or roll back together.
 */
@Injectable()
export class AuditService {
  constructor(private readonly system: SystemContextService) {}

  async append(tx: Tx, actor: RequestActor, input: AuditEventInput): Promise<void> {
    if (containsSecretKeys(input.payload) || containsSecretKeys(input.metadata)) {
      throw new BadRequestException('audit events must not contain secret fields');
    }
    const metadata = { ...(input.metadata ?? {}) };
    // Platform actors touching tenant data must state a purpose (AUDIT_LOGGING).
    if (actor.isPlatform && input.tenantId && !metadata.purpose) {
      throw new BadRequestException('metadata.purpose is required for platform access to tenant data');
    }

    const [{ next }] = await this.system.run((sys) =>
      sys.$queryRaw<[{ next: bigint }]>`
      SELECT COALESCE(MAX("sequence"), 0) + 1 AS next
      FROM "audit_events"
        WHERE "stream_type" = ${input.streamType} AND "stream_id" = ${input.streamId}::uuid
      `,
    );

    await tx.auditEvent.create({
      data: {
        id: uuidv7(),
        tenantId: input.tenantId ?? actor.tenantId ?? null,
        streamType: input.streamType,
        streamId: input.streamId,
        sequence: next,
        eventType: input.eventType,
        actorId: actor.userId ?? null,
        actorKind: actor.isSystem ? 'system' : actor.isPlatform ? 'platform' : actor.isPublic ? 'guest' : 'business',
        onBehalfOf: input.onBehalfOf ?? null,
        payload: input.payload as object,
        metadata: { request_id: metadata.request_id ?? null, jti: actor.jti ?? null, ...metadata },
      },
    });
  }
}
