import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { ActorContextService } from '../common/auth/actor-context.service';
import { RequestActor } from '../common/auth/actor';
import { AuditService } from '../common/audit/audit.service';
import { RecordNotFoundException } from '../common/errors/api-error';
import { newId } from '../common/ids/uuid';
import { SystemContextService } from '../common/context/system-context.service';
import { ScopedPrisma } from '../prisma/scoped-prisma.service';
import {
  CommerceDb,
  MembershipPlanRow,
  MembershipRow,
  PaymentRow,
} from './commerce.types';
import { PaymentsService } from './payments.service';
import { nextReference } from './reference.util';

type Body = Record<string, unknown>;

/**
 * Membership plans (tenant catalog) and memberships (player-owned,
 * transactional). A purchase creates a pending membership plus a payment
 * through the normal payment flow; the membership activates when the
 * payment is captured (see PaymentWebhooksService).
 */
@Injectable()
export class MembershipsService {
  constructor(
    private readonly scoped: ScopedPrisma,
    private readonly actorContext: ActorContextService,
    private readonly audit: AuditService,
    private readonly system: SystemContextService,
    private readonly payments: PaymentsService,
  ) {}

  private get db(): CommerceDb {
    return this.scoped.client as unknown as CommerceDb;
  }

  private get actor(): RequestActor {
    return this.actorContext.actor;
  }

  private async record(
    streamType: string,
    streamId: string,
    eventType: string,
    payload: Record<string, unknown>,
    tenantId?: string,
  ): Promise<void> {
    await this.audit.append(this.scoped.client, this.actor, {
      streamType,
      streamId,
      eventType,
      tenantId: tenantId ?? this.actor.tenantId,
      payload,
    });
  }

  // ---------- plans (tenant catalog) ----------

  /**
   * Player-facing browse: plans are tenant-owned rows, so a player actor
   * (no tenant claim) cannot see them under RLS. Published/active plans
   * are catalog data, so player browse reads through explicit system
   * context filtered to status='active' — never ambient privilege.
   */
  listPlansForBrowse(): Promise<MembershipPlanRow[]> {
    return this.system.run((tx) =>
      (tx as unknown as CommerceDb).membershipPlan.findMany({
        where: { status: 'active' },
        orderBy: { createdAt: 'asc' },
      }),
    );
  }

  listPlans(): Promise<MembershipPlanRow[]> {
    return this.db.membershipPlan.findMany({ orderBy: { createdAt: 'asc' } });
  }

  async getPlan(id: string): Promise<MembershipPlanRow> {
    const plan = await this.db.membershipPlan.findFirst({ where: { id } });
    if (!plan) throw new RecordNotFoundException();
    return plan;
  }

  async createPlan(data: Body): Promise<MembershipPlanRow> {
    const plan = await this.db.membershipPlan.create({ data: { id: newId(), ...data } });
    await this.record('membership_plan', plan.id, 'membership_plan.created', {
      plan: { id: plan.id, name: plan.name, status: plan.status },
    });
    return plan;
  }

  async updatePlan(id: string, data: Body): Promise<MembershipPlanRow> {
    await this.getPlan(id);
    const plan = await this.db.membershipPlan.update({ where: { id }, data });
    await this.record('membership_plan', plan.id, 'membership_plan.updated', {
      plan: { id: plan.id, status: plan.status },
    });
    return plan;
  }

  async deletePlan(id: string): Promise<MembershipPlanRow> {
    const plan = await this.getPlan(id);
    await this.db.membershipPlan.delete({ where: { id } });
    await this.record('membership_plan', plan.id, 'membership_plan.deleted', {
      plan_id: plan.id,
    });
    return plan;
  }

  // ---------- memberships (player-owned) ----------

  /**
   * Purchase: validates the plan through system context (player actors
   * cannot read tenant rows), then writes the player's membership and its
   * payment inside the request transaction.
   */
  async purchase(
    planId: string,
    input: { method: string; autoRenew?: boolean; idempotencyKey?: string },
  ): Promise<{ membership: MembershipRow; payment: PaymentRow; reused: boolean }> {
    const actor = this.actor;
    if (!actor.userId) {
      throw new BadRequestException('a player account is required');
    }
    const plan = await this.system.run(async (tx) => {
      const db = tx as unknown as CommerceDb;
      return db.membershipPlan.findFirst({ where: { id: planId, status: 'active' } });
    });
    if (!plan) {
      throw new RecordNotFoundException();
    }
    // Recurring billing requires an integrated method that supports repeat
    // charges; direct transfer / pay-at-venue renewals are manual.
    if (input.autoRenew && plan.billingType !== 'recurring') {
      throw new BadRequestException('auto_renew requires a recurring-billing plan');
    }
    if (plan.billingType === 'recurring' && input.autoRenew &&
        !['gcash', 'maya'].includes(input.method)) {
      throw new BadRequestException('auto_renew requires an integrated payment method');
    }

    if (input.idempotencyKey) {
      const existing = await this.db.payment.findFirst({
        where: {
          tenantId: plan.tenantId,
          payerId: actor.userId,
          idempotencyKey: input.idempotencyKey,
          purpose: 'membership',
        },
      });
      if (existing?.membershipId) {
        const prior = await this.db.membership.findFirst({ where: { id: existing.membershipId } });
        if (prior) {
          return { membership: prior, payment: existing, reused: true };
        }
      }
    }

    const streamId = newId();
    const reference = await nextReference(this.scoped.client, plan.tenantId, 'membership');
    let membership = await this.db.membership.create({
      data: {
        streamId,
        tenantId: plan.tenantId,
        planId: plan.id,
        memberId: actor.userId,
        reference,
        status: 'pending',
        autoRenew: input.autoRenew === true,
        qrToken: `mqr_${randomBytes(16).toString('hex')}`,
      },
    });
    await this.record('membership', streamId, 'membership.requested', {
      plan_id: plan.id,
      member_id: actor.userId,
      reference,
    }, plan.tenantId);

    const { payment, reused } = await this.payments.initiate({
      tenantId: plan.tenantId,
      payerId: actor.userId,
      purpose: 'membership',
      membershipId: membership.id,
      amountCents: plan.priceCents,
      currency: plan.currency,
      method: input.method,
      idempotencyKey: input.idempotencyKey,
      details: { line_items: [{ label: plan.name, amount_cents: plan.priceCents }] },
    });
    membership = await this.db.membership.update({
      where: { id: membership.id },
      data: { paymentId: payment.id },
    });
    return { membership, payment, reused };
  }

  /** Player: own memberships. Tenant staff: tenant memberships. */
  listMine(): Promise<MembershipRow[]> {
    const actor = this.actor;
    if (actor.tenantId) {
      return this.db.membership.findMany({
        where: { tenantId: actor.tenantId },
        orderBy: { createdAt: 'desc' },
      });
    }
    return this.db.membership.findMany({
      where: { memberId: actor.userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMembership(id: bigint): Promise<MembershipRow> {
    const membership = await this.db.membership.findFirst({ where: { id } });
    if (!membership) throw new RecordNotFoundException();
    return membership;
  }
}
