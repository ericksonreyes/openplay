# Concurrency and resource conflicts

- Availability shown to a player is informational; the system rechecks availability when a private reservation, event registration, or equipment rental is submitted.
- A private reservation or scheduled event occupies each assigned bookable resource for its scheduled interval, including any configured buffer. Event registration capacity is tracked separately from resource availability.
- Concurrent overlapping claims for the same bookable resource must be resolved atomically so a private reservation and a conflicting event cannot both claim it. A conflicting request receives an unavailable result and refreshed availability.
- Event registration must atomically claim the event's configured capacity unit (individual seats, group seats, or team slots) so concurrent registrations cannot overbook it or create duplicate registrations. This also applies to Open Play.
- Concurrent equipment rental requests must atomically reserve the requested quantities so the available stock cannot be overbooked.
- Any payment flow that temporarily holds a resource, event place, or equipment quantity must release that hold after failure or expiry. Repeated submissions or payment notifications must not create duplicate reservations, event registrations, rentals, payments, or confirmations.

## Technical mechanism notes (PostgreSQL)

These notes describe how the backend enforces the rules above; they do not add product behavior.

- **Counter-style claims** — event capacity and equipment stock are claimed by locking the existing row: `SELECT ... FOR NO KEY UPDATE` on the event or inventory row, check the remaining capacity, then write. `FOR NO KEY UPDATE` is the correct lock level when the update does not change the primary key.
- **Range-style conflicts** — a reservation conflict means "no overlapping row exists yet," so there is no row to lock. Prefer an exclusion constraint on a time-range column (for example `EXCLUDE USING gist (resource_id WITH =, slot WITH &&)`) so the database rejects overlapping inserts itself; a transaction-scoped advisory lock on `resource_id` is the fallback. Locking the resource row also works but serializes every booking on that resource.
- **Fail-fast claims** — where waiting is worse than failing (the last event seat, a contested slot), `FOR UPDATE NOWAIT` returns an immediate conflict instead of blocking the player's request.
- **Worker claims** — reminder-style background claiming uses `SELECT ... FOR UPDATE SKIP LOCKED`, so multiple worker replicas process different rows and never claim the same record twice.
