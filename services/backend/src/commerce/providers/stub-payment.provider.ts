import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  CheckoutRequest,
  CheckoutSession,
  PaymentProvider,
  PaymentProviderRegistry,
  ProviderWebhookEvent,
  RefundRequest,
  RefundResult,
} from './payment-provider';

/**
 * Deterministic local stub for integrated checkout. No real GCash/Maya
 * calls ever happen; it records provider references and verifies a
 * signature the same way a real adapter would. Default adapter until
 * env-driven provider selection lands.
 *
 * Signature scheme: `x-openplay-signature` = HMAC-SHA256 over the
 * canonical string
 *   `${event_id}.${provider_checkout_id}.${provider_payment_id}.${outcome}.${amount_cents}.${currency}`
 * keyed by the stub secret (env PAYMENT_STUB_WEBHOOK_SECRET, default
 * 'stub-webhook-secret'). `signStubWebhook` is exported so tests, seeds,
 * and manual curl flows can produce valid deliveries.
 */

export const STUB_SIGNATURE_HEADER = 'x-openplay-signature';
const DEFAULT_SECRET = 'stub-webhook-secret';

const OUTCOMES = ['captured', 'failed', 'cancelled', 'expired'] as const;

export function stubWebhookSecret(): string {
  return process.env['PAYMENT_STUB_WEBHOOK_SECRET'] ?? DEFAULT_SECRET;
}

export function canonicalWebhookMessage(event: {
  eventId: string;
  providerCheckoutId: string;
  providerPaymentId: string;
  outcome: string;
  amountCents: number;
  currency: string;
}): string {
  return [
    event.eventId,
    event.providerCheckoutId,
    event.providerPaymentId,
    event.outcome,
    String(event.amountCents),
    event.currency,
  ].join('.');
}

export function signStubWebhook(
  event: Parameters<typeof canonicalWebhookMessage>[0],
  secret: string = stubWebhookSecret(),
): string {
  return createHmac('sha256', secret).update(canonicalWebhookMessage(event)).digest('hex');
}

@Injectable()
export class StubPaymentProvider extends PaymentProvider {
  readonly name: string;

  constructor(name = 'stub') {
    super();
    this.name = name;
  }

  initiateCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
    const providerCheckoutId = `chk_${this.name}_${request.paymentId.toString()}`;
    return Promise.resolve({
      providerCheckoutId,
      checkoutUrl: `https://stub.pay.local/${this.name}/checkout/${providerCheckoutId}`,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30-minute provider session
    });
  }

  verifyWebhook(
    headers: Record<string, string | undefined>,
    payload: unknown,
  ): ProviderWebhookEvent | null {
    const body = (payload ?? {}) as Record<string, unknown>;
    const event: ProviderWebhookEvent = {
      eventId: String(body['event_id'] ?? ''),
      providerCheckoutId: String(body['provider_checkout_id'] ?? ''),
      providerPaymentId: String(body['provider_payment_id'] ?? ''),
      outcome: body['outcome'] as ProviderWebhookEvent['outcome'],
      amountCents: Number(body['amount_cents']),
      currency: String(body['currency'] ?? ''),
    };
    if (
      !event.eventId ||
      !event.providerCheckoutId ||
      !event.providerPaymentId ||
      !OUTCOMES.includes(event.outcome) ||
      !Number.isInteger(event.amountCents) ||
      !event.currency
    ) {
      return null;
    }
    const presented = headers[STUB_SIGNATURE_HEADER];
    if (!presented) {
      return null;
    }
    const expected = signStubWebhook(event);
    const a = Buffer.from(presented, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return null;
    }
    return event;
  }

  refund(request: RefundRequest): Promise<RefundResult> {
    // Deterministic provider reference — the stub always "succeeds".
    return Promise.resolve({
      providerRefundId: `ref_${this.name}_${createHmac('sha256', stubWebhookSecret())
        .update(`${request.providerPaymentId}.${request.amountCents}.${request.reference}`)
        .digest('hex')
        .slice(0, 16)}`,
      status: 'succeeded',
    });
  }
}

/** Test/seed helper: a random opaque event id matching provider formats. */
export function newStubEventId(): string {
  return `evt_${randomBytes(8).toString('hex')}`;
}

/**
 * Registry over the stub adapters — one named adapter per integrated
 * method (gcash, maya) so provider references stay distinguishable.
 */
@Injectable()
export class StubPaymentProviderRegistry implements PaymentProviderRegistry {
  private readonly providers = new Map<string, StubPaymentProvider>([
    ['gcash', new StubPaymentProvider('gcash')],
    ['maya', new StubPaymentProvider('maya')],
  ]);

  forMethod(method: string): PaymentProvider {
    const provider = this.providers.get(method);
    if (!provider) {
      throw new Error(`no payment provider for method: ${method}`);
    }
    return provider;
  }

  forProviderName(name: string): PaymentProvider {
    return this.forMethod(name);
  }
}
