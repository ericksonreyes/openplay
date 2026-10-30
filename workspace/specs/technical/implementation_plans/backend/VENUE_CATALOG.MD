# Venue catalog implementation plan

The `catalog` module: everything a business configures before it can take bookings — Business Profile Page content, venues, bookable resources, activities, operating settings, prices, Facility Use Rules, closures, and waiver documents. The catalog is configuration and published content; transactional records (reservations, consents) live in their own modules.

## Sources

- [Venue resources and activities](../../../domain/specifications/VENUE_RESOURCES_AND_ACTIVITIES.MD) — resources, settings, pricing ownership
- [Facility Use Rules](../../../domain/specifications/FACILITY_USE_RULES.MD) — scoped house rules, public vs internal
- [Venue closures and blackouts](../../../domain/specifications/VENUE_CLOSURES_AND_BLACKOUTS.MD) — closures and affected-booking flow
- [Waivers and consent](../../../domain/specifications/WAIVERS_AND_CONSENT.MD) — waiver documents and versioning
- [Business Profile Pages](../../../domain/specifications/BUSINESS_PROFILE_PAGES.MD) — profile content and publish states
- [Business onboarding and verification](../../../domain/specifications/BUSINESS_ONBOARDING_AND_VERIFICATION.MD) — owner-vs-manager policy map
- [Sport-agnostic principles](../../../domain/specifications/SPORT_AGNOSTIC_PRINCIPLES.MD) — activities as optional configuration

## Deliverables

- **Business profile**: profile fields, images, activity list, linked venues, owner-selected public contact details, publish/unpublish lifecycle, and slug with permanent redirects on rename. Only published content reaches public reads.
- **Venues and resources**: venues under a business; bookable resources with activity associations. Activities are lightweight, sport-agnostic configuration — no sport-specific data or rules are required by shared flows.
- **Operating settings**: operating hours, reservation durations, start-time increments, turnover buffers (10-minute court default, overridable including zero), booking horizons, and prices. Settings resolve through the precedence chain platform default → business → venue → resource/activity; the model must support layered overrides since the precedence rule is set per setting.
- **Facility Use Rules**: rules scoped to business, venue, activity, or resource; public vs internal marking; create/edit/publish/unpublish. Internal rules never reach public reads. A text rule never changes availability, capacity, or price — structured settings do.
- **Closures/blackouts**: single, ranged, and recurring closures with a reason label. Creating a closure that overlaps existing bookings or events returns the affected records before save; keep/move/cancel handling is coordinated with [Booking](BOOKING.MD) and [Events](EVENTS.MD).
- **Waiver documents**: versioned waiver text scoped to business/venue/activity/resource; publish and retire; a text change creates a new version while earlier signed versions are retained. Recording consent is [Booking](BOOKING.MD)'s job.
- **Permission enforcement**: owners set rules and prices; managers maintain schedules and day-to-day data inside owner settings; staff read what operations need. Delegation flags gate each write — enforced here, surfaced in the venue portal.
- **Published contract**: the `published` flags and read projections that [Public content](PUBLIC_CONTENT.MD) exposes under `app.is_public`.
- Audit streams `profile.*`, `facility_rules.*`, `closure.*`, `waiver.*` on every mutation.

## Dependencies

- [Foundation](FOUNDATION.MD), [Tenant data](TENANT_DATA.MD) — pipeline, RLS, audit primitives.
- [Identity & access](IDENTITY_AND_ACCESS.MD) — the tenant these records belong to and the actor making changes.

## Acceptance checks

- Owner/manager/staff permission matrix holds on every settings write; delegation flags work.
- Buffer, increment, horizon, and price overrides resolve correctly through the precedence layers.
- Editing waiver text creates a new version; prior versions stay on record.
- Creating a closure over booked dates returns the affected list before save; internal rules and unpublished content never appear in public reads.
- RLS isolation and same-transaction audit writes verified for every new table.

## Open decisions

- Rule precedence across overlapping scopes and which rules require player acknowledgment — [Facility Use Rules](../../../domain/specifications/FACILITY_USE_RULES.MD).
- Closure internals: weather fast-path, recurring exceptions, internal-use reservations, event handling — [Venue closures](../../../domain/specifications/VENUE_CLOSURES_AND_BLACKOUTS.MD).
- Waiver acknowledgment method and guardian verification detail — [Waivers and consent](../../../domain/specifications/WAIVERS_AND_CONSENT.MD).
- Business Profile Page field list and publishing review — [open product decisions](../../../domain/specifications/OPEN_PRODUCT_DECISIONS.MD).
