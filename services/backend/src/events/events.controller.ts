import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ParseUuidPipe } from '../common/ids/parse-id.pipes';
import { RequirePermissions } from '../common/auth/require-permissions.decorator';
import { ActorContextService } from '../common/auth/actor-context.service';
import {
  optionalBoolean,
  optionalEnum,
  optionalInt,
  optionalJson,
  optionalString,
  optionalUuid,
  optionalUuidList,
  requireString,
} from '../venue-catalog/validation';
import { SqidCodec } from '../common/ids/sqid';
import { EventsService } from './events.service';
import {
  serializeEvent,
  serializeEventResult,
  serializeRegistration,
} from './serializers';

const MANAGE = 'events.manage';

const EVENT_STATUSES = ['draft', 'published', 'registration_open', 'registration_closed', 'complete', 'cancelled'] as const;
const CAPACITY_UNITS = ['participant', 'seat', 'team'] as const;
const PAYMENT_TIMINGS = ['free', 'full', 'deposit', 'later', 'at_venue'] as const;
const FEE_BASES = ['participant', 'seat', 'team', 'event', 'free'] as const;
const REG_KINDS = ['individual', 'group', 'team'] as const;
const VISIBILITIES = ['public', 'internal'] as const;

const parseInstant = (value: unknown, field: string, required = false): Date | undefined => {
  if (value === undefined || value === null) {
    if (required) throw new BadRequestException(`${field} is required`);
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new BadRequestException(`${field} must be an ISO-8601 timestamp`);
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`${field} must be an ISO-8601 timestamp`);
  }
  return d;
};

const eventFields = (body: Record<string, unknown>, partial: boolean) => {
  const fields: Record<string, unknown> = {};
  const put = (key: string, value: unknown) => {
    if (value !== undefined) fields[key] = value;
  };
  if (!partial || body['venue_id'] !== undefined) {
    const venueId = optionalUuid(body, 'venue_id');
    if (!partial && !venueId) throw new BadRequestException('venue_id is required');
    put('venueId', venueId);
  }
  put('name', partial ? optionalString(body, 'name', 200) : requireString(body, 'name', 200));
  put('description', optionalString(body, 'description', 4000));
  put('activityId', optionalUuid(body, 'activity_id'));
  put('format', optionalString(body, 'format', 100));
  put('visibility', optionalEnum(body, 'visibility', VISIBILITIES));
  put('status', optionalEnum(body, 'status', EVENT_STATUSES));
  const startsAt = parseInstant(body['starts_at'], 'starts_at', !partial);
  const endsAt = parseInstant(body['ends_at'], 'ends_at', !partial);
  put('startsAt', startsAt);
  put('endsAt', endsAt);
  if (startsAt && endsAt && endsAt <= startsAt) {
    throw new BadRequestException('ends_at must be after starts_at');
  }
  put('bufferMinutes', optionalInt(body, 'buffer_minutes', 0));
  put('capacity', optionalInt(body, 'capacity', 1));
  put('capacityUnit', optionalEnum(body, 'capacity_unit', CAPACITY_UNITS));
  put('feeCents', optionalInt(body, 'fee_cents', 0));
  put('currency', optionalString(body, 'currency', 10));
  put('feeBasis', optionalEnum(body, 'fee_basis', FEE_BASES));
  put('paymentTiming', optionalEnum(body, 'payment_timing', PAYMENT_TIMINGS));
  put('registrationOpensAt', parseInstant(body['registration_opens_at'], 'registration_opens_at'));
  put('registrationClosesAt', parseInstant(body['registration_closes_at'], 'registration_closes_at'));
  put('waitlistEnabled', optionalBoolean(body, 'waitlist_enabled'));
  put('resultsEnabled', optionalBoolean(body, 'results_enabled'));
  put('seriesId', optionalUuid(body, 'series_id'));
  put('details', optionalJson(body, 'details'));
  put('resourceIds', optionalUuidList(body, 'resource_ids'));
  return fields;
};

/** Event management (staff) + discovery + registration (players). */
@Controller('events')
export class EventsController {
  constructor(
    private readonly events: EventsService,
    private readonly actorContext: ActorContextService,
  ) {}

  @Get()
  async list() {
    return (await this.events.listEvents()).map(({ event, registered }) =>
      serializeEvent(event, { registeredCount: registered }),
    );
  }

