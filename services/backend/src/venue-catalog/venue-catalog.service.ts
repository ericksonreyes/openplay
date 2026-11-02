import { ConflictException, Injectable } from '@nestjs/common';
import { ScopedPrisma } from '../prisma/scoped-prisma.service';
import { ActorContextService } from '../common/auth/actor-context.service';
import { AuditService } from '../common/audit/audit.service';
import { RecordNotFoundException } from '../common/errors/api-error';
import { newId } from '../common/ids/uuid';
import { RequestActor } from '../common/auth/actor';
import {
  CatalogDb,
  VenueActivityResourceRow,
  VenueActivityRow,
  VenueClosureRow,
  VenueFacilityRuleRow,
  VenuePriceRow,
  VenueResourceRow,
  VenueRow,
  VenueWaiverDocumentRow,
  VenueWaiverVersionRow,
} from './catalog.types';

type Body = Record<string, unknown>;

/**
 * Venue-catalog CRUD. All queries run through ScopedPrisma (RLS context is
 * already on the transaction), so tenant isolation is enforced by the
 * database; a missing row is always a plain RecordNotFoundException.
 * Every mutation appends an audit event in the same transaction.
 */
@Injectable()
export class VenueCatalogService {
  constructor(
    private readonly scoped: ScopedPrisma,
    private readonly actorContext: ActorContextService,
    private readonly audit: AuditService,
  ) {}

  private get db(): CatalogDb {
    return this.scoped.client as unknown as CatalogDb;
  }

  private get actor(): RequestActor {
    return this.actorContext.actor;
  }

  private async record(
    streamType: string,
    streamId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.audit.append(this.scoped.client, this.actor, {
      streamType,
      streamId,
      eventType,
      tenantId: this.actor.tenantId ?? (payload['tenant_id'] as string | undefined),
      payload,
    });
  }

  // ---------- venues ----------

  listVenues(list: { where?: Record<string, unknown>; orderBy?: Record<string, 'asc' | 'desc'> } = {}): Promise<VenueRow[]> {
    return this.db.venue.findMany({ where: list.where, orderBy: list.orderBy ?? { createdAt: 'asc' } });
  }

  async getVenue(id: string): Promise<VenueRow> {
    const venue = await this.db.venue.findFirst({ where: { id } });
    if (!venue) throw new RecordNotFoundException();
    return venue;
  }

  async createVenue(data: Body): Promise<VenueRow> {
    const venue = await this.db.venue.create({ data: { id: newId(), ...data } });
    await this.record('venue', venue.id, 'venue.created', { venue: serialize(venue) });
    return venue;
  }

  async updateVenue(id: string, data: Body): Promise<VenueRow> {
    await this.getVenue(id);
    const venue = await this.db.venue.update({ where: { id }, data });
    await this.record('venue', venue.id, 'venue.updated', { venue: serialize(venue) });
    return venue;
  }

  async deleteVenue(id: string): Promise<VenueRow> {
    const venue = await this.getVenue(id);
    // History check first: a venue with bookings/events must be
    // decommissioned, not deleted (audit + attendance records depend on it).
    const [bookings, events] = await Promise.all([
      this.scoped.client.reservation.count({ where: { venueId: id } }),
      this.scoped.client.event.count({ where: { venueId: id } }),
    ]);
    const history = bookings + events;
    if (history > 0) {
      throw new ConflictException(
        `${venue.name} has ${history} booking${history === 1 ? '' : 's'}/event${history === 1 ? '' : 's'} on record — decommission it instead of deleting.`,
      );
    }
    // venue→resource deletes CASCADE at the DB layer, so guard next.
    const facilities = await this.scoped.client.venueResource.count({ where: { venueId: id } });
    if (facilities > 0) {
      throw new ConflictException(
        `This venue still has ${facilities} facilit${facilities === 1 ? 'y' : 'ies'} — remove them first.`,
      );
    }
    await this.db.venue.delete({ where: { id } });
    await this.record('venue', venue.id, 'venue.deleted', { venue_id: venue.id });
    return venue;
  }

