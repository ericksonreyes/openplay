# Notifications

Notifications tell players and venue teams about changes to bookings and other time-sensitive activity. They do not create or change a reservation, event registration, payment, or rental.

## Initial notification coverage

- Players and guests receive confirmation, pending-status, change, and cancellation updates for reservations and event registrations.
- Players receive payment-status and due-time updates, including transfer verification results and checkout expiry.
- Players receive reminders for upcoming reservations and events, event schedule changes, and equipment pickup or return deadlines.
- Venue Owners, managers, and delegated staff can receive alerts for new reservations or event registrations, transfer evidence awaiting review, cancellations, and operational deadlines within their assigned venues.
- A notification links to the relevant OpenPlay page. It must not expose private booking, guest, or payment details in the message itself.
- Signed-in users can see relevant notices in the web app. Initial transactional delivery uses in-app notices and email to an available verified contact. SMS is deferred.

## Delivery rules

- A failed notification does not change the status of a booking, event registration, payment, or rental.
- The system records delivery status and avoids sending duplicate messages for a repeated request or payment callback.
- Promotional messages are outside the initial notification scope. Preference and consent rules for optional reminders remain to be defined.
- Native-app push notifications are deferred with native mobile apps.

## Open notification decisions

Email providers, reminder timing, message language, user preferences, retry limits, and which operational alerts can be assigned to staff remain to be decided.
