# Guest booking

Guest booking lets a person make an eligible booking without creating an OpenPlay account. It reduces sign-up friction, but it is not fully anonymous: the guest provides contact details needed for confirmation and booking access.

## Guest booking flow

- A person can browse venues, search availability, and ask about offerings without signing in.
- Business Owners can enable or disable guest checkout for eligible offerings in their business.
- When guest checkout is enabled, a person can submit an eligible private reservation, scheduled event registration (including Open Play), or equipment rental without creating a username or password.
- A guest without an active membership can complete the booking at the regular price without creating an account.
- Purchasing a membership requires a player account; a guest may create an account and link a booking after proving control of the verified contact method.
- A guest can receive membership benefits only after signing in or securely verifying an active membership for that venue. A name or contact detail alone does not prove membership.
- A Venue Manager or Business Owner can verify the guest's membership against venue records, review a secure link to an official membership record, or scan a QR code that identifies the membership.
- A verifier must confirm that the membership belongs to the guest, applies to the venue, and is active. A member photo may help match the guest to the record, but a photo, QR code, arbitrary URL, screenshot, or contact detail alone is not proof. Never ask the guest for their account password.
- A QR code must resolve to a current membership record and must not expose unnecessary personal information. Do not use automated face recognition.
- Record the verification result and who checked it. Store only the membership information needed to apply the benefit, and limit photo access to authorized verifiers.
- The form collects only the contact details needed to send confirmation and updates. The guest must verify at least one contact method with a time-limited code or secure link before booking confirmation; exact required fields and the verification method remain open decisions.
- Guest bookings and event registrations follow the same availability, capacity, payment, grace-period, cancellation, and no-show rules as other bookings.
- After a booking, the guest can optionally create an account and link the booking after proving control of the booking's verified contact method. Account creation is not required to complete the booking.

## Guest booking access and privacy

- After verifying control of a booking contact through a secure, time-limited link or one-time code, a guest can view or manage all records linked to that verified contact reference.
- A name, email address, or phone number alone is not enough to reveal or change a booking. The app must not provide a lookup that exposes another person's reservations.
- Venue users can view guest bookings only within their assigned venues and existing permissions.
- Guest payment and transfer-verification flows follow the same rules as other bookings. The guest must receive a confirmation and payment status through the contact method they provided.

## Relationship to the AI assistant

- Form-based search and guest booking remain available without the AI assistant.
- The assistant may prefill an unsaved guest booking or event registration form only if guest access to the assistant is enabled. It must not create the booking or reveal guest booking details without verification.
- How guests complete verification in the chatbot and which booking types allow guest checkout remain open decisions; guest public-availability searches are allowed per [AI Assistant](AI_ASSISTANT.MD).

## Open guest-booking decisions

- Required contact fields and the verification method for confirming a guest booking.
- Which booking types and payment methods support guest checkout.
- Limits or abuse controls for repeated guest bookings.
- The link/code expiry and booking-change/cancellation flow.
- Approved membership verification link sources, QR code format and expiry, optional photo consent and retention, offline verification, and what verification details are retained.
- Whether and how a guest can associate bookings with a later-created account or membership.
