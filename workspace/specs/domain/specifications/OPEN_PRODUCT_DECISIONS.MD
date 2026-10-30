# Open product decisions

Business Owners configure policies for their businesses and venues; venue managers and staff operate within delegated authority. Unless otherwise stated, this specification leaves exact values venue-defined. The default court turnover buffer is 10 minutes and the default payment grace period is 15 minutes; venues can override both. The following details still need decisions before implementation:

- Time-zone handling.
- Venue-specific booking start-time increments and buffer settings for non-court resources.
- Event recurrence patterns, occurrence exceptions, and series-wide versus single-occurrence edits.
- Team-size and roster rules, capacity counting for teams/groups, and how team members can be added or changed.
- Event fee basis (per participant, group seat, team, or event) and event-specific payment deadlines.
- Event-specific scoring presets, tie-break rules, result corrections or disputes, and standings visibility.
- Whether scheduled events should support waitlists.
- Equipment quantity versus individually identified item tracking, rental duration choices, and pickup/return windows.
- Policies for late returns, extensions, damage, loss, and any equipment deposits.
- Membership eligibility and benefits, recurring billing intervals, auto-renew cancellation and notice, failed-payment retries and grace, the interaction between optional expiration date and plan term, activation timing, and whether an 'all venues' plan includes venues added later.
- Exact checkout-hold and transfer-verification deadlines, venue-specific payment due times and grace-period overrides, and retry or resubmission windows. These deadlines apply separately to unconfirmed payment holds and confirmed reservations with an unpaid balance.
- Payment fees, provider refund processing, deposit refund handling under the default cancellation policy, reconciliation, and pay-at-venue collection procedures.
- Whether venues may charge a no-show fee for unpaid pay-at-venue reservations and how it can be collected.
- Integration behavior for GCash and Maya; direct transfer methods and venue account details are configured per venue.
- Which reservation, session, rental, and payment states block resource or inventory availability, including the precise expiry behavior for temporary holds and equipment return recording.
- Business Profile Page fields, brand assets, public contact choices, page address, publishing review, and edit permissions.
- Business verification evidence, approval criteria, and onboarding steps for single-company and multi-tenant installations.
- How platform defaults, business-wide, venue-specific, and resource/activity-specific rules take precedence.
- Which facility rules require explicit player acknowledgment, how acknowledgment is recorded, and whether legal waivers require a separate workflow.
- Notification channels and providers, reminder timing, language, user preferences, and delivery retries.
- Search geography, map/radius behavior, sort order, and result ranking.
- The technical tenant-isolation and account-provisioning design, fine-grained delegation rules (including which staff may change or cancel bookings or verify transfers), and Platform Administrator support-access audit controls.
- AI assistant release timing and default toggle state, approved providers/models, voice input/output providers, audio and chat retention, hosted-data disclosure, credential setup, and guest access. See [AI Assistant](AI_ASSISTANT.MD).
- Guest booking: eligible booking types, required contact fields and verification, secure booking retrieval/change/cancellation flow, abuse limits, account linking, QR code contents and lifecycle, approved verification links, optional photo consent and retention, offline verification, and whether guests can purchase memberships. See [Guest Booking](GUEST_BOOKING.MD).
