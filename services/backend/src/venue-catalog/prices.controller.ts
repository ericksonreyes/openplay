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
import { isUuid } from '../common/ids/uuid';
import { VenueCatalogService } from './venue-catalog.service';
import { parseListQuery } from '../common/list-query';
import { serializePrice } from './serializers';
import {
  PRICE_UNITS,
  optionalBoolean,
  optionalEnum,
  optionalInt,
  optionalJson,
  optionalString,
  optionalUuid,
  requireString,
  resolveTenantId,
} from './validation';
import { ActorContextService } from '../common/auth/actor-context.service';

const READ = 'bookings.view';
const WRITE = 'venue.config.manage';

@Controller('prices')
export class PricesController {
  constructor(
    private readonly catalog: VenueCatalogService,
    private readonly actorContext: ActorContextService,
  ) {}

  @Get()
  @RequirePermissions(READ)
  async list(@Query('venue_id') venueId?: string, @Query('resource_id') resourceId?: string, @Query() query: Record<string, string | undefined> = {}) {
    for (const [name, value] of Object.entries({ venue_id: venueId, resource_id: resourceId })) {
      if (value !== undefined && !isUuid(value)) {
        throw new BadRequestException(`${name} must be a UUID`);
      }
    }
    const list = parseListQuery(query, {
      dateField: 'createdAt',
      sortable: { name: 'name', amount_cents: 'amountCents', created_at: 'createdAt' },
      search: ['name'],
    });
    return (await this.catalog.listPrices({ venueId, resourceId, ...list })).map(serializePrice);
  }

  @Post()
  @RequirePermissions(WRITE)
  async create(@Body() body: Record<string, unknown>) {
    const tenantId = resolveTenantId(this.actorContext.actor, body);
    const amountCents = optionalInt(body, 'amount_cents', 0);
    if (amountCents === undefined) {
      throw new BadRequestException('amount_cents is required');
    }
    const row = await this.catalog.createPrice({
      tenantId,
      venueId: optionalUuid(body, 'venue_id'),
      resourceId: optionalUuid(body, 'resource_id'),
      activityId: optionalUuid(body, 'activity_id'),
      label: requireString(body, 'label'),
      amountCents,
      currency: optionalString(body, 'currency', 3),
      unit: optionalEnum(body, 'unit', PRICE_UNITS),
      active: optionalBoolean(body, 'active'),
      details: optionalJson(body, 'details'),
    });
    return serializePrice(row);
  }

  @Get(':id')
  @RequirePermissions(READ)
  async get(@Param('id', ParseUuidPipe) id: string) {
    return serializePrice(await this.catalog.getPrice(id));
  }

  @Patch(':id')
  @RequirePermissions(WRITE)
  async update(@Param('id', ParseUuidPipe) id: string, @Body() body: Record<string, unknown>) {
    if (body['tenant_id'] !== undefined) {
      throw new BadRequestException('tenant_id cannot be changed');
    }
    const row = await this.catalog.updatePrice(id, {
      venueId: optionalUuid(body, 'venue_id'),
      resourceId: optionalUuid(body, 'resource_id'),
      activityId: optionalUuid(body, 'activity_id'),
      label: body['label'] !== undefined ? requireString(body, 'label') : undefined,
      amountCents: optionalInt(body, 'amount_cents', 0),
      currency: optionalString(body, 'currency', 3),
      unit: optionalEnum(body, 'unit', PRICE_UNITS),
      active: optionalBoolean(body, 'active'),
      details: optionalJson(body, 'details'),
    });
    return serializePrice(row);
  }

  @Delete(':id')
  @RequirePermissions(WRITE)
  async remove(@Param('id', ParseUuidPipe) id: string) {
    await this.catalog.deletePrice(id);
    return { type: 'price', id, attributes: { deleted: true } };
  }
}
