# ADR-0017: Recurring Closures and Scheduled Holidays

## Status

Accepted — 2026-11-03.

## Context

Venues close on a schedule that repeats: weekly maintenance windows,
monthly closures, and annual holidays (Christmas, New Year). One-off
`venue_closures` rows forced staff to create dozens of records per
year — and anything missed stayed bookable.

## Decision

1. **Recurrence lives on `venue_closures.recurrence` (JSONB).** The
   column already existed per the original design
   (`{rule: 'FREQ=WEEKLY|MONTHLY|YEARLY'}` RFC-5545-style). Occurrence
   expansion happens in app code (`venue-catalog/recurrence.ts`),
   never in SQL — `closureInstances(c, rangeStart, rangeEnd)` returns
   concrete intervals, and non-recurring rows pass through when they
   overlap the range.
   - `FREQ=WEEKLY` — `BYDAY=MO,TU` honored; defaults to the seed's weekday.
   - `FREQ=MONTHLY` — seed's day-of-month, clamped to month end.
   - `FREQ=YEARLY` — seed's month+day; Feb 29 → Feb 28 in short years.
   - Occurrences keep the seed's time-of-day and duration.
2. **Closure queries no longer pre-filter by date overlap** — a
   recurring seed outside the window still blocks it. Both booking
   checks (availability grid + `createReservation`'s closure guard)
   expand instances in memory instead; scheduled-closure counts are
   tenant-scoped and small.
3. **`venue_id: null` = tenant-wide.** A closure with no venue applies
   to every venue in the tenant (the booking checks match `venueId OR
   NULL`). This is how national holidays are modeled — one row covers
   all venues; venue-specific holidays carry their venue id. The
   create endpoint accepts `venue_id: null` explicitly; omitting the
   field still requires `resource_id`.
4. **Scheduled holidays are closures.** A holiday is a `venue_closure`
   with `details.holiday: true` + `recurrence: 'FREQ=YEARLY'` stored
   on a representative date (the year's occurrence) spanning the full
   day — no new table, no new lifecycle. The `/catalog/holidays` page
   surfaces only `details.holiday` rows with `status = scheduled`.
5. **Cancel stays the only retirement.** Holidays and recurring
   closures cancel via the same `status: cancelled` path — cancelling
   stops all future occurrences (they're computed, not materialized).
   ADR-0015's "closures are cancelled, never deleted" is unchanged.

## Consequences

- Bookings on recurring-closure dates now 409 (`RESOURCE_CLOSED`)
  even though the seed date may be months earlier.
- The UI exposes recurrence as a select on the closure form
  (`recurrence.rule` dotted field); holidays get a dedicated nav
  entry under Venue Admin.
- `exceptions: [{date, action, movedTo}]` in the recurrence JSON is
  reserved by the original design but not yet implemented — holiday
  rescheduling for a single year needs it (skip-date support).
