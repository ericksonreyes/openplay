import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes, randomInt } from 'crypto';
import { SystemContextService } from '../common/context/system-context.service';
import { AuditService } from '../common/audit/audit.service';
import { RecordNotFoundException } from '../common/errors/api-error';
import { newId } from '../common/ids/uuid';
import { publicActor } from '../common/auth/actor';
import { PrismaClient } from '@prisma/client';
import { BookingDb, GuestContactRow, ReservationRow } from './booking.types';
import { BookingService } from './booking.service';
import { CatalogDb } from '../venue-catalog/catalog.types';

type TxClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;
type Tx = TxClient & BookingDb & CatalogDb;

const sha256 = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

const TOKEN_TTL_HOURS = 24;

export interface GuestBookingResult {
  contact: GuestContactRow;
  reservation: ReservationRow;
  /** Opaque secure-link credential; shown once, stored only as a hash. */
  accessToken: string;
  /** One-time code alternative for verification (local stub channel). */
  verificationCode: string;
}

/**
 * Account-free guest booking. The guest gets an opaque access token (secure
 * link) plus a one-time code; either verifies the contact. Until
 * verification, the only handle is the unguessable token — no lookup by
 * name/email/phone exists, so records cannot be enumerated.
 * Guest-context queries run inside SystemContextService because a public
 * actor carries no RLS scope; every query is filtered by the verified
 * contact id.
 */
@Injectable()
export class GuestBookingService {
  constructor(
    private readonly system: SystemContextService,
    private readonly audit: AuditService,
    private readonly booking: BookingService,
  ) {}

  /** POST /guest-bookings — creates the guest contact and a reservation hold. */
  async createGuestBooking(input: {
    name: string;
    email?: string;
    phone?: string;
    resourceId: string;
    activityId?: string;
    startsAt: Date;
    endsAt: Date;
    partySize: number;
    notes?: string;
    idempotencyKey?: string;
  }): Promise<GuestBookingResult> {
    if (!input.email && !input.phone) {
      throw new BadRequestException('email or phone is required');
    }
    const accessToken = randomBytes(24).toString('hex');
    const verificationCode = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const tokenExpiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 3_600_000);

    // Resolve the tenant from the target resource before contact creation.
    const resource = await this.system.run(async (tx) => {
      const db = tx as unknown as Tx;
      const r = await db.venueResource.findFirst({
        where: { id: input.resourceId, status: 'active' },
      });
      if (!r) throw new RecordNotFoundException();
      return r;
    });

    const contact = await this.system.run(async (tx) => {
      const db = tx as unknown as Tx;
      const row = await db.guestContact.create({
        data: {
          id: newId(),
          tenantId: resource.tenantId,
          name: input.name,
          email: input.email ?? null,
          phone: input.phone ?? null,
          accessTokenHash: sha256(accessToken),
          verificationCodeHash: sha256(verificationCode),
          tokenExpiresAt,
        },
      });
      await this.audit.append(tx, publicActor(), {
        streamType: 'reservation',
        streamId: row.id,
        eventType: 'guest.contact_created',
        tenantId: resource.tenantId,
        payload: { guest_contact_id: row.id },
        metadata: { channel: input.email ? 'email' : 'phone' },
      });
      return row;
    });

    const reservation = await this.booking.createHold({
      resourceId: input.resourceId,
      activityId: input.activityId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      partySize: input.partySize,
      notes: input.notes,
      guestContactId: contact.id,
      idempotencyKey: input.idempotencyKey,
    });

    return { contact, reservation, accessToken, verificationCode };
  }

  /**
   * POST /guest-bookings/:id/verify — :id is the guest contact uuid.
   * Accepts the opaque access token (secure link) or the one-time code.
   * On success the contact is marked verified and the guest's reservations
   * are returned — all scoped strictly by the verified contact id.
   */
  async verify(
    guestContactId: string,
    credential: { accessToken?: string; code?: string },
  ): Promise<{ contact: GuestContactRow; reservations: ReservationRow[] }> {
    if (!credential.accessToken && !credential.code) {
      throw new BadRequestException('access_token or code is required');
    }
    return this.system.run(async (tx) => {
      const db = tx as unknown as Tx;
      const contact = await db.guestContact.findFirst({ where: { id: guestContactId } });
      if (!contact) throw new RecordNotFoundException();
      const now = new Date();
      if (!contact.tokenExpiresAt || contact.tokenExpiresAt <= now) {
        throw new UnauthorizedException('verification link has expired');
      }
      const tokenOk =
        credential.accessToken !== undefined &&
        sha256(credential.accessToken) === contact.accessTokenHash;
      const codeOk =
        credential.code !== undefined &&
        contact.verificationCodeHash !== null &&
        sha256(credential.code) === contact.verificationCodeHash;
      if (!tokenOk && !codeOk) {
        throw new UnauthorizedException('invalid verification credential');
      }
      const verified =
        contact.verifiedAt === null
          ? await db.guestContact.update({
              where: { id: contact.id },
              data: { verifiedAt: now },
            })
          : contact;
      const reservations = await db.reservation.findMany({
        where: { guestContactId: contact.id },
        orderBy: { startsAt: 'desc' },
      });
      return { contact: verified, reservations };
    });
  }

  /** Verified-contact bookings view used after verification. */
  async reservationsFor(guestContactId: string): Promise<ReservationRow[]> {
    return this.system.run(async (tx) => {
      const db = tx as unknown as Tx;
      const contact = await db.guestContact.findFirst({
        where: { id: guestContactId, verifiedAt: { not: null } },
      });
      if (!contact) throw new RecordNotFoundException();
      return db.reservation.findMany({
        where: { guestContactId: contact.id },
        orderBy: { startsAt: 'desc' },
      });
    });
  }
}
