# Concurrency and resource conflicts

- Availability shown to a player is informational; the system revalidates availability when a reservation, session join, or equipment rental is committed.
- A private reservation or open-play session occupies its linked bookable resource for its scheduled interval, including any venue-configured buffer time. Equipment rental quantities are reserved for their rental intervals, including venue-configured pickup and return windows.
- Concurrent overlapping claims for the same bookable resource must be resolved atomically so at most one active reservation or session occupies it. A conflicting request receives an unavailable result and refreshed availability.
- Concurrent equipment rental requests must atomically reserve the requested quantities so the available stock cannot be overbooked.
- Open-play joins must atomically check capacity and add the participant, so concurrent joins cannot exceed the session limit. Repeated requests must not register the same player more than once.
- Any payment flow that temporarily holds resource or equipment capacity, including integrated checkout and pending direct-transfer verification, must release the hold after failure or expiry. Repeated payment submissions or provider notifications must not create duplicate reservations, rentals, payments, or confirmations.
