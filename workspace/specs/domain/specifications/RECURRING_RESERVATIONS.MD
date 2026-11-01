# Recurring reservations

A recurring reservation is a private reservation that repeats on a pattern — for example a team's standing Tuesday 7 p.m. court slot. It creates a series of individual occurrences rather than one continuous booking.

## Creating a series

- A player can request a repeating private reservation using a pattern allowed by the venue, with an end date or occurrence limit. The initial release supports venue-configured pattern types rather than limiting every venue to one global pattern.
- Each occurrence is checked against availability like a normal reservation. A series does not claim times that conflict with existing bookings, closures, or scheduled events.
- When some occurrences conflict, the system reports which dates are unavailable and offers alternatives or skips them — the player is never silently given a partial series.
- Business Owners can limit how far ahead a recurring series may extend and which resources allow recurring bookings.

## Managing occurrences

- A player can cancel a single occurrence or the remaining series; each occurrence follows the venue's cancellation and refund rules independently.
- Editing a pattern applies to future occurrences only; past and already-paid occurrences are unchanged.
- A recurring occurrence has no special priority over a single reservation, event, or closure. If a later event or closure conflicts with an existing occurrence, the venue must explicitly keep, move, or cancel the affected occurrence under the same rules as a single reservation; players are notified.

## Payment

- Whether a series is paid per occurrence or as a single upfront total is venue-configurable.
- Per-occurrence payment follows the same holds, grace periods, and due times as single reservations; an occurrence that misses payment is handled under venue policy without cancelling the whole series by default.
- Membership benefits apply to each eligible occurrence individually, the same way they apply to single reservations.

## Open decisions

- Maximum series length and advance horizon per venue.
- Pricing rules for series (per-occurrence rate vs. series discount).
- How a recurring series interacts with membership benefits that expire mid-series.
- Whether other players can see and request the open slots a skipped occurrence frees.
- The supported pattern catalogue and edge cases such as monthly dates that do not occur in every month.
