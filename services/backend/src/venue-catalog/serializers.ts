import {
  JsonApiResource,
  VenueActivityRow,
  VenueClosureRow,
  VenueFacilityRuleRow,
  VenuePriceRow,
  VenueResourceRow,
  VenueRow,
  VenueWaiverDocumentRow,
  VenueWaiverVersionRow,
} from './catalog.types';

/** Row -> JSON:API resource object. Attributes use snake_case wire names. */

export const serializeVenue = (v: VenueRow): JsonApiResource => ({
  type: 'venue',
  id: v.id,
  attributes: {
    tenant_id: v.tenantId,
    name: v.name,
    timezone: v.timezone,
    status: v.status,
    address: v.address ?? null,
    details: v.details ?? null,
    created_at: v.createdAt,
    updated_at: v.updatedAt,
  },
});

export const serializeResource = (
  r: VenueResourceRow,
  activityIds: string[] = [],
): JsonApiResource => ({
  type: 'resource',
  id: r.id,
  attributes: {
    tenant_id: r.tenantId,
    venue_id: r.venueId,
    name: r.name,
    resource_type: r.resourceType,
    status: r.status,
    capacity: r.capacity,
    settings: r.settings ?? null,
    details: r.details ?? null,
    activity_ids: activityIds,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  },
});

export const serializeActivity = (
  a: VenueActivityRow,
  resourceIds: string[] = [],
): JsonApiResource => ({
  type: 'activity',
  id: a.id,
  attributes: {
    tenant_id: a.tenantId,
    name: a.name,
    code: a.code,
    status: a.status,
    description: a.description,
    details: a.details ?? null,
    resource_ids: resourceIds,
    created_at: a.createdAt,
    updated_at: a.updatedAt,
  },
});

export const serializePrice = (p: VenuePriceRow): JsonApiResource => ({
  type: 'price',
  id: p.id,
  attributes: {
    tenant_id: p.tenantId,
    venue_id: p.venueId,
    resource_id: p.resourceId,
    activity_id: p.activityId,
    label: p.label,
    amount_cents: p.amountCents,
    currency: p.currency,
    unit: p.unit,
    active: p.active,
    details: p.details ?? null,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  },
});

export const serializeFacilityRule = (r: VenueFacilityRuleRow): JsonApiResource => ({
  type: 'facility-rule',
  id: r.id,
  attributes: {
    tenant_id: r.tenantId,
    venue_id: r.venueId,
    resource_id: r.resourceId,
    activity_id: r.activityId,
    title: r.title,
    body: r.body,
    visibility: r.visibility,
    requires_acknowledgment: r.requiresAcknowledgment,
    status: r.status,
    version: r.version,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  },
});

export const serializeClosure = (c: VenueClosureRow): JsonApiResource => ({
  type: 'closure',
  id: c.id,
  attributes: {
    tenant_id: c.tenantId,
    venue_id: c.venueId,
    resource_id: c.resourceId,
    kind: c.kind,
    starts_at: c.startsAt,
    ends_at: c.endsAt,
    recurrence: c.recurrence ?? null,
    reason: c.reason,
    status: c.status,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  },
});

export const serializeWaiverDocument = (d: VenueWaiverDocumentRow): JsonApiResource => ({
  type: 'waiver-document',
  id: d.id,
  attributes: {
    tenant_id: d.tenantId,
    venue_id: d.venueId,
    resource_id: d.resourceId,
    activity_id: d.activityId,
    title: d.title,
    status: d.status,
    current_version: d.currentVersion,
    reacknowledge_on_update: d.reacknowledgeOnUpdate,
    created_at: d.createdAt,
    updated_at: d.updatedAt,
  },
});

export const serializeWaiverVersion = (v: VenueWaiverVersionRow): JsonApiResource => ({
  type: 'waiver-version',
  id: v.id,
  attributes: {
    tenant_id: v.tenantId,
    document_id: v.documentId,
    version: v.version,
    body: v.body,
    status: v.status,
    created_at: v.createdAt,
  },
});
