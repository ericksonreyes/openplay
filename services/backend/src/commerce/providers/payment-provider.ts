/**
 * PaymentProvider port — the only boundary domain code uses to talk to a
 * payment provider (GCash, Maya, …). Concrete adapters are deterministic
 * stubs locally; env-driven provider selection lands later. Domain code
 * never calls a vendor SDK directly.
 */

export interface CheckoutRequest {
  paymentId: bigint;
  reference: string;
  amountCents: number;
  currency: string;
  method: string; // gcash | maya
  idempotencyKey?: string;
}

export interface CheckoutSession {
  providerCheckoutId: string;
  checkoutUrl: string;
  expiresAt: Date;
}

export type WebhookOutcome = 'captured' | 'failed' | 'cancelled' | 'expired';

export interface ProviderWebhookEvent {
  providerCheckoutId: string;
  providerPaymentId: string;
  outcome: WebhookOutcome;
  amountCents: number;
  currency: string;
  /** Provider-side event/delivery id used for duplicate-webhook idempotency. */
  eventId: string;
}

export interface RefundRequest {
  providerPaymentId: string;
  amountCents: number;
  currency: string;
  reference: string;
}

export interface RefundResult {
  providerRefundId: string;
  status: 'succeeded' | 'failed';
}

export abstract class PaymentProvider {
  abstract readonly name: string;

  abstract initiateCheckout(request: CheckoutRequest): Promise<CheckoutSession>;

  /**
   * Verifies a signed provider notification. Returns the parsed event on
   * a valid signature, or null when verification fails — a browser
   * redirect is never proof of payment.
   */
  abstract verifyWebhook(
    headers: Record<string, string | undefined>,
    payload: unknown,
  ): ProviderWebhookEvent | null;

  abstract refund(request: RefundRequest): Promise<RefundResult>;
}

/** Method name -> adapter resolution. Both e-wallets share the stub locally. */
export interface PaymentProviderRegistry {
  forMethod(method: string): PaymentProvider;
  forProviderName(name: string): PaymentProvider;
}
