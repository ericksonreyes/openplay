# Open product decisions

Business Owners configure policies for their businesses and venues; venue managers and staff operate within delegated authority. Unless otherwise stated, this specification leaves exact values venue-defined. The default court turnover buffer is 10 minutes and the default payment grace period is 15 minutes; venues can override both. The following details still need decisions before implementation:

- Venue-specific booking start-time increments and non-court buffer settings; non-court resources default to zero buffer.
- Exact event recurrence patterns, exception handling, series horizon, and repeat-edit behavior.
- Exact per-event team-size limits and roster-change rules; how group/team registrations consume capacity remains to be defined.
- Event-specific payment deadlines. Paid events inherit the Business Owner's default fee basis unless explicitly overridden.
- Event-specific scoring presets, tie-break rules, result corrections or disputes, and standings visibility.
- Eligibility for group or team registrations on event waitlists.
- Rental duration choices and pickup/return windows; quantity tracking is the default, with optional per-item identifiers.
- Exact venue-configured policies for late returns, extensions, damage, loss, deposits, and related charges.
- Membership eligibility and benefits, recurring billing intervals, auto-renew cancellation and notice, manual failed-payment recovery window, the per-plan expiration/term interaction, activation timing, and the per-plan choice to include venues added later in an all-venues plan.
- Integrated-checkout fallback durations and platform bounds, venue-specific payment due times and grace-period overrides, and retry or resubmission windows. Direct transfers require a Business Owner-set verification deadline and have no platform default; confirmed unpaid balances use separate rules from unconfirmed payment holds.
- The amount and percentage base for an optional platform service fee, provider-specific refund limits, reconciliation, and pay-at-venue collection procedures. The platform fee stays off until configured and activated by transaction type; provider processing fees are absorbed by the business, not passed through as a separate player charge. Deposit refunds use the venue's separately configured and disclosed policy.
- Exact amount and timing rules for an optional venue no-show fee on unpaid pay-at-venue reservations; no fee applies by default and opted-in fees require manual venue collection.
- Integration behavior for GCash and Maya; direct transfer methods and venue account details are configured per venue.
- Which reservation, session, rental, and payment states block resource or inventory availability, including the precise expiry behavior for temporary holds and equipment return recording.
- Business Profile Page fields, brand assets, public contact choices, and delegated edit permissions; slug pattern, collision behavior, and redirect window are tracked in [Public Content Delivery](../../technical/PUBLIC_CONTENT_DELIVERY.MD). Slugs are generated and editable; active owners publish edits after activation review.
- Exact verification evidence checklist and approval criteria per deployment, plus onboarding and invitation steps.
- How overlapping Facility Use Rules combine across scopes; see [Facility Use Rules](FACILITY_USE_RULES.MD).
- Email providers, reminder timing, language, user preferences, and delivery retries; see [Notifications](NOTIFICATIONS.MD).
- Search geography, radius preset values, relevance signal weights/tie-breaks, price filters, saved searches, and supported resource attributes. Map/radius search uses local distance units, requires a player-selected radius, and defaults to relevance-first ordering.
- Account provisioning and tenant-code rules, fine-grained delegation rules (including which staff may change or cancel bookings or verify transfers), and Platform Administrator support-access audit controls. Technical isolation uses PostgreSQL RLS plus NestJS service checks; implementation details remain in [Row-Level Security](../../technical/security/ROW_LEVEL_SECURITY.MD).
- AI assistant Ollama model allowlist contents, request-throttle values, platform limits for owner-set budgets, and supported question types. Failover notices go to Business Owners and venue managers, hosted-provider disclosure is shown to players before first use and acknowledged by the Business Owner before enabling, guest form prefilling is Business Owner-configurable, and languages are model-dependent. The assistant is included in the initial release and off by default; see [AI Assistant](AI_ASSISTANT.MD) and [AI Governance](../../technical/AI_GOVERNANCE.MD).
- Guest booking: eligible booking types, required contact fields and verification method, secure booking retrieval/change/cancellation flow, abuse limits, account linking, QR code contents and lifecycle, approved verification links, optional photo consent and retention, and offline verification. Membership purchase requires a player account. See [Guest Booking](GUEST_BOOKING.MD).
- Check-in: arrival and no-show windows, self check-in, and attendance retention. See [Check-in and Attendance](CHECK_IN_AND_ATTENDANCE.MD).
- Waivers: acknowledgment method, consent period, guardian verification, retention, and covered booking types. See [Waivers and Consent](WAIVERS_AND_CONSENT.MD).
- Closure warnings or lead-time rules for heavily booked periods. Weather quick-close, recurring exceptions, internal-use blocks, and explicit handling of affected events are decided; see [Venue Closures and Blackouts](VENUE_CLOSURES_AND_BLACKOUTS.MD).
- Recurring reservations: supported pattern catalogue and edge cases, series horizon, pricing, membership interaction, and skipped-occurrence visibility. Pattern types are venue-configured; conflicts with later events or closures require an explicit keep, move, or cancel decision. See [Recurring Reservations](RECURRING_RESERVATIONS.MD).
- Disputes: deadlines, escalation timing, category routing, and guest evidence. See [Disputes](DISPUTES.MD).
