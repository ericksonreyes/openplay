# Concurrency and resource conflicts

- Availability shown to a player is informational; the system rechecks availability when a private reservation, event registration, or equipment rental is submitted.
- A private reservation or scheduled event occupies each assigned bookable resource for its scheduled interval, including any configured buffer. Event registration capacity is tracked separately from resource availability.
- Concurrent overlapping claims for the same bookable resource must be resolved atomically so a private reservation and a conflicting event cannot both claim it. A conflicting request receives an unavailable result and refreshed availability.
- Event registration must atomically claim the event's configured capacity unit (individual seats, group seats, or team slots) so concurrent registrations cannot overbook it or create duplicate registrations. This also applies to Open Play.
- Concurrent equipment rental requests must atomically reserve the requested quantities so the available stock cannot be overbooked.
- Any payment flow that temporarily holds a resource, event place, or equipment quantity must release that hold after failure or expiry. Repeated submissions or payment notifications must not create duplicate reservations, event registrations, rentals, payments, or confirmations.
