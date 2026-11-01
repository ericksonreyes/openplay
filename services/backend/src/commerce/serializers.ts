import { SqidCodec } from '../common/ids/sqid';
import {
  DisputeMessageRow,
  DisputeRow,
  EquipmentItemRow,
  EquipmentRentalRow,
  JsonApiResource,
  MembershipPlanRow,
  MembershipRow,
  PaymentRow,
  RefundRow,
  SQID_SCOPES,
} from './commerce.types';

/** Row -> JSON:API resource object. SQID public ids; snake_case attributes. */

const codec = new SqidCodec();
const sqid = (scope: string, id: bigint): string => codec.encode(scope, id);

export const serializePayment = (p: PaymentRow): JsonApiResource => ({
  type: 'payment',
  id: sqid(SQID_SCOPES.payment, p.id),
  attributes: {
    tenant_id: p.tenantId,
    reference: p.reference,
    purpose: p.purpose,
    reservation_id: p.reservationId,
    membership_id: p.membershipId === null ? null : sqid(SQID_SCOPES.membership, p.membershipId),
    rental_id: p.rentalId === null ? null : sqid(SQID_SCOPES.rental, p.rentalId),
    amount_cents: p.amountCents,
    currency: p.currency,
    method: p.method,
    status: p.status,
    provider: p.provider,
    checkout_url: p.checkoutUrl,
    checkout_expires_at: p.checkoutExpiresAt,
    captured_at: p.capturedAt,
    details: p.details ?? null,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  },
});

export const serializeRefund = (r: RefundRow): JsonApiResource => ({
  type: 'refund',
  id: sqid(SQID_SCOPES.refund, r.id),
  attributes: {
    tenant_id: r.tenantId,
    payment_id: sqid(SQID_SCOPES.payment, r.paymentId),
    reference: r.reference,
    amount_cents: r.amountCents,
    status: r.status,
    reason: r.reason,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  },
});

export const serializeMembershipPlan = (p: MembershipPlanRow): JsonApiResource => ({
  type: 'membership-plan',
  id: p.id,
  attributes: {
    tenant_id: p.tenantId,
    venue_id: p.venueId,
    include_future_venues: p.includeFutureVenues,
    name: p.name,
    description: p.description,
    price_cents: p.priceCents,
    currency: p.currency,
    term_days: p.termDays,
    expires_at: p.expiresAt,
    term_end_rule: p.termEndRule,
    billing_type: p.billingType,
    interval_days: p.intervalDays,
    benefits: p.benefits ?? {},
    eligibility: p.eligibility ?? null,
    status: p.status,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  },
});

export const serializeMembership = (m: MembershipRow): JsonApiResource => ({
  type: 'membership',
  id: sqid(SQID_SCOPES.membership, m.id),
  attributes: {
    tenant_id: m.tenantId,
    plan_id: m.planId,
    reference: m.reference,
    status: m.status,
    starts_at: m.startsAt,
    ends_at: m.endsAt,
    auto_renew: m.autoRenew,
    qr_token: m.qrToken,
    created_at: m.createdAt,
    updated_at: m.updatedAt,
  },
});

export const serializeEquipmentItem = (i: EquipmentItemRow): JsonApiResource => ({
  type: 'equipment-item',
  id: i.id,
  attributes: {
    tenant_id: i.tenantId,
    venue_id: i.venueId,
    activity_id: i.activityId,
    name: i.name,
    description: i.description,
    total_stock: i.totalStock,
    price_cents: i.priceCents,
    currency: i.currency,
    unit: i.unit,
    status: i.status,
    details: i.details ?? null,
    created_at: i.createdAt,
    updated_at: i.updatedAt,
  },
});

export const serializeRental = (r: EquipmentRentalRow): JsonApiResource => ({
  type: 'rental',
  id: sqid(SQID_SCOPES.rental, r.id),
  attributes: {
    tenant_id: r.tenantId,
    item_id: r.itemId,
    reservation_id: r.reservationId,
    reference: r.reference,
    quantity: r.quantity,
    status: r.status,
    starts_at: r.startsAt,
    ends_at: r.endsAt,
    amount_cents: r.amountCents,
    currency: r.currency,
    checked_out_at: r.checkedOutAt,
    returned_at: r.returnedAt,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  },
});

export const serializeDispute = (
  d: DisputeRow,
  messages: DisputeMessageRow[] = [],
): JsonApiResource => ({
  type: 'dispute',
  id: sqid(SQID_SCOPES.dispute, d.id),
  attributes: {
    tenant_id: d.tenantId,
    reference: d.reference,
    category: d.category,
    subject_type: d.subjectType,
    subject_id: d.subjectId,
    account: d.account,
    status: d.status,
    resolution: d.resolution,
    attachments: d.attachments ?? null,
    opened_at: d.openedAt,
    resolved_at: d.resolvedAt,
    messages: messages.map(serializeDisputeMessage),
    created_at: d.createdAt,
    updated_at: d.updatedAt,
  },
});

export const serializeDisputeMessage = (m: DisputeMessageRow): JsonApiResource => ({
  type: 'dispute-message',
  id: m.id,
  attributes: {
    author_side: m.authorSide,
    kind: m.kind,
    body: m.body,
    attachments: m.attachments ?? null,
    created_at: m.createdAt,
  },
});