  @Post()
  @RequirePermissions(MANAGE)
  async create(@Body() body: Record<string, unknown>) {
    const fields = eventFields(body, false);
    if (fields['capacity'] === undefined) {
      throw new BadRequestException('capacity is required');
    }
    const event = await this.events.createEvent(fields);
    return serializeEvent(event);
  }

  @Get(':id')
  async get(@Param('id', ParseUuidPipe) id: string) {
    const { event, resourceIds, registered } = await this.events.getEvent(id);
    return serializeEvent(event, { resourceIds, registeredCount: registered });
  }

  @Patch(':id')
  @RequirePermissions(MANAGE)
  async update(@Param('id', ParseUuidPipe) id: string, @Body() body: Record<string, unknown>) {
    if (body['tenant_id'] !== undefined) {
      throw new BadRequestException('tenant_id cannot be changed');
    }
    return serializeEvent(await this.events.updateEvent(id, eventFields(body, true)));
  }

  @Delete(':id')
  @RequirePermissions(MANAGE)
  async remove(@Param('id', ParseUuidPipe) id: string) {
    // Deleting an unpublished draft; anything published must be cancelled.
    const { event } = await this.events.getEvent(id);
    if (event.status !== 'draft') {
      throw new BadRequestException('only draft events can be deleted; cancel instead');
    }
    await this.events.deleteDraft(id);
    return { type: 'event', id, attributes: { deleted: true } };
  }

  @Post(':id/publish')
  @RequirePermissions(MANAGE)
  async publish(@Param('id', ParseUuidPipe) id: string) {
    return serializeEvent(await this.events.publish(id));
  }

  @Post(':id/cancel')
  @RequirePermissions(MANAGE)
  async cancel(@Param('id', ParseUuidPipe) id: string, @Body() body: Record<string, unknown>) {
    return serializeEvent(await this.events.cancel(id, optionalString(body, 'reason', 500)));
  }

  @Post(':id/open-registration')
  @RequirePermissions(MANAGE)
  async openRegistration(@Param('id', ParseUuidPipe) id: string) {
    return serializeEvent(await this.events.setRegistrationState(id, true));
  }

  @Post(':id/close-registration')
  @RequirePermissions(MANAGE)
  async closeRegistration(@Param('id', ParseUuidPipe) id: string) {
    return serializeEvent(await this.events.setRegistrationState(id, false));
  }

  /** Player registration — no permission gate; actor.userId owns the row. */
  @Post(':id/register')
  async register(@Param('id', ParseUuidPipe) id: string, @Body() body: Record<string, unknown>) {
    const actor = this.actorContext.actor;
    const staff = Boolean(actor.tenantId);
    const registration = await this.events.register({
      eventId: id,
      playerId: staff ? optionalUuid(body, 'player_id') : actor.userId,
      guestContactId: staff ? optionalUuid(body, 'guest_contact_id') : undefined,
      kind: optionalEnum(body, 'kind', REG_KINDS) ?? 'individual',
      seats: optionalInt(body, 'seats', 1) ?? 1,
      teamName: optionalString(body, 'team_name', 200),
      roster: optionalJson(body, 'roster'),
      idempotencyKey: optionalString(body, 'idempotency_key', 200),
    });
    return serializeRegistration(registration);
  }

  @Get(':id/registrations')
  @RequirePermissions(MANAGE)
  async registrations(@Param('id', ParseUuidPipe) id: string) {
    return (await this.events.listRegistrations(id)).map(serializeRegistration);
  }

  @Post(':id/results')
  @RequirePermissions(MANAGE)
  async recordResult(@Param('id', ParseUuidPipe) id: string, @Body() body: Record<string, unknown>) {
    const regId = body['registration_id'];
    let registrationId: bigint | undefined;
    if (regId !== undefined && regId !== null) {
      const decoded = new SqidCodec().decode('event-registration', String(regId));
      if (decoded === null) throw new BadRequestException('registration_id is invalid');
      registrationId = decoded;
    }
    const result = body['result'];
    if (result === undefined || typeof result !== 'object') {
      throw new BadRequestException('result is required');
    }
    return serializeEventResult(
      await this.events.recordResult(id, {
        registrationId,
        label: optionalString(body, 'label', 200),
        result: result as Record<string, unknown>,
      }),
    );
  }

  @Get(':id/results')
  async results(@Param('id', ParseUuidPipe) id: string) {
    return (await this.events.listResults(id)).map(serializeEventResult);
  }
}
