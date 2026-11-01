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
import { serializeFacilityRule } from './serializers';
import {
  RULE_STATUSES,
  RULE_VISIBILITIES,
  optionalBoolean,
  optionalEnum,
  optionalUuid,
  requireString,
  resolveTenantId,
} from './validation';
import { ActorContextService } from '../common/auth/actor-context.service';

const READ = 'bookings.view';
const WRITE = 'venue.config.manage';

@Controller('facility-rules')
export class FacilityRulesController {
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
    return (await this.catalog.listFacilityRules({ venueId })).map(serializeFacilityRule);
  }

  @Post()
  @RequirePermissions(WRITE)
  async create(@Body() body: Record<string, unknown>) {
    const tenantId = resolveTenantId(this.actorContext.actor, body);
    const row = await this.catalog.createFacilityRule({
      tenantId,
      venueId: optionalUuid(body, 'venue_id'),
      resourceId: optionalUuid(body, 'resource_id'),
      activityId: optionalUuid(body, 'activity_id'),
      title: requireString(body, 'title'),
      body: requireString(body, 'body', 20000),
      visibility: optionalEnum(body, 'visibility', RULE_VISIBILITIES),
      requiresAcknowledgment: optionalBoolean(body, 'requires_acknowledgment'),
      status: optionalEnum(body, 'status', RULE_STATUSES),
    });
    return serializeFacilityRule(row);
  }

  @Get(':id')
  @RequirePermissions(READ)
  async get(@Param('id', ParseUuidPipe) id: string) {
    return serializeFacilityRule(await this.catalog.getFacilityRule(id));
  }

  @Patch(':id')
  @RequirePermissions(WRITE)
  async update(@Param('id', ParseUuidPipe) id: string, @Body() body: Record<string, unknown>) {
    if (body['tenant_id'] !== undefined || body['version'] !== undefined) {
      throw new BadRequestException('tenant_id and version cannot be changed');
    }
    const row = await this.catalog.updateFacilityRule(id, {
      venueId: optionalUuid(body, 'venue_id'),
      resourceId: optionalUuid(body, 'resource_id'),
      activityId: optionalUuid(body, 'activity_id'),
      title: body['title'] !== undefined ? requireString(body, 'title') : undefined,
      body: body['body'] !== undefined ? requireString(body, 'body', 20000) : undefined,
      visibility: optionalEnum(body, 'visibility', RULE_VISIBILITIES),
      requiresAcknowledgment: optionalBoolean(body, 'requires_acknowledgment'),
      status: optionalEnum(body, 'status', RULE_STATUSES),
    });
    return serializeFacilityRule(row);
  }

  @Post(':id/publish')
  @RequirePermissions(WRITE)
  async publish(@Param('id', ParseUuidPipe) id: string) {
    return serializeFacilityRule(await this.catalog.setFacilityRuleStatus(id, 'published'));
  }

  @Post(':id/unpublish')
  @RequirePermissions(WRITE)
  async unpublish(@Param('id', ParseUuidPipe) id: string) {
    return serializeFacilityRule(await this.catalog.setFacilityRuleStatus(id, 'unpublished'));
  }

  @Delete(':id')
  @RequirePermissions(WRITE)
  async remove(@Param('id', ParseUuidPipe) id: string) {
    await this.catalog.deleteFacilityRule(id);
    return { type: 'facility-rule', id, attributes: { deleted: true } };
  }
}
