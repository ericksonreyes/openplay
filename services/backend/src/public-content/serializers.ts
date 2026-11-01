import {
  EventRow,
  JsonApiResource,
  TenantRow,
  VenueActivityRow,
  VenueFacilityRuleRow,
  VenuePriceRow,
  VenueResourceRow,
  VenueRow,
} from './public-content.types';

/**
 * PUBLIC FIELD ALLOWLIST — the only fields the anonymous surface may emit.
 *
 * Every serializer below maps a row to an explicit attribute literal. Adding
 * a column to a table never adds it to a public response — it must be listed
 * here deliberately. Forbidden by spec (INTERNAL_SERVICE_SECURITY,
 * BUSINESS_PROFILE_PAGES): contacts/PII (emails, phones, guest or staff
 * names/ids), payment internals, internal notes, tenant/user ids of
 * internals, unpublished content, and bookkeeping fields (created_by,
 * idempotency keys, audit metadata).
 */

/** details JSON keys that are safe to publish; everything else is dropped. */
const VENUE_DETAILS_ALLOWLIST = ['description', 'amenities', 'images'] as const;
const BUSINESS_DETAILS_ALLOWLIST = ['description', 'logo', 'images', 'links'] as const;

const pick = (source: unknown, keys: readonly string[]): Record<string, unknown> | null => {
  if (source === null || typeof source !== 'object' || Array.isArray(source)) {
    return null;
  }
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if ((source as Record<string, unknown>)[key] !== undefined) {
      out[key] = (source as Record<string, unknown>)[key];
    }
  }
  return Object.keys(out).length > 0 ? out : null;
};

/** tenants -> 'business'. `id` is the public slug (code), not the internal uuid. */
export const serializeBusiness = (t: TenantRow, details?: unknown): JsonApiResource => ({
  type: 'business',
  id: t.code,
  attributes: {
    code: t.code,
    name: t.name,
    profile: pick(details, BUSINESS_DETAILS_ALLOWLIST),
  },
});

export const serializeVenueSummary = (v: VenueRow): JsonApiResource => ({
  type: 'venue',
  id: v.id,
  attributes: {
    name: v.name,
    timezone: v.timezone,
    address: v.address ?? null,
    details: pick(v.details, VENUE_DETAILS_ALLOWLIST),
  },
});

export const serializePublicResource = (r: VenueResourceRow): JsonApiResource => ({
  type: 'resource',
  id: r.id,
  attributes: {
    name: r.name,
    resource_type: r.resourceType,
    capacity: r.capacity,
  },
});

export const serializePublicActivity = (a: VenueActivityRow): JsonApiResource => ({
  type: 'activity',
  id: a.id,
  attributes: {
    name: a.name,
    code: a.code,
    description: a.description,
  },
});

export const serializePublicPrice = (p: VenuePriceRow): JsonApiResource => ({
  type: 'price',
  id: p.id,
  attributes: {
    label: p.label,
    amount_cents: p.amountCents,
    currency: p.currency,
    unit: p.unit,
    resource_id: p.resourceId,
    activity_id: p.activityId,
  },
});

export const serializePublicFacilityRule = (r: VenueFacilityRuleRow): JsonApiResource => ({
  type: 'facility-rule',
  id: r.id,
  attributes: {
    title: r.title,
    body: r.body,
    resource_id: r.resourceId,
    activity_id: r.activityId,
  },
});

/** Event lifecycle states a public reader may learn about at all. */
export const ENDED_EVENT_STATUSES = ['complete', 'cancelled'] as const;

export const serializePublicEvent = (
  e: EventRow,
  extras: { businessCode?: string; registeredCount?: number } = {},
): JsonApiResource => ({
  type: 'event',
  id: e.id,
  attributes: {
    name: e.name,
    description: e.description,
    format: e.format,
    status: e.status,
    state: (ENDED_EVENT_STATUSES as readonly string[]).includes(e.status)
      ? 'ended'
      : 'upcoming',
    starts_at: e.startsAt,
    ends_at: e.endsAt,
    capacity: e.capacity,
    capacity_unit: e.capacityUnit,
    remaining_capacity:
      extras.registeredCount !== undefined
        ? Math.max(0, e.capacity - extras.registeredCount)
        : null,
    fee_cents: e.feeCents,
    currency: e.currency,
    fee_basis: e.feeBasis,
    payment_timing: e.paymentTiming,
    venue_id: e.venueId,
    business_code: extras.businessCode ?? null,
  },
});
