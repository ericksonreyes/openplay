import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Public } from '../common/auth/public.decorator';
import { ParseUuidPipe } from '../common/ids/parse-id.pipes';
import { optionalInt, optionalString, optionalUuid, requireString } from '../venue-catalog/validation';
import { GuestBookingService } from './guest-booking.service';
import { serializeGuestContact, serializeReservation } from './serializers';

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

/**
 * Account-free guest booking (public). The opaque access token is returned
 * once at creation; verify accepts it or the one-time code. No endpoint here
 * exposes a booking by contact detail alone.
 */
@Controller('guest-bookings')
export class GuestBookingsController {
  constructor(private readonly guests: GuestBookingService) {}

  @Public()
  @Post()
  async create(@Body() body: Record<string, unknown>) {
    const result = await this.guests.createGuestBooking({
      name: requireString(body, 'name', 200),
      email: optionalString(body, 'email', 320),
      phone: optionalString(body, 'phone', 50),
      resourceId: requireString(body, 'resource_id', 64),
      activityId: optionalUuid(body, 'activity_id'),
      startsAt: parseInstant(body['starts_at'], 'starts_at'),
      endsAt: parseInstant(body['ends_at'], 'ends_at'),
      partySize: optionalInt(body, 'party_size', 1) ?? 1,
      notes: optionalString(body, 'notes', 1000),
      idempotencyKey: optionalString(body, 'idempotency_key', 200),
    });
    return {
      type: 'guest-booking',
      id: result.contact.id,
      attributes: {
        reservation: serializeReservation(result.reservation).attributes,
        // Secure-link credentials, returned once. A production build would
        // deliver the code over the contact channel instead.
        access_token: result.accessToken,
        verification_code: result.verificationCode,
        token_expires_at: result.contact.tokenExpiresAt,
      },
    };
  }

  @Public()
  @Post(':id/verify')
  async verify(
    @Param('id', ParseUuidPipe) id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const { contact, reservations } = await this.guests.verify(id, {
      accessToken: optionalString(body, 'access_token', 200),
      code: optionalString(body, 'code', 20),
    });
    return {
      type: 'guest-booking',
      id: contact.id,
      attributes: {
        contact: serializeGuestContact(contact).attributes,
        reservations: reservations.map(serializeReservation),
      },
    };
  }

  /** Post-verification bookings view; requires the opaque access token. */
  @Public()
  @Get(':id')
  async get(@Param('id', ParseUuidPipe) id: string, @Query('access_token') token?: string) {
    if (!token) throw new BadRequestException('access_token is required');
    const { contact } = await this.guests.verify(id, { accessToken: token });
    const reservations = await this.guests.reservationsFor(id);
    return {
      type: 'guest-booking',
      id: contact.id,
      attributes: {
        contact: serializeGuestContact(contact).attributes,
        reservations: reservations.map(serializeReservation),
      },
    };
  }
}
