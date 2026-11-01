import {
  signStubWebhook,
  STUB_SIGNATURE_HEADER,
  StubPaymentProvider,
  StubPaymentProviderRegistry,
} from './providers/stub-payment.provider';

const event = {
  eventId: 'evt_1',
  providerCheckoutId: 'chk_gcash_1',
  providerPaymentId: 'pay_gcash_1',
  outcome: 'captured',
  amountCents: 50000,
  currency: 'PHP',
};

const payload = {
  event_id: event.eventId,
  provider_checkout_id: event.providerCheckoutId,
  provider_payment_id: event.providerPaymentId,
  outcome: event.outcome,
  amount_cents: event.amountCents,
  currency: event.currency,
};

describe('StubPaymentProvider', () => {
  const provider = new StubPaymentProvider('gcash');

  it('issues deterministic checkout references', async () => {
    const session = await provider.initiateCheckout({
      paymentId: 42n,
      reference: 'PAY-00042',
      amountCents: 50000,
      currency: 'PHP',
      method: 'gcash',
    });
    expect(session.providerCheckoutId).toBe('chk_gcash_42');
    expect(session.checkoutUrl).toContain('chk_gcash_42');
    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('accepts a webhook signed with the stub secret', () => {
    const signature = signStubWebhook(event);
    const parsed = provider.verifyWebhook(
      { [STUB_SIGNATURE_HEADER]: signature },
      payload,
    );
    expect(parsed).not.toBeNull();
    expect(parsed?.providerCheckoutId).toBe(event.providerCheckoutId);
    expect(parsed?.amountCents).toBe(50000);
  });

  it('rejects a tampered payload and a missing signature', () => {
    const signature = signStubWebhook(event);
    expect(
      provider.verifyWebhook(
        { [STUB_SIGNATURE_HEADER]: signature },
        { ...payload, amount_cents: 1 },
      ),
    ).toBeNull();
    expect(provider.verifyWebhook({}, payload)).toBeNull();
    expect(
      provider.verifyWebhook({ [STUB_SIGNATURE_HEADER]: 'bogus' }, payload),
    ).toBeNull();
    expect(
      provider.verifyWebhook(
        { [STUB_SIGNATURE_HEADER]: signature },
        { ...payload, outcome: 'hacked' },
      ),
    ).toBeNull();
  });

  it('produces deterministic refund references', async () => {
    const a = await provider.refund({
      providerPaymentId: 'pay_gcash_1',
      amountCents: 50000,
      currency: 'PHP',
      reference: 'REF-00001',
    });
    const b = await provider.refund({
      providerPaymentId: 'pay_gcash_1',
      amountCents: 50000,
      currency: 'PHP',
      reference: 'REF-00001',
    });
    expect(a.status).toBe('succeeded');
    expect(a.providerRefundId).toBe(b.providerRefundId);
  });
});

describe('StubPaymentProviderRegistry', () => {
  it('resolves named adapters per integrated method', () => {
    const registry = new StubPaymentProviderRegistry();
    expect(registry.forMethod('gcash').name).toBe('gcash');
    expect(registry.forProviderName('maya').name).toBe('maya');
    expect(() => registry.forMethod('pay_at_venue')).toThrow();
  });
});
