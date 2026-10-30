# Open product decisions

Business Owners configure policies for their businesses and venues; venue managers and staff operate within delegated authority. Unless otherwise stated, this specification leaves exact values venue-defined. The default court turnover buffer is 10 minutes and the default payment grace period is 15 minutes; venues can override both. The following details still need decisions before implementation:

- Time-zone handling.
- Venue-specific booking start-time increments and buffer settings for non-court resources.
- Whether open-play sessions should support waitlists.
- Equipment quantity versus individually identified item tracking, rental duration choices, and pickup/return windows.
- Policies for late returns, extensions, damage, loss, and any equipment deposits.
- Membership eligibility, benefit types, membership terms, renewals, and when purchased benefits become active.
- Exact checkout-hold and transfer-verification deadlines, venue-specific payment due times and grace-period overrides, and retry or resubmission windows. These deadlines apply separately to unconfirmed payment holds and confirmed reservations with an unpaid balance.
- Payment fees, deposit and refund mechanics, reconciliation, and pay-at-venue collection procedures.
- Integration behavior for GCash and Maya; direct transfer methods and venue account details are configured per venue.
- Which reservation, session, rental, and payment states block resource or inventory availability, including the precise expiry behavior for temporary holds and equipment return recording.
- The technical tenant-isolation and account-provisioning design, fine-grained delegation rules (including which staff may change or cancel bookings or verify transfers), and Platform Administrator support-access audit controls.
- AI assistant release timing and default toggle state, approved providers/models, voice input/output providers, audio and chat retention, hosted-data disclosure, credential setup, and guest access. See [AI Assistant](AI_ASSISTANT.MD).
- Guest booking: eligible booking types, required contact fields and verification, secure booking retrieval/change/cancellation flow, abuse limits, account linking, and membership benefits. See [Guest Booking](GUEST_BOOKING.MD).
