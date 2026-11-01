import { BadRequestException } from '@nestjs/common';
import { newId } from '../common/ids/uuid';
import { PaymentRow } from './commerce.types';
import { PaymentsService } from './payments.service';
import { StubPaymentProviderRegistry } from './providers/stub-payment.provider';
import { membershipWindow } from './payment-webhooks.service';
import { MembershipPlanRow } from './commerce.types';

const actor = {
  userId: newId(),
  tenantId: newId(),
  roles: [],
  permissions: [],
  venueIds: [],
  isPlatform: false,
  isSystem: false,
  isPublic: false,
};

const tenantId = newId();
const playerId = newId();

function paymentRow(overrides: Partial<PaymentRow> = {}): PaymentRow {
  return {
    id: 1n,
    streamId: newId(),
    tenantId,
    payerId: playerId,
    reference: 'PAY-00001',
    purpose: 'reservation',
    reservationId: null,
    membershipId: null,
    rentalId: null,
    amountCents: 50000,
    currency: 'PHP',
    method: 'gcash',
    status: 'initiated',
    provider: 'gcash',
    providerCheckoutId: 'chk_gcash_1',
    providerPaymentId: null,
    checkoutUrl: 'https://stub.pay.local/gcash/checkout/chk_gcash_1',
    checkoutExpiresAt: new Date(),
    idempotencyKey: 'idem-1',
    capturedAt: null,
    failureReason: null,
    details: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function harness(rows: { payments?: PaymentRow[] } = {}) {
  const payments = rows.payments ?? [];
  const client = {
    $queryRaw: jest.fn(async () => [{ value: 1n }]),
    payment: {
      findFirst: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
        payments.find((p) =>
          Object.entries(where).every(([k, v]) => p[k as keyof PaymentRow] === v),
        ) ?? null,
      ),
      findMany: jest.fn(async () => payments),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) =>
        paymentRow({ ...(data as Partial<PaymentRow>), id: 7n }),
      ),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) =>
        paymentRow(data as Partial<PaymentRow>),
      ),
    },
    refund: {
      findMany: jest.fn(async () => []),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 3n,
        streamId: newId(),
        tenantId,
        paymentId: 1n,
        reference: 'REF-00001',
        amountCents: data['amountCents'],
        status: data['status'],
        reason: null,
        providerRefundId: data['providerRefundId'],
        requestedBy: actor.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    },
  };
  const audit = { append: jest.fn(async () => undefined) };
  const service = new PaymentsService(
    { client } as never,
    { actor } as never,
    audit as never,
    new StubPaymentProviderRegistry(),
  );
  return { service, client, audit };
}

describe('PaymentsService.initiate', () => {
  const input = {
    tenantId,
    payerId: playerId,
    purpose: 'reservation',
    amountCents: 50000,
    currency: 'PHP',
    method: 'gcash',
    idempotencyKey: 'idem-1',
  };

  it('returns the existing payment for a repeated idempotency key', async () => {
    const existing = paymentRow();
    const { service, client } = harness({ payments: [existing] });
    const result = await service.initiate(input);
    expect(result.reused).toBe(true);
    expect(result.payment).toBe(existing);
    expect(client.payment.create).not.toHaveBeenCalled();
  });

  it('creates a checkout session for integrated methods', async () => {
    const { service, client, audit } = harness();
    const result = await service.initiate(input);
    expect(result.reused).toBe(false);
    expect(client.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          provider: 'gcash',
          providerCheckoutId: 'chk_gcash_7',
        }),
      }),
    );
    expect(audit.append).toHaveBeenCalledWith(
      expect.anything(),
      actor,
      expect.objectContaining({ eventType: 'payment.initiated', streamType: 'payment' }),
    );
  });

  it('marks direct transfers as awaiting verification, never captured', async () => {
    const { service, client } = harness();
    await service.initiate({ ...input, method: 'direct_transfer' });
    expect(client.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'awaiting_verification' }),
      }),
    );
  });
});

describe('PaymentsService.refund', () => {
  it('rejects refunds on non-captured payments', async () => {
    const { service } = harness({ payments: [paymentRow({ status: 'initiated' })] });
    await expect(service.refund(1n, {})).rejects.toThrow(BadRequestException);
  });

  it('refunds via the provider for captured integrated payments', async () => {
    const { service, client } = harness({
      payments: [paymentRow({ status: 'captured', providerPaymentId: 'pay_gcash_1' })],
    });
    const { refund } = await service.refund(1n, { amountCents: 20000 });
    expect(refund.status).toBe('succeeded');
    expect(refund.providerRefundId).toContain('ref_gcash_');
    expect(client.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'partially_refunded' } }),
    );
  });

  it('records manual refunds for direct transfers without provider calls', async () => {
    const { service, client } = harness({
      payments: [
        paymentRow({ status: 'captured', method: 'direct_transfer', provider: null }),
      ],
    });
    const { refund } = await service.refund(1n, {});
    expect(refund.status).toBe('recorded');
    expect(client.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'refunded' } }),
    );
  });

  it('rejects refund amounts above the refundable balance', async () => {
    const { service } = harness({
      payments: [paymentRow({ status: 'captured' })],
    });
    await expect(service.refund(1n, { amountCents: 50001 })).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.refund(1n, { amountCents: 0 })).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('membershipWindow', () => {
  const plan = (overrides: Partial<MembershipPlanRow>): MembershipPlanRow => ({
    id: newId(),
    tenantId,
    venueId: null,
    includeFutureVenues: false,
    name: 'Plan',
    description: null,
    priceCents: 50000,
    currency: 'PHP',
    termDays: null,
    expiresAt: null,
    termEndRule: 'term',
    billingType: 'one_time',
    intervalDays: null,
    benefits: {},
    eligibility: null,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  it('derives the end date from term days', () => {
    const { endsAt } = membershipWindow(plan({ termDays: 30 }));
    expect(endsAt).not.toBeNull();
    expect(endsAt!.getTime()).toBeGreaterThan(Date.now() + 29 * 86400_000);
  });

  it('honours fixed_expiration and earliest rules', () => {
    const fixed = new Date(Date.now() + 10 * 86400_000);
    expect(
      membershipWindow(plan({ termDays: 30, expiresAt: fixed, termEndRule: 'fixed_expiration' }))
        .endsAt,
    ).toEqual(fixed);
    expect(
      membershipWindow(plan({ termDays: 30, expiresAt: fixed, termEndRule: 'earliest' })).endsAt,
    ).toEqual(fixed);
  });
});
