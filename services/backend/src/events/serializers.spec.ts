import { serializeEvent, serializeRegistration } from './serializers';
import { EventRegistrationRow, EventRow } from '../booking/booking.types';
import { newId } from '../common/ids/uuid';
import { SqidCodec } from '../common/ids/sqid';

const now = new Date('2030-01-01T00:00:00Z');

const event: EventRow = {
  id: newId(),
  tenantId: newId(),
  venueId: newId(),
  activityId: null,
  seriesId: null,
  name: 'Open Play',
  description: null,
  format: 'open_play',
  status: 'published',
  visibility: 'public',
  startsAt: now,
  endsAt: new Date(now.getTime() + 7_200_000),
  bufferMinutes: 10,
  capacity: 12,
  capacityUnit: 'participant',
  feeCents: 0,
  currency: 'USD',
  feeBasis: 'participant',
  paymentTiming: 'free',
  registrationOpensAt: null,
  registrationClosesAt: null,
  waitlistEnabled: true,
  resultsEnabled: false,
  cancellationReason: null,
  details: { resource_ids: ['r1'] },
  createdBy: null,
  createdAt: now,
  updatedAt: now,
};

const registration: EventRegistrationRow = {
  id: 42n,
  uuid: newId(),
  referenceNo: 'REG-000042',
  tenantId: event.tenantId,
  eventId: event.id,
  playerId: newId(),
  guestContactId: null,
  kind: 'individual',
  teamName: null,
  roster: null,
  seats: 1,
  status: 'confirmed',
  waitlistPosition: null,
  paymentState: 'none',
  amountDueCents: 0,
  dueAt: null,
  holdExpiresAt: null,
  idempotencyKey: null,
  registeredAt: now,
  createdAt: now,
  updatedAt: now,
};

describe('events serializers', () => {
  it('serializes an event with computed remaining capacity', () => {
    const doc = serializeEvent(event, { resourceIds: ['r1'], registeredCount: 5 });
    expect(doc.type).toBe('event');
    expect(doc.id).toBe(event.id);
    expect(doc.attributes).toMatchObject({
      format: 'open_play',
      capacity: 12,
      registered_count: 5,
      remaining_capacity: 7,
      resource_ids: ['r1'],
      waitlist_enabled: true,
    });
  });

  it('exposes the registration SQID, never the bigint or uuid', () => {
    const doc = serializeRegistration(registration);
    expect(doc.type).toBe('event-registration');
    expect(doc.id).toBe(new SqidCodec().encode('event-registration', 42n));
    expect(JSON.stringify(doc)).not.toContain(registration.uuid);
    expect(doc.attributes).toMatchObject({
      reference_no: 'REG-000042',
      status: 'confirmed',
      seats: 1,
    });
  });
});
