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

function normalizeRecurrence(rec: unknown): Record<string, unknown> | null {
  const r = rec as Record<string, unknown> | null | undefined;
  if (!r) return null;
  const rule = String(r['rule'] ?? '');
  if (!rule) return null;
  const byday = String(r['byday'] ?? '').replace(/[^A-Z,]/g, '');
  const full = byday && rule.includes('FREQ=WEEKLY') && !rule.includes('BYDAY=')
    ? `${rule};BYDAY=${byday}`
    : rule;
  return { rule: full };
}

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
    @Query() query: Record<string, string | undefined> = {},
  ) {
    for (const [name, value] of Object.entries({ venue_id: venueId, resource_id: resourceId })) {
      if (value !== undefined && !isUuid(value)) {
        throw new BadRequestException(`${name} must be a UUID`);
      }
    }
    const kinds = kind !== undefined ? kind.split(',') : undefined;
    if (kinds !== undefined && !kinds.every((k) => CLOSURE_KINDS.includes(k as (typeof CLOSURE_KINDS)[number]))) {
      throw new BadRequestException(`kind must be one of: ${CLOSURE_KINDS.join(', ')} (comma-separated allowed)`);
    }
    const list = parseListQuery(query, {
      dateField: 'startsAt',
      sortable: { kind: 'kind', status: 'status', starts_at: 'startsAt', ends_at: 'endsAt', created_at: 'createdAt' },
      search: ['reason'],
    });
    return (await this.catalog.listClosures({ venueId, resourceId, kind: kinds, ...list })).map(serializeClosure);
  }

  @Post()
  @RequirePermissions(WRITE)
  async create(@Body() body: Record<string, unknown>) {
    const tenantId = resolveTenantId(this.actorContext.actor, body);
    const { startsAt, endsAt } = requireTimeRange(body);
    // Explicit `venue_id: null` = tenant-wide (applies to every venue).
    const venueId = 'venue_id' in body ? (optionalUuid(body, 'venue_id') ?? null) : undefined;
    const resourceId = optionalUuid(body, 'resource_id');
    if (venueId === undefined && !resourceId) {
      throw new BadRequestException('venue_id, resource_id, or venue_id: null (tenant-wide) is required');
    }
    const row = await this.catalog.createClosure({
      tenantId,
      venueId,
      resourceId,
      kind: optionalEnum(body, 'kind', CLOSURE_KINDS),
      startsAt,
      endsAt,
      recurrence: normalizeRecurrence(optionalJson(body, 'recurrence')),
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
      recurrence: normalizeRecurrence(optionalJson(body, 'recurrence')),
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
