import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ParseSqidPipe, ParseUuidPipe } from '../common/ids/parse-id.pipes';
import { RequirePermissions } from '../common/auth/require-permissions.decorator';
import { ActorContextService } from '../common/auth/actor-context.service';
import { optionalInt, optionalString, optionalUuid } from '../venue-catalog/validation';
import { parseListQuery } from '../common/list-query';
import { BookingService } from './booking.service';
import {
  RESERVATION_SQID_SCOPE,
  serializeReservation,
} from './serializers';

const parseInstant = (value: unknown, field: string): Date => {
  if (typeof value !== 'string') {
    throw new BadRequestException(`${field} must be an ISO-8601 timestamp`);
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`${field} must be an ISO-8601 timestamp`);
  }
  return d;
};

interface ParticipantInput {
  userId?: string;
  name?: string;
  isMinor?: boolean;
  guardianUserId?: string;
}

const parseParticipants = (body: Record<string, unknown>): ParticipantInput[] | undefined => {
  const value = body['participants'];
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) {
    throw new BadRequestException('participants must be an array');
  }
  return value.map((p) => {
    const row = p as Record<string, unknown>;
    return {
      userId: optionalUuid(row, 'user_id'),
      name: optionalString(row, 'name', 200),
      isMinor: row['is_minor'] === true,
      guardianUserId: optionalUuid(row, 'guardian_user_id'),
    };
  });
};

/**
 * Reservation lifecycle endpoints. Player-facing routes need no permission
 * gate — the service scopes every action by the actor's user id; staff routes
 * are permission-gated here and re-checked in the service.
 */
@Controller('reservations')
export class ReservationsController {
  constructor(
    private readonly booking: BookingService,
    private readonly actorContext: ActorContextService,
  ) {}

  /** Staff: member lookup for on-behalf/walk-in choice in the create form. */
  @Get('players')
  @RequirePermissions('bookings.manage')
  async lookupPlayers(@Query() query: Record<string, string | undefined>) {
    const q = query['filter[q]'] ?? query['q'] ?? '';
    const users = await this.booking.lookupPlayers(q);
    // Client-side sort for the lookup list (bounded at 50 rows server-side).
    const sort = query['sort'] ?? '';
    const desc = sort.startsWith('-');
    const key = sort.replace(/^-/, '');
    if (key === 'display_name' || key === 'email') {
      users.sort((a, b) => {
        const av = (key === 'display_name' ? a.display_name : a.email) ?? '';
        const bv = (key === 'display_name' ? b.display_name : b.email) ?? '';
        return desc ? bv.localeCompare(av) : av.localeCompare(bv);
      });
    }
    return users.map((u) => ({
      type: 'player',
      id: u.id,
      attributes: { display_name: u.display_name, email: u.email, phone: u.phone, note: u.note },
    }));
  }

  /** Staff: update a member's reachable fields (phone + staff note). */
  @Patch('players/:playerId')
  @RequirePermissions('bookings.manage')
  async updatePlayer(
    @Param('playerId', ParseUuidPipe) playerId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const data: { phone?: string; note?: string } = {};
    const phone = optionalString(body, 'phone', 40);
    const note = optionalString(body, 'note', 2000);
    if (phone !== undefined) data.phone = phone;
    if (note !== undefined) data.note = note;
    if (Object.keys(data).length === 0) throw new BadRequestException('no updatable fields');
    await this.booking.updatePlayerContact(playerId, data);
    return { type: 'player', id: playerId, attributes: data };
  }

  /** Staff: upsert a tenant-owned note about a member account. */
  @Put('players/:playerId/notes')
  @RequirePermissions('bookings.manage')
  async setPlayerNote(
    @Param('playerId', ParseUuidPipe) playerId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const note = optionalString(body, 'note', 2000) ?? '';
    await this.booking.updatePlayerNote(playerId, note);
    return { type: 'customer-note', id: playerId, attributes: { note } };
  }

