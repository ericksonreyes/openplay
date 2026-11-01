import { SqidCodec } from '../common/ids/sqid';
import {
  EventRegistrationRow,
  EventResultRow,
  EventRow,
  EventSeriesRow,
  JsonApiResource,
} from '../booking/booking.types';

/** Row -> JSON:API resource object. Attributes use snake_case wire names. */

const sqids = new SqidCodec();
export const REGISTRATION_SQID_SCOPE = 'event-registration';

export const registrationPublicId = (id: bigint): string =>
  sqids.encode(REGISTRATION_SQID_SCOPE, id);

export const serializeEvent = (
  e: EventRow,
  extras: { resourceIds?: string[]; registeredCount?: number } = {},
): JsonApiResource => ({
  type: 'event',
  id: e.id,
  attributes: {
    tenant_id: e.tenantId,
    venue_id: e.venueId,
    activity_id: e.activityId,
    series_id: e.seriesId,
    name: e.name,
    description: e.description,
    format: e.format,
    status: e.status,
    visibility: e.visibility,
    starts_at: e.startsAt,
    ends_at: e.endsAt,
    buffer_minutes: e.bufferMinutes,
    capacity: e.capacity,
    capacity_unit: e.capacityUnit,
    registered_count: extras.registeredCount ?? null,
    remaining_capacity:
      extras.registeredCount !== undefined ? Math.max(0, e.capacity - extras.registeredCount) : null,
    fee_cents: e.feeCents,
    currency: e.currency,
    fee_basis: e.feeBasis,
    payment_timing: e.paymentTiming,
    registration_opens_at: e.registrationOpensAt,
    registration_closes_at: e.registrationClosesAt,
    waitlist_enabled: e.waitlistEnabled,
    results_enabled: e.resultsEnabled,
    cancellation_reason: e.cancellationReason,
    details: e.details ?? null,
    resource_ids: extras.resourceIds ?? [],
    created_at: e.createdAt,
    updated_at: e.updatedAt,
  },
});

export const serializeEventSeries = (s: EventSeriesRow): JsonApiResource => ({
  type: 'event-series',
  id: s.id,
  attributes: {
    tenant_id: s.tenantId,
    name: s.name,
    rule: s.rule,
    status: s.status,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
  },
});

export const serializeRegistration = (r: EventRegistrationRow): JsonApiResource => ({
  type: 'event-registration',
  id: registrationPublicId(r.id),
  attributes: {
    reference_no: r.referenceNo,
    tenant_id: r.tenantId,
    event_id: r.eventId,
    player_id: r.playerId,
    guest_contact_id: r.guestContactId,
    kind: r.kind,
    team_name: r.teamName,
    roster: r.roster ?? null,
    seats: r.seats,
    status: r.status,
    waitlist_position: r.waitlistPosition,
    payment_state: r.paymentState,
    amount_due_cents: r.amountDueCents,
    due_at: r.dueAt,
    registered_at: r.registeredAt,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  },
});

export const serializeEventResult = (r: EventResultRow): JsonApiResource => ({
  type: 'event-result',
  id: r.id,
  attributes: {
    tenant_id: r.tenantId,
    event_id: r.eventId,
    registration_id: r.registrationId !== null ? registrationPublicId(r.registrationId) : null,
    label: r.label,
    result: r.result,
    recorded_by: r.recordedBy,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  },
});
