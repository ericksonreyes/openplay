# Platforms and payments

- Player and venue workflows are planned for web and native mobile experiences.
- Planned payment options include GCash and Maya through integrated checkout or direct transfer to a venue account, as well as paying at the venue. Direct e-wallet or bank transfers allow venues to accept funds even when they do not use a payment gateway.
- Business Owners choose which supported payment methods to offer and provide any required transfer instructions or account details.
- Membership purchases use the supported payment methods and verification flows; benefit activation follows the membership plan's configured policy.
- Business Owners configure whether payment is collected in full or as a deposit, and when any remaining balance is due.
- Booking confirmation and payment status are separate: a reservation, open-play participation, or equipment rental can be confirmed while payment remains due.
- For reservations or open-play participation with payment due at check-in, standalone rentals with payment due at pickup, and balances due after a deposit, the default payment grace period is 15 minutes after the scheduled start or pickup time; Business Owners can configure a different duration.

## Booking confirmation and payment flows

- Instant booking is the default when a resource is available. A venue can enable request-based approval separately from its choice of payment method.
- For integrated checkout, the system temporarily holds the relevant resource or equipment quantity while the player completes payment. It confirms the reservation, session participation, or rental only after successful payment is verified server-side through the provider; a browser redirect alone is not proof of payment. Failed, cancelled, or expired checkout releases the hold.
- For direct transfers, the system temporarily holds the relevant resource or equipment quantity and marks the payment as awaiting venue verification. The player can submit a transaction reference and optionally a receipt image. Authorized venue staff verify the incoming transfer against the venue's official wallet or bank account records. A screenshot alone does not confirm payment. A verified transfer confirms the reservation, session participation, or rental and marks it paid; rejection or hold expiry releases the hold.
- For pay-at-venue, a reservation, open-play participation, or rental can be confirmed with payment recorded as due at the venue or equipment pickup. Staff record payment when it is collected.
- A confirmed reservation, open-play participation, or rental with an unpaid amount remains confirmed, and its resource, session capacity, or equipment quantity remains allocated during its grace period. If payment is still outstanding when the grace period ends, the venue's overdue, cancellation, or no-show policy applies. Once a resource's scheduled use has started, it must not be reopened for rebooking. Equipment already checked out remains unavailable until staff record its return; uncollected equipment can be released according to the venue's no-show policy.
- If a venue requires approval for a reservation or rental, the request remains pending and holds the requested resource or equipment quantity for a limited period; no payment is collected while approval is pending. After approval, the selected payment flow begins, or the reservation or rental is confirmed with payment due at the venue or equipment pickup. Rejected or expired requests release the hold.
