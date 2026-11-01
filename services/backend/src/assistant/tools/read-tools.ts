import { computeSlots, resolveGridSettings } from '../../booking/availability';
import {
  EventRegistrationRow,
  ReservationRow,
  ResourceAllocationRow,
} from '../../booking/booking.types';
import { VenueClosureRow, VenueResourceRow, VenueRow } from '../../venue-catalog/catalog.types';
import { ToolDefinition } from './registry';

/**
 * Read-only tools. Every handler queries the caller's scoped transaction —
 * tenant rows are already RLS-filtered; player callers (no tenant) get
 * explicit ownership filters mirroring the API services.
 */

const boundedString = (value: unknown, max: number): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value.slice(0, max) : undefined;

const boundedLimit = (value: unknown, fallback: number, max: number): number => {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback;
  return Math.min(Math.max(n, 1), max);
};

const reservationSummary = (r: ReservationRow) => ({
  reference: r.referenceNo ?? r.uuid,
  status: r.status,
  venue_id: r.venueId,
  resource_id: r.resourceId,
  starts_at: r.startsAt.toISOString(),
  ends_at: r.endsAt.toISOString(),
  party_size: r.partySize,
});

export function readTools(): ToolDefinition[] {
  return [
    {
      spec: {
        name: 'search_venues',
        description:
          'Search venues visible to the caller: their tenant venues (staff) or published/active venues (players). Read-only.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Optional name filter.' },
            limit: { type: 'integer', description: 'Max results (default 10, max 20).' },
          },
        },
      },
      handler: async (args, ctx) => {
        const where: Record<string, unknown> = ctx.actor.tenantId
          ? { tenantId: ctx.actor.tenantId }
          : { status: 'active' };
        const rows = await ctx.tx.venue.findMany({ where, orderBy: { name: 'asc' } });
        const q = boundedString(args['query'], 100)?.toLowerCase();
        const filtered = (q ? rows.filter((v: VenueRow) => v.name.toLowerCase().includes(q)) : rows)
          .slice(0, boundedLimit(args['limit'], 10, 20));
        return {
          count: filtered.length,
          venues: filtered.map((v: VenueRow) => ({ id: v.id, name: v.name, status: v.status })),
        };
      },
    },
    {
      spec: {
        name: 'get_availability',
        description:
          'Bookable slot grid for a venue on a date (YYYY-MM-DD). Optionally one resource. Read-only; submission still revalidates.',
        parameters: {
          type: 'object',
          required: ['venue_id', 'date'],
          properties: {
            venue_id: { type: 'string' },
            resource_id: { type: 'string' },
            date: { type: 'string', description: 'YYYY-MM-DD' },
          },
        },
      },
      handler: async (args, ctx) => {
        const venueId = boundedString(args['venue_id'], 64);
        const date = boundedString(args['date'], 10);
        if (!venueId || !date) return { error: 'venue_id and date are required' };
        const dayStart = new Date(`${date}T00:00:00.000Z`);
        if (Number.isNaN(dayStart.getTime())) return { error: 'date must be YYYY-MM-DD' };
        const dayEnd = new Date(dayStart.getTime() + 24 * 3_600_000);
        const now = new Date();
        const resourceWhere: Record<string, unknown> = { venueId, status: 'active' };
        const resourceId = boundedString(args['resource_id'], 64);
        if (resourceId) resourceWhere['id'] = resourceId;
        const resources = await ctx.tx.venueResource.findMany({
          where: resourceWhere,
          orderBy: { name: 'asc' },
        });
        if (resources.length === 0) return { error: 'not_found', grids: [] };
        const closures = await ctx.tx.venueClosure.findMany({
          where: {
            OR: [{ venueId }, { venueId: null }],
            status: 'scheduled',
            startsAt: { lt: dayEnd },
            endsAt: { gt: dayStart },
          },
        });
        const allocations = await ctx.tx.resourceAllocation.findMany({
          where: {
            resourceId: { in: resources.map((r: VenueResourceRow) => r.id) },
            startsAt: { lt: dayEnd },
            endsAt: { gt: dayStart },
          },
        });
        return {
          grids: resources.map((resource: VenueResourceRow) => {
            const busy = [
              ...closures
                .filter((c: VenueClosureRow) => c.resourceId === null || c.resourceId === resource.id)
                .map((c: VenueClosureRow) => ({ startsAt: c.startsAt, endsAt: c.endsAt })),
              ...allocations
                .filter(
                  (a: ResourceAllocationRow) =>
                    a.resourceId === resource.id && (a.expiresAt === null || a.expiresAt > now),
                )
                .map((a: ResourceAllocationRow) => ({ startsAt: a.startsAt, endsAt: a.endsAt })),
            ];
            const slots = computeSlots(dayStart, resolveGridSettings(resource.settings), busy, now);
            return {
              resource_id: resource.id,
              resource_name: resource.name,
              open_slots: slots.filter((s) => s.available).length,
              slots,
            };
          }),
        };
      },
    },
    {
      spec: {
        name: 'list_reservations',
        description:
          'List reservations in the caller scope — a player sees only their own; tenant staff see their tenant’s. Bounded to 20. Read-only.',
        parameters: {
          type: 'object',
          properties: {
            limit: { type: 'integer', description: 'Max results (default 10, max 20).' },
          },
        },
      },
      handler: async (args, ctx) => {
        const where: Record<string, unknown> = {};
        if (ctx.actor.tenantId) {
          where['tenantId'] = ctx.actor.tenantId;
        } else {
          where['playerId'] = ctx.actor.userId ?? '__none__';
        }
        const rows = await ctx.tx.reservation.findMany({
          where,
          orderBy: { startsAt: 'desc' },
        });
        const page = rows.slice(0, boundedLimit(args['limit'], 10, 20));
        return { count: page.length, total_in_scope: rows.length, reservations: page.map(reservationSummary) };
      },
    },
    {
      spec: {
        name: 'lookup_event',
        description:
          'Look up a scheduled event by id within the caller scope. Players only see public, non-draft events. Read-only.',
        parameters: {
          type: 'object',
          required: ['event_id'],
          properties: { event_id: { type: 'string' } },
        },
      },
      handler: async (args, ctx) => {
        const eventId = boundedString(args['event_id'], 64);
        if (!eventId) return { error: 'event_id is required' };
        const event = await ctx.tx.event.findFirst({ where: { id: eventId } });
        if (!event) return { error: 'not_found' };
        const staff = Boolean(ctx.actor.tenantId);
        if (!staff && (event.visibility !== 'public' || event.status === 'draft' || event.status === 'cancelled')) {
          return { error: 'not_found' };
        }
        const registrations = await ctx.tx.eventRegistration.findMany({
          where: { eventId: event.id, status: 'confirmed' },
        });
        const seats = registrations.reduce(
          (sum: number, r: EventRegistrationRow) => sum + r.seats,
          0,
        );
        return {
          event: {
            id: event.id,
            name: event.name,
            format: event.format,
            status: event.status,
            venue_id: event.venueId,
            starts_at: event.startsAt.toISOString(),
            ends_at: event.endsAt.toISOString(),
            capacity: event.capacity,
            registered: seats,
            fee_cents: event.feeCents,
            currency: event.currency,
          },
        };
      },
    },
    {
      spec: {
        name: 'summarize_day',
        description:
          'Tenant staff only: reservation count per resource for a date (default today). Read-only.',
        parameters: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'YYYY-MM-DD (default: today).' },
            venue_id: { type: 'string', description: 'Optional venue filter.' },
          },
        },
      },
      handler: async (args, ctx) => {
        if (!ctx.actor.tenantId) {
          return { error: 'tenant_scope_required' };
        }
        const date = boundedString(args['date'], 10) ?? new Date().toISOString().slice(0, 10);
        const dayStart = new Date(`${date}T00:00:00.000Z`);
        if (Number.isNaN(dayStart.getTime())) return { error: 'date must be YYYY-MM-DD' };
        const dayEnd = new Date(dayStart.getTime() + 24 * 3_600_000);
        const where: Record<string, unknown> = {
          tenantId: ctx.actor.tenantId,
          startsAt: { lt: dayEnd },
          endsAt: { gt: dayStart },
          status: { notIn: ['cancelled', 'declined'] },
        };
        const venueId = boundedString(args['venue_id'], 64);
        if (venueId) where['venueId'] = venueId;
        const rows = await ctx.tx.reservation.findMany({ where });
        const perResource = new Map<string, number>();
        for (const r of rows) {
          perResource.set(r.resourceId, (perResource.get(r.resourceId) ?? 0) + 1);
        }
        return {
          date,
          total: rows.length,
          per_resource: [...perResource.entries()].map(([resource_id, count]) => ({
            resource_id,
            reservations: count,
          })),
        };
      },
    },
  ];
}
