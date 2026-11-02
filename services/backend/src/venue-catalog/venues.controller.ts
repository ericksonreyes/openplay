import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ParseUuidPipe } from '../common/ids/parse-id.pipes';
import { RequirePermissions } from '../common/auth/require-permissions.decorator';
import { VenueCatalogService } from './venue-catalog.service';
import { parseListQuery } from '../common/list-query';
import { serializeVenue } from './serializers';
import {
  VENUE_STATUSES,
  optionalEnum,
  optionalJson,
  optionalString,
  requireString,
  resolveTenantId,
} from './validation';
import { ActorContextService } from '../common/auth/actor-context.service';

const READ = 'bookings.view';
const WRITE = 'venue.config.manage';

@Controller('venues')
export class VenuesController {
  constructor(
    private readonly catalog: VenueCatalogService,
    private readonly actorContext: ActorContextService,
  ) {}

  @Get()
  @RequirePermissions(READ)
  async list(@Query() query: Record<string, string | undefined>) {
    const list = parseListQuery(query, {
      dateField: 'createdAt',
      sortable: { name: 'name', status: 'status', timezone: 'timezone', created_at: 'createdAt' },
      search: ['name'],
    });
    return (await this.catalog.listVenues(list)).map(serializeVenue);
  }

  @Post()
  @RequirePermissions(WRITE)
  async create(@Body() body: Record<string, unknown>) {
    const tenantId = resolveTenantId(this.actorContext.actor, body);
    const venue = await this.catalog.createVenue({
      tenantId,
      name: requireString(body, 'name'),
      timezone: optionalString(body, 'timezone', 100),
      status: optionalEnum(body, 'status', VENUE_STATUSES),
      address: optionalJson(body, 'address'),
      details: optionalJson(body, 'details'),
    });
    return serializeVenue(venue);
  }

  @Get(':id')
  @RequirePermissions(READ)
  async get(@Param('id', ParseUuidPipe) id: string) {
    return serializeVenue(await this.catalog.getVenue(id));
  }

  @Patch(':id')
  @RequirePermissions(WRITE)
  async update(@Param('id', ParseUuidPipe) id: string, @Body() body: Record<string, unknown>) {
    if (body['tenant_id'] !== undefined) {
      throw new BadRequestException('tenant_id cannot be changed');
    }
    const venue = await this.catalog.updateVenue(id, {
      name: body['name'] !== undefined ? requireString(body, 'name') : undefined,
      timezone: optionalString(body, 'timezone', 100),
      status: optionalEnum(body, 'status', VENUE_STATUSES),
      address: optionalJson(body, 'address'),
      details: optionalJson(body, 'details'),
    });
    return serializeVenue(venue);
  }

  @Delete(':id')
  @RequirePermissions(WRITE)
  async remove(@Param('id', ParseUuidPipe) id: string) {
    await this.catalog.deleteVenue(id);
    return { type: 'venue', id, attributes: { deleted: true } };
  }
}
