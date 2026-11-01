import {
  serializeClosure,
  serializeFacilityRule,
  serializeResource,
  serializeVenue,
  serializeWaiverVersion,
} from './serializers';
import {
  VenueClosureRow,
  VenueFacilityRuleRow,
  VenueResourceRow,
  VenueRow,
  VenueWaiverVersionRow,
} from './catalog.types';
import { newId } from '../common/ids/uuid';

const now = new Date('2030-01-01T00:00:00Z');

const venue: VenueRow = {
  id: newId(),
  tenantId: newId(),
  name: 'Main Hall',
  timezone: 'Asia/Manila',
  status: 'active',
  address: { city: 'Makati' },
  details: null,
  createdAt: now,
  updatedAt: now,
};

describe('serializers', () => {
  it('emits a venue resource object with snake_case attributes', () => {
    const doc = serializeVenue(venue);
    expect(doc.type).toBe('venue');
    expect(doc.id).toBe(venue.id);
    expect(doc.attributes).toMatchObject({
      tenant_id: venue.tenantId,
      name: 'Main Hall',
      timezone: 'Asia/Manila',
      status: 'active',
      created_at: now,
    });
  });

  it('serializes a resource with linked activity ids', () => {
    const activityId = newId();
    const resource: VenueResourceRow = {
      id: newId(),
      tenantId: venue.tenantId,
      venueId: venue.id,
      name: 'Court A',
      resourceType: 'court',
      status: 'active',
      capacity: 4,
      settings: { buffer_minutes: 10 },
      details: null,
      createdAt: now,
      updatedAt: now,
    };
    const doc = serializeResource(resource, [activityId]);
    expect(doc.type).toBe('resource');
    expect(doc.attributes['activity_ids']).toEqual([activityId]);
    expect(doc.attributes['resource_type']).toBe('court');
  });

  it('serializes a closure window', () => {
    const closure: VenueClosureRow = {
      id: newId(),
      tenantId: venue.tenantId,
      venueId: venue.id,
      resourceId: null,
      kind: 'closure',
      startsAt: now,
      endsAt: new Date(now.getTime() + 3600_000),
      recurrence: null,
      reason: 'Maintenance',
      status: 'scheduled',
      createdAt: now,
      updatedAt: now,
    };
    const doc = serializeClosure(closure);
    expect(doc.type).toBe('closure');
    expect(doc.attributes['kind']).toBe('closure');
    expect(doc.attributes['reason']).toBe('Maintenance');
  });

  it('serializes a facility rule with visibility and version', () => {
    const rule: VenueFacilityRuleRow = {
      id: newId(),
      tenantId: venue.tenantId,
      venueId: venue.id,
      resourceId: null,
      activityId: null,
      title: 'House rule',
      body: 'Be kind.',
      visibility: 'public',
      requiresAcknowledgment: true,
      status: 'published',
      version: 3,
      createdAt: now,
      updatedAt: now,
    };
    const doc = serializeFacilityRule(rule);
    expect(doc.type).toBe('facility-rule');
    expect(doc.attributes).toMatchObject({
      visibility: 'public',
      requires_acknowledgment: true,
      version: 3,
    });
  });

  it('serializes a waiver version', () => {
    const version: VenueWaiverVersionRow = {
      id: newId(),
      tenantId: venue.tenantId,
      documentId: newId(),
      version: 2,
      body: 'Waiver text v2',
      status: 'published',
      createdAt: now,
    };
    const doc = serializeWaiverVersion(version);
    expect(doc.type).toBe('waiver-version');
    expect(doc.attributes['version']).toBe(2);
    expect(doc.attributes['document_id']).toBe(version.documentId);
  });
});
