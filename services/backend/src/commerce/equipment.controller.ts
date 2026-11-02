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
import { ActorContextService } from '../common/auth/actor-context.service';
import { RequirePermissions } from '../common/auth/require-permissions.decorator';
import { ParseUuidPipe } from '../common/ids/parse-id.pipes';
import { resolveTenantId } from '../venue-catalog/validation';
import { parseListQuery } from '../common/list-query';
import { serializeEquipmentItem } from './serializers';
import { RentalsService } from './rentals.service';
import {
  EQUIPMENT_STATUSES,
  optionalEnum,
  optionalInt,
  optionalJson,
  optionalString,
  optionalUuid,
  requireString,
} from './validation';

const READ = 'bookings.view';
const WRITE = 'rentals.manage';

@Controller('equipment')
export class EquipmentController {
  constructor(
    private readonly rentals: RentalsService,
    private readonly actorContext: ActorContextService,
  ) {}

  @Get()
  @RequirePermissions(READ)
  async list(@Query() query: Record<string, string | undefined>) {
    const list = parseListQuery(query, {
      dateField: 'createdAt',
      sortable: {
        name: 'name',
        status: 'status',
        total_stock: 'totalStock',
        price_cents: 'priceCents',
        created_at: 'createdAt',
      },
      search: ['name', 'description'],
    });
    return (await this.rentals.listItems(list)).map(serializeEquipmentItem);
  }

  @Post()
  @RequirePermissions(WRITE)
  async create(@Body() body: Record<string, unknown>) {
    const tenantId = resolveTenantId(this.actorContext.actor, body);
    const item = await this.rentals.createItem({
      tenantId,
      venueId: optionalUuid(body, 'venue_id') ?? null,
      activityId: optionalUuid(body, 'activity_id') ?? null,
      name: requireString(body, 'name'),
      description: optionalString(body, 'description'),
      totalStock: optionalInt(body, 'total_stock', 0) ?? 0,
      priceCents: optionalInt(body, 'price_cents', 0),
      currency: optionalString(body, 'currency', 3) ?? 'PHP',
      unit: optionalString(body, 'unit', 20) ?? 'booking',
      status: optionalEnum(body, 'status', EQUIPMENT_STATUSES),
      details: optionalJson(body, 'details'),
    });
    return serializeEquipmentItem(item);
  }

  @Get(':id')
  @RequirePermissions(READ)
  async get(@Param('id', ParseUuidPipe) id: string) {
    return serializeEquipmentItem(await this.rentals.getItem(id));
  }

  @Patch(':id')
  @RequirePermissions(WRITE)
  async update(@Param('id', ParseUuidPipe) id: string, @Body() body: Record<string, unknown>) {
    if (body['tenant_id'] !== undefined) {
      throw new BadRequestException('tenant_id cannot be changed');
    }
    const item = await this.rentals.updateItem(id, {
      venueId: optionalUuid(body, 'venue_id'),
      activityId: optionalUuid(body, 'activity_id'),
      name: body['name'] !== undefined ? requireString(body, 'name') : undefined,
      description: optionalString(body, 'description'),
      totalStock: optionalInt(body, 'total_stock', 0),
      priceCents: optionalInt(body, 'price_cents', 0),
      currency: optionalString(body, 'currency', 3),
      unit: optionalString(body, 'unit', 20),
      status: optionalEnum(body, 'status', EQUIPMENT_STATUSES),
      details: optionalJson(body, 'details'),
    });
    return serializeEquipmentItem(item);
  }

  @Delete(':id')
  @RequirePermissions(WRITE)
  async remove(@Param('id', ParseUuidPipe) id: string) {
    await this.rentals.deleteItem(id);
    return { type: 'equipment-item', id, attributes: { deleted: true } };
  }
}
