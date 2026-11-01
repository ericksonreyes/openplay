import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ScopedPrisma } from '../prisma/scoped-prisma.service';
import { RecordNotFoundException } from '../common/errors/api-error';
import { computeSlots, resolveGridSettings, Slot } from '../booking/availability';
import { VenueClosureRow } from '../venue-catalog/catalog.types';
import {
  businessListWhere,
  dayRange,
  isPublishedBusiness,
  LISTED_EVENT_STATUSES,
  RESOLVABLE_EVENT_STATUSES,
} from './filters';
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
  JsonApiResource,
  PublicContentDb,
  TenantRow,
  VenueRow,
} from './public-content.types';

type TxClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

const asDb = (tx: TxClient): PublicContentDb => tx as unknown as PublicContentDb;

export interface PublicSlotGrid {
  resource_id: string;
  resource_name: string;
  slots: Slot[];
}

/** Directory results stay bounded so crawler traffic cannot scan the table. */
const PAGE_LIMIT = 50;
const EVENT_LIMIT = 100;

/**
 * Anonymous read surface (PUBLIC_CONTENT.MD).
 *
 * RLS note: the `app.is_public` context is set on the request transaction by
 * RlsContextInterceptor, but no table policy currently grants an `is_public`
 * read arm — venues/events/tenants policies only recognise tenant, platform,
 * and system context. Following the booking module's precedent for actor-less
 * reads, every query here runs inside SystemContextService.run with explicit
 * service-side publication filters (published + active tenant, public
 * visibility, listed statuses). Publication scoping is enforced twice: once
 * in the query where-clauses and again by the allowlist serializers, which
 * can only emit whitelisted fields regardless of what the row contains.
 */
@Injectable()
export class PublicContentService {
  constructor(private readonly prisma: ScopedPrisma) {}

  // Reads run inside the request's own transaction whose RLS context is
  // app.is_public (opened by RlsContextInterceptor for @Public routes) —
  // the database itself now gates publication; serializer allowlists stay
  // as the column-level defense.
  private async db<T>(fn: (tx: PublicContentDb) => Promise<T>): Promise<T> {
    return fn(asDb(this.prisma.client as unknown as TxClient));
  }

  /** Fetch a published, active tenant by slug or 404 — never reveals which failed. */
  private async mustGetBusiness(tx: PublicContentDb, code: string): Promise<TenantRow> {
    const tenant = await tx.tenant.findFirst({
      where: { code, published: true, status: 'active' },
    });
    if (!tenant || !isPublishedBusiness(tenant)) throw new RecordNotFoundException();
    return tenant;
  }

  /** Fetch a venue whose tenant is published and active, or 404. */
  private async mustGetVenue(tx: PublicContentDb, id: string): Promise<VenueRow> {
    const venue = await tx.venue.findFirst({ where: { id, status: 'active' } });
    if (!venue) throw new RecordNotFoundException();
    const tenant = await tx.tenant.findFirst({ where: { id: venue.tenantId } });
    if (!tenant || !isPublishedBusiness(tenant)) throw new RecordNotFoundException();
    return venue;
  }

  // ---------- businesses ----------

  async listBusinesses(name?: string): Promise<JsonApiResource[]> {
    return this.db(async (tx) => {
      const tenants = await tx.tenant.findMany({
        where: businessListWhere(name),
        orderBy: { name: 'asc' },
        take: PAGE_LIMIT,
      });
      return tenants.map((t) => serializeBusiness(t, t.details));
    });
  }

  async getBusiness(code: string): Promise<JsonApiResource> {
    return this.db(async (tx) => {
      const tenant = await this.mustGetBusiness(tx, code);
      const venues = await tx.venue.findMany({
        where: { tenantId: tenant.id, status: 'active' },
        orderBy: { name: 'asc' },
        take: PAGE_LIMIT,
      });
      const business = serializeBusiness(tenant, tenant.details);
      business.attributes['venues'] = venues.map(serializeVenueSummary);
      return business;
    });
  }

  async listBusinessVenues(code: string): Promise<JsonApiResource[]> {
    return this.db(async (tx) => {
      const tenant = await this.mustGetBusiness(tx, code);
      const venues = await tx.venue.findMany({
        where: { tenantId: tenant.id, status: 'active' },
        orderBy: { name: 'asc' },
        take: PAGE_LIMIT,
      });
      return venues.map(serializeVenueSummary);
    });
  }

  // ---------- venues ----------

