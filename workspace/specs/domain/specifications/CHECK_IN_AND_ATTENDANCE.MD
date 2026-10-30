# Check-in and attendance

Check-in is how a venue records that a player actually arrived for their booking. Attendance records drive no-show handling, disputes, and reporting.

## Recording attendance

- Venue staff can mark a player as **arrived** for a private reservation, event registration, or equipment pickup.
- Staff can check in a player by scanning a QR code shown by the player, or by looking up the booking manually. The QR code identifies the booking; it is not a payment or membership credential.
- Check-in follows the venue's arrival window rules — for example, how early a player may check in and how late before the booking counts as a no-show. Exact windows are venue-configurable.
- A booking with no recorded arrival by the end of its no-show window can be marked as a no-show. Marking may be manual by staff or automatic according to venue settings.
- Guest bookings check in with the same QR or manual flow after completing the verification required by [Guest Booking](GUEST_BOOKING.MD).
- Players can see their own attendance status for past and upcoming bookings.

## What attendance drives

- **No-show handling** — the venue's no-show policy (forfeit, fee, or booking limits) applies only when attendance is recorded; an unmarked booking should not silently become a charge.
- **Disputes** — attendance records are evidence when a player disputes a charge or a no-show marking; see [Disputes](DISPUTES.MD).
- **Reporting** — attendance data feeds venue utilization and no-show-rate reporting.

## Open decisions

- Whether players can self check-in from their own device (for example a geo or QR-at-venue flow) or staff confirmation is always required.
- Exact arrival and no-show windows per venue and per booking type.
- Whether partial attendance is tracked for events (late arrival, early departure).
- How attendance relates to equipment already checked out when the booking is a no-show.
- Retention period for attendance records.
