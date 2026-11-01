import {
  serializeCheckIn,
  serializeConsentRecord,
  serializeReservation,
} from './serializers';
import { CheckInRow, ConsentRecordRow, ReservationRow } from './booking.types';
import { newId } from '../common/ids/uuid';
import { SqidCodec } from '../common/ids/sqid';

const now = new Date('2030-01-01T00:00:00Z');

const reservation: ReservationRow = {
  id: 504n,
  uuid: newId(),
  referenceNo: 'RES-000504',
  tenantId: newId(),
  venueId: newId(),
  resourceId: newId(),
  activityId: null,
  playerId: newId(),
  guestContactId: null,
  seriesId: null,
  status: 'hold',
  startsAt: now,
  endsAt: new Date(now.getTime() + 3_600_000),
  bufferMinutes: 10,
  partySize: 2,
  holdExpiresAt: new Date(now.getTime() + 900_000),
  noShowMarkedAt: null,
  cancellation: { free_cancel_hours: 24 },
  paymentState: 'none',
  notes: null,
  idempotencyKey: null,
  createdBy: null,
  createdAt: now,
  updatedAt: now,
};

describe('booking serializers', () => {
  it('exposes the reservation SQID, never the bigint or uuid', () => {
    const doc = serializeReservation(reservation);
    expect(doc.type).toBe('reservation');
    const expected = new SqidCodec().encode('reservation', 504n);
    expect(doc.id).toBe(expected);
    expect(JSON.stringify(doc)).not.toContain(reservation.uuid);
    expect(doc.attributes).toMatchObject({
      reference_no: 'RES-000504',
      status: 'hold',
      party_size: 2,
      buffer_minutes: 10,
    });
  });

  it('serializes a check-in record', () => {
    const checkIn: CheckInRow = {
      id: newId(),
      tenantId: reservation.tenantId,
      venueId: reservation.venueId,
      reservationUuid: reservation.uuid,
      registrationUuid: null,
      subjectUserId: reservation.playerId,
      guestContactId: null,
      outcome: 'arrived',
      method: 'qr',
      recordedBy: null,
      recordedAt: now,
    };
    const doc = serializeCheckIn(checkIn);
    expect(doc.type).toBe('check-in');
    expect(doc.attributes).toMatchObject({ outcome: 'arrived', method: 'qr' });
  });

  it('serializes a consent record', () => {
    const consent: ConsentRecordRow = {
      id: newId(),
      tenantId: reservation.tenantId,
      kind: 'waiver',
      facilityRuleId: null,
      facilityRuleVersion: null,
      waiverDocumentId: newId(),
      waiverVersionId: newId(),
      userId: reservation.playerId,
      guestContactId: null,
      participantName: null,
      guardianUserId: null,
      coveredAction: 'reservation',
      coveredId: null,
      createdAt: now,
    };
    const doc = serializeConsentRecord(consent);
    expect(doc.type).toBe('consent-record');
    expect(doc.attributes).toMatchObject({ kind: 'waiver', covered_action: 'reservation' });
  });
});
