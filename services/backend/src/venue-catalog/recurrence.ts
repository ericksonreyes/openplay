import type { VenueClosureRow } from './catalog.types';

const DAY_MS = 24 * 3_600_000;
const DOW: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

/**
 * Expands a closure's recurrence.rule into concrete [startsAt, endsAt]
 * instances overlapping [rangeStart, rangeEnd). Non-recurring closures
 * return themselves only when they overlap the range.
 *
 * Rules: FREQ=WEEKLY (BYDAY=MO,TU — defaults to the seed's weekday),
 * FREQ=MONTHLY (seed's day-of-month, clamped to month end),
 * FREQ=YEARLY (seed's month+day, Feb 29 → Feb 28 in short years).
 * Occurrences keep the seed's time-of-day and duration.
 */
export function closureInstances(
  c: Pick<VenueClosureRow, 'startsAt' | 'endsAt' | 'recurrence'>,
  rangeStart: Date,
  rangeEnd: Date,
): { startsAt: Date; endsAt: Date }[] {
  const rule = ((c.recurrence as Record<string, unknown> | null)?.['rule'] ?? '') as string;
  const seedStart = new Date(c.startsAt);
  const dur = new Date(c.endsAt).getTime() - seedStart.getTime();
  const overlaps = (startsAt: Date) => startsAt.getTime() < rangeEnd.getTime() && startsAt.getTime() + dur > rangeStart.getTime();

  if (!rule.includes('FREQ=')) {
    return overlaps(seedStart) ? [{ startsAt: seedStart, endsAt: new Date(c.endsAt) }] : [];
  }

  const occurrences: { startsAt: Date; endsAt: Date }[] = [];
  const push = (startsAt: Date) => {
    if (overlaps(startsAt)) occurrences.push({ startsAt, endsAt: new Date(startsAt.getTime() + dur) });
  };
  const at = (y: number, m: number, d: number) =>
    new Date(y, m, d, seedStart.getHours(), seedStart.getMinutes(), seedStart.getSeconds());

  // Occurrences whose block could touch the range can start up to `dur` before it.
  const from = new Date(rangeStart.getTime() - dur);

  if (rule.includes('FREQ=WEEKLY')) {
    const byday = /BYDAY=([A-Z,]+)/.exec(rule)?.[1];
    const weekdays = byday ? byday.split(',').map((d) => DOW[d]).filter((d) => d !== undefined) : [seedStart.getDay()];
    for (const dow of weekdays) {
      // first occurrence of this weekday on/after `from`
      let d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
      d = new Date(d.getTime() + ((dow - d.getDay() + 7) % 7) * DAY_MS);
      while (d.getTime() < rangeEnd.getTime()) {
        push(new Date(d.getFullYear(), d.getMonth(), d.getDate(), seedStart.getHours(), seedStart.getMinutes(), seedStart.getSeconds()));
        d = new Date(d.getTime() + 7 * DAY_MS);
      }
    }
  } else if (rule.includes('FREQ=MONTHLY')) {
    const dom = seedStart.getDate();
    let y = from.getFullYear();
    let m = from.getMonth();
    while (new Date(y, m, 1) < rangeEnd) {
      const monthEnd = new Date(y, m + 1, 0).getDate();
      push(at(y, m, Math.min(dom, monthEnd)));
      m += 1;
      if (m > 11) { m = 0; y += 1; }
    }
  } else if (rule.includes('FREQ=YEARLY')) {
    const mm = seedStart.getMonth();
    const dom = seedStart.getDate();
    for (let y = from.getFullYear(); new Date(y, mm, 1) < rangeEnd; y += 1) {
      const monthEnd = new Date(y, mm + 1, 0).getDate();
      push(at(y, mm, Math.min(dom, monthEnd)));
    }
  }
  return occurrences;
}
