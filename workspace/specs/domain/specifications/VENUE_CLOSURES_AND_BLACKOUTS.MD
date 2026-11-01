# Venue closures and blackout dates

Closures mark times when a venue or resource cannot be booked — holidays, maintenance, private functions, or staff unavailability. A blackout applies to the whole venue, a specific resource, or a time range.

## Defining closures

- Business Owners and venue managers can create closures for a venue or a bookable resource: a date, a date range, or a partial-day window.
- Recurring closures are supported for regular patterns, such as a weekly maintenance morning or an annual holiday.
- Recurring closures support exceptions: an authorized user can skip, move, or change an individual date without replacing the whole series.
- A closure has a reason label so players see why the time is unavailable.
- Closures make the affected times unbookable for new private reservations and event scheduling; they do not silently block anything already confirmed.
- Outdoor venues can use a quick weather-closure action for a selected venue/resource and time range. It still shows affected bookings and events and requires explicit handling for each.
- Internal-use blocks are supported separately from closures. They occupy a venue or resource for staff or private business use but do not appear as customer bookings or in public search.

## Effect on existing bookings

- Creating a closure that overlaps existing bookings or scheduled events shows the affected records before saving. OpenPlay never cancels an affected record automatically.
- The venue explicitly chooses how to handle each affected booking or event: keep it, move it where possible, or cancel it under the venue's cancellation rules — a venue-initiated cancellation follows the same refund and notification rules as other venue cancellations.
- Affected players and guests are notified of the closure and its impact on their booking; see [Notifications](NOTIFICATIONS.MD).

## Player visibility

- Closed times appear as unavailable in search, availability views, and the booking calendar — ideally with the reason shown.
- Public closures (for example holiday hours) can appear on the Business Profile Page.

## Open decisions

- Lead time rules or warnings when creating closures over heavily booked periods.
