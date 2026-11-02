import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ActorContextService } from '../common/auth/actor-context.service';
import { RequestActor } from '../common/auth/actor';
import { AuditService } from '../common/audit/audit.service';
import { RecordNotFoundException } from '../common/errors/api-error';
import { newId } from '../common/ids/uuid';
import { ScopedPrisma } from '../prisma/scoped-prisma.service';
import { CommerceDb, PaymentRow, RefundRow } from './commerce.types';
import { refundableBalance } from './money';
import { StubPaymentProviderRegistry } from './providers/stub-payment.provider';
import { nextReference } from './reference.util';
import { assertTransition, PAYMENT_TRANSITIONS } from './status';

const INTEGRATED_METHODS = new Set(['gcash', 'maya']);
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

export const systemActor = (): RequestActor => ({
  roles: [],
  permissions: [],
  venueIds: [],
  isPlatform: false,
  isSystem: true,
  isPublic: false,
});

export interface InitiatePaymentInput {
  tenantId: string;
  payerId: string;
  purpose: string;
  reservationId?: string;
  membershipId?: bigint;
  rentalId?: bigint;
  amountCents: number;
  currency: string;
  method: string;
  idempotencyKey?: string;
  details?: unknown;
}

/**
 * Payment lifecycle. Request-path queries run through ScopedPrisma (RLS
 * already on the tx); webhook arrivals run through explicit system
 * context in PaymentsWebhookService. Every mutation appends its audit
 * event on the same transaction.
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly scoped: ScopedPrisma,
    private readonly actorContext: ActorContextService,
    private readonly audit: AuditService,
    private readonly providers: StubPaymentProviderRegistry,
  ) {}

  private get db(): CommerceDb {
    return this.scoped.client as unknown as CommerceDb;
  }

  private get actor(): RequestActor {
    return this.actorContext.actor;
  }

  /** Initiates a payment. When an Idempotency-Key is supplied, a prior row
   *  for the same payer + tenant + key is returned unchanged. */
  async initiate(input: InitiatePaymentInput): Promise<{ payment: PaymentRow; reused: boolean }> {
    if (input.idempotencyKey) {
      const existing = await this.db.payment.findFirst({
        where: {
          tenantId: input.tenantId,
          payerId: input.payerId,
          idempotencyKey: input.idempotencyKey,
        },
      });
      if (existing) {
        return { payment: existing, reused: true };
      }
    }

    const streamId = newId();
    const reference = await nextReference(this.scoped.client, input.tenantId, 'payment');
    const integrated = INTEGRATED_METHODS.has(input.method);
    const initialStatus = input.method === 'direct_transfer' ? 'awaiting_verification' : 'initiated';

    let payment = await this.db.payment.create({
      data: {
        streamId,
        tenantId: input.tenantId,
        payerId: input.payerId,
        reference,
        purpose: input.purpose,
        reservationId: input.reservationId ?? null,
        membershipId: input.membershipId ?? null,
        rentalId: input.rentalId ?? null,
        amountCents: input.amountCents,
        currency: input.currency,
        method: input.method,
        status: initialStatus,
        idempotencyKey: input.idempotencyKey ?? null,
        details: (input.details as object | undefined) ?? Prisma.JsonNull,
      },
    });

    if (integrated) {
      const provider = this.providers.forMethod(input.method);
      const session = await provider.initiateCheckout({
        paymentId: payment.id,
        reference,
        amountCents: payment.amountCents,
        currency: payment.currency,
        method: input.method,
        idempotencyKey: input.idempotencyKey,
      });
      payment = await this.db.payment.update({
        where: { id: payment.id },
        data: {
          provider: provider.name,
          providerCheckoutId: session.providerCheckoutId,
          checkoutUrl: session.checkoutUrl,
          checkoutExpiresAt: session.expiresAt,
        },
      });
    }

    await this.audit.append(this.scoped.client, this.actor, {
      streamType: 'payment',
      streamId,
      eventType: 'payment.initiated',
      tenantId: input.tenantId,
      payload: {
        payment: {
          id: payment.id.toString(),
          reference,
          method: input.method,
          amount_cents: payment.amountCents,
          currency: payment.currency,
          status: payment.status,
        },
      },
    });
    return { payment, reused: false };
  }

  /** RLS already scopes visibility; an invisible row is a plain 404. */
  async getById(id: bigint): Promise<PaymentRow> {
    const payment = await this.db.payment.findFirst({ where: { id } });
    if (!payment) throw new RecordNotFoundException();
    return payment;
  }

  listForActor(list?: { where?: Record<string, unknown>; orderBy?: Record<string, 'asc' | 'desc'> }): Promise<PaymentRow[]> {
    const actor = this.actor;
    const orderBy = list?.orderBy ?? { createdAt: 'desc' as const };
    if (actor.tenantId) {
      return this.db.payment.findMany({
        where: { tenantId: actor.tenantId, ...(list?.where ?? {}) },
        orderBy,
      });
    }
    return this.db.payment.findMany({
      where: { payerId: actor.userId, ...(list?.where ?? {}) },
      orderBy,
    });
  }

  /**
   * Records a refund. Integrated methods go through the provider port;
   * direct_transfer / pay_at_venue refunds are manual — recorded for
   * tracking only (venue settles off-platform).
   */
  async refund(
    id: bigint,
    input: { amountCents?: number; reason?: string },
  ): Promise<{ refund: RefundRow; payment: PaymentRow }> {
    const payment = await this.getById(id);
    if (payment.status !== 'captured' && payment.status !== 'partially_refunded') {
      throw new BadRequestException('only captured payments can be refunded');
    }

    const prior = await this.db.refund.findMany({
      where: { paymentId: payment.id, status: 'succeeded' },
    });
    const refundedSoFar = prior.reduce((t, r) => t + r.amountCents, 0);
    const balance = refundableBalance(payment.amountCents, refundedSoFar);
    const amount = input.amountCents ?? balance;
    if (!Number.isInteger(amount) || amount <= 0 || amount > balance) {
      throw new BadRequestException(`refund amount must be between 1 and ${balance} centavos`);
    }

    const reference = await nextReference(this.scoped.client, payment.tenantId, 'refund');
    const integrated = INTEGRATED_METHODS.has(payment.method) && payment.providerPaymentId;
    let status = 'recorded'; // manual path (direct transfer / pay at venue)
    let providerRefundId: string | null = null;
    if (integrated) {
      const provider = this.providers.forProviderName(payment.provider ?? payment.method);
      const result = await provider.refund({
        providerPaymentId: payment.providerPaymentId as string,
        amountCents: amount,
        currency: payment.currency,
        reference,
      });
      status = result.status;
      providerRefundId = result.providerRefundId;
    }

    const streamId = newId();
    const refund = await this.db.refund.create({
      data: {
        streamId,
        tenantId: payment.tenantId,
        paymentId: payment.id,
        reference,
        amountCents: amount,
        status,
        reason: input.reason ?? null,
        providerRefundId,
        requestedBy: this.actor.userId,
      },
    });

    const nextStatus =
      status === 'succeeded' || status === 'recorded'
        ? refundedSoFar + amount >= payment.amountCents
          ? 'refunded'
          : 'partially_refunded'
        : payment.status;
    let updated = payment;
    if (nextStatus !== payment.status) {
      assertTransition(PAYMENT_TRANSITIONS, payment.status, nextStatus);
      updated = await this.db.payment.update({
        where: { id: payment.id },
        data: { status: nextStatus },
      });
    }

    await this.audit.append(this.scoped.client, this.actor, {
      streamType: 'payment',
      streamId: payment.streamId,
      eventType: 'payment.refund_requested',
      tenantId: payment.tenantId,
      payload: {
        refund: { id: refund.id.toString(), reference, amount_cents: amount, status },
        payment_id: payment.id.toString(),
      },
    });
    return { refund, payment: updated };
  }
}

export { NIL_UUID };
