import {
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ScopedPrisma } from '../prisma/scoped-prisma.service';
import { SystemContextService } from '../common/context/system-context.service';
import { ActorContextService } from '../common/auth/actor-context.service';
import { AuditService } from '../common/audit/audit.service';
import { DomainException, RecordNotFoundException } from '../common/errors/api-error';
import { newId } from '../common/ids/uuid';
import { RequestActor } from '../common/auth/actor';
import { CatalogDb, VenueClosureRow, VenueFacilityRuleRow, VenueRow, VenueWaiverDocumentRow, VenueWaiverVersionRow } from '../venue-catalog/catalog.types';
import { closureInstances } from '../venue-catalog/recurrence';
import {
  BookingDb,
  CheckInRow,
  ConsentRecordRow,
  ReservationRow,
} from './booking.types';
import {
  bufferedWindow,
  computeSlots,
  resolveGridSettings,
  Slot,
} from './availability';
import {
  ACTIVE_RESERVATION_STATUSES,
  canCancel,
  canConfirm,
  holdExpiryFrom,
  isHoldExpired,
} from './holds';
import { evaluateCancellation, resolvePolicy, CancelActor } from './cancellation';
import { canAccessOwnedRow } from './scope';
import { reservationPublicId } from './serializers';

type TxClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

type Db = BookingDb & CatalogDb;
type Tx = TxClient & Db;

const asDb = (client: TxClient): Tx => client as unknown as Tx;

export interface SlotGrid {
  resource_id: string;
  resource_name: string;
  slots: Slot[];
}

export interface ConsentRequirement {
  kind: 'facility_rule' | 'waiver';
  id: string;
  version: number;
  title: string;
}

export class MissingConsentException extends DomainException {
  constructor(public readonly required: ConsentRequirement[]) {
    super(
      422,
      'MISSING_CONSENT',
      `missing required consents: ${required.map((r) => r.title).join(', ')}`,
      { required: required.map((r) => ({ kind: r.kind, document_id: r.id, version: r.version, title: r.title })) },
    );
  }
}

/**
 * Reservation lifecycle, availability, check-in/attendance. All work runs in
 * one transaction carrying the RLS context; players and guests have no
 * tenant context, so their calls execute inside SystemContextService with the
 * service validating scope explicitly (tenant discovered from the target
 * resource, ownership from player_id/guest_contact_id).
 */
@Injectable()
export class BookingService {
  constructor(
    private readonly scoped: ScopedPrisma,
    private readonly system: SystemContextService,
    private readonly actorContext: ActorContextService,
    private readonly audit: AuditService,
  ) {}

  private get actor(): RequestActor {
    return this.actorContext.actor;
  }

  /** Run `fn` in the caller's persistence context. */
  private async db<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    const actor = this.actor;
    if (actor.tenantId || actor.isPlatform || actor.isSystem) {
      return fn(asDb(this.scoped.client));
    }
    // Player/guest callers: no tenant RLS context exists, so use an explicit
    // system transaction; every query below still scopes by actor/user id.
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

  // ---------- availability ----------

  /** Bookable-slot grid for every active resource of a venue on `date` (YYYY-MM-DD, UTC). */
  async availability(venueId: string, date: string): Promise<SlotGrid[]> {
    return this.db(async (tx) => {
      const venue = await tx.venue.findFirst({ where: { id: venueId } });
      if (!venue) throw new RecordNotFoundException();
      const dayStart = new Date(`${date}T00:00:00.000Z`);
      if (Number.isNaN(dayStart.getTime())) {
        throw new UnprocessableEntityException('date must be YYYY-MM-DD');
      }
      const dayEnd = new Date(dayStart.getTime() + 24 * 3_600_000);
      const now = new Date();
      const resources = await tx.venueResource.findMany({
        where: { venueId, status: 'active' },
        orderBy: { name: 'asc' },
      });
      const closures = await tx.venueClosure.findMany({
        where: {
          OR: [{ venueId }, { venueId: null }],
          status: 'scheduled',
        },
      });
      const allocations = await tx.resourceAllocation.findMany({
        where: {
          resourceId: { in: resources.map((r) => r.id) },
          startsAt: { lt: dayEnd },
          endsAt: { gt: dayStart },
        },
      });
      return resources.map((resource) => {
        const closuresFor = closures.filter(
          (c) => c.resourceId === null || c.resourceId === resource.id,
        );
        const busy = [
          ...closuresFor.flatMap((c) => closureInstances(c, dayStart, dayEnd)),
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
          slots: computeSlots(dayStart, resolveGridSettings(resource.settings), busy, now),
        };
      });
    });
  }

