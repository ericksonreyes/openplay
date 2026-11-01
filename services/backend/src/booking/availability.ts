/**
 * Availability engine — pure functions, unit-tested without a database.
 * Computes the bookable slot grid for one resource on one date from its
 * resolved settings plus the busy intervals already claimed (reservations,
 * event allocations) or blocked (closures/internal-use).
 *
 * Results are informational only; every submission revalidates through the
 * resource_allocations exclusion constraint.
 */

export interface Interval {
  startsAt: Date;
  endsAt: Date;
}

export interface Slot {
  starts_at: string;
  ends_at: string;
  available: boolean;
}

export interface GridSettings {
  /** Minutes after midnight (venue-local) the resource opens. Default 8:00. */
  open_minutes?: number;
  /** Minutes after midnight it closes. Default 22:00. */
  close_minutes?: number;
  /** Start-time increment. Default 30. */
  increment_minutes?: number;
  /** Booking duration. Default 60. */
  duration_minutes?: number;
  /** Turnover buffer appended to each booking for conflict purposes. */
  buffer_minutes?: number;
}

export const DEFAULT_SETTINGS: Required<GridSettings> = {
  open_minutes: 8 * 60,
  close_minutes: 22 * 60,
  increment_minutes: 30,
  duration_minutes: 60,
  buffer_minutes: 0,
};

/** Half-open overlap: [aStart, aEnd) && [bStart, bEnd). */
export const overlaps = (a: Interval, b: Interval): boolean =>
  a.startsAt < b.endsAt && b.startsAt < a.endsAt;

/** Buffered claim window used for conflict checks and allocations. */
export const bufferedWindow = (
  startsAt: Date,
  endsAt: Date,
  bufferMinutes: number,
): Interval => ({
  startsAt,
  endsAt: new Date(endsAt.getTime() + bufferMinutes * 60_000),
});

/** Resolve resource.settings JSON into grid settings with defaults. */
export function resolveGridSettings(settings: unknown): Required<GridSettings> {
  const s = (settings ?? {}) as Record<string, unknown>;
  const num = (key: keyof Required<GridSettings>): number | undefined =>
    typeof s[key] === 'number' && Number.isFinite(s[key] as number)
      ? (s[key] as number)
      : undefined;
  return {
    open_minutes: num('open_minutes') ?? DEFAULT_SETTINGS.open_minutes,
    close_minutes: num('close_minutes') ?? DEFAULT_SETTINGS.close_minutes,
    increment_minutes: num('increment_minutes') ?? DEFAULT_SETTINGS.increment_minutes,
    duration_minutes: num('duration_minutes') ?? DEFAULT_SETTINGS.duration_minutes,
    buffer_minutes: num('buffer_minutes') ?? DEFAULT_SETTINGS.buffer_minutes,
  };
}

/**
 * Candidate slots for `dayStart`..`dayStart+24h`. A slot is unavailable when
 * its buffered window overlaps any busy interval or falls outside operating
 * minutes. `now` hides slots that already started.
 */
export function computeSlots(
  dayStart: Date,
  settings: GridSettings,
  busy: Interval[],
  now: Date,
): Slot[] {
  const g = { ...DEFAULT_SETTINGS, ...settings };
  const slots: Slot[] = [];
  for (
    let startMin = g.open_minutes;
    startMin + g.duration_minutes <= g.close_minutes;
    startMin += g.increment_minutes
  ) {
    const startsAt = new Date(dayStart.getTime() + startMin * 60_000);
    const endsAt = new Date(startsAt.getTime() + g.duration_minutes * 60_000);
    const window = bufferedWindow(startsAt, endsAt, g.buffer_minutes);
    const available =
      startsAt >= now && !busy.some((b) => overlaps(window, b));
    slots.push({
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      available,
    });
  }
  return slots;
}
