import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { RequirePermissions } from '../common/auth/require-permissions.decorator';
import { isUuid } from '../common/ids/uuid';
import { BookingService } from './booking.service';
import { serializeReservation } from './serializers';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Venue-portal schedule feed: GET /schedule?date=&venue_id= */
@Controller('schedule')
export class ScheduleController {
  constructor(private readonly booking: BookingService) {}

  @Get()
  @RequirePermissions('bookings.view')
  async feed(@Query('date') date?: string, @Query('venue_id') venueId?: string) {
    if (!date || !DATE_RE.test(date)) {
      throw new BadRequestException('date query parameter (YYYY-MM-DD) is required');
    }
    if (venueId !== undefined && !isUuid(venueId)) {
      throw new BadRequestException('venue_id must be a UUID');
    }
    const { reservations } = await this.booking.schedule(date, venueId);
    return {
      type: 'schedule',
      id: date,
      attributes: {
        date,
        reservations: reservations.map(serializeReservation),
      },
    };
  }
}
