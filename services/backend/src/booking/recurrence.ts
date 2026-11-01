/**
 * Recurrence expansion math — pure functions, unit-testable without a DB.
 *
 * Pattern model (RRULE-lite, per RECURRING_RESERVATIONS.MD "supported pattern
 * catalogue" being venue-configured; the initial release supports weekly
 * series on a day-of-week list):
 *
 *   rule = {
 *     freq: 'weekly',
 *     interval_weeks: number >= 1,        // every Nth week
 *     weekdays: WeekdayName[],            // ['mon','tue',...] UTC
 *     start_time: 'HH:MM',                // UTC wall-clock start
 *     duration_minutes: number >= 1,
 *     start_date: 'YYYY-MM-DD',           // first eligible day (UTC)
 *     end_date?: 'YYYY-MM-DD',            // inclusive last day (UTC)
 *   }
 *
 * All arithmetic is UTC — venues currently expose local times through their
 * own settings; timezone-aware expansion is an open decision.
 */

export type WeekdayName = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

export const WEEKDAYS: readonly WeekdayName[] = [
  'sun',
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
];

export interface RecurrenceRule {
  freq: 'weekly';
  interval_weeks: number;
  weekdays: WeekdayName[];
  start_time: string;
  duration_minutes: number;
  start_date: string;
  end_date?: string;
}

export interface OccurrenceWindow {
  startsAt: Date;
  endsAt: Date;
}

const DAY_MS = 24 * 3_600_000;
const WEEK_MS = 7 * DAY_MS;

export const parseDay = (value: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const parseTime = (value: string): { hours: number; minutes: number } | null => {
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
};

/** Validate a stored/request rule; returns error messages (empty = valid). */
export const validateRule = (rule: RecurrenceRule): string[] => {
  const errors: string[] = [];
  if (rule.freq !== 'weekly') errors.push('freq must be weekly');
  if (!Number.isInteger(rule.interval_weeks) || rule.interval_weeks < 1) {
    errors.push('interval_weeks must be an integer >= 1');
  }
  if (!Array.isArray(rule.weekdays) || rule.weekdays.length === 0) {
    errors.push('weekdays must be a non-empty array');
  } else if (rule.weekdays.some((d) => !WEEKDAYS.includes(d))) {
    errors.push(`weekdays entries must be one of: ${WEEKDAYS.join(', ')}`);
  }
  if (parseTime(rule.start_time) === null) {
    errors.push('start_time must be HH:MM (UTC)');
  }
  if (!Number.isInteger(rule.duration_minutes) || rule.duration_minutes < 1) {
    errors.push('duration_minutes must be an integer >= 1');
  }
  if (parseDay(rule.start_date) === null) errors.push('start_date must be YYYY-MM-DD');
  if (rule.end_date !== undefined && parseDay(rule.end_date) === null) {
    errors.push('end_date must be YYYY-MM-DD');
  }
  const start = parseDay(rule.start_date);
  const end = rule.end_date !== undefined ? parseDay(rule.end_date) : null;
  if (start && end && end < start) errors.push('end_date must be on or after start_date');
  return errors;
};

/** Monday (UTC) of the week containing `d`; the interval anchor. */
const startOfWeek = (d: Date): Date => {
  const day = d.getUTCDay(); // 0 = Sunday
  const offset = (day + 6) % 7; // days since Monday
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - offset));
};

/**
 * Expand `rule` into occurrence windows whose start falls in [windowFrom, windowTo).
 * Occurrences before start_date or after end_date are never produced.
 */
export const nextOccurrences = (
  rule: RecurrenceRule,
  windowFrom: Date,
  windowTo: Date,
): OccurrenceWindow[] => {
  if (validateRule(rule).length > 0) return [];
  const startDay = parseDay(rule.start_date) as Date;
  const endDay = rule.end_date !== undefined ? (parseDay(rule.end_date) as Date) : null;
  const time = parseTime(rule.start_time) as { hours: number; minutes: number };
  const weekdaySet = new Set(rule.weekdays.map((d) => WEEKDAYS.indexOf(d)));
  const anchorWeek = startOfWeek(startDay);

  // First candidate day: the later of start_date and windowFrom (floored to day).
  const fromDay = new Date(
    Date.UTC(windowFrom.getUTCFullYear(), windowFrom.getUTCMonth(), windowFrom.getUTCDate()),
  );
  let cursor = startDay > fromDay ? startDay : fromDay;
  if (endDay && cursor.getTime() > endDay.getTime() + DAY_MS - 1) return [];

  const out: OccurrenceWindow[] = [];
  const lastDay = endDay ?? windowTo;
  const hardStop = new Date(Math.min(lastDay.getTime(), windowTo.getTime()) + DAY_MS);

  while (cursor < hardStop) {
    const weeksSinceAnchor = Math.floor((startOfWeek(cursor).getTime() - anchorWeek.getTime()) / WEEK_MS);
    if (weeksSinceAnchor % rule.interval_weeks === 0 && weekdaySet.has(cursor.getUTCDay())) {
      const startsAt = new Date(cursor.getTime() + (time.hours * 60 + time.minutes) * 60_000);
      if (startsAt >= windowFrom && startsAt < windowTo) {
        out.push({
          startsAt,
          endsAt: new Date(startsAt.getTime() + rule.duration_minutes * 60_000),
        });
      }
    }
    cursor = new Date(cursor.getTime() + DAY_MS);
  }
  return out;
};

/** Default expansion horizon: occurrences materialized this far ahead. */
export const EXPANSION_HORIZON_WEEKS = 8;

export const expansionWindowTo = (now: Date): Date =>
  new Date(now.getTime() + EXPANSION_HORIZON_WEEKS * WEEK_MS);
