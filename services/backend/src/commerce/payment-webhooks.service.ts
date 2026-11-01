import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuditService } from '../common/audit/audit.service';
import { SystemContextService } from '../common/context/system-context.service';
import { CommerceDb, MembershipPlanRow, PaymentRow } from './commerce.types';
import { NIL_UUID, systemActor } from './payments.service';
import { WebhookOutcome } from './providers/payment-provider';
import { StubPaymentProviderRegistry } from './providers/stub-payment.provider';
import { assertTransition, MEMBERSHIP_TRANSITIONS, PAYMENT_TRANSITIONS } from './status';

/**
 * Provider webhook intake — public route, verified payloads only, and
 * strictly idempotent: a duplicate delivery has a single effect.
 *
 * Per AUDIT_LOGGING external-arrival rules the arrival is recorded in
 * its OWN committed transaction (TX1) before any processing begins;
 * the state transition + outcome event commit together in TX2.
 * A browser redirect is never proof of payment — only a signature-
 * verified webhook moves a payment to `captured`.
 */
@Injectable()
export class PaymentWebhooksService {
  constructor(
    private readonly system: SystemContextService,
    private readonly audit: AuditService,
    private readonly providers: StubPaymentProviderRegistry,
  ) {}

  async handle(
    providerName: string,
    headers: Record<string, string | undefined>,
    payload: unknown,
  ): Promise<{ processed: boolean; outcome?: WebhookOutcome }> {
    const provider = this.providers.forProviderName(providerName);
    const event = provider.verifyWebhook(headers, payload);
    if (!event) {
      // Unverified payloads produce no durable record — just rejection.
      throw new UnauthorizedException('webhook signature verification failed');
    }

    // TX1 — commit the arrival fact first, independently of processing.
    await this.system.run(async (tx) => {
      const db = tx as unknown as CommerceDb;
      const payment = await db.payment.findFirst({
        where: { providerCheckoutId: event.providerCheckoutId },
      });
      await this.audit.append(tx, systemActor(), {
        streamType: 'payment',
        streamId: payment?.streamId ?? NIL_UUID,
        eventType: 'payment.provider_notification_received',
        tenantId: payment?.tenantId,
        payload: {
          provider: provider.name,
          event_id: event.eventId,
          provider_checkout_id: event.providerCheckoutId,
          outcome: event.outcome,
          payment_known: payment !== null,
        },
        metadata: { source: `webhook:${provider.name}` },
      });
      return payment;
    });

    // TX2 — the work and its outcome event, atomic as usual.
    return this.system.run(async (tx) => {
      const db = tx as unknown as CommerceDb;
      const payment = await db.payment.findFirst({
        where: { providerCheckoutId: event.providerCheckoutId },
      });
      if (!payment) {
        return { processed: false };
      }
      // Idempotent: a payment already past the pending stage ignores the
      // duplicate delivery — the arrival event above is still the record.
      if (!canAccept(payment.status)) {
        return { processed: false, outcome: event.outcome };
      }
      if (event.amountCents !== payment.amountCents || event.currency !== payment.currency) {
        await this.audit.append(tx, systemActor(), {
          streamType: 'payment',
          streamId: payment.streamId,
          eventType: 'payment.webhook_rejected',
          tenantId: payment.tenantId,
          payload: {
            expected_amount_cents: payment.amountCents,
            received_amount_cents: event.amountCents,
            expected_currency: payment.currency,
            received_currency: event.currency,
          },
          metadata: { source: `webhook:${provider.name}` },
        });
        return { processed: false, outcome: event.outcome };
      }

      const target =
        event.outcome === 'captured'
          ? 'captured'
          : event.outcome === 'expired'
            ? 'expired'
            : event.outcome === 'cancelled'
              ? 'cancelled'
              : 'failed';
      assertTransition(PAYMENT_TRANSITIONS, payment.status, target);
      const updated = await db.payment.update({
        where: { id: payment.id },
        data: {
          status: target,
          providerPaymentId: event.providerPaymentId,
          capturedAt: target === 'captured' ? new Date() : null,
          failureReason: target === 'failed' ? 'provider reported failure' : null,
        },
      });
      await this.audit.append(tx, systemActor(), {
        streamType: 'payment',
        streamId: payment.streamId,
        eventType: `payment.${target}`,
        tenantId: payment.tenantId,
        payload: {
          provider: provider.name,
          event_id: event.eventId,
          provider_payment_id: event.providerPaymentId,
          amount_cents: event.amountCents,
        },
        metadata: { source: `webhook:${provider.name}` },
      });

      // A captured membership payment activates the entitlement in the
      // same transaction — the capture and the activation commit together.
      if (target === 'captured' && updated.membershipId !== null) {
        await this.activateMembership(db, tx, updated);
      }
      return { processed: true, outcome: event.outcome };
    });
  }

  private async activateMembership(
    db: CommerceDb,
    tx: Parameters<Parameters<SystemContextService['run']>[0]>[0],
    payment: PaymentRow,
  ): Promise<void> {
    const membership = await db.membership.findFirst({ where: { id: payment.membershipId } });
    if (!membership || membership.status !== 'pending') {
      return;
    }
    const plan = await db.membershipPlan.findFirst({ where: { id: membership.planId } });
    const { startsAt, endsAt } = membershipWindow(plan);
    assertTransition(MEMBERSHIP_TRANSITIONS, membership.status, 'active');
    await db.membership.update({
      where: { id: membership.id },
      data: { status: 'active', startsAt, endsAt },
    });
    await this.audit.append(tx, systemActor(), {
      streamType: 'membership',
      streamId: membership.streamId,
      eventType: 'membership.activated',
      tenantId: membership.tenantId,
      onBehalfOf: membership.memberId,
      payload: {
        payment_id: payment.id.toString(),
        plan_id: membership.planId,
        starts_at: startsAt,
        ends_at: endsAt,
      },
    });
  }
}

const PENDING_STATUSES = new Set(['initiated', 'awaiting_verification']);
const canAccept = (status: string): boolean => PENDING_STATUSES.has(status);

/** Plan term and optional fixed expiration combine per the plan's rule. */
export function membershipWindow(plan: MembershipPlanRow | null): {
  startsAt: Date;
  endsAt: Date | null;
} {
  const startsAt = new Date();
  const termEnd =
    plan?.termDays != null
      ? new Date(startsAt.getTime() + plan.termDays * 24 * 60 * 60 * 1000)
      : null;
  const fixed = plan?.expiresAt ?? null;
  switch (plan?.termEndRule ?? 'term') {
    case 'fixed_expiration':
      return { startsAt, endsAt: fixed ?? termEnd };
    case 'earliest':
      if (termEnd && fixed) {
        return { startsAt, endsAt: termEnd < fixed ? termEnd : fixed };
      }
      return { startsAt, endsAt: termEnd ?? fixed };
    default:
      return { startsAt, endsAt: termEnd ?? fixed };
  }
}
