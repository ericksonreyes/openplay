# Business onboarding and verification

This specification describes how a sports business joins OpenPlay and sets up its Business Owner, venues, and public offerings. Exact verification evidence and review steps remain open.

## Onboarding by installation type

- In a single-company installation, the installation is initialized with the company's business account and Business Owner. The Business Owner then adds venues, resources, activities, staff, policies, and payment options.
- In a multi-tenant service, a business account must be created or approved by a Platform Administrator before it can publish a Business Profile Page or accept public bookings.
- A Business Owner provides the public business details and confirms control of the account's contact method. Business and venue information remains unpublished until the business is active and the owner publishes it.
- The Business Owner sets up venues, activities, resources, schedules, booking and event rules, rental inventory, memberships, payment options, and staff assignments.
- Payment providers perform any merchant checks required for their integrated services. Direct-transfer account details and verification follow the venue payment rules.

## Business Owner-defined rules

The Business Owner is responsible for setting the rules that apply to the business and its venues. The detailed settings belong in the canonical specifications for each topic:

- Operating hours, resource durations, booking increments, buffers, booking horizons, and prices: [Venue resources and activities](VENUE_RESOURCES_AND_ACTIVITIES.MD).
- Facility-use house rules and their public display: [Facility Use Rules](FACILITY_USE_RULES.MD).
- Reservation changes, cancellations, no-shows, and refunds: [Private reservations](PRIVATE_RESERVATIONS.MD).
- Event formats, capacity, registration, results, and entry fees: [Scheduled events](SCHEDULED_EVENTS.MD).
- Payment methods, deposits, due times, and payment verification: [Platforms and payments](PLATFORMS_AND_PAYMENTS.MD).
- Equipment inventory, rental periods, pickup, and return: [Equipment rentals](EQUIPMENT_RENTALS.MD).
- Membership eligibility, benefits, and terms: [Memberships](MEMBERSHIPS.MD).
- Guest booking eligibility and access: [Guest booking](GUEST_BOOKING.MD).

Venue managers and staff work within the Business Owner's rules. They can change a rule only when the Business Owner delegates that authority. Players see the rules that apply before they submit a reservation, event registration, or rental. Public-facing house rules can appear on the Business Profile Page; internal policies and records remain private.

The precedence between platform defaults, business-wide settings, and venue-specific overrides must be defined for each setting.

## Verification and account states

- OpenPlay records whether a business is being set up, awaiting review, active, or suspended. Only active businesses can publish profiles and accept public bookings.
- In multi-tenant mode, Platform Administrators can approve or suspend business accounts. In a single-company installation, the designated installation administrator initializes the Business Owner account.
- Business Owners can invite or assign venue managers and staff within their business and venues.
- The evidence needed to verify business ownership or authority, approval criteria, and the exact invite or application flow remain open decisions.