  // ---------- resources ----------

  listResources(filter: { venueId?: string; where?: Record<string, unknown>; orderBy?: Record<string, 'asc' | 'desc'> } = {}): Promise<VenueResourceRow[]> {
    return this.db.venueResource.findMany({
      where: { ...(filter.venueId ? { venueId: filter.venueId } : {}), ...(filter.where ?? {}) },
      orderBy: filter.orderBy ?? { createdAt: 'asc' },
    });
  }

  async getResource(id: string): Promise<VenueResourceRow> {
    const row = await this.db.venueResource.findFirst({ where: { id } });
    if (!row) throw new RecordNotFoundException();
    return row;
  }

  async createResource(data: Body): Promise<VenueResourceRow> {
    const row = await this.db.venueResource.create({ data: { id: newId(), ...data } });
    await this.record('venue_resource', row.id, 'resource.created', { resource: serialize(row) });
    return row;
  }

  async updateResource(id: string, data: Body): Promise<VenueResourceRow> {
    await this.getResource(id);
    const row = await this.db.venueResource.update({ where: { id }, data });
    await this.record('venue_resource', row.id, 'resource.updated', { resource: serialize(row) });
    return row;
  }

  async deleteResource(id: string): Promise<VenueResourceRow> {
    const row = await this.getResource(id);
    // Upcoming bookings get the actionable message first.
    const upcoming = await this.scoped.client.reservation.count({
      where: {
        resourceId: id,
        startsAt: { gt: new Date() },
        status: { in: ['pending_approval', 'approved', 'confirmed', 'hold'] },
      },
    });
    if (upcoming > 0) {
      throw new ConflictException(
        `${row.name} has ${upcoming} upcoming reservation${upcoming === 1 ? '' : 's'} — cancel them or schedule a closure instead.`,
      );
    }
    // Any bookings/events on record → archive, not delete (history must stay intact).
    const [bookings, events] = await Promise.all([
      this.scoped.client.reservation.count({ where: { resourceId: id } }),
      this.scoped.client.event.count({
        where: { details: { path: ['resource_ids'], array_contains: [id] } },
      }),
    ]);
    const history = bookings + events;
    if (history > 0) {
      throw new ConflictException(
        `${row.name} has ${history} booking${history === 1 ? '' : 's'}/event${history === 1 ? '' : 's'} on record — decommission it instead of deleting.`,
      );
    }
    await this.db.venueResource.delete({ where: { id } });
    await this.record('venue_resource', row.id, 'resource.deleted', { resource_id: row.id });
    return row;
  }

  // ---------- activities ----------

  listActivities(list: { where?: Record<string, unknown>; orderBy?: Record<string, 'asc' | 'desc'> } = {}): Promise<VenueActivityRow[]> {
    return this.db.venueActivity.findMany({ where: list.where, orderBy: list.orderBy ?? { createdAt: 'asc' } });
  }

  async getActivity(id: string): Promise<VenueActivityRow> {
    const row = await this.db.venueActivity.findFirst({ where: { id } });
    if (!row) throw new RecordNotFoundException();
    return row;
  }

  activityResourceIds(activityId: string): Promise<VenueActivityResourceRow[]> {
    return this.db.venueActivityResource.findMany({ where: { activityId } });
  }

  activityLinksForResources(resourceIds: string[]): Promise<VenueActivityResourceRow[]> {
    if (resourceIds.length === 0) return Promise.resolve([]);
    return this.db.venueActivityResource.findMany({ where: { resourceId: { in: resourceIds } } });
  }

  async createActivity(data: Body): Promise<VenueActivityRow> {
    const row = await this.db.venueActivity.create({ data: { id: newId(), ...data } });
    await this.record('venue_activity', row.id, 'activity.created', { activity: serialize(row) });
    return row;
  }

  async updateActivity(id: string, data: Body): Promise<VenueActivityRow> {
    await this.getActivity(id);
    const row = await this.db.venueActivity.update({ where: { id }, data });
    await this.record('venue_activity', row.id, 'activity.updated', { activity: serialize(row) });
    return row;
  }

