/**
 * Plain row types mirroring prisma/models/venue_catalog.prisma.fragment.
 * The generated Prisma client only gains these models after the orchestrator
 * merges the fragment, so the service accesses delegates through CatalogDb —
 * delegate names already match the final model names.
 */

export interface VenueRow {
  id: string;
  tenantId: string;
  name: string;
  timezone: string;
  status: string;
  address: unknown;
  details: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface VenueResourceRow {
  id: string;
  tenantId: string;
  venueId: string;
  name: string;
  resourceType: string;
  status: string;
  capacity: number | null;
  settings: unknown;
  details: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface VenueActivityRow {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  status: string;
  description: string | null;
  details: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface VenueActivityResourceRow {
  tenantId: string;
  activityId: string;
  resourceId: string;
}

export interface VenuePriceRow {
  id: string;
  tenantId: string;
  venueId: string | null;
  resourceId: string | null;
  activityId: string | null;
  label: string;
  amountCents: number;
  currency: string;
  unit: string;
  active: boolean;
  details: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface VenueFacilityRuleRow {
  id: string;
  tenantId: string;
  venueId: string | null;
  resourceId: string | null;
  activityId: string | null;
  title: string;
  body: string;
  visibility: string;
  requiresAcknowledgment: boolean;
  status: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface VenueClosureRow {
  id: string;
  tenantId: string;
  venueId: string | null;
  resourceId: string | null;
  kind: string;
  startsAt: Date;
  endsAt: Date;
  recurrence: unknown;
  reason: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface VenueWaiverDocumentRow {
  id: string;
  tenantId: string;
  venueId: string | null;
  resourceId: string | null;
  activityId: string | null;
  title: string;
  status: string;
  currentVersion: number;
  reacknowledgeOnUpdate: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface VenueWaiverVersionRow {
  id: string;
  tenantId: string;
  documentId: string;
  version: number;
  body: string;
  status: string;
  createdAt: Date;
}

type Where = Record<string, unknown>;

interface Delegate<Row> {
  count(args?: { where?: Where }): Promise<number>;
  create(args: { data: Record<string, unknown> }): Promise<Row>;
  findMany(args?: {
    where?: Where;
    orderBy?: Where | Where[];
  }): Promise<Row[]>;
  findFirst(args: { where: Where }): Promise<Row | null>;
  update(args: { where: Where; data: Record<string, unknown> }): Promise<Row>;
  delete(args: { where: Where }): Promise<Row>;
  deleteMany(args: { where: Where }): Promise<{ count: number }>;
}

/** The subset of the post-merge PrismaClient used by this module. */
export interface CatalogDb {
  venue: Delegate<VenueRow>;
  venueResource: Delegate<VenueResourceRow>;
  venueActivity: Delegate<VenueActivityRow>;
  venueActivityResource: Delegate<VenueActivityResourceRow>;
  venuePrice: Delegate<VenuePriceRow>;
  venueFacilityRule: Delegate<VenueFacilityRuleRow>;
  venueClosure: Delegate<VenueClosureRow>;
  venueWaiverDocument: Delegate<VenueWaiverDocumentRow>;
  venueWaiverVersion: Delegate<VenueWaiverVersionRow>;
  /** Referenced-integrity guards (ADR-0015): count-only lookups. */
  reservation: Pick<Delegate<never>, 'count'>;
  consentRecord: Pick<Delegate<never>, 'count'>;
}

export interface JsonApiResource {
  type: string;
  id: string;
  attributes: Record<string, unknown>;
}
