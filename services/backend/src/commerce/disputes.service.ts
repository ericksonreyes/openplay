import { BadRequestException, Injectable } from '@nestjs/common';
import { ActorContextService } from '../common/auth/actor-context.service';
import { RequestActor } from '../common/auth/actor';
import { AuditService } from '../common/audit/audit.service';
import { RecordNotFoundException } from '../common/errors/api-error';
import { newId } from '../common/ids/uuid';
import { ScopedPrisma } from '../prisma/scoped-prisma.service';
import { CommerceDb, DisputeMessageRow, DisputeRow } from './commerce.types';
import { nextReference } from './reference.util';
import { assertTransition, DISPUTE_TRANSITIONS } from './status';

type Body = Record<string, unknown>;

/**
 * Disputes: a structured record a player or verified guest opens on their
 * own booking, registration, rental, or payment. Opening a dispute never
 * mutates the subject — payment/booking/rental state changes only via
 * authorized actions in their owning flows. Every response and status
 * change appends to the shared dispute_messages timeline.
 */
@Injectable()
export class DisputesService {
  constructor(
    private readonly scoped: ScopedPrisma,
    private readonly actorContext: ActorContextService,
    private readonly audit: AuditService,
  ) {}

  private get db(): CommerceDb {
    return this.scoped.client as unknown as CommerceDb;
  }

  private get actor(): RequestActor {
    return this.actorContext.actor;
  }

  private side(): 'player' | 'venue' | 'platform' {
    const actor = this.actor;
    if (actor.isPlatform) return 'platform';
    if (actor.tenantId) return 'venue';
    return 'player';
  }

  private async record(
    streamId: string,
    eventType: string,
    payload: Record<string, unknown>,
    tenantId?: string,
  ): Promise<void> {
    await this.audit.append(this.scoped.client, this.actor, {
      streamType: 'dispute',
      streamId,
      eventType,
      tenantId: tenantId ?? this.actor.tenantId,
      payload,
    });
  }

  async open(input: {
    tenantId: string;
    category: string;
    subjectType: string;
    subjectId: string;
    account: string;
    attachments?: unknown;
  }): Promise<DisputeRow> {
    const actor = this.actor;
    if (!actor.userId) {
      throw new BadRequestException('an account is required to open a dispute');
    }
    const streamId = newId();
    const reference = await nextReference(this.scoped.client, input.tenantId, 'dispute');
    const dispute = await this.db.dispute.create({
      data: {
        streamId,
        tenantId: input.tenantId,
        openerId: actor.userId,
        reference,
        category: input.category,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        account: input.account,
        status: 'open',
        attachments: (input.attachments as object | undefined) ?? null,
      },
    });
    await this.addMessage(dispute, 'response', input.account, input.attachments);
    await this.record(streamId, 'dispute.opened', {
      reference,
      category: input.category,
      subject_type: input.subjectType,
      subject_id: input.subjectId,
    }, input.tenantId);
    return dispute;
  }

  /** Player: own disputes. Tenant staff: tenant disputes. */
  listDisputes(list?: { where?: Record<string, unknown>; orderBy?: Record<string, 'asc' | 'desc'> }): Promise<DisputeRow[]> {
    const actor = this.actor;
    const orderBy = list?.orderBy ?? { openedAt: 'desc' as const };
    if (actor.tenantId) {
      return this.db.dispute.findMany({
        where: { tenantId: actor.tenantId, ...(list?.where ?? {}) },
        orderBy,
      });
    }
    return this.db.dispute.findMany({
      where: { openerId: actor.userId, ...(list?.where ?? {}) },
      orderBy,
    });
  }

  async getDispute(id: bigint): Promise<{ dispute: DisputeRow; messages: DisputeMessageRow[] }> {
    const dispute = await this.db.dispute.findFirst({ where: { id } });
    if (!dispute) throw new RecordNotFoundException();
    const messages = await this.db.disputeMessage.findMany({
      where: { disputeId: dispute.id },
      orderBy: { createdAt: 'asc' },
    });
    return { dispute, messages };
  }

  /** Either side responds; the first venue response moves open -> under_review. */
  async respond(id: bigint, body: Body): Promise<DisputeMessageRow> {
    const { dispute } = await this.getDispute(id);
    if (dispute.status === 'resolved') {
      throw new BadRequestException('a resolved dispute cannot be responded to');
    }
    const message = await this.addMessage(
      dispute,
      'response',
      body['body'] as string,
      body['attachments'],
    );
    if (dispute.status === 'open' && this.side() === 'venue') {
      assertTransition(DISPUTE_TRANSITIONS, 'open', 'under_review');
      await this.db.dispute.update({
        where: { id: dispute.id },
        data: { status: 'under_review' },
      });
      await this.addMessage(dispute, 'status_change', 'under review');
      await this.record(dispute.streamId, 'dispute.under_review', {
        dispute_id: dispute.id.toString(),
      }, dispute.tenantId);
    }
    await this.record(dispute.streamId, 'dispute.responded', {
      dispute_id: dispute.id.toString(),
      side: this.side(),
    }, dispute.tenantId);
    return message;
  }

  async resolve(id: bigint, resolution: string): Promise<DisputeRow> {
    const { dispute } = await this.getDispute(id);
    assertTransition(DISPUTE_TRANSITIONS, dispute.status, 'resolved');
    const updated = await this.db.dispute.update({
      where: { id: dispute.id },
      data: { status: 'resolved', resolution, resolvedAt: new Date() },
    });
    await this.addMessage(dispute, 'status_change', `resolved: ${resolution}`);
    await this.record(dispute.streamId, 'dispute.resolved', {
      dispute_id: dispute.id.toString(),
      resolution,
    }, dispute.tenantId);
    return updated;
  }

  /** Player escalation routes to the Platform Administrator (audited). */
  async escalate(id: bigint, reason: string): Promise<DisputeRow> {
    const { dispute } = await this.getDispute(id);
    assertTransition(DISPUTE_TRANSITIONS, dispute.status, 'escalated');
    const updated = await this.db.dispute.update({
      where: { id: dispute.id },
      data: { status: 'escalated' },
    });
    await this.addMessage(dispute, 'status_change', `escalated: ${reason}`);
    await this.record(dispute.streamId, 'dispute.escalated', {
      dispute_id: dispute.id.toString(),
      reason,
    }, dispute.tenantId);
    return updated;
  }

  private async addMessage(
    dispute: DisputeRow,
    kind: string,
    body: string,
    attachments?: unknown,
  ): Promise<DisputeMessageRow> {
    const actor = this.actor;
    return this.db.disputeMessage.create({
      data: {
        id: newId(),
        tenantId: dispute.tenantId,
        disputeId: dispute.id,
        authorId: actor.userId ?? null,
        authorSide: this.side(),
        kind,
        body,
        attachments: (attachments as object | undefined) ?? null,
      },
    });
  }
}
