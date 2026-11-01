import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { ParseUuidPipe } from '../common/ids/parse-id.pipes';
import { BookingService } from './booking.service';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Player/staff availability grid: GET /venues/:id/availability?date=YYYY-MM-DD */
@Controller('venues')
export class AvailabilityController {
  constructor(private readonly booking: BookingService) {}

  @Get(':id/availability')
  async grid(@Param('id', ParseUuidPipe) venueId: string, @Query('date') date?: string) {
    if (!date || !DATE_RE.test(date)) {
      throw new BadRequestException('date query parameter (YYYY-MM-DD) is required');
    }
    const resources = await this.booking.availability(venueId, date);
    return {
      type: 'availability',
      id: `${venueId}:${date}`,
      attributes: { venue_id: venueId, date, resources },
    };
  }
}
