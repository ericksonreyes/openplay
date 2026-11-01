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
import { serializeResource } from './serializers';
import {
  RECORD_STATUSES,
  optionalEnum,
  optionalInt,
  optionalJson,
  optionalUuid,
  requireString,
  resolveTenantId,
} from './validation';
import { ActorContextService } from '../common/auth/actor-context.service';

const READ = 'bookings.view';
const WRITE = 'venue.config.manage';

@Controller('resources')
export class ResourcesController {
  constructor(
    private readonly catalog: VenueCatalogService,
    private readonly actorContext: ActorContextService,
  ) {}

  @Get()
  @RequirePermissions(READ)
  async list(@Query('venue_id') venueId?: string) {
    if (venueId !== undefined && !isUuid(venueId)) {
      throw new BadRequestException('venue_id must be a UUID');
    }
    const rows = await this.catalog.listResources({ venueId });
    const links = await this.catalog.activityLinksForResources(rows.map((r) => r.id));
    return rows.map((r) =>
      serializeResource(
        r,
        links.filter((l) => l.resourceId === r.id).map((l) => l.activityId),
      ),
    );
  }

  @Post()
  @RequirePermissions(WRITE)
  async create(@Body() body: Record<string, unknown>) {
    const tenantId = resolveTenantId(this.actorContext.actor, body);
    const venueId = optionalUuid(body, 'venue_id');
    if (!venueId) {
      throw new BadRequestException('venue_id is required');
    }
    const row = await this.catalog.createResource({
      tenantId,
      venueId,
      name: requireString(body, 'name'),
      resourceType: requireString(body, 'resource_type'),
      status: optionalEnum(body, 'status', RECORD_STATUSES),
      capacity: optionalInt(body, 'capacity'),
      settings: optionalJson(body, 'settings'),
      details: optionalJson(body, 'details'),
    });
    return serializeResource(row);
  }

  @Get(':id')
  @RequirePermissions(READ)
  async get(@Param('id', ParseUuidPipe) id: string) {
    const row = await this.catalog.getResource(id);
    const links = await this.catalog.activityLinksForResources([id]);
    return serializeResource(row, links.map((l) => l.activityId));
  }

  @Patch(':id')
  @RequirePermissions(WRITE)
  async update(@Param('id', ParseUuidPipe) id: string, @Body() body: Record<string, unknown>) {
    if (body['tenant_id'] !== undefined || body['venue_id'] !== undefined) {
      throw new BadRequestException('tenant_id and venue_id cannot be changed');
    }
    const row = await this.catalog.updateResource(id, {
      name: body['name'] !== undefined ? requireString(body, 'name') : undefined,
      resourceType: body['resource_type'] !== undefined ? requireString(body, 'resource_type') : undefined,
      status: optionalEnum(body, 'status', RECORD_STATUSES),
      capacity: optionalInt(body, 'capacity'),
      settings: optionalJson(body, 'settings'),
      details: optionalJson(body, 'details'),
    });
    const links = await this.catalog.activityLinksForResources([id]);
    return serializeResource(row, links.map((l) => l.activityId));
  }

  @Delete(':id')
  @RequirePermissions(WRITE)
  async remove(@Param('id', ParseUuidPipe) id: string) {
    await this.catalog.deleteResource(id);
    return { type: 'resource', id, attributes: { deleted: true } };
  }
}