  // ---------- reservations ----------

  async listReservations(
    filters: {
      date?: Date;
      statuses?: string[];
      where?: Record<string, unknown>;
      orderBy?: Record<string, 'asc' | 'desc'>;
      q?: string;
    } = {},
  ): Promise<ReservationRow[]> {
    return this.db(async (tx) => {
      const actor = this.actor;
      const where: Record<string, unknown> = { ...(filters.where ?? {}) };
      // Free-text also matches hydrated names: expand to matching
      // guest-contact ids (tenant-scoped) and player ids (system context).
      if (filters.q) {
        const q = filters.q;
        const [guests, players] = await Promise.all([
          tx.guestContact.findMany({
            where: {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q, mode: 'insensitive' } },
              ],
            },
            select: { id: true },
          }),
          this.system.run((sys) =>
            sys.iamUser.findMany({
              where: {
                OR: [
                  { displayName: { contains: q, mode: 'insensitive' } },
                  { email: { contains: q, mode: 'insensitive' } },
                  { username: { contains: q, mode: 'insensitive' } },
                ],
              },
              select: { id: true },
            }),
          ),
        ]);
        const or = (where.OR as unknown[] | undefined) ?? [];
        if (guests.length) or.push({ guestContactId: { in: guests.map((g) => g.id) } });
        if (players.length) or.push({ playerId: { in: players.map((p) => p.id) } });
        if (or.length) where.OR = or;
      }
      if (!actor.tenantId && !actor.isPlatform) {
        // Players see only their own rows (RLS mirrors this under tenant scope).
        where['playerId'] = actor.userId;
      }
      if (filters.date) {
        const dayStart = filters.date;
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        // Any overlap with the selected day (matches /schedule's semantics).
        where['startsAt'] = { lt: dayEnd };
        where['endsAt'] = { gt: dayStart };
      }
      if (filters.statuses?.length) where['status'] = { in: filters.statuses };
      const rows = await tx.reservation.findMany({
        where,
        orderBy: filters.orderBy ?? { startsAt: 'desc' },
      });
      await this.hydrateDisplay(tx, rows);
      return rows;
    });
  }

  async getReservation(id: bigint): Promise<ReservationRow> {
    return this.db(async (tx) => {
      const row = await tx.reservation.findFirst({ where: { id } });
      if (!row) throw new RecordNotFoundException();
      this.assertCanView(row);
      await this.hydrateDisplay(tx, [row]);
      return row;
    });
  }

  /**
   * Staff member lookup for on-behalf booking. Returns minimal display fields
   * for players who already have a relationship with this tenant (a past or
   * upcoming reservation / event registration) — never arbitrary platform
   * users. The iam_users read itself is field-allowlisted under system
   * context because platform-scope players are RLS-invisible.
   */
  async lookupPlayers(q: string): Promise<{ id: string; display_name: string | null; email: string | null; phone: string | null; note: string | null }[]> {
    this.requireStaff('bookings.manage');
    return this.db(async (tx) => {
      const [resRows, regRows] = await Promise.all([
        tx.reservation.findMany({
          where: { playerId: { not: null } },
          orderBy: { createdAt: 'desc' },
        }),
        tx.eventRegistration.findMany({ where: {}, orderBy: { createdAt: 'desc' } }),
      ]);
      const relatedIds = [
        ...new Set([
          ...resRows.map((r) => r.playerId).filter((v): v is string => Boolean(v)),
          ...regRows.map((r) => r.playerId).filter((v): v is string => Boolean(v)),
        ]),
      ];
      if (relatedIds.length === 0) return [];
      const users = await this.system.run((sys) =>
        sys.iamUser.findMany({
          where: { id: { in: relatedIds } },
          select: { id: true, displayName: true, email: true, phone: true },
        }),
      );
      // Tenant-owned staff notes (customer_notes is RLS-scoped to this tenant).
      const notes = await this.scoped.client.customerNote.findMany({
        where: { playerId: { in: relatedIds } },
        select: { playerId: true, note: true },
      });
      const noteByPlayer = new Map(notes.map((n): [string, string] => [n.playerId, n.note]));
      const needle = q.trim().toLowerCase();
      const filtered = needle
        ? users.filter(
            (u) =>
              (u.displayName ?? '').toLowerCase().includes(needle) ||
              (u.email ?? '').toLowerCase().includes(needle) ||
              (u.phone ?? '').toLowerCase().includes(needle),
          )
        : users;
      return filtered
        .slice(0, 50)
        .map((u) => ({
          id: u.id,
          display_name: u.displayName,
          email: u.email,
          phone: u.phone,
          note: noteByPlayer.get(u.id) ?? null,
        }));
    });
  }

  /** Staff: upsert a tenant-owned note about a player account. */
  async updatePlayerNote(playerId: string, note: string): Promise<void> {
    this.requireStaff('bookings.manage');
    const actor = this.actor;
    if (!actor.tenantId) throw new RecordNotFoundException();
    const tenantId = actor.tenantId;
    await this.db(async (tx) => {
      await this.scoped.client.customerNote.upsert({
        where: { tenantId_playerId: { tenantId, playerId } },
        create: {
          id: newId(),
          tenantId,
          playerId,
          note,
          updatedBy: actor.userId ?? null,
        },
        update: { note, updatedBy: actor.userId ?? null },
      });
      await this.record(tx, 'customer_note', playerId, 'customer_note.updated', tenantId, {
        note,
      });
    });
  }

  /** Staff: update a member's reachable fields (phone on iam_users, notes on customer_notes). */
  async updatePlayerContact(playerId: string, data: { phone?: string; note?: string }): Promise<void> {
    this.requireStaff('bookings.manage');
    const actor = this.actor;
    if (!actor.tenantId) throw new RecordNotFoundException();
    const tenantId = actor.tenantId;

    if (data.phone !== undefined) {
      const before = await this.system.run((sys) =>
        sys.iamUser.findFirst({ where: { id: playerId }, select: { id: true, phone: true } }),
      );
      if (!before) throw new RecordNotFoundException();
      await this.system.run((sys) => sys.iamUser.update({ where: { id: playerId }, data: { phone: data.phone } }));
      await this.db(async (tx) => {
        await this.record(tx, 'iam_user', playerId, 'iam_user.phone_updated', tenantId, {
          from: before.phone ?? null,
          to: data.phone ?? null,
        });
      });
    }
    if (data.note !== undefined) {
      await this.updatePlayerNote(playerId, data.note);
    }
  }

  /** Staff: update a guest contact's reachable fields (phone + staff notes). */
  async updateGuestContact(id: string, data: { phone?: string; notes?: string }) {
    this.requireStaff('bookings.manage');
    return this.db(async (tx) => {
      const row = await tx.guestContact.findFirst({ where: { id } });
      if (!row) throw new RecordNotFoundException();
      const updated = await tx.guestContact.update({ where: { id }, data });
      await this.record(tx, 'guest_contact', id, 'guest_contact.updated', row.tenantId, {
        changed: Object.keys(data),
        phone: updated.phone ?? null,
        notes: updated.notes ?? null,
      });
      return updated;
    });
  }

  /** Staff list of the tenant's guest contacts (walk-ins + guest bookings). */
  async listGuestContacts(list?: { where?: Record<string, unknown>; orderBy?: Record<string, 'asc' | 'desc'> }) {
    this.requireStaff('bookings.manage');
    return this.db((tx) =>
      tx.guestContact.findMany({
        where: list?.where,
        orderBy: list?.orderBy ?? { createdAt: 'desc' },
      }),
    );
  }

  /** Staff list of check-in records; names hydrated like reservations. */
  async listCheckIns(list?: { where?: Record<string, unknown>; orderBy?: Record<string, 'asc' | 'desc'> }) {
    this.requireStaff('bookings.manage');
    return this.db(async (tx) => {
      const rows = (await tx.checkIn.findMany({
        where: list?.where,
        orderBy: list?.orderBy ?? { recordedAt: 'desc' },
      })) as CheckInRow[];
      const userIds = [...new Set(rows.map((r) => r.subjectUserId).filter((v): v is string => Boolean(v)))];
      const guestIds = [...new Set(rows.map((r) => r.guestContactId).filter((v): v is string => Boolean(v)))];
      const [users, guests] = await Promise.all([
        userIds.length
          ? this.system.run((sys) =>
              sys.iamUser.findMany({ where: { id: { in: userIds } }, select: { id: true, displayName: true, email: true, username: true } }),
            )
          : Promise.resolve([]),
        guestIds.length
          ? tx.guestContact.findMany({ where: { id: { in: guestIds } } })
          : Promise.resolve([]),
      ]);
      const userName = new Map<string, string | null>(
        users.map((u): [string, string | null] => [u.id, u.displayName || u.email || u.username || null]),
      );
      const guestName = new Map<string, string | null>(guests.map((g): [string, string | null] => [g.id, g.name ?? null]));
      for (const r of rows) {
        r.subjectName =
          (r.subjectUserId ? userName.get(r.subjectUserId) : null) ??
          (r.guestContactId ? guestName.get(r.guestContactId) : null) ??
          null;
      }
      return rows;
    });
  }

  private assertCanView(row: ReservationRow): void {
    if (!canAccessOwnedRow(this.actor, row)) throw new RecordNotFoundException();
  }

  /** Create a reservation hold. `subject` is the player user id or guest contact id. */
  async createHold(input: {
    resourceId: string;
    activityId?: string;
    startsAt: Date;
    endsAt: Date;
    partySize: number;
    notes?: string;
    playerId?: string;
    guestContactId?: string;
    /** Staff walk-in: find-or-create a guest contact by name + phone/email. */
    guestName?: string;
    guestContact?: string;
    idempotencyKey?: string;
    participants?: { userId?: string; name?: string; isMinor?: boolean; guardianUserId?: string }[];
  }): Promise<ReservationRow> {
    return this.db(async (tx) => {
      const actor = this.actor;
      const resource = await tx.venueResource.findFirst({
        where: { id: input.resourceId, status: 'active' },
      });
      if (!resource) throw new RecordNotFoundException();
      const venue = (await tx.venue.findFirst({ where: { id: resource.venueId } })) as VenueRow | null;
      if (!venue || venue.status !== 'active') throw new RecordNotFoundException();
      if (input.endsAt <= input.startsAt) {
        throw new UnprocessableEntityException('ends_at must be after starts_at');
      }
      if (input.startsAt < new Date()) {
        throw new UnprocessableEntityException('starts_at must be in the future');
      }

      // Walk-in subject: staff may supply a name + contact instead of a
      // player id; find-or-create the guest contact inside the same tx.
      let guestContactId = input.guestContactId ?? null;
      if (!input.playerId && !guestContactId && input.guestName) {
        const contact = input.guestContact?.includes('@')
          ? { email: input.guestContact, phone: null }
          : { email: null, phone: input.guestContact ?? null };
        const existing = contact.email || contact.phone
          ? await tx.guestContact.findFirst({
              where: {
                tenantId: resource.tenantId,
                name: input.guestName,
                OR: [
                  ...(contact.email ? [{ email: contact.email }] : []),
                  ...(contact.phone ? [{ phone: contact.phone }] : []),
                ],
              },
            })
          : null;
        guestContactId =
          existing?.id ??
          (await tx.guestContact.create({
            data: {
              id: newId(),
              tenantId: resource.tenantId,
              name: input.guestName,
              email: contact.email,
              phone: contact.phone,
            },
          })).id;
      }
      if (!input.playerId && !guestContactId) {
        throw new BadRequestException(
          'a subject is required: player_id, or guest_name (+ optional contact) for walk-ins',
        );
      }

      // Consent gating: flagged rules + active waivers must be acknowledged
      // before the protected action completes (WAIVERS_AND_CONSENT, FACILITY_USE_RULES).
      const missing = await this.missingConsents(tx, {
        tenantId: resource.tenantId,
        venueId: resource.venueId,
        resourceId: resource.id,
        activityId: input.activityId ?? null,
        userId: input.playerId ?? null,
        guestContactId,
      });
      if (missing.length > 0) throw new MissingConsentException(missing);

      const settings = resolveGridSettings(resource.settings);
      const bufferMinutes =
        typeof (resource.settings as Record<string, unknown> | null)?.['buffer_minutes'] === 'number'
          ? ((resource.settings as Record<string, unknown>)['buffer_minutes'] as number)
          : settings.buffer_minutes;
      const window = bufferedWindow(input.startsAt, input.endsAt, bufferMinutes);

      // Closures block submissions outright.
      const closures = await tx.venueClosure.findMany({
        where: {
          OR: [{ venueId: resource.venueId }, { venueId: null }],
          status: 'scheduled',
        },
      });
      const blocked = closures.find(
        (c: VenueClosureRow) =>
          (c.resourceId === null || c.resourceId === resource.id) &&
          closureInstances(c, window.startsAt, window.endsAt).length > 0,
      );
      if (blocked) {
        throw new DomainException(409, 'RESOURCE_CLOSED', 'resource is closed during the requested window');
      }

      // Idempotent retry: return the existing row for a reused key.
      if (input.idempotencyKey) {
        const existing = await tx.reservation.findFirst({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (existing) {
          this.assertSubject(actor, existing);
          return existing;
        }
      }

      await this.sweepExpired(tx, resource.id);

      const approvalRequired =
        (resource.settings as Record<string, unknown> | null)?.['approval_required'] === true;
      const now = new Date();
      const status = approvalRequired ? 'pending_approval' : 'hold';
      const uuid = newId();
      const reservation = await tx.reservation.create({
        data: {
          uuid,
          tenantId: resource.tenantId,
          venueId: resource.venueId,
          resourceId: resource.id,
          activityId: input.activityId ?? null,
          playerId: input.playerId ?? null,
          guestContactId,
          status,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          bufferMinutes,
          partySize: input.partySize,
          holdExpiresAt: approvalRequired ? null : holdExpiryFrom(now),
          paymentState: 'none',
          notes: input.notes ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
          createdBy: actor.userId ?? null,
          cancellation: resolvePolicy(
            (resource.settings as Record<string, unknown> | null)?.['cancellation_policy'],
          ) as unknown as object,
        },
      });
      // Display reference: RES-<seq>, unique per tenant.
      await tx.$executeRaw`
        UPDATE "reservations"
        SET "reference_no" = 'RES-' || lpad("id"::text, 6, '0')
        WHERE "id" = ${reservation.id}
      `;
      // Shared conflict space: PostgreSQL rejects an overlapping claim here.
      try {
        await tx.resourceAllocation.create({
        data: {
          id: newId(),
          tenantId: resource.tenantId,
          resourceId: resource.id,
          ownerType: 'reservation',
          ownerId: uuid,
          startsAt: window.startsAt,
          endsAt: window.endsAt,
          expiresAt: approvalRequired ? null : holdExpiryFrom(now),
        },
      });
      } catch {
        // Exclusion-constraint violation → the slot was claimed concurrently.
        throw new DomainException(409, 'DOUBLE_BOOKING', 'the requested slot overlaps an existing booking', {
          resource_id: resource.id,
          starts_at: input.startsAt,
          ends_at: input.endsAt,
        });
      }
      for (const p of input.participants ?? []) {
        await tx.reservationParticipant.create({
          data: {
            id: newId(),
            tenantId: resource.tenantId,
            reservationId: reservation.id,
            kind: p.isMinor ? 'minor' : 'participant',
            userId: p.userId ?? null,
            name: p.name ?? null,
            isMinor: p.isMinor ?? false,
            guardianUserId: p.guardianUserId ?? null,
          },
        });
      }
      const saved = (await tx.reservation.findFirst({ where: { id: reservation.id } })) as ReservationRow;
      await this.record(tx, 'reservation', uuid, 'reservation.requested', resource.tenantId, {
        reservation: this.auditPayload(saved),
      });
      await this.hydrateDisplay(tx, [saved]);
      return saved;
    });
  }

  /** hold/pending_payment -> confirmed; pending_approval requires staff approve. */
  async confirm(id: bigint): Promise<ReservationRow> {
    return this.db(async (tx) => {
      const row = await this.mustGet(tx, id);
      this.assertSubject(this.actor, row);
      if (!canConfirm(row.status)) {
        throw new ConflictException(`reservation cannot be confirmed from status ${row.status}`);
      }
      if (isHoldExpired(row.status, row.holdExpiresAt, new Date())) {
        throw new DomainException(409, 'HOLD_EXPIRED', 'hold has expired; create a new reservation');
      }
      if (row.status === 'pending_approval' && !this.isStaff()) {
        throw new ForbiddenException('reservation awaits venue approval');
      }
      const updated = await tx.reservation.update({
        where: { id: row.id },
        data: { status: 'confirmed', holdExpiresAt: null },
      });
      await tx.resourceAllocation.updateMany({
        where: { ownerType: 'reservation', ownerId: row.uuid },
        data: { expiresAt: null },
      });
      await this.record(tx, 'reservation', row.uuid, 'reservation.confirmed', row.tenantId, {
        reservation: this.auditPayload(updated),
      });
      return updated;
    });
  }

  async cancel(id: bigint): Promise<ReservationRow> {
    return this.db(async (tx) => {
      const row = await this.mustGet(tx, id);
      this.assertSubject(this.actor, row);
      if (!canCancel(row.status)) {
        throw new ConflictException(`reservation cannot be cancelled from status ${row.status}`);
      }
      const cancelledBy: CancelActor = this.isStaff() ? 'venue' : 'player';
      const outcome = evaluateCancellation(row.cancellation, row.startsAt, new Date(), cancelledBy);
      const updated = await tx.reservation.update({
        where: { id: row.id },
        data: {
          status: 'cancelled',
          holdExpiresAt: null,
          cancellation: { ...outcome, evaluated_at: new Date().toISOString() } as unknown as object,
        },
      });
      await tx.resourceAllocation.deleteMany({
        where: { ownerType: 'reservation', ownerId: row.uuid },
      });
      await this.record(tx, 'reservation', row.uuid, 'reservation.cancelled', row.tenantId, {
        reservation: this.auditPayload(updated),
        outcome,
      });
      return updated;
    });
  }

  /** Staff approve: pending_approval -> confirmed. */
  async approve(id: bigint): Promise<ReservationRow> {
    this.requireStaff('bookings.manage');
    return this.db(async (tx) => {
      const row = await this.mustGet(tx, id);
      if (row.status !== 'pending_approval') {
        throw new ConflictException('reservation is not awaiting approval');
      }
      const updated = await tx.reservation.update({
        where: { id: row.id },
        data: { status: 'confirmed' },
      });
      await this.record(tx, 'reservation', row.uuid, 'reservation.approved', row.tenantId, {
        reservation: this.auditPayload(updated),
      });
      return updated;
    });
  }

  async decline(id: bigint, reason?: string): Promise<ReservationRow> {
    this.requireStaff('bookings.manage');
    return this.db(async (tx) => {
      const row = await this.mustGet(tx, id);
      if (row.status !== 'pending_approval') {
        throw new ConflictException('reservation is not awaiting approval');
      }
      const updated = await tx.reservation.update({
        where: { id: row.id },
        data: { status: 'declined', notes: reason ?? row.notes },
      });
      await tx.resourceAllocation.deleteMany({
        where: { ownerType: 'reservation', ownerId: row.uuid },
      });
      await this.record(tx, 'reservation', row.uuid, 'reservation.declined', row.tenantId, {
        reservation: this.auditPayload(updated),
        reason: reason ?? null,
      });
      return updated;
    });
  }

  // ---------- check-in / attendance ----------

  async checkIn(input: {
    reservationId?: bigint;
    method: string;
  }): Promise<CheckInRow> {
    return this.db(async (tx) => {
      const actor = this.actor;
      if (!input.reservationId) {
        throw new UnprocessableEntityException('reservation_id is required');
      }
      const row = await this.mustGet(tx, input.reservationId);
      const self = actor.userId !== undefined && actor.userId === row.playerId;
      if (!self) this.requireStaff('checkin.perform');
      if (row.status !== 'confirmed') {
        throw new DomainException(
          409,
          'RESERVATION_NOT_CONFIRMED',
          'only confirmed reservations can be checked in',
          { status: row.status },
        );
      }
      const now = new Date();
      const resource = await tx.venueResource.findFirst({ where: { id: row.resourceId } });
      const windowMin =
        typeof (resource?.settings as Record<string, unknown> | null)?.['arrival_window_minutes'] === 'number'
          ? ((resource!.settings as Record<string, unknown>)['arrival_window_minutes'] as number)
          : 30;
      const opens = new Date(row.startsAt.getTime() - windowMin * 60_000);
      if (now < opens || now > row.endsAt) {
        throw new DomainException(409, 'CHECKIN_WINDOW_CLOSED', 'outside the check-in window', {
          window_opens_at: opens,
          window_closes_at: row.endsAt,
          now,
        });
      }
      const checkIn = await tx.checkIn.create({
        data: {
          id: newId(),
          tenantId: row.tenantId,
          venueId: row.venueId,
          reservationUuid: row.uuid,
          subjectUserId: row.playerId,
          guestContactId: row.guestContactId,
          outcome: 'arrived',
          method: self ? 'self' : input.method,
          recordedBy: actor.userId ?? null,
        },
      });
      await this.record(tx, 'attendance', row.uuid, 'check_in.recorded', row.tenantId, {
        check_in_id: checkIn.id,
        reservation_id: reservationPublicId(row.id),
        method: checkIn.method,
      });
      return checkIn;
    });
  }

  /** Staff mark a confirmed reservation as no-show once its window has passed. */
  async markNoShow(id: bigint): Promise<ReservationRow> {
    this.requireStaff('checkin.perform');
    return this.db(async (tx) => {
      const row = await this.mustGet(tx, id);
      if (row.status !== 'confirmed') {
        throw new ConflictException('only confirmed reservations can be marked no-show');
      }
      const now = new Date();
      const updated = await tx.reservation.update({
        where: { id: row.id },
        data: { status: 'no_show', noShowMarkedAt: now },
      });
      const checkIn = await tx.checkIn.create({
        data: {
          id: newId(),
          tenantId: row.tenantId,
          venueId: row.venueId,
          reservationUuid: row.uuid,
          subjectUserId: row.playerId,
          guestContactId: row.guestContactId,
          outcome: 'no_show',
          method: 'manual',
          recordedBy: this.actor.userId ?? null,
        },
      });
      await this.record(tx, 'attendance', row.uuid, 'check_in.no_show_marked', row.tenantId, {
        check_in_id: checkIn.id,
        reservation_id: reservationPublicId(row.id),
      });
      return updated;
    });
  }

  /** Schedule feed for the venue portal: reservations + events on a date. */
  async schedule(date: string, venueId?: string): Promise<{ reservations: ReservationRow[] }> {
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(dayStart.getTime())) {
      throw new UnprocessableEntityException('date must be YYYY-MM-DD');
    }
    const dayEnd = new Date(dayStart.getTime() + 24 * 3_600_000);
    return this.db(async (tx) => {
      const where: Record<string, unknown> = {
        startsAt: { lt: dayEnd },
        endsAt: { gt: dayStart },
        status: { in: [...ACTIVE_RESERVATION_STATUSES, 'completed', 'no_show'] },
      };
      if (venueId) where['venueId'] = venueId;
      const reservations = await tx.reservation.findMany({
        where,
        orderBy: { startsAt: 'asc' },
      });
      await this.hydrateDisplay(tx, reservations);
      return { reservations };
    });
  }

  /**
   * Display fields — customers and resources render as names, never raw ids
   * (DISPLAY_CONVENTIONS). Batch-loads; the names live on iam_users,
   * guest_contacts, venue_resources which RLS already scopes.
   */
  private async hydrateDisplay(tx: Tx, rows: ReservationRow[]): Promise<void> {
    const playerIds = [...new Set(rows.map((r) => r.playerId).filter((v): v is string => Boolean(v)))];
    const guestIds = [...new Set(rows.map((r) => r.guestContactId).filter((v): v is string => Boolean(v)))];
    const resourceIds = [...new Set(rows.map((r) => r.resourceId))];
    // Player names live on iam_users — platform-scope player rows are
    // invisible to the tenant under RLS, so that single lookup runs under
    // system context and returns display fields only (id + name bits).
    const [players, guests, resources] = await Promise.all([
      playerIds.length
        ? this.system.run((sys) =>
            sys.iamUser.findMany({
              where: { id: { in: playerIds } },
              select: { id: true, displayName: true, email: true, username: true },
            }),
          )
        : Promise.resolve([]),
      guestIds.length
        ? tx.guestContact.findMany({ where: { id: { in: guestIds } } })
        : Promise.resolve([]),
      resourceIds.length
        ? tx.venueResource.findMany({ where: { id: { in: resourceIds } } })
        : Promise.resolve([]),
    ]);
    const playerName = new Map<string, string | null>(
      players.map((u): [string, string | null] => [
        u.id,
        u.displayName || u.email || u.username || null,
      ]),
    );
    const guestName = new Map<string, string | null>(
      guests.map((g): [string, string | null] => [g.id, g.name ?? null]),
    );
    const resourceName = new Map<string, string | null>(
      resources.map((r): [string, string | null] => [r.id, r.name ?? null]),
    );
    for (const r of rows) {
      r.customerName =
        (r.playerId ? playerName.get(r.playerId) : null) ??
        (r.guestContactId ? guestName.get(r.guestContactId) : null) ??
        null;
      r.resourceName = resourceName.get(r.resourceId) ?? null;
    }
  }

  // ---------- shared helpers ----------

  /** Lazily release expired holds on a resource before claiming it. */
  async sweepExpired(tx: Tx, resourceId: string): Promise<void> {
    const now = new Date();
    const expired = await tx.resourceAllocation.findMany({
      where: { resourceId, expiresAt: { lte: now } },
    });
    for (const alloc of expired) {
      if (alloc.ownerType === 'reservation') {
        await tx.reservation.updateMany({
          where: { uuid: alloc.ownerId, status: 'hold' },
          data: { status: 'expired' },
        });
      }
    }
    await tx.resourceAllocation.deleteMany({
      where: { resourceId, expiresAt: { lte: now } },
    });
  }

  /** Required consents missing for this subject; empty array = booking may proceed. */
  async missingConsents(
    tx: Tx,
    scope: {
      tenantId: string;
      venueId: string;
      resourceId: string;
      activityId: string | null;
      userId: string | null;
      guestContactId: string | null;
    },
  ): Promise<ConsentRequirement[]> {
    const rules = await tx.venueFacilityRule.findMany({
      where: {
        tenantId: scope.tenantId,
        requiresAcknowledgment: true,
        status: 'published',
        AND: [
          { OR: [{ venueId: scope.venueId }, { venueId: null }] },
          { OR: [{ resourceId: scope.resourceId }, { resourceId: null }] },
          { OR: [{ activityId: scope.activityId }, { activityId: null }] },
        ],
      },
    });
    const waiverDocs = await tx.venueWaiverDocument.findMany({
      where: {
        tenantId: scope.tenantId,
        status: 'active',
        AND: [
          { OR: [{ venueId: scope.venueId }, { venueId: null }] },
          { OR: [{ resourceId: scope.resourceId }, { resourceId: null }] },
          { OR: [{ activityId: scope.activityId }, { activityId: null }] },
        ],
      },
    });
    const subject: Record<string, unknown> = scope.userId
      ? { userId: scope.userId }
      : { guestContactId: scope.guestContactId };
    const required: ConsentRequirement[] = [];
    for (const rule of rules as VenueFacilityRuleRow[]) {
      const existing = await tx.consentRecord.findFirst({
        where: {
          kind: 'facility_rule',
          facilityRuleId: rule.id,
          facilityRuleVersion: rule.version,
          ...subject,
        },
      });
      if (!existing) {
        required.push({ kind: 'facility_rule', id: rule.id, version: rule.version, title: rule.title });
      }
    }
    for (const doc of waiverDocs as VenueWaiverDocumentRow[]) {
      const version = (await tx.venueWaiverVersion.findFirst({
        where: { documentId: doc.id, version: doc.currentVersion, status: 'published' },
      })) as VenueWaiverVersionRow | null;
      if (!version) continue;
      const existing = await tx.consentRecord.findFirst({
        where: { kind: 'waiver', waiverVersionId: version.id, ...subject },
      });
      if (!existing) {
        required.push({ kind: 'waiver', id: doc.id, version: version.version, title: doc.title });
      }
    }
    return required;
  }

  async recordConsent(
    tx: Tx,
    data: Record<string, unknown>,
    streamEvent: string,
  ): Promise<ConsentRecordRow> {
    const record = await tx.consentRecord.create({ data: { id: newId(), ...data } });
    await this.record(tx, 'consent', record.id, streamEvent, record.tenantId, {
      consent: record as unknown as Record<string, unknown>,
    });
    return record;
  }

  /** Expose a scoped tx to sibling services (consent, guest booking). */
  async run<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db(fn);
  }

  private async mustGet(tx: Tx, id: bigint): Promise<ReservationRow> {
    const row = await tx.reservation.findFirst({ where: { id } });
    if (!row) throw new RecordNotFoundException();
    return row;
  }

  private isStaff(): boolean {
    return Boolean(this.actor.tenantId) || this.actor.isPlatform;
  }

  private requireStaff(permission: string): void {
    if (!this.isStaff() || !this.actor.permissions.includes(permission)) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  /** Caller must own the row (player/guest subject) or be tenant staff. */
  private assertSubject(actor: RequestActor, row: ReservationRow): void {
    if (!canAccessOwnedRow(actor, row)) throw new RecordNotFoundException();
  }

  private auditPayload(r: ReservationRow): Record<string, unknown> {
    return {
      id: reservationPublicId(r.id),
      reference_no: r.referenceNo,
      resource_id: r.resourceId,
      status: r.status,
      starts_at: r.startsAt,
      ends_at: r.endsAt,
    };
  }
}