  async deleteActivity(id: string): Promise<VenueActivityRow> {
    const row = await this.getActivity(id);
    // Draft only: anything past draft, or with linked bookings/events/prices,
    // is retired via status — never deleted.
    if (row.status !== 'draft') {
      throw new ConflictException(
        `${row.name} is ${row.status} — only draft activities can be deleted; unpublish it instead.`,
      );
    }
    const [bookings, events, prices] = await Promise.all([
      this.scoped.client.reservation.count({ where: { activityId: id } }),
      this.scoped.client.event.count({ where: { activityId: id } }),
      this.scoped.client.venuePrice.count({ where: { activityId: id } }),
    ]);
    const linked = bookings + events + prices;
    if (linked > 0) {
      throw new ConflictException(
        `${row.name} is linked to ${linked} record${linked === 1 ? '' : 's'} (bookings/events/prices) — unpublish it instead of deleting.`,
      );
    }
    await this.db.venueActivity.delete({ where: { id } });
    await this.record('venue_activity', row.id, 'activity.deleted', { activity_id: row.id });
    return row;
  }

  /** Replace the activity's resource links; each resource must exist in scope. */
  async setActivityResources(id: string, resourceIds: string[]): Promise<string[]> {
    const activity = await this.getActivity(id);
    for (const resourceId of resourceIds) {
      const resource = await this.db.venueResource.findFirst({ where: { id: resourceId } });
      if (!resource) throw new RecordNotFoundException();
    }
    await this.db.venueActivityResource.deleteMany({ where: { activityId: id } });
    for (const resourceId of resourceIds) {
      await this.db.venueActivityResource.create({
        data: { tenantId: activity.tenantId, activityId: id, resourceId },
      });
    }
    await this.record('venue_activity', id, 'activity.resources_updated', {
      activity_id: id,
      resource_ids: resourceIds,
    });
    return resourceIds;
  }

  // ---------- prices ----------

  listPrices(filter: { venueId?: string; resourceId?: string; where?: Record<string, unknown>; orderBy?: Record<string, 'asc' | 'desc'> } = {}): Promise<VenuePriceRow[]> {
    const where: Record<string, unknown> = { ...(filter.where ?? {}) };
    if (filter.venueId) where['venueId'] = filter.venueId;
    if (filter.resourceId) where['resourceId'] = filter.resourceId;
    return this.db.venuePrice.findMany({ where, orderBy: filter.orderBy ?? { createdAt: 'asc' } });
  }

  async getPrice(id: string): Promise<VenuePriceRow> {
    const row = await this.db.venuePrice.findFirst({ where: { id } });
    if (!row) throw new RecordNotFoundException();
    return row;
  }

  async createPrice(data: Body): Promise<VenuePriceRow> {
    const row = await this.db.venuePrice.create({ data: { id: newId(), ...data } });
    await this.record('venue_price', row.id, 'price.created', { price: serialize(row) });
    return row;
  }

  async updatePrice(id: string, data: Body): Promise<VenuePriceRow> {
    await this.getPrice(id);
    const row = await this.db.venuePrice.update({ where: { id }, data });
    await this.record('venue_price', row.id, 'price.updated', { price: serialize(row) });
    return row;
  }

  async deletePrice(id: string): Promise<VenuePriceRow> {
    const row = await this.getPrice(id);
    // Only unpublished prices can be deleted — published ones must be
    // unpublished first so history/pricing context is preserved.
    if (row.active) {
      throw new ConflictException(
        `${row.label ?? 'This price'} is published — unpublish it instead of deleting.`,
      );
    }
    await this.db.venuePrice.delete({ where: { id } });
    await this.record('venue_price', row.id, 'price.deleted', { price_id: row.id });
    return row;
  }

  // ---------- facility rules ----------

  listFacilityRules(filter: { venueId?: string; where?: Record<string, unknown>; orderBy?: Record<string, 'asc' | 'desc'> } = {}): Promise<VenueFacilityRuleRow[]> {
    return this.db.venueFacilityRule.findMany({
      where: { ...(filter.venueId ? { venueId: filter.venueId } : {}), ...(filter.where ?? {}) },
      orderBy: filter.orderBy ?? { createdAt: 'asc' },
    });
  }

