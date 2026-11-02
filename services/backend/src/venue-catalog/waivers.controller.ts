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
import { parseListQuery } from '../common/list-query';
import { VenueCatalogService } from './venue-catalog.service';
import { serializeWaiverDocument, serializeWaiverVersion } from './serializers';
import {
  WAIVER_DOC_STATUSES,
  optionalBoolean,
  optionalEnum,
  optionalUuid,
  requireString,
  resolveTenantId,
} from './validation';
import { ActorContextService } from '../common/auth/actor-context.service';

const READ = 'bookings.view';
const WRITE = 'venue.config.manage';

@Controller('waiver-documents')
export class WaiversController {
  constructor(
    private readonly catalog: VenueCatalogService,
    private readonly actorContext: ActorContextService,
  ) {}

  @Get()
  @RequirePermissions(READ)
  async list(@Query('venue_id') venueId?: string, @Query() query: Record<string, string | undefined> = {}) {
    if (venueId !== undefined && !isUuid(venueId)) {
      throw new BadRequestException('venue_id must be a UUID');
    }
    const list = parseListQuery(query, {
      dateField: 'createdAt',
      sortable: { title: 'title', status: 'status', created_at: 'createdAt' },
      search: ['title'],
    });
    return (await this.catalog.listWaiverDocuments({ venueId, ...list })).map(serializeWaiverDocument);
  }

  /** Creates the document and (when `body` is present) version 1 in one call. */
  @Post()
  @RequirePermissions(WRITE)
  async create(@Body() body: Record<string, unknown>) {
    const tenantId = resolveTenantId(this.actorContext.actor, body);
    const doc = await this.catalog.createWaiverDocument({
      tenantId,
      venueId: optionalUuid(body, 'venue_id'),
      resourceId: optionalUuid(body, 'resource_id'),
      activityId: optionalUuid(body, 'activity_id'),
      title: requireString(body, 'title'),
      status: optionalEnum(body, 'status', WAIVER_DOC_STATUSES),
      reacknowledgeOnUpdate: optionalBoolean(body, 'reacknowledge_on_update'),
    });
    if (body['body'] !== undefined) {
      await this.catalog.createWaiverVersion(doc.id, requireString(body, 'body', 100000));
    }
    return serializeWaiverDocument(await this.catalog.getWaiverDocument(doc.id));
  }

  @Get(':id')
  @RequirePermissions(READ)
  async get(@Param('id', ParseUuidPipe) id: string) {
    return serializeWaiverDocument(await this.catalog.getWaiverDocument(id));
  }

  @Patch(':id')
  @RequirePermissions(WRITE)
  async update(@Param('id', ParseUuidPipe) id: string, @Body() body: Record<string, unknown>) {
    if (body['tenant_id'] !== undefined || body['current_version'] !== undefined) {
      throw new BadRequestException('tenant_id and current_version cannot be changed');
    }
    const doc = await this.catalog.updateWaiverDocument(id, {
      venueId: optionalUuid(body, 'venue_id'),
      resourceId: optionalUuid(body, 'resource_id'),
      activityId: optionalUuid(body, 'activity_id'),
      title: body['title'] !== undefined ? requireString(body, 'title') : undefined,
      status: optionalEnum(body, 'status', WAIVER_DOC_STATUSES),
      reacknowledgeOnUpdate: optionalBoolean(body, 'reacknowledge_on_update'),
    });
    return serializeWaiverDocument(doc);
  }

  @Delete(':id')
  @RequirePermissions(WRITE)
  async remove(@Param('id', ParseUuidPipe) id: string) {
    await this.catalog.deleteWaiverDocument(id);
    return { type: 'waiver-document', id, attributes: { deleted: true } };
  }

  @Get(':id/versions')
  @RequirePermissions(READ)
  async versions(@Param('id', ParseUuidPipe) id: string) {
    return (await this.catalog.listWaiverVersions(id)).map(serializeWaiverVersion);
  }

  /** A text change creates a new immutable version; earlier versions are retained. */
  @Post(':id/versions')
  @RequirePermissions(WRITE)
  async createVersion(@Param('id', ParseUuidPipe) id: string, @Body() body: Record<string, unknown>) {
    const version = await this.catalog.createWaiverVersion(
      id,
      requireString(body, 'body', 100000),
    );
    return serializeWaiverVersion(version);
  }

  @Post(':id/versions/:versionId/publish')
  @RequirePermissions(WRITE)
  async publishVersion(
    @Param('id', ParseUuidPipe) id: string,
    @Param('versionId', ParseUuidPipe) versionId: string,
  ) {
    return serializeWaiverVersion(
      await this.catalog.setWaiverVersionStatus(id, versionId, 'published'),
    );
  }

  @Post(':id/versions/:versionId/retire')
  @RequirePermissions(WRITE)
  async retireVersion(
    @Param('id', ParseUuidPipe) id: string,
    @Param('versionId', ParseUuidPipe) versionId: string,
  ) {
    return serializeWaiverVersion(
      await this.catalog.setWaiverVersionStatus(id, versionId, 'retired'),
    );
  }
}
