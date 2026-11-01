import {
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ActorContextService } from '../common/auth/actor-context.service';
import { AuditService } from '../common/audit/audit.service';
import { RequestActor } from '../common/auth/actor';
import { RecordNotFoundException } from '../common/errors/api-error';
import { newId } from '../common/ids/uuid';
import { CatalogDb, VenueClosureRow, VenueRow } from '../venue-catalog/catalog.types';
import {
  BookingDb,
  RecurringReservationTemplateRow,
  ReservationRow,
} from './booking.types';
import { BookingService } from './booking.service';
import { canCancel } from './holds';
import { resolvePolicy } from './cancellation';
import { canAccessOwnedRow } from './scope';
import { reservationPublicId } from './serializers';
import {
  expansionWindowTo,
  nextOccurrences,
  RecurrenceRule,
  validateRule,
} from './recurrence';

type TxClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

type Tx = TxClient & BookingDb & CatalogDb;

export interface SkippedOccurrence {
  starts_at: string;
  reason: 'conflict' | 'closure' | 'exists' | 'unavailable';
}

export interface ExpansionResult {
  occurrences: ReservationRow[];
  skipped: SkippedOccurrence[];
}

const overlaps = (
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean => aStart < bEnd && aEnd > bStart;

/**
 * Expand a template's occurrences into reservations + allocations inside `tx`.
 * A conflicting occurrence is skipped and reported — never double-books; the
 * resource_allocations exclusion constraint is the DB-level backstop, and the
 * advisory xact lock serializes concurrent expansions/claims per resource.
 * Idempotent: an occurrence whose (series_id, starts_at) row already exists is
 * reported as 'exists' rather than re-created.
 */
export async function expandTemplate(tx: Tx, template: RecurringReservationTemplateRow, now: Date): Promise<ExpansionResult> {
  const result: ExpansionResult = { occurrences: [], skipped: [] };
  const resource = await tx.venueResource.findFirst({
    where: { id: template.resourceId },
  });
  const windowFrom = now;
  const windowTo = expansionWindowTo(now);
  const rule = template.rule as unknown as RecurrenceRule;
  const candidates = nextOccurrences(rule, windowFrom, windowTo);

  if (!resource || resource.status !== 'active') {
    result.skipped = candidates.map((o) => ({
      starts_at: o.startsAt.toISOString(),
      reason: 'unavailable' as const,
    }));
    return result;
  }

  // Serialize writers on this resource for the duration of the transaction.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${resource.id}))`;

  // Lazily release expired holds before claiming (same rule as createHold).
  const expiredAllocs = await tx.resourceAllocation.findMany({
    where: { resourceId: resource.id, expiresAt: { lte: now } },
  });
  for (const alloc of expiredAllocs) {
    if (alloc.ownerType === 'reservation') {
      await tx.reservation.updateMany({
        where: { uuid: alloc.ownerId, status: 'hold' },
        data: { status: 'expired' },
      });
    }
  }
  await tx.resourceAllocation.deleteMany({
    where: { resourceId: resource.id, expiresAt: { lte: now } },
  });

  const settings = (resource.settings ?? {}) as Record<string, unknown>;
  const bufferMinutes =
    typeof settings['buffer_minutes'] === 'number' ? (settings['buffer_minutes'] as number) : 0;
  const approvalRequired = settings['approval_required'] === true;
  const cancellation = resolvePolicy(settings['cancellation_policy']) as unknown as object;

  // Prefetch the whole conflict space once, then filter per occurrence.
  const closures = (await tx.venueClosure.findMany({
    where: {
      OR: [{ venueId: resource.venueId }, { venueId: null }],
      status: 'scheduled',
      startsAt: { lt: windowTo },
      endsAt: { gt: windowFrom },
    },
  })) as VenueClosureRow[];
  const blockingClosures = closures.filter(
    (c) => c.resourceId === null || c.resourceId === resource.id,
  );
  const busy = await tx.resourceAllocation.findMany({
    where: {
      resourceId: resource.id,
      startsAt: { lt: windowTo },
      endsAt: { gt: windowFrom },
    },
  });
  const existing = await tx.reservation.findMany({
    where: {
      seriesId: template.id,
      startsAt: { gte: windowFrom, lt: windowTo },
    },
  });
  const existingStarts = new Set(existing.map((r) => r.startsAt.getTime()));

  for (const occ of candidates) {
    if (existingStarts.has(occ.startsAt.getTime())) {
      result.skipped.push({ starts_at: occ.startsAt.toISOString(), reason: 'exists' });
      continue;
    }
    const buffered = {
      startsAt: new Date(occ.startsAt.getTime() - bufferMinutes * 60_000),
      endsAt: new Date(occ.endsAt.getTime() + bufferMinutes * 60_000),
    };
    if (blockingClosures.some((c) => overlaps(buffered.startsAt, buffered.endsAt, c.startsAt, c.endsAt))) {
      result.skipped.push({ starts_at: occ.startsAt.toISOString(), reason: 'closure' });
      continue;
    }
    if (busy.some((a) => overlaps(buffered.startsAt, buffered.endsAt, a.startsAt, a.endsAt))) {
      result.skipped.push({ starts_at: occ.startsAt.toISOString(), reason: 'conflict' });
      continue;
    }

    const uuid = newId();
    const status = approvalRequired ? 'pending_approval' : 'confirmed';
    const reservation = await tx.reservation.create({
      data: {
        uuid,
        tenantId: template.tenantId,
        venueId: resource.venueId,
        resourceId: resource.id,
        playerId: template.playerId,
        seriesId: template.id,
        status,
        startsAt: occ.startsAt,
        endsAt: occ.endsAt,
        bufferMinutes,
        partySize: 1,
        holdExpiresAt: null,
        paymentState: 'none',
        notes: null,
        cancellation,
        createdBy: template.playerId,
      },
    });
    await tx.$executeRaw`
      UPDATE "reservations"
      SET "reference_no" = 'RES-' || lpad("id"::text, 6, '0')
      WHERE "id" = ${reservation.id}
    `;
    await tx.resourceAllocation.create({
      data: {
        id: newId(),
        tenantId: template.tenantId,
        resourceId: resource.id,
        ownerType: 'reservation',
        ownerId: uuid,
        startsAt: buffered.startsAt,
        endsAt: buffered.endsAt,
        expiresAt: null,
      },
    });
    const saved = (await tx.reservation.findFirst({
      where: { id: reservation.id },
    })) as ReservationRow;
    result.occurrences.push(saved);
    busy.push({ ...buffered } as (typeof busy)[number]);
  }
  return result;
}

/**
 * Daily-path/job hook: expand every active template so its materialized
 * occurrences always cover [now, now + EXPANSION_HORIZON_WEEKS]. Designed to be
 * invoked by the notification worker or a scheduled job inside a system
 * transaction — scheduler wiring is intentionally left out (see BOOKING.MD).
 * `audit` may be omitted when no stream events are wanted.
 */
export async function expandDueTemplates(
  tx: Tx,
  opts: { now?: Date; audit?: AuditService; actor?: RequestActor } = {},
): Promise<{ templates: number; created: number; skipped: number }> {
  const now = opts.now ?? new Date();
  const templates = await tx.recurringReservationTemplate.findMany({
    where: { status: 'active' },
  });
  let created = 0;
  let skipped = 0;
  for (const template of templates) {
    const result = await expandTemplate(tx, template, now);
    created += result.occurrences.length;
    skipped += result.skipped.filter((s) => s.reason !== 'exists').length;
    if (opts.audit && opts.actor && result.occurrences.length > 0) {
      await opts.audit.append(tx, opts.actor, {
        streamType: 'recurring_template',
        streamId: template.id,
        eventType: 'recurring_template.expanded',
        tenantId: template.tenantId,
        payload: {
          created: result.occurrences.map((r) => reservationPublicId(r.id)),
          skipped: result.skipped,
        },
      });
    }
  }
  return { templates: templates.length, created, skipped };
}

/**
 * Recurring reservation templates: a player owns a series of normal
 * reservation rows (linked via reservations.series_id); each occurrence is
 * availability-checked independently and per-occurrence payment/cancellation
 * rules apply unchanged (RECURRING_RESERVATIONS.MD).
 */
@Injectable()
export class RecurringService {
  constructor(
    private readonly booking: BookingService,
    private readonly actorContext: ActorContextService,
    private readonly audit: AuditService,
  ) {}

  private get actor(): RequestActor {
    return this.actorContext.actor;
  }

  private get staff(): boolean {
    return Boolean(this.actor.tenantId) || this.actor.isPlatform;
  }

  private async record(
    tx: Tx,
    streamId: string,
    eventType: string,
    tenantId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.audit.append(tx, this.actor, {
      streamType: 'recurring_template',
      streamId,
      eventType,
      tenantId,
      payload,
      metadata: {},
    });
  }

  async createTemplate(input: {
    resourceId: string;
    rule: RecurrenceRule;
    playerId?: string;
  }): Promise<{ template: RecurringReservationTemplateRow } & ExpansionResult> {
    const errors = validateRule(input.rule);
    if (errors.length > 0) {
      throw new UnprocessableEntityException(errors.join('; '));
    }
    const actor = this.actor;
    // Players create only their own series; staff may set player_id on behalf.
    const playerId = this.staff ? (input.playerId ?? null) : actor.userId;
    if (this.staff && !playerId) {
      throw new BadRequestException(
        'player_id is required for staff-created series (on-behalf booking)',
      );
    }
    if (!this.staff && !playerId) {
      throw new ForbiddenException('a player identity is required');
    }
    return this.booking.run(async (tx) => {
      const resource = await tx.venueResource.findFirst({
        where: { id: input.resourceId, status: 'active' },
      });
      if (!resource) throw new RecordNotFoundException();
      const venue = (await tx.venue.findFirst({ where: { id: resource.venueId } })) as VenueRow | null;
      if (!venue || venue.status !== 'active') throw new RecordNotFoundException();

      const template = await tx.recurringReservationTemplate.create({
        data: {
          id: newId(),
          tenantId: resource.tenantId,
          venueId: resource.venueId,
          resourceId: resource.id,
          playerId,
          rule: input.rule as unknown as object,
          status: 'active',
        },
      });
      await this.record(tx, template.id, 'recurring_template.created', template.tenantId, {
        template: this.templatePayload(template),
      });
      const expansion = await expandTemplate(tx, template, new Date());
      await this.record(tx, template.id, 'recurring_template.expanded', template.tenantId, {
        created: expansion.occurrences.map((r) => reservationPublicId(r.id)),
        skipped: expansion.skipped,
      });
      return { template, ...expansion };
    });
  }

  async listTemplates(): Promise<RecurringReservationTemplateRow[]> {
    return this.booking.run(async (tx) => {
      const where: Record<string, unknown> = {};
      const actor = this.actor;
      if (!actor.tenantId && !actor.isPlatform && !actor.isSystem) {
        where['playerId'] = actor.userId;
      }
      return tx.recurringReservationTemplate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });
    });
  }

  async getTemplate(id: string): Promise<RecurringReservationTemplateRow> {
    return this.booking.run(async (tx) => {
      const row = await this.mustGet(tx, id);
      return row;
    });
  }

  /** Extend the materialized occurrence window; idempotent per (series_id, starts_at). */
  async expand(id: string): Promise<{ template: RecurringReservationTemplateRow } & ExpansionResult> {
    return this.booking.run(async (tx) => {
      const template = await this.mustGet(tx, id);
      if (template.status !== 'active') {
        throw new ConflictException(`template is ${template.status}`);
      }
      const expansion = await expandTemplate(tx, template, new Date());
      await this.record(tx, template.id, 'recurring_template.expanded', template.tenantId, {
        created: expansion.occurrences.map((r) => reservationPublicId(r.id)),
        skipped: expansion.skipped,
      });
      return { template, ...expansion };
    });
  }

  /** Stop the series: template cancelled + future occurrences cancelled (past keep history). */
  async cancel(id: string): Promise<RecurringReservationTemplateRow> {
    return this.booking.run(async (tx) => {
      const template = await this.mustGet(tx, id);
      if (template.status === 'cancelled') {
        throw new ConflictException('template is already cancelled');
      }
      const now = new Date();
      const future = await tx.reservation.findMany({
        where: { seriesId: template.id, startsAt: { gt: now } },
      });
      const cancelled: string[] = [];
      for (const row of future) {
        if (!canCancel(row.status)) continue;
        await tx.reservation.updateMany({
          where: { id: row.id },
          data: { status: 'cancelled', holdExpiresAt: null },
        });
        await tx.resourceAllocation.deleteMany({
          where: { ownerType: 'reservation', ownerId: row.uuid },
        });
        cancelled.push(reservationPublicId(row.id));
        await this.audit.append(tx, this.actor, {
          streamType: 'reservation',
          streamId: row.uuid,
          eventType: 'reservation.cancelled',
          tenantId: row.tenantId,
          payload: {
            reservation: {
              id: reservationPublicId(row.id),
              reference_no: row.referenceNo,
              resource_id: row.resourceId,
              status: 'cancelled',
              starts_at: row.startsAt,
              ends_at: row.endsAt,
            },
            series_id: template.id,
          },
          metadata: {},
        });
      }
      const updated = await tx.recurringReservationTemplate.update({
        where: { id: template.id },
        data: { status: 'cancelled' },
      });
      await this.record(tx, template.id, 'recurring_template.cancelled', template.tenantId, {
        template: this.templatePayload(updated),
        cancelled_occurrences: cancelled,
      });
      return updated;
    });
  }

  private async mustGet(tx: Tx, id: string): Promise<RecurringReservationTemplateRow> {
    const row = await tx.recurringReservationTemplate.findFirst({ where: { id } });
    if (!row || !canAccessOwnedRow(this.actor, row)) throw new RecordNotFoundException();
    return row;
  }

  private templatePayload(t: RecurringReservationTemplateRow): Record<string, unknown> {
    return {
      id: t.id,
      venue_id: t.venueId,
      resource_id: t.resourceId,
      player_id: t.playerId,
      rule: t.rule,
      status: t.status,
    };
  }
}
