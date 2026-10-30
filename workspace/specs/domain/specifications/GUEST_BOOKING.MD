# Guest booking

Guest booking lets a person make an eligible booking without creating an OpenPlay account. It reduces sign-up friction, but it is not fully anonymous: the guest provides contact details needed for confirmation and booking access.

## Guest booking flow

- A person can browse venues, search availability, and ask about offerings without signing in.
- Business Owners can enable or disable guest checkout for eligible offerings in their business.
- When guest checkout is enabled, a person can submit an eligible private reservation, open-play registration, or equipment rental without creating a username or password.
- The form collects only the contact details needed to send confirmation and updates. Exact required fields and whether those details must be verified before confirmation remain open decisions.
- Guest bookings follow the same availability, capacity, payment, grace-period, cancellation, and no-show rules as other bookings.
- After a booking, the guest can optionally create an account and link the booking after proving control of the booking's verified contact method. Account creation is not required to complete the booking.

## Guest booking access and privacy

- A guest can view or manage only their own booking through a secure, time-limited link or a one-time verification code sent to the booking contact.
- A name, email address, or phone number alone is not enough to reveal or change a booking. The app must not provide a lookup that exposes another person's reservations.
- Venue users can view guest bookings only within their assigned venues and existing permissions.
- Guest payment and transfer-verification flows follow the same rules as other bookings. The guest must receive a confirmation and payment status through the contact method they provided.

## Relationship to the AI assistant

- Form-based search and guest booking remain available without the AI assistant.
- The assistant may prefill an unsaved guest booking form only if guest access to the assistant is enabled. It must not create the booking or reveal guest booking details without verification.
- Whether guests can use the chatbot for public availability searches, how verification works, and which booking types allow guest checkout remain open decisions.

## Open guest-booking decisions

- Required contact fields and the verification method for confirming a guest booking.
- Which booking types and payment methods support guest checkout.
- Limits or abuse controls for repeated guest bookings.
- The link/code expiry and booking-change/cancellation flow.
- Whether and how a guest can associate bookings with a later-created account or membership.
