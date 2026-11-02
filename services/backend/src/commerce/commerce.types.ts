/**
 * Plain row types mirroring prisma/models/commerce.prisma.fragment.
 * The generated Prisma client only gains these models after the
 * orchestrator merges the fragment, so services access delegates through
 * CommerceDb — delegate names already match the final model names.
 */

export interface PaymentRow {
  id: bigint;
  streamId: string;
  tenantId: string;
  payerId: string;
  reference: string;
  purpose: string;
  reservationId: string | null;
  membershipId: bigint | null;
  rentalId: bigint | null;
  amountCents: number;
  currency: string;
  method: string;
  status: string;
  provider: string | null;
  providerCheckoutId: string | null;
  providerPaymentId: string | null;
  checkoutUrl: string | null;
  checkoutExpiresAt: Date | null;
  idempotencyKey: string | null;
  capturedAt: Date | null;
  failureReason: string | null;
  details: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface RefundRow {
  id: bigint;
  streamId: string;
  tenantId: string;
  paymentId: bigint;
  reference: string;
  amountCents: number;
  status: string;
  reason: string | null;
  providerRefundId: string | null;
  requestedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MembershipPlanRow {
  id: string;
  tenantId: string;
  venueId: string | null;
  includeFutureVenues: boolean;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  termDays: number | null;
  expiresAt: Date | null;
  termEndRule: string;
  billingType: string;
  intervalDays: number | null;
  benefits: unknown;
  eligibility: unknown;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MembershipRow {
  id: bigint;
  streamId: string;
  tenantId: string;
  planId: string;
  memberId: string;
  reference: string;
  status: string;
  startsAt: Date | null;
  endsAt: Date | null;
  autoRenew: boolean;
  qrToken: string;
  paymentId: bigint | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EquipmentItemRow {
  id: string;
  tenantId: string;
  venueId: string | null;
  activityId: string | null;
  name: string;
  description: string | null;
  totalStock: number;
  priceCents: number | null;
  currency: string;
  unit: string;
  status: string;
  details: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface EquipmentRentalRow {
  id: bigint;
  streamId: string;
  tenantId: string;
  itemId: string;
  renterId: string;
  reservationId: string | null;
  reference: string;
  quantity: number;
  status: string;
  startsAt: Date;
  endsAt: Date;
  pickupWindowMinutes: number;
  returnWindowMinutes: number;
  amountCents: number | null;
  currency: string;
  paymentId: bigint | null;
  checkedOutAt: Date | null;
  returnedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  renterName?: string | null;
  equipmentName?: string | null;
}

export interface DisputeRow {
  id: bigint;
  streamId: string;
  tenantId: string;
  openerId: string;
  reference: string;
  category: string;
  subjectType: string;
  subjectId: string;
  account: string;
  status: string;
  resolution: string | null;
  attachments: unknown;
  openedAt: Date;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DisputeMessageRow {
  id: string;
  tenantId: string;
  disputeId: bigint;
  authorId: string | null;
  authorSide: string;
  kind: string;
  body: string;
  attachments: unknown;
  createdAt: Date;
}

export interface ReferenceCounterRow {
  tenantId: string;
  kind: string;
  value: bigint;
}

type Where = Record<string, unknown>;
type Order = Record<string, 'asc' | 'desc'>;

export interface Delegate<Row> {
  create(args: { data: Record<string, unknown> }): Promise<Row>;
  findMany(args?: {
    where?: Where;
    orderBy?: Order | Order[];
    take?: number;
  }): Promise<Row[]>;
  findFirst(args: { where: Where; orderBy?: Order | Order[] }): Promise<Row | null>;
  findUnique(args: { where: Where }): Promise<Row | null>;
  update(args: { where: Where; data: Record<string, unknown> }): Promise<Row>;
  updateMany(args: { where: Where; data: Record<string, unknown> }): Promise<{ count: number }>;
  delete(args: { where: Where }): Promise<Row>;
  count(args?: { where?: Where }): Promise<number>;
}

/** The subset of the post-merge PrismaClient used by this module. */
export interface CommerceDb {
  payment: Delegate<PaymentRow>;
  refund: Delegate<RefundRow>;
  membershipPlan: Delegate<MembershipPlanRow>;
  membership: Delegate<MembershipRow>;
  equipmentItem: Delegate<EquipmentItemRow>;
  equipmentRental: Delegate<EquipmentRentalRow>;
  dispute: Delegate<DisputeRow>;
  disputeMessage: Delegate<DisputeMessageRow>;
  referenceCounter: Delegate<ReferenceCounterRow>;
}

export interface JsonApiResource {
  type: string;
  id: string;
  attributes: Record<string, unknown>;
}

/** SQID scopes — per-record-type alphabets prevent cross-type correlation. */
export const SQID_SCOPES = {
  payment: 'payment',
  refund: 'refund',
  membership: 'membership',
  rental: 'rental',
  dispute: 'dispute',
} as const;

const REFERENCE_PREFIX: Record<string, string> = {
  payment: 'PAY',
  refund: 'REF',
  membership: 'MBR',
  rental: 'RNT',
  dispute: 'DSP',
};

export const referencePrefix = (kind: string): string => {
  const prefix = REFERENCE_PREFIX[kind];
  if (!prefix) throw new Error(`unknown reference kind: ${kind}`);
  return prefix;
};
