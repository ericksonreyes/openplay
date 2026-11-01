import {
  serializeBusiness,
  serializePublicActivity,
  serializePublicEvent,
  serializePublicFacilityRule,
  serializePublicPrice,
  serializePublicResource,
  serializeVenueSummary,
} from './serializers';
import {
  EventRow,
  TenantRow,
  VenueActivityRow,
  VenueFacilityRuleRow,
  VenuePriceRow,
  VenueResourceRow,
  VenueRow,
} from './public-content.types';
import { newId } from '../common/ids/uuid';

const now = new Date('2030-01-01T00:00:00Z');

const tenant: TenantRow = {
  id: newId(),
  code: 'acme-sports',
  name: 'Acme Sports',
  status: 'active',
  published: true,
  details: { description: 'Demo club', logo: null, images: [], links: {}, secret: 'drop-me' },
  createdAt: now,
  updatedAt: now,
};

const venue: VenueRow = {
  id: newId(),
  tenantId: tenant.id,
  name: 'Main Hall',
  timezone: 'Asia/Manila',
  status: 'active',
  address: { line1: '1 Court St', city: 'Makati', lat: 14.5, lng: 121.0 },
  details: {
    description: 'Indoor courts',
    amenities: ['showers'],
    images: ['https://img/1.png'],
    contact: { phone: '+63917', email: 'gm@acme.test' },
    internal_notes: 'do not leak',
  },
  createdAt: now,
  updatedAt: now,
};

const event: EventRow = {
  id: newId(),
  tenantId: tenant.id,
  venueId: venue.id,
  activityId: null,
  seriesId: null,
  name: 'Friday Open Play',
  description: 'All levels',
  format: 'open_play',
  status: 'published',
  visibility: 'public',
  startsAt: now,
  endsAt: new Date(now.getTime() + 2 * 3_600_000),
  bufferMinutes: 0,
  capacity: 20,
  capacityUnit: 'participant',
  feeCents: 15000,
  currency: 'PHP',
  feeBasis: 'participant',
  paymentTiming: 'full',
  registrationOpensAt: null,
  registrationClosesAt: null,
  waitlistEnabled: false,
  resultsEnabled: false,
  cancellationReason: null,
  details: { roster_rules: { internal: true } },
  createdBy: newId(),
  createdAt: now,
  updatedAt: now,
};

const FORBIDDEN_KEYS = [
  'tenant_id',
  'created_by',
  'created_at',
  'updated_at',
  'idempotency_key',
  'payment_state',
  'player_id',
  'guest_contact_id',
  'roster',
  'notes',
  'contact',
  'phone',
  'email',
  'internal_notes',
  'cancellation_reason',
];

const expectNoForbiddenKeys = (resource: { attributes: Record<string, unknown> }) => {
  for (const key of FORBIDDEN_KEYS) {
    expect(resource.attributes).not.toHaveProperty(key);
  }
  expect(JSON.stringify(resource.attributes)).not.toMatch(/gm@acme|63917|internal_notes|roster_rules/);
};

describe('public allowlist serializers', () => {
  it('serializes a business with code as the public id', () => {
    const doc = serializeBusiness(tenant);
    expect(doc.type).toBe('business');
    expect(doc.id).toBe('acme-sports');
    expect(Object.keys(doc.attributes).sort()).toEqual(['code', 'name', 'profile']);
    expectNoForbiddenKeys(doc);
  });

  it('serializes a venue summary without contact or internal details', () => {
    const doc = serializeVenueSummary(venue);
    expect(doc.type).toBe('venue');
    expect(doc.id).toBe(venue.id);
    expect(doc.attributes['details']).toEqual({
      description: 'Indoor courts',
      amenities: ['showers'],
      images: ['https://img/1.png'],
    });
    expectNoForbiddenKeys(doc);
  });

  it('drops details entirely when nothing is publishable', () => {
    const doc = serializeVenueSummary({ ...venue, details: { contact: { phone: 'x' } } });
    expect(doc.attributes['details']).toBeNull();
  });

  it('serializes resources, activities, prices, and rules within their allowlists', () => {
    const resource: VenueResourceRow = {
      id: newId(), tenantId: tenant.id, venueId: venue.id, name: 'Court A',
      resourceType: 'court', status: 'active', capacity: 4,
      settings: { buffer_minutes: 10 }, details: { notes: 'private' },
      createdAt: now, updatedAt: now,
    };
    expect(Object.keys(serializePublicResource(resource).attributes).sort())
      .toEqual(['capacity', 'name', 'resource_type']);
    expectNoForbiddenKeys(serializePublicResource(resource));

    const activity: VenueActivityRow = {
      id: newId(), tenantId: tenant.id, name: 'Pickleball', code: 'PB',
      status: 'active', description: 'Open play', details: null,
      createdAt: now, updatedAt: now,
    };
    expect(Object.keys(serializePublicActivity(activity).attributes).sort())
      .toEqual(['code', 'description', 'name']);

    const price: VenuePriceRow = {
      id: newId(), tenantId: tenant.id, venueId: venue.id, resourceId: null,
      activityId: null, label: 'Hourly', amountCents: 50000, currency: 'PHP',
      unit: 'hour', active: true, details: { cost_basis: 'secret' },
      createdAt: now, updatedAt: now,
    };
    expect(Object.keys(serializePublicPrice(price).attributes).sort())
      .toEqual(['activity_id', 'amount_cents', 'currency', 'label', 'resource_id', 'unit']);
    expectNoForbiddenKeys(serializePublicPrice(price));

    const rule: VenueFacilityRuleRow = {
      id: newId(), tenantId: tenant.id, venueId: venue.id, resourceId: null,
      activityId: null, title: 'Shoes', body: 'Non-marking only',
      visibility: 'public', requiresAcknowledgment: true, status: 'published',
      version: 3, createdAt: now, updatedAt: now,
    };
    expect(Object.keys(serializePublicFacilityRule(rule).attributes).sort())
      .toEqual(['activity_id', 'body', 'resource_id', 'title']);
    expectNoForbiddenKeys(serializePublicFacilityRule(rule));
  });

  it('serializes an upcoming event with public fee/capacity fields only', () => {
    const doc = serializePublicEvent(event, { businessCode: 'acme-sports', registeredCount: 5 });
    expect(doc.type).toBe('event');
    expect(doc.attributes['state']).toBe('upcoming');
    expect(doc.attributes['remaining_capacity']).toBe(15);
    expect(doc.attributes['business_code']).toBe('acme-sports');
    expectNoForbiddenKeys(doc);
  });

  it('marks complete/cancelled events as ended', () => {
    expect(serializePublicEvent({ ...event, status: 'complete' }).attributes['state']).toBe('ended');
    expect(serializePublicEvent({ ...event, status: 'cancelled' }).attributes['state']).toBe('ended');
  });
});
