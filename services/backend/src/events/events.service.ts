import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ScopedPrisma } from '../prisma/scoped-prisma.service';
import { SystemContextService } from '../common/context/system-context.service';
import { ActorContextService } from '../common/auth/actor-context.service';
import { AuditService } from '../common/audit/audit.service';
import { RecordNotFoundException } from '../common/errors/api-error';
import { newId } from '../common/ids/uuid';
import { RequestActor } from '../common/auth/actor';
import { CatalogDb, VenueResourceRow, VenueRow } from '../venue-catalog/catalog.types';
import {
  BookingDb,
  EventRegistrationRow,
  EventResultRow,
  EventRow,
} from '../booking/booking.types';
import { bufferedWindow } from '../booking/availability';
import { holdExpiryFrom } from '../booking/holds';
import { decideRegistration, nextWaitlistPosition, seatsTaken } from './capacity';
import { registrationPublicId } from './serializers';

type TxClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;
type Tx = TxClient & BookingDb & CatalogDb;

const asDb = (client: TxClient): Tx => client as unknown as Tx;

const PLAYER_VISIBLE_STATUSES = new Set([
  'published',
  'registration_open',
  'registration_closed',
  'complete',
]);

/** Events lifecycle + registrations + results. Same db-context pattern as BookingService. */
@Injectable()
export class EventsService {
  constructor(
    private readonly scoped: ScopedPrisma,
    private readonly system: SystemContextService,
    private readonly actorContext: ActorContextService,
    private readonly audit: AuditService,
  ) {}

  private get actor(): RequestActor {
    return this.actorContext.actor;
  }

