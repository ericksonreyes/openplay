import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import { SqidCodec } from '../common/ids/sqid';
import { BookingService } from './booking.service';
import { RESERVATION_SQID_SCOPE, serializeCheckIn } from './serializers';
import { optionalString } from '../venue-catalog/validation';
import { RequirePermissions } from '../common/auth/require-permissions.decorator';
import { parseListQuery } from '../common/list-query';

const sqids = new SqidCodec();

/** Front-desk and self check-in. Ownership/permission decided in the service. */
@Controller('check-ins')
export class CheckInsController {
  constructor(private readonly booking: BookingService) {}

  @Get()
  @RequirePermissions('bookings.manage')
  async list(@Query() query: Record<string, string | undefined>) {
    const list = parseListQuery(query, {
      dateField: 'recordedAt',
      sortable: { recorded_at: 'recordedAt', method: 'method' },
    });
    return (await this.booking.listCheckIns(list)).map(serializeCheckIn);
  }

  @Post()
  async create(@Body() body: Record<string, unknown>) {
    const raw = body['reservation_id'];
    let reservationId: bigint | undefined;
    if (typeof raw === 'string' && raw.length > 0) {
      const decoded = sqids.decode(RESERVATION_SQID_SCOPE, raw);
      if (decoded === null) throw new BadRequestException('reservation_id is invalid');
      reservationId = decoded;
    }
    const checkIn = await this.booking.checkIn({
      reservationId,
      method: optionalString(body, 'method', 50) ?? 'manual',
    });
    return serializeCheckIn(checkIn);
  }
}