  async getFacilityRule(id: string): Promise<VenueFacilityRuleRow> {
    const row = await this.db.venueFacilityRule.findFirst({ where: { id } });
    if (!row) throw new RecordNotFoundException();
    return row;
  }

  async createFacilityRule(data: Body): Promise<VenueFacilityRuleRow> {
    const row = await this.db.venueFacilityRule.create({ data: { id: newId(), ...data } });
    await this.record('facility_rules', row.id, 'rule.created', { rule: serialize(row) });
    return row;
  }

  async updateFacilityRule(id: string, data: Body): Promise<VenueFacilityRuleRow> {
    const existing = await this.getFacilityRule(id);
    const patch = { ...data };
    // A text change bumps the document version so acknowledgments stay traceable.
    if (typeof patch['body'] === 'string' && patch['body'] !== existing.body) {
      patch['version'] = existing.version + 1;
    }
    const row = await this.db.venueFacilityRule.update({ where: { id }, data: patch });
    await this.record('facility_rules', row.id, 'rule.updated', { rule: serialize(row) });
    return row;
  }

  async setFacilityRuleStatus(id: string, status: 'published' | 'unpublished'): Promise<VenueFacilityRuleRow> {
    const row = await this.updateFacilityRule(id, { status });
    return row;
  }

  async deleteFacilityRule(id: string): Promise<VenueFacilityRuleRow> {
    const row = await this.getFacilityRule(id);
    // Draft only: published/unpublished rules are retired via status.
    if (row.status !== 'draft') {
      throw new ConflictException(
        `${row.title} is ${row.status} — only draft rules can be deleted; unpublish it instead.`,
      );
    }
    const acks = await this.scoped.client.consentRecord.count({ where: { facilityRuleId: id } });
    if (acks > 0) {
      throw new ConflictException(
        `${row.title} has ${acks} recorded acknowledgment${acks === 1 ? '' : 's'} — archive it instead of deleting.`,
      );
    }
    await this.db.venueFacilityRule.delete({ where: { id } });
    await this.record('facility_rules', row.id, 'rule.deleted', { rule_id: row.id });
    return row;
  }

  // ---------- closures / internal-use blocks ----------

  listClosures(filter: { venueId?: string; resourceId?: string; kind?: string | string[]; where?: Record<string, unknown>; orderBy?: Record<string, 'asc' | 'desc'> } = {}): Promise<VenueClosureRow[]> {
    const where: Record<string, unknown> = { ...(filter.where ?? {}) };
    if (filter.venueId) where['venueId'] = filter.venueId;
    if (filter.resourceId) where['resourceId'] = filter.resourceId;
    if (filter.kind) where['kind'] = { in: Array.isArray(filter.kind) ? filter.kind : [filter.kind] };
    return this.db.venueClosure.findMany({ where, orderBy: filter.orderBy ?? { startsAt: 'asc' } });
  }

  async getClosure(id: string): Promise<VenueClosureRow> {
    const row = await this.db.venueClosure.findFirst({ where: { id } });
    if (!row) throw new RecordNotFoundException();
    return row;
  }

  async createClosure(data: Body): Promise<VenueClosureRow> {
    const row = await this.db.venueClosure.create({ data: { id: newId(), ...data } });
    await this.record('closure', row.id, 'closure.scheduled', { closure: serialize(row) });
    return row;
  }

  async updateClosure(id: string, data: Body): Promise<VenueClosureRow> {
    await this.getClosure(id);
    const row = await this.db.venueClosure.update({ where: { id }, data });
    const eventType = row.status === 'cancelled' ? 'closure.cancelled' : 'closure.updated';
    await this.record('closure', row.id, eventType, { closure: serialize(row) });
    return row;
  }

  async deleteClosure(id: string): Promise<VenueClosureRow> {
    const row = await this.getClosure(id);
    // Closures are cancelled, never deleted — the audit trail matters.
    throw new ConflictException(
      `Closures can't be deleted — cancel ${row.reason ?? 'this closure'} instead.`,
    );
  }