  async getVenue(id: string): Promise<JsonApiResource> {
    return this.db(async (tx) => {
      const venue = await this.mustGetVenue(tx, id);
      const [resources, activities, prices, rules] = await Promise.all([
        tx.venueResource.findMany({
          where: { venueId: id, status: 'active' },
          orderBy: { name: 'asc' },
        }),
        tx.venueActivity.findMany({
          where: { tenantId: venue.tenantId, status: 'active' },
          orderBy: { name: 'asc' },
        }),
        tx.venuePrice.findMany({
          where: { tenantId: venue.tenantId, active: true },
        }),
        tx.venueFacilityRule.findMany({
          where: {
            tenantId: venue.tenantId,
            status: 'published',
            visibility: 'public',
          },
        }),
      ]);
      const resourceIds = new Set(resources.map((r) => r.id));
      const doc = serializeVenueSummary(venue);
      doc.attributes['resources'] = resources.map(serializePublicResource);
      doc.attributes['activities'] = activities.map(serializePublicActivity);
      doc.attributes['prices'] = prices
        .filter(
          (p) =>
            p.venueId === null ||
            p.venueId === id ||
            (p.resourceId !== null && resourceIds.has(p.resourceId)),
        )
        .map(serializePublicPrice);
      doc.attributes['facility_rules'] = rules
        .filter(
          (r) =>
            r.venueId === null ||
            r.venueId === id ||
            (r.resourceId !== null && resourceIds.has(r.resourceId)),
        )
        .map(serializePublicFacilityRule);
      return doc;
    });
  }

  /**
   * Public bookable-slot grid. Reuses the booking module's pure slot engine
   * (computeSlots/resolveGridSettings); the query orchestration is replicated
   * here rather than calling BookingService.availability because that method
   * is actor-scoped and performs no publication checks — see the class
   * docstring. Output contains slot times and counts only: no reservation,
   * guest, or player data is read into the response.
   */
  async venueAvailability(venueId: string, date: string): Promise<PublicSlotGrid[]> {
    const range = dayRange(date);
    if (!range) throw new RecordNotFoundException();
    return this.db(async (tx) => {
      const venue = await this.mustGetVenue(tx, venueId);
      const now = new Date();
      const resources = await tx.venueResource.findMany({
        where: { venueId, status: 'active' },
        orderBy: { name: 'asc' },
      });
      const closures = await tx.venueClosure.findMany({
        where: {
          tenantId: venue.tenantId,
          OR: [{ venueId }, { venueId: null }],
          status: 'scheduled',
          startsAt: { lt: range.lt },
          endsAt: { gt: range.gte },
        },
      });
      const allocations = await tx.resourceAllocation.findMany({
        where: {
          resourceId: { in: resources.map((r) => r.id) },
          startsAt: { lt: range.lt },
          endsAt: { gt: range.gte },
        },
      });
      return resources.map((resource) => {
        const closuresFor = closures.filter(
          (c: VenueClosureRow) => c.resourceId === null || c.resourceId === resource.id,
        );
        const busy = [
          ...closuresFor.map((c) => ({ startsAt: c.startsAt, endsAt: c.endsAt })),
          ...allocations
            .filter(
              (a) =>
                a.resourceId === resource.id &&
                (a.expiresAt === null || a.expiresAt > now),
            )
            .map((a) => ({ startsAt: a.startsAt, endsAt: a.endsAt })),
        ];
        return {
          resource_id: resource.id,
          resource_name: resource.name,
          slots: computeSlots(range.gte, resolveGridSettings(resource.settings), busy, now),
        };
      });
    });
  }

  // ---------- events ----------

  /** Upcoming published events of published businesses. */
  async listEvents(filter: { date?: string; tenantCode?: string } = {}): Promise<JsonApiResource[]> {
    return this.db(async (tx) => {
      let tenantId: string | undefined;
      if (filter.tenantCode) {
        const tenant = await tx.tenant.findFirst({
          where: { code: filter.tenantCode, published: true, status: 'active' },
        });
        // Unknown/unpublished code -> empty list, never an existence signal.
        if (!tenant) return [];
        tenantId = tenant.id;
      }
      const published = await tx.tenant.findMany({
        where: { published: true, status: 'active' },
        take: 500,
      });
      const publishedIds = new Set(published.map((t) => t.id));
      const range = filter.date ? dayRange(filter.date) : null;
      const where: Record<string, unknown> = {
        visibility: 'public',
        status: { in: [...LISTED_EVENT_STATUSES] },
        ...(tenantId ? { tenantId } : {}),
        startsAt: range ? { gte: range.gte, lt: range.lt } : { gte: new Date() },
      };
      const events = await tx.event.findMany({
        where,
        orderBy: { startsAt: 'asc' },
        take: EVENT_LIMIT,
      });
      const codes = new Map(published.map((t) => [t.id, t.code]));
      return events
        .filter((e) => publishedIds.has(e.tenantId))
        .map((e) => serializePublicEvent(e, { businessCode: codes.get(e.tenantId) }));
    });
  }

  /** Public event detail; ended/cancelled events still resolve per spec. */
  async getEvent(id: string): Promise<JsonApiResource> {
    return this.db(async (tx) => {
      const event = await tx.event.findFirst({
        where: {
          id,
          visibility: 'public',
          status: { in: [...RESOLVABLE_EVENT_STATUSES] },
        },
      });
      if (!event) throw new RecordNotFoundException();
      const tenant = await tx.tenant.findFirst({ where: { id: event.tenantId } });
      if (!tenant || !isPublishedBusiness(tenant)) throw new RecordNotFoundException();
      const registrations = await tx.eventRegistration.findMany({
        where: { eventId: event.id, status: { in: ['pending', 'confirmed'] } },
      });
      const registered = registrations.reduce((sum, r) => sum + r.seats, 0);
      return serializePublicEvent(event, {
        businessCode: tenant.code,
        registeredCount: registered,
      });
    });
  }
}