  @Get()
  async list(@Query() query: Record<string, string | undefined>) {
    const filters: {
      date?: Date;
      statuses?: string[];
      where?: Record<string, unknown>;
      orderBy?: Record<string, 'asc' | 'desc'>;
      q?: string;
    } = {};
    const date = query['filter[date]'];
    if (date) {
      const d = new Date(`${date}T00:00:00Z`);
      if (Number.isNaN(d.getTime())) throw new BadRequestException('filter[date] must be YYYY-MM-DD');
      filters.date = d;
    }
    const status = query['filter[status]'];
    if (status) {
      filters.statuses = status.split(',').map((s) => s.trim()).filter(Boolean);
    }
    const list = parseListQuery(query, {
      dateField: 'startsAt',
      sortable: {
        starts_at: 'startsAt',
        status: 'status',
        party_size: 'partySize',
        created_at: 'createdAt',
        reference_no: 'referenceNo',
      },
      search: ['referenceNo', 'notes'],
    });
    filters.where = list.where;
    filters.orderBy = list.orderBy;
    filters.q = list.q;
    return (await this.booking.listReservations(filters)).map(serializeReservation);
  }

  @Post()
  async create(@Body() body: Record<string, unknown>) {
    const actor = this.actorContext.actor;
    const startsAt = parseInstant(body['starts_at'], 'starts_at');
    const endsAt = parseInstant(body['ends_at'], 'ends_at');
    const resourceId = body['resource_id'];
    if (typeof resourceId !== 'string' || resourceId.length === 0) {
      throw new BadRequestException('resource_id is required');
    }
    const staff = Boolean(actor.tenantId);
    const reservation = await this.booking.createHold({
      resourceId,
      activityId: optionalUuid(body, 'activity_id'),
      startsAt,
      endsAt,
      partySize: optionalInt(body, 'party_size', 1) ?? 1,
      notes: optionalString(body, 'notes', 1000),
      // Tenant staff create on behalf of a player when player_id is supplied;
      // players always book for themselves.
      playerId: staff ? optionalUuid(body, 'player_id') : actor.userId,
      guestName: staff ? optionalString(body, 'guest_name', 200) : undefined,
      guestContact: staff ? optionalString(body, 'guest_contact', 200) : undefined,
      idempotencyKey: optionalString(body, 'idempotency_key', 200),
      participants: parseParticipants(body),
    });
    return serializeReservation(reservation);
  }

  @Get(':id')
  async get(@Param('id', ParseSqidPipe(RESERVATION_SQID_SCOPE)) id: bigint) {
    return serializeReservation(await this.booking.getReservation(id));
  }

  @Post(':id/confirm')
  async confirm(@Param('id', ParseSqidPipe(RESERVATION_SQID_SCOPE)) id: bigint) {
    return serializeReservation(await this.booking.confirm(id));
  }

  @Post(':id/cancel')
  async cancel(@Param('id', ParseSqidPipe(RESERVATION_SQID_SCOPE)) id: bigint) {
    return serializeReservation(await this.booking.cancel(id));
  }

  @Post(':id/approve')
  @RequirePermissions('bookings.manage')
  async approve(@Param('id', ParseSqidPipe(RESERVATION_SQID_SCOPE)) id: bigint) {
    return serializeReservation(await this.booking.approve(id));
  }

  @Post(':id/decline')
  @RequirePermissions('bookings.manage')
  async decline(
    @Param('id', ParseSqidPipe(RESERVATION_SQID_SCOPE)) id: bigint,
    @Body() body: Record<string, unknown>,
  ) {
    return serializeReservation(
      await this.booking.decline(id, optionalString(body, 'reason', 500)),
    );
  }

  @Post(':id/no-show')
  @RequirePermissions('checkin.perform')
  async noShow(@Param('id', ParseSqidPipe(RESERVATION_SQID_SCOPE)) id: bigint) {
    return serializeReservation(await this.booking.markNoShow(id));
  }
}

