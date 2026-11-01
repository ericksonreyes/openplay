import { VenueRow, VenueResourceRow, VenueActivityRow, VenuePriceRow, VenueClosureRow, VenueFacilityRuleRow } from '../venue-catalog/catalog.types';
import { EventRegistrationRow, EventRow, ResourceAllocationRow } from '../booking/booking.types';

/**
 * Plain row type for the tenants table (schema.prisma — owned by the
 * foundation module). Only the columns the public surface reads are listed.
 */
export interface TenantRow {
  id: string;
  code: string;
  name: string;
  status: string;
  published: boolean;
  details: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface JsonApiResource {
  type: string;
  id: string;
  attributes: Record<string, unknown>;
}

type Where = Record<string, unknown>;

interface Delegate<Row> {
  findMany(args?: {
    where?: Where;
    orderBy?: Where | Where[];
    take?: number;
  }): Promise<Row[]>;
  findFirst(args: { where: Where }): Promise<Row | null>;
  findUnique(args: { where: Where }): Promise<Row | null>;
}

/**
 * The subset of the PrismaClient used by this module. Everything is read-only
 * — the public surface never writes.
 */
export interface PublicContentDb {
  tenant: Delegate<TenantRow>;
  venue: Delegate<VenueRow>;
  venueResource: Delegate<VenueResourceRow>;
  venueActivity: Delegate<VenueActivityRow>;
  venueActivityResource: Delegate<{ tenantId: string; activityId: string; resourceId: string }>;
  venuePrice: Delegate<VenuePriceRow>;
  venueFacilityRule: Delegate<VenueFacilityRuleRow>;
  venueClosure: Delegate<VenueClosureRow>;
  resourceAllocation: Delegate<ResourceAllocationRow>;
  event: Delegate<EventRow>;
  eventRegistration: Delegate<EventRegistrationRow>;
}

export type {
  VenueRow,
  VenueResourceRow,
  VenueActivityRow,
  VenuePriceRow,
  VenueClosureRow,
  VenueFacilityRuleRow,
  EventRow,
};
