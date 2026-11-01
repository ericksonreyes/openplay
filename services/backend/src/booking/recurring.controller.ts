import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { ParseUuidPipe } from '../common/ids/parse-id.pipes';
import { optionalInt, optionalUuid } from '../venue-catalog/validation';
import { RecurringService } from './recurring.service';
import { RecurrenceRule, WeekdayName } from './recurrence';
import {
  serializeRecurringTemplate,
  serializeReservation,
} from './serializers';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const parseDayField = (body: Record<string, unknown>, field: string, required: boolean): string | undefined => {
  const value = body[field];
  if (value === undefined || value === null) {
    if (required) throw new BadRequestException(`${field} is required`);
    return undefined;
  }
  if (typeof value !== 'string' || !DAY_RE.test(value)) {
    throw new BadRequestException(`${field} must be YYYY-MM-DD`);
  }
  return value;
};

const parseWeekdays = (body: Record<string, unknown>): WeekdayName[] => {
  const value = body['weekdays'];
  if (!Array.isArray(value) || value.length === 0 || value.some((d) => typeof d !== 'string')) {
    throw new BadRequestException('weekdays must be a non-empty array of day names');
  }
  return value as WeekdayName[];
};

/** Build the stored rule from request fields; fine-grained checks run in the service. */
const parseRule = (body: Record<string, unknown>): RecurrenceRule => {
  const startTime = body['starts_time'];
  if (typeof startTime !== 'string' || !/^\d{2}:\d{2}$/.test(startTime)) {
    throw new BadRequestException('starts_time must be HH:MM (UTC)');
  }
  const duration = optionalInt(body, 'duration_minutes', 1);
  const endsTime = body['ends_time'];
  let durationMinutes = duration;
  if (durationMinutes === undefined) {
    if (typeof endsTime !== 'string' || !/^\d{2}:\d{2}$/.test(endsTime)) {
      throw new BadRequestException('duration_minutes or ends_time (HH:MM) is required');
    }
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endsTime.split(':').map(Number);
    durationMinutes = eh * 60 + em - (sh * 60 + sm);
    if (durationMinutes <= 0) {
      throw new BadRequestException('ends_time must be after starts_time');
    }
  }
  const startDate = parseDayField(body, 'start_date', true) as string;
  return {
    freq: 'weekly',
    interval_weeks: optionalInt(body, 'interval_weeks', 1) ?? 1,
    weekdays: parseWeekdays(body),
    start_time: startTime,
    duration_minutes: durationMinutes,
    start_date: startDate,
    end_date: parseDayField(body, 'end_date', false),
  };
};

const withExpansion = (
  result: { template: Parameters<typeof serializeRecurringTemplate>[0] } & {
    occurrences: Parameters<typeof serializeReservation>[0][];
    skipped: unknown[];
  },
) => ({
  ...serializeRecurringTemplate(result.template),
  attributes: {
    ...serializeRecurringTemplate(result.template).attributes,
    occurrences: result.occurrences.map(serializeReservation),
    skipped: result.skipped,
  },
});

/**
 * Recurring reservation series. Player-facing routes carry no permission gate —
 * the service scopes by actor user id; staff act under tenant RLS scope.
 */
@Controller('recurring-reservations')
export class RecurringController {
  constructor(private readonly recurring: RecurringService) {}

  @Get()
  async list() {
    return (await this.recurring.listTemplates()).map(serializeRecurringTemplate);
  }

  @Post()
  async create(@Body() body: Record<string, unknown>) {
    const resourceId = body['resource_id'];
    if (typeof resourceId !== 'string' || resourceId.length === 0) {
      throw new BadRequestException('resource_id is required');
    }
    const result = await this.recurring.createTemplate({
      resourceId,
      rule: parseRule(body),
      playerId: optionalUuid(body, 'player_id'),
    });
    return withExpansion(result);
  }

  @Get(':id')
  async get(@Param('id', ParseUuidPipe) id: string) {
    return serializeRecurringTemplate(await this.recurring.getTemplate(id));
  }

  @Post(':id/expand')
  async expand(@Param('id', ParseUuidPipe) id: string) {
    return withExpansion(await this.recurring.expand(id));
  }

  @Post(':id/cancel')
  async cancel(@Param('id', ParseUuidPipe) id: string) {
    return serializeRecurringTemplate(await this.recurring.cancel(id));
  }
}

