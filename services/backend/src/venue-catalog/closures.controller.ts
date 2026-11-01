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
import { serializeClosure } from './serializers';
import {
  CLOSURE_KINDS,
  CLOSURE_STATUSES,
  optionalEnum,
  optionalJson,
  optionalString,
  optionalUuid,
  requireTimeRange,
  resolveTenantId,
} from './validation';
import { ActorContextService } from '../common/auth/actor-context.service';

const READ = 'bookings.view';
const WRITE = 'venue.config.manage';

@Controller('closures')
export class ClosuresController {
  constructor(
    private readonly catalog: VenueCatalogService,
    private readonly actorContext: ActorContextService,
  ) {}

  @Get()
  @RequirePermissions(READ)
  async list(
    @Query('venue_id') venueId?: string,
    @Query('resource_id') resourceId?: string,
    @Query('kind') kind?: string,
  ) {
    for (const [name, value] of Object.entries({ venue_id: venueId, resource_id: resourceId })) {
      if (value !== undefined && !isUuid(value)) {
        throw new BadRequestException(`${name} must be a UUID`);
      }
    }
    if (kind !== undefined && !CLOSURE_KINDS.includes(kind as (typeof CLOSURE_KINDS)[number])) {
      throw new BadRequestException(`kind must be one of: ${CLOSURE_KINDS.join(', ')}`);
    }
    return (await this.catalog.listClosures({ venueId, resourceId, kind })).map(serializeClosure);
  }

  @Post()
  @RequirePermissions(WRITE)
  async create(@Body() body: Record<string, unknown>) {
    const tenantId = resolveTenantId(this.actorContext.actor, body);
    const { startsAt, endsAt } = requireTimeRange(body);
    const venueId = optionalUuid(body, 'venue_id');
    const resourceId = optionalUuid(body, 'resource_id');
    if (!venueId && !resourceId) {
      throw new BadRequestException('venue_id or resource_id is required');
    }
    const row = await this.catalog.createClosure({
      tenantId,
      venueId,
      resourceId,
      kind: optionalEnum(body, 'kind', CLOSURE_KINDS),
      startsAt,
      endsAt,
      recurrence: optionalJson(body, 'recurrence'),
      reason: optionalString(body, 'reason', 1000),
      status: optionalEnum(body, 'status', CLOSURE_STATUSES),
    });
    return serializeClosure(row);
  }

  @Get(':id')
  @RequirePermissions(READ)
  async get(@Param('id', ParseUuidPipe) id: string) {
    return serializeClosure(await this.catalog.getClosure(id));
  }

  @Patch(':id')
  @RequirePermissions(WRITE)
  async update(@Param('id', ParseUuidPipe) id: string, @Body() body: Record<string, unknown>) {
    if (body['tenant_id'] !== undefined) {
      throw new BadRequestException('tenant_id cannot be changed');
    }
    const patch: Record<string, unknown> = {
      venueId: optionalUuid(body, 'venue_id'),
      resourceId: optionalUuid(body, 'resource_id'),
      kind: optionalEnum(body, 'kind', CLOSURE_KINDS),
      recurrence: optionalJson(body, 'recurrence'),
      reason: optionalString(body, 'reason', 1000),
      status: optionalEnum(body, 'status', CLOSURE_STATUSES),
    };
    if (body['starts_at'] !== undefined || body['ends_at'] !== undefined) {
      const { startsAt, endsAt } = requireTimeRange(body);
      patch['startsAt'] = startsAt;
      patch['endsAt'] = endsAt;
    }
    return serializeClosure(await this.catalog.updateClosure(id, patch));
  }

  @Delete(':id')
  @RequirePermissions(WRITE)
  async remove(@Param('id', ParseUuidPipe) id: string) {
    await this.catalog.deleteClosure(id);
    return { type: 'closure', id, attributes: { deleted: true } };
  }
}
