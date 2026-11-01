import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ParseUuidPipe } from '../common/ids/parse-id.pipes';
import { RequirePermissions } from '../common/auth/require-permissions.decorator';
import { VenueCatalogService } from './venue-catalog.service';
import { serializeActivity } from './serializers';
import {
  RECORD_STATUSES,
  optionalEnum,
  optionalJson,
  optionalString,
  optionalUuidList,
  requireString,
  resolveTenantId,
} from './validation';
import { ActorContextService } from '../common/auth/actor-context.service';

const READ = 'bookings.view';
const WRITE = 'venue.config.manage';

@Controller('activities')
export class ActivitiesController {
  constructor(
    private readonly catalog: VenueCatalogService,
    private readonly actorContext: ActorContextService,
  ) {}

  @Get()
  @RequirePermissions(READ)
  async list() {
    const rows = await this.catalog.listActivities();
    return Promise.all(
      rows.map(async (a) =>
        serializeActivity(a, (await this.catalog.activityResourceIds(a.id)).map((l) => l.resourceId)),
      ),
    );
  }

  @Post()
  @RequirePermissions(WRITE)
  async create(@Body() body: Record<string, unknown>) {
    const tenantId = resolveTenantId(this.actorContext.actor, body);
    const row = await this.catalog.createActivity({
      tenantId,
      name: requireString(body, 'name'),
      code: requireString(body, 'code', 100),
      status: optionalEnum(body, 'status', RECORD_STATUSES),
      description: optionalString(body, 'description'),
      details: optionalJson(body, 'details'),
    });
    return serializeActivity(row);
  }

  @Get(':id')
  @RequirePermissions(READ)
  async get(@Param('id', ParseUuidPipe) id: string) {
    const row = await this.catalog.getActivity(id);
    const links = await this.catalog.activityResourceIds(id);
    return serializeActivity(row, links.map((l) => l.resourceId));
  }

  @Patch(':id')
  @RequirePermissions(WRITE)
  async update(@Param('id', ParseUuidPipe) id: string, @Body() body: Record<string, unknown>) {
    if (body['tenant_id'] !== undefined) {
      throw new BadRequestException('tenant_id cannot be changed');
    }
    const row = await this.catalog.updateActivity(id, {
      name: body['name'] !== undefined ? requireString(body, 'name') : undefined,
      code: body['code'] !== undefined ? requireString(body, 'code', 100) : undefined,
      status: optionalEnum(body, 'status', RECORD_STATUSES),
      description: optionalString(body, 'description'),
      details: optionalJson(body, 'details'),
    });
    const links = await this.catalog.activityResourceIds(id);
    return serializeActivity(row, links.map((l) => l.resourceId));
  }

  /** Replace the set of resources that host this activity. */
  @Put(':id/resources')
  @RequirePermissions(WRITE)
  async setResources(@Param('id', ParseUuidPipe) id: string, @Body() body: Record<string, unknown>) {
    const resourceIds = optionalUuidList(body, 'resource_ids') ?? [];
    const applied = await this.catalog.setActivityResources(id, resourceIds);
    const row = await this.catalog.getActivity(id);
    return serializeActivity(row, applied);
  }

  @Delete(':id')
  @RequirePermissions(WRITE)
  async remove(@Param('id', ParseUuidPipe) id: string) {
    await this.catalog.deleteActivity(id);
    return { type: 'activity', id, attributes: { deleted: true } };
  }
}