  // ---------- waiver documents + versions ----------

  listWaiverDocuments(filter: { venueId?: string; where?: Record<string, unknown>; orderBy?: Record<string, 'asc' | 'desc'> } = {}): Promise<VenueWaiverDocumentRow[]> {
    return this.db.venueWaiverDocument.findMany({
      where: { ...(filter.venueId ? { venueId: filter.venueId } : {}), ...(filter.where ?? {}) },
      orderBy: filter.orderBy ?? { createdAt: 'asc' },
    });
  }

  async getWaiverDocument(id: string): Promise<VenueWaiverDocumentRow> {
    const row = await this.db.venueWaiverDocument.findFirst({ where: { id } });
    if (!row) throw new RecordNotFoundException();
    return row;
  }

  async createWaiverDocument(data: Body): Promise<VenueWaiverDocumentRow> {
    const row = await this.db.venueWaiverDocument.create({ data: { id: newId(), ...data } });
    await this.record('waiver', row.id, 'waiver.created', { document: serialize(row) });
    return row;
  }

  async updateWaiverDocument(id: string, data: Body): Promise<VenueWaiverDocumentRow> {
    await this.getWaiverDocument(id);
    const row = await this.db.venueWaiverDocument.update({ where: { id }, data });
    await this.record('waiver', row.id, 'waiver.updated', { document: serialize(row) });
    return row;
  }

  async deleteWaiverDocument(id: string): Promise<VenueWaiverDocumentRow> {
    const row = await this.getWaiverDocument(id);
    // Draft only: active/retired docs are retired via status.
    if (row.status !== 'draft') {
      throw new ConflictException(
        `${row.title} is ${row.status} — only draft waivers can be deleted; retire it instead.`,
      );
    }
    const signatures = await this.scoped.client.consentRecord.count({ where: { waiverDocumentId: id } });
    if (signatures > 0) {
      throw new ConflictException(
        `${row.title} has ${signatures} recorded signature${signatures === 1 ? '' : 's'} — archive it instead of deleting.`,
      );
    }
    await this.db.venueWaiverDocument.delete({ where: { id } });
    await this.record('waiver', row.id, 'waiver.deleted', { document_id: row.id });
    return row;
  }

  async listWaiverVersions(documentId: string): Promise<VenueWaiverVersionRow[]> {
    await this.getWaiverDocument(documentId);
    return this.db.venueWaiverVersion.findMany({
      where: { documentId },
      orderBy: { version: 'asc' },
    });
  }

  /** A text change creates the next immutable version; prior versions stay. */
  async createWaiverVersion(documentId: string, body: string): Promise<VenueWaiverVersionRow> {
    const document = await this.getWaiverDocument(documentId);
    const version = await this.db.venueWaiverVersion.create({
      data: {
        id: newId(),
        tenantId: document.tenantId,
        documentId,
        version: document.currentVersion + 1,
        body,
        status: 'draft',
      },
    });
    await this.db.venueWaiverDocument.update({
      where: { id: documentId },
      data: { currentVersion: version.version },
    });
    await this.record('waiver', documentId, 'waiver.version_created', {
      document_id: documentId,
      version: version.version,
    });
    return version;
  }

  async setWaiverVersionStatus(
    documentId: string,
    versionId: string,
    status: 'published' | 'retired',
  ): Promise<VenueWaiverVersionRow> {
    await this.getWaiverDocument(documentId);
    const existing = await this.db.venueWaiverVersion.findFirst({
      where: { id: versionId, documentId },
    });
    if (!existing) throw new RecordNotFoundException();
    const row = await this.db.venueWaiverVersion.update({
      where: { id: versionId },
      data: { status },
    });
    await this.record('waiver', documentId, `waiver.version_${status}`, {
      document_id: documentId,
      version_id: row.id,
      version: row.version,
    });
    return row;
  }
}

const serialize = (row: object): Record<string, unknown> => row as Record<string, unknown>;
