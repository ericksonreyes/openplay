import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Param,
  Query,
} from '@nestjs/common';
import { Public } from '../common/auth/public.decorator';
import { ParseUuidPipe } from '../common/ids/parse-id.pipes';
import { PublicContentService } from './public-content.service';
import { readFilter } from './filters';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Cache contract (PUBLIC_CONTENT_DELIVERY): stable content is briefly cacheable. */
const CACHEABLE = 'public, max-age=60';

/**
 * Anonymous public-site endpoints — GET /api/v1/public/* per API_CONTRACT.
 * Shares the `public` prefix with src/public (status endpoint); route paths
 * do not overlap. Field allowlisting lives in ./serializers.ts; publication
 * scoping in ./public-content.service.ts.
 */
@Controller('public')
@Public()
export class PublicContentController {
  constructor(private readonly content: PublicContentService) {}

  @Get('businesses')
  @Header('Cache-Control', CACHEABLE)
  async businesses(@Query() query: Record<string, unknown>) {
    return this.content.listBusinesses(readFilter(query, 'name'));
  }

  @Get('businesses/:code')
  @Header('Cache-Control', CACHEABLE)
  async business(@Param('code') code: string) {
    return this.content.getBusiness(code);
  }

  @Get('businesses/:code/venues')
  @Header('Cache-Control', CACHEABLE)
  async businessVenues(@Param('code') code: string) {
    return this.content.listBusinessVenues(code);
  }

  @Get('venues/:id')
  @Header('Cache-Control', CACHEABLE)
  async venue(@Param('id', ParseUuidPipe) id: string) {
    return this.content.getVenue(id);
  }

  /** Live availability is never cached — revalidated at submission time. */
  @Get('venues/:id/availability')
  @Header('Cache-Control', 'no-store')
  async availability(
    @Param('id', ParseUuidPipe) id: string,
    @Query('date') date?: string,
  ) {
    if (!date || !DATE_RE.test(date)) {
      throw new BadRequestException('date query parameter (YYYY-MM-DD) is required');
    }
    const resources = await this.content.venueAvailability(id, date);
    return {
      type: 'availability',
      id: `${id}:${date}`,
      attributes: { venue_id: id, date, resources },
    };
  }

  @Get('events')
  @Header('Cache-Control', CACHEABLE)
  async events(@Query() query: Record<string, unknown>) {
    const date = readFilter(query, 'date');
    if (date !== undefined && !DATE_RE.test(date)) {
      throw new BadRequestException('filter[date] must be YYYY-MM-DD');
    }
    return this.content.listEvents({
      date,
      tenantCode: readFilter(query, 'tenant'),
    });
  }

  @Get('events/:id')
  @Header('Cache-Control', CACHEABLE)
  async event(@Param('id', ParseUuidPipe) id: string) {
    return this.content.getEvent(id);
  }
}