  private async db<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    const actor = this.actor;
    if (actor.tenantId || actor.isPlatform || actor.isSystem) {
      return fn(asDb(this.scoped.client));
    }
    return this.system.run((tx) => fn(asDb(tx as TxClient)));
  }

  private async record(
    tx: Tx,
    streamType: string,
    streamId: string,
    eventType: string,
    tenantId: string,
    payload: Record<string, unknown>,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    await this.audit.append(tx, this.actor, {
      streamType,
      streamId,
      eventType,
      tenantId,
      payload,
      metadata,
    });
  }

  private isStaff(): boolean {
    return Boolean(this.actor.tenantId) || this.actor.isPlatform;
  }

  // ---------- event CRUD + lifecycle ----------

  async listEvents(): Promise<{ event: EventRow; registered: number }[]> {
    return this.db(async (tx) => {
      const events = await tx.event.findMany({ orderBy: { startsAt: 'asc' } });
      const visible = this.isStaff()
        ? events
        : events.filter((e) => e.visibility === 'public' && PLAYER_VISIBLE_STATUSES.has(e.status));
      return Promise.all(
        visible.map(async (event) => ({ event, registered: await this.registeredSeats(tx, event.id) })),
      );
    });
  }

  async getEvent(id: string): Promise<{ event: EventRow; resourceIds: string[]; registered: number }> {
    return this.db(async (tx) => {
      const event = await tx.event.findFirst({ where: { id } });
      if (!event) throw new RecordNotFoundException();
      if (!this.isStaff() && !(event.visibility === 'public' && PLAYER_VISIBLE_STATUSES.has(event.status))) {
        throw new RecordNotFoundException();
      }
      const allocations = await tx.resourceAllocation.findMany({
        where: { ownerType: 'event', ownerId: event.id },
      });
      return {
        event,
        resourceIds: allocations.map((a) => a.resourceId),
        registered: await this.registeredSeats(tx, event.id),
      };
    });
  }

  async createEvent(data: Record<string, unknown> & { resourceIds?: string[] }): Promise<EventRow> {
    return this.db(async (tx) => {
      const venue = (await tx.venue.findFirst({ where: { id: data['venueId'] } })) as VenueRow | null;
      if (!venue) throw new RecordNotFoundException();
      const resourceIds = data.resourceIds ?? [];
      for (const rid of resourceIds) {
        const resource = (await tx.venueResource.findFirst({ where: { id: rid } })) as VenueResourceRow | null;
        if (!resource || resource.venueId !== venue.id) throw new RecordNotFoundException();
      }
      const { resourceIds: _unused, details: extraDetails, ...fields } = data;
      void _unused;
      const event = await tx.event.create({
        data: {
          id: newId(),
          tenantId: venue.tenantId,
          createdBy: this.actor.userId ?? null,
          ...fields,
          details: { resource_ids: resourceIds, ...((extraDetails as Record<string, unknown>) ?? {}) },
        },
      });
      await this.record(tx, 'event', event.id, 'event.created', event.tenantId, {
        event: { id: event.id, name: event.name, status: event.status },
      });
      return event;
    });
  }

  async updateEvent(id: string, data: Record<string, unknown> & { resourceIds?: string[] }): Promise<EventRow> {
    return this.db(async (tx) => {
      const existing = await tx.event.findFirst({ where: { id } });
      if (!existing) throw new RecordNotFoundException();
      if (existing.status !== 'draft') {
        throw new ConflictException('only draft events can be edited');
      }
      const { resourceIds, details: extraDetails, ...rest } = data;
      const details = {
        ...((existing.details as Record<string, unknown>) ?? {}),
        ...((extraDetails as Record<string, unknown>) ?? {}),
      };
      if (resourceIds !== undefined) details['resource_ids'] = resourceIds;
      const event = await tx.event.update({
        where: { id },
        data: { ...rest, details },
      });
      await this.record(tx, 'event', id, 'event.updated', event.tenantId, {
        event: { id: event.id, name: event.name, status: event.status },
      });
      return event;
    });
  }

  /** Permanently remove a draft event (published events are cancelled, not deleted). */
  async deleteDraft(id: string): Promise<void> {
    await this.db(async (tx) => {
      const event = await tx.event.findFirst({ where: { id } });
      if (!event) throw new RecordNotFoundException();
      if (event.status !== 'draft') {
        throw new ConflictException('only draft events can be deleted');
      }
      await tx.event.delete({ where: { id } });
      await this.record(tx, 'event', id, 'event.deleted', event.tenantId, { event_id: id });
    });
  }

  /** draft -> published; occupies assigned resources in the shared conflict space. */
  async publish(id: string): Promise<EventRow> {
    return this.db(async (tx) => {
      const event = await tx.event.findFirst({ where: { id } });
      if (!event) throw new RecordNotFoundException();
      if (event.status !== 'draft') {
        throw new ConflictException(`event cannot be published from status ${event.status}`);
      }
      const resourceIds = this.resourceIdsOf(event);
      const window = bufferedWindow(event.startsAt, event.endsAt, event.bufferMinutes);
      for (const resourceId of resourceIds) {
        // Closures block publishing onto a resource.
        const closures = await tx.venueClosure.findMany({
          where: {
            OR: [{ venueId: event.venueId }, { venueId: null }],
            status: 'scheduled',
            startsAt: { lt: window.endsAt },
            endsAt: { gt: window.startsAt },
          },
        });
        if (closures.some((c) => c.resourceId === null || c.resourceId === resourceId)) {
          throw new ConflictException(`resource ${resourceId} is closed during the event window`);
        }
        await tx.resourceAllocation.deleteMany({
          where: { resourceId, expiresAt: { lte: new Date() } },
        });
        // The exclusion constraint rejects overlaps with reservations/other events.
        await tx.resourceAllocation.create({
          data: {
            id: newId(),
            tenantId: event.tenantId,
            resourceId,
            ownerType: 'event',
            ownerId: event.id,
            startsAt: window.startsAt,
            endsAt: window.endsAt,
            expiresAt: null,
          },
        });
      }
      const updated = await tx.event.update({
        where: { id },
        data: { status: 'published' },
      });
      await this.record(tx, 'event', id, 'event.published', event.tenantId, {
        event: { id, status: updated.status },
      });
      return updated;
    });
  }

  async cancel(id: string, reason?: string): Promise<EventRow> {
    return this.db(async (tx) => {
      const event = await tx.event.findFirst({ where: { id } });
      if (!event) throw new RecordNotFoundException();
      if (event.status === 'cancelled' || event.status === 'complete') {
        throw new ConflictException(`event cannot be cancelled from status ${event.status}`);
      }
      const updated = await tx.event.update({
        where: { id },
        data: { status: 'cancelled', cancellationReason: reason ?? null },
      });
      await tx.resourceAllocation.deleteMany({ where: { ownerType: 'event', ownerId: id } });
      // Active registrations are cancelled; Commerce owns refund execution.
      await tx.eventRegistration.updateMany({
        where: { eventId: id, status: { in: ['pending', 'confirmed'] } },
        data: { status: 'cancelled' },
      });
      await this.record(tx, 'event', id, 'event.cancelled', event.tenantId, {
        event: { id, status: updated.status },
        reason: reason ?? null,
      });
      return updated;
    });
  }

  async setRegistrationState(id: string, open: boolean): Promise<EventRow> {
    return this.db(async (tx) => {
      const event = await tx.event.findFirst({ where: { id } });
      if (!event) throw new RecordNotFoundException();
      if (event.status !== 'published' && event.status !== 'registration_open' && event.status !== 'registration_closed') {
        throw new ConflictException(`registration cannot change from status ${event.status}`);
      }
      const status = open ? 'registration_open' : 'registration_closed';
      const updated = await tx.event.update({ where: { id }, data: { status } });
      await this.record(tx, 'event', id, `event.registration_${open ? 'opened' : 'closed'}`, event.tenantId, {
        event: { id, status },
      });
      return updated;
    });
  }

  // ---------- registrations ----------

  async register(input: {
    eventId: string;
    playerId?: string;
    guestContactId?: string;
    kind: string;
    seats: number;
    teamName?: string;
    roster?: unknown;
    idempotencyKey?: string;
  }): Promise<EventRegistrationRow> {
    return this.db(async (tx) => {
      if (input.idempotencyKey) {
        const existing = await tx.eventRegistration.findFirst({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (existing) return existing;
      }
      // Atomic capacity claim: lock the event row, then count seats.
      const rows = await tx.$queryRaw<EventRow[]>`
        SELECT * FROM "events" WHERE "id" = ${input.eventId}::uuid FOR NO KEY UPDATE
      `;
      const event = rows[0];
      if (!event) throw new RecordNotFoundException();
      const now = new Date();
      const registrations = await tx.eventRegistration.findMany({
        where: { eventId: event.id, status: { in: ['pending', 'confirmed', 'waitlisted'] } },
      });
      const decision = decideRegistration(
        event,
        seatsTaken(registrations),
        input.seats,
        event.paymentTiming,
        now,
      );
      if (decision.action === 'reject') {
        throw new ConflictException(decision.reason);
      }
      const isPending = decision.action === 'confirm' && decision.status === 'pending';
      const registration = await tx.eventRegistration.create({
        data: {
          uuid: newId(),
          tenantId: event.tenantId,
          eventId: event.id,
          playerId: input.playerId ?? null,
          guestContactId: input.guestContactId ?? null,
          kind: input.kind,
          teamName: input.teamName ?? null,
          roster: (input.roster as object) ?? null,
          seats: input.seats,
          status:
            decision.action === 'waitlist'
              ? 'waitlisted'
              : (decision as { status: string }).status,
          waitlistPosition:
            decision.action === 'waitlist' ? nextWaitlistPosition(registrations) : null,
          paymentState: isPending ? 'pending' : event.paymentTiming === 'later' ? 'due_later' : 'none',
          amountDueCents: event.feeBasis === 'free' ? 0 : event.feeCents * input.seats,
          holdExpiresAt: isPending ? holdExpiryFrom(now) : null,
          idempotencyKey: input.idempotencyKey ?? null,
        },
      });
      await tx.$executeRaw`
        UPDATE "event_registrations"
        SET "reference_no" = 'REG-' || lpad("id"::text, 6, '0')
        WHERE "id" = ${registration.id}
      `;
      const saved = (await tx.eventRegistration.findFirst({
        where: { id: registration.id },
      })) as EventRegistrationRow;
      await this.record(tx, 'registration', saved.uuid, 'event.registration.created', event.tenantId, {
        registration: {
          id: registrationPublicId(saved.id),
          event_id: event.id,
          status: saved.status,
          seats: saved.seats,
        },
      });
      return saved;
    });
  }

  async cancelRegistration(id: bigint): Promise<EventRegistrationRow> {
    return this.db(async (tx) => {
      const row = await tx.eventRegistration.findFirst({ where: { id } });
      if (!row) throw new RecordNotFoundException();
      const actor = this.actor;
      const own = actor.userId !== undefined && actor.userId === row.playerId;
      if (!own && !(this.isStaff() && (actor.tenantId === row.tenantId || actor.isPlatform))) {
        throw new RecordNotFoundException();
      }
      if (row.status === 'cancelled') {
        throw new ConflictException('registration is already cancelled');
      }
      const updated = await tx.eventRegistration.update({
        where: { id: row.id },
        data: { status: 'cancelled', holdExpiresAt: null },
      });
      await this.record(tx, 'registration', row.uuid, 'event.registration.cancelled', row.tenantId, {
        registration: { id: registrationPublicId(row.id), event_id: row.eventId },
      });
      return updated;
    });
  }

  async listRegistrations(eventId: string): Promise<EventRegistrationRow[]> {
    return this.db(async (tx) => {
      const event = await tx.event.findFirst({ where: { id: eventId } });
      if (!event) throw new RecordNotFoundException();
      return tx.eventRegistration.findMany({
        where: { eventId },
        orderBy: { registeredAt: 'asc' },
      });
    });
  }

  // ---------- results ----------

  async recordResult(
    eventId: string,
    input: { registrationId?: bigint; label?: string; result: Record<string, unknown> },
  ): Promise<EventResultRow> {
    return this.db(async (tx) => {
      const event = await tx.event.findFirst({ where: { id: eventId } });
      if (!event) throw new RecordNotFoundException();
      if (!event.resultsEnabled) {
        throw new UnprocessableEntityException('results are not enabled for this event');
      }
      const result = await tx.eventResult.create({
        data: {
          id: newId(),
          tenantId: event.tenantId,
          eventId: event.id,
          registrationId: input.registrationId ?? null,
          label: input.label ?? null,
          result: input.result as object,
          recordedBy: this.actor.userId ?? null,
        },
      });
      await this.record(tx, 'event', eventId, 'event.result_recorded', event.tenantId, {
        result_id: result.id,
        registration_id: input.registrationId ? registrationPublicId(input.registrationId) : null,
      });
      return result;
    });
  }

  async listResults(eventId: string): Promise<EventResultRow[]> {
    return this.db(async (tx) => {
      const event = await tx.event.findFirst({ where: { id: eventId } });
      if (!event) throw new RecordNotFoundException();
      if (!this.isStaff() && event.visibility !== 'public') {
        throw new ForbiddenException('standings are not public for this event');
      }
      return tx.eventResult.findMany({ where: { eventId }, orderBy: { createdAt: 'asc' } });
    });
  }

  private resourceIdsOf(event: EventRow): string[] {
    const details = (event.details ?? {}) as Record<string, unknown>;
    return Array.isArray(details['resource_ids']) ? (details['resource_ids'] as string[]) : [];
  }

  private async registeredSeats(tx: Tx, eventId: string): Promise<number> {
    const regs = await tx.eventRegistration.findMany({
      where: { eventId, status: { in: ['pending', 'confirmed'] } },
    });
    return seatsTaken(regs);
  }
}
