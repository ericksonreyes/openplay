import { SqidCodec } from '../common/ids/sqid';
import {
  CheckInRow,
  ConsentRecordRow,
  GuestContactRow,
  JsonApiResource,
  RecurringReservationTemplateRow,
  ReservationParticipantRow,
  ReservationRow,
} from './booking.types';

/** Row -> JSON:API resource object. Attributes use snake_case wire names. */

const sqids = new SqidCodec();
export const RESERVATION_SQID_SCOPE = 'reservation';

/** Reservations are transactional: external id is the SQID of the bigint PK. */
export const reservationPublicId = (id: bigint): string =>
  sqids.encode(RESERVATION_SQID_SCOPE, id);

export const serializeReservation = (r: ReservationRow): JsonApiResource => ({
  type: 'reservation',
  id: reservationPublicId(r.id),
  attributes: {
    uuid: r.uuid,
    reference_no: r.referenceNo,
    tenant_id: r.tenantId,
    venue_id: r.venueId,
    resource_id: r.resourceId,
    activity_id: r.activityId,
    player_id: r.playerId,
    guest_contact_id: r.guestContactId,
    customer_name: r.customerName ?? null,
    resource_name: r.resourceName ?? null,
    series_id: r.seriesId,
    status: r.status,
    starts_at: r.startsAt,
    ends_at: r.endsAt,
    buffer_minutes: r.bufferMinutes,
    party_size: r.partySize,
    hold_expires_at: r.holdExpiresAt,
    payment_state: r.paymentState,
    cancellation: r.cancellation ?? null,
    notes: r.notes,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  },
});

export const serializeRecurringTemplate = (
  t: RecurringReservationTemplateRow,
): JsonApiResource => ({
  type: 'recurring-reservation-template',
  id: t.id,
  attributes: {
    tenant_id: t.tenantId,
    venue_id: t.venueId,
    resource_id: t.resourceId,
    player_id: t.playerId,
    rule: t.rule,
    status: t.status,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
  },
});

export const serializeParticipant = (p: ReservationParticipantRow): JsonApiResource => ({
  type: 'reservation-participant',
  id: p.id,
  attributes: {
    reservation_id: reservationPublicId(p.reservationId),
    kind: p.kind,
    user_id: p.userId,
    name: p.name,
    is_minor: p.isMinor,
    guardian_user_id: p.guardianUserId,
    created_at: p.createdAt,
  },
});

export const serializeCheckIn = (c: CheckInRow): JsonApiResource => ({
  type: 'check-in',
  id: c.id,
  attributes: {
    tenant_id: c.tenantId,
    venue_id: c.venueId,
    reservation_uuid: c.reservationUuid,
    registration_uuid: c.registrationUuid,
    subject_user_id: c.subjectUserId,
    subject_name: c.subjectName ?? null,
    guest_contact_id: c.guestContactId,
    outcome: c.outcome,
    method: c.method,
    recorded_by: c.recordedBy,
    recorded_at: c.recordedAt,
  },
});

export const serializeConsentRecord = (c: ConsentRecordRow): JsonApiResource => ({
  type: 'consent-record',
  id: c.id,
  attributes: {
    tenant_id: c.tenantId,
    kind: c.kind,
    facility_rule_id: c.facilityRuleId,
    facility_rule_version: c.facilityRuleVersion,
    waiver_document_id: c.waiverDocumentId,
    waiver_version_id: c.waiverVersionId,
    user_id: c.userId,
    user_name: c.userName ?? c.participantName ?? null,
    guest_contact_id: c.guestContactId,
    participant_name: c.participantName,
    guardian_user_id: c.guardianUserId,
    covered_action: c.coveredAction,
    covered_id: c.coveredId,
    created_at: c.createdAt,
  },
});

/** Guest-contact responses never expose token/code hashes or full contact PII. */
export const serializeGuestContact = (g: GuestContactRow): JsonApiResource => ({
  type: 'guest-contact',
  id: g.id,
  attributes: {
    name: g.name,
    email: g.email,
    phone: g.phone,
    notes: g.notes,
    verified_at: g.verifiedAt,
    created_at: g.createdAt,
  },
});
