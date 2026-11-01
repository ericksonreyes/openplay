/**
 * Plain row types mirroring prisma/models/booking_events.prisma.fragment
 * (booking-owned tables). The generated Prisma client only gains these models
 * after the orchestrator merges the fragment, so services access delegates
 * through BookingDb — delegate names already match the final model names.
 */

export interface ReservationRow {
  id: bigint;
  uuid: string;
  referenceNo: string | null;
  tenantId: string;
  venueId: string;
  resourceId: string;
  activityId: string | null;
  playerId: string | null;
  guestContactId: string | null;
  seriesId: string | null;
  status: string;
  startsAt: Date;
  endsAt: Date;
  bufferMinutes: number;
  partySize: number;
  holdExpiresAt: Date | null;
  noShowMarkedAt: Date | null;
  cancellation: unknown;
  paymentState: string;
  notes: string | null;
  idempotencyKey: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Hydrated display fields (not persisted) — service fills before serialize.
  customerName?: string | null;
  resourceName?: string | null;
}

export interface ReservationParticipantRow {
  id: string;
  tenantId: string;
  reservationId: bigint;
  kind: string;
  userId: string | null;
  name: string | null;
  isMinor: boolean;
  guardianUserId: string | null;
  createdAt: Date;
}

export interface GuestContactRow {
  id: string;
  tenantId: string;
  name: string;
  email: string | null;
  phone: string | null;
  accessTokenHash: string | null;
  verificationCodeHash: string | null;
  verifiedAt: Date | null;
  tokenExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecurringReservationTemplateRow {
  id: string;
  tenantId: string;
  venueId: string;
  resourceId: string;
  playerId: string | null;
  rule: unknown;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResourceAllocationRow {
  id: string;
  tenantId: string;
  resourceId: string;
  ownerType: string;
  ownerId: string;
  startsAt: Date;
  endsAt: Date;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface ConsentRecordRow {
  id: string;
  tenantId: string;
  kind: string;
  facilityRuleId: string | null;
  facilityRuleVersion: number | null;
  waiverDocumentId: string | null;
  waiverVersionId: string | null;
  userId: string | null;
  guestContactId: string | null;
  participantName: string | null;
  guardianUserId: string | null;
  coveredAction: string;
  coveredId: string | null;
  createdAt: Date;
}

export interface EventRow {
  id: string;
  tenantId: string;
  venueId: string;
  activityId: string | null;
  seriesId: string | null;
  name: string;
  description: string | null;
  format: string;
  status: string;
  visibility: string;
  startsAt: Date;
  endsAt: Date;
  bufferMinutes: number;
  capacity: number;
  capacityUnit: string;
  feeCents: number;
  currency: string;
  feeBasis: string;
  paymentTiming: string;
  registrationOpensAt: Date | null;
  registrationClosesAt: Date | null;
  waitlistEnabled: boolean;
  resultsEnabled: boolean;
  cancellationReason: string | null;
  details: unknown;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventSeriesRow {
  id: string;
  tenantId: string;
  name: string;
  rule: unknown;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventRegistrationRow {
  id: bigint;
  uuid: string;
  referenceNo: string | null;
  tenantId: string;
  eventId: string;
  playerId: string | null;
  guestContactId: string | null;
  kind: string;
  teamName: string | null;
  roster: unknown;
  seats: number;
  status: string;
  waitlistPosition: number | null;
  paymentState: string;
  amountDueCents: number;
  dueAt: Date | null;
  holdExpiresAt: Date | null;
  idempotencyKey: string | null;
  registeredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventResultRow {
  id: string;
  tenantId: string;
  eventId: string;
  registrationId: bigint | null;
  label: string | null;
  result: unknown;
  recordedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CheckInRow {
  id: string;
  tenantId: string;
  venueId: string | null;
  reservationUuid: string | null;
  registrationUuid: string | null;
  subjectUserId: string | null;
  guestContactId: string | null;
  outcome: string;
  method: string;
  recordedBy: string | null;
  recordedAt: Date;
}

type Where = Record<string, unknown>;

interface Delegate<Row> {
  create(args: { data: Record<string, unknown> }): Promise<Row>;
  findMany(args?: {
    where?: Where;
    orderBy?: Where | Where[];
  }): Promise<Row[]>;
  findFirst(args: { where: Where }): Promise<Row | null>;
  update(args: { where: Where; data: Record<string, unknown> }): Promise<Row>;
  updateMany(args: { where: Where; data: Record<string, unknown> }): Promise<{ count: number }>;
  delete(args: { where: Where }): Promise<Row>;
  deleteMany(args: { where: Where }): Promise<{ count: number }>;
}

/** The subset of the post-merge PrismaClient used by booking + events. */
export interface BookingDb {
  iamUser: Delegate<{ id: string; displayName: string | null; email: string | null; username: string | null }>;
  venueResource: Delegate<{ id: string; name: string }>;
  guestContact: Delegate<GuestContactRow>;
  reservation: Delegate<ReservationRow>;
  reservationParticipant: Delegate<ReservationParticipantRow>;
  recurringReservationTemplate: Delegate<RecurringReservationTemplateRow>;
  resourceAllocation: Delegate<ResourceAllocationRow>;
  consentRecord: Delegate<ConsentRecordRow>;
  eventSeries: Delegate<EventSeriesRow>;
  event: Delegate<EventRow>;
  eventRegistration: Delegate<EventRegistrationRow>;
  eventResult: Delegate<EventResultRow>;
  checkIn: Delegate<CheckInRow>;
}

export interface JsonApiResource {
  type: string;
  id: string;
  attributes: Record<string, unknown>;
}
