# Memberships

- Business Owners create membership plans for selected venues or all venues in their business. For an all-venues plan, the Business Owner chooses whether venues added later are included. They set plan eligibility, price, term, optional expiration date, billing type, and benefits, such as eligible booking or rental discounts or an earlier booking window.
- If a plan has both a term and an expiration date, the Business Owner chooses how they interact for that plan and shows the resulting end date before purchase.
- A plan can charge once for its term or offer recurring billing at a configured interval when the payment method supports repeat charges. The Business Owner may choose whether recurring billing is selected by default in the offer, but the player must actively confirm it before purchase; an untouched default is not consent.
- Direct transfers and pay-at-venue do not renew automatically; the player must make each renewal payment manually unless a supported recurring-payment flow is configured.
- If an automatic renewal payment fails, OpenPlay does not retry it automatically. The player is notified, and membership benefits pause until payment succeeds.
- Managers administer membership operations within the Business Owner's plan rules.
- Players can view each plan's venue scope, billing type, price, term or recurring interval, and benefits before purchase. They can see their membership status, benefits, and expiration date when one applies.
- A member's active membership is linked to their player account. When the member is signed in, OpenPlay identifies the membership and automatically applies its benefits to eligible reservations, scheduled events, or equipment rentals at venues covered by the plan.
- A player without an active membership can use guest booking at the regular price when guest checkout is enabled.
- Purchasing a membership requires a player account. A guest may create an account and link a booking after proving control of the verified contact method.
- Guest membership claims follow the secure verification steps in [Guest Booking](GUEST_BOOKING.MD).
- A membership represents access and benefits, not an in-app cash balance or stored-value wallet.

## In-person membership identification

- A member may use a QR code as an identifier for their membership. Scanning it must check the current membership record, venue eligibility, and active status; the QR code alone is not proof of eligibility.
- If a member photo is provided, an authorized Venue Manager or Business Owner may use it to help match the person to the membership record. A photo alone does not prove that membership is active.
- Membership photos are available only to authorized verifiers. QR codes must not expose unnecessary personal information, and the system does not use automated face recognition.
