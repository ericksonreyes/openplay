# User personas

## Player / participant

A person looking for activities at one or more venues.

- Discovers venue offerings, makes private reservations, joins open-play sessions, and rents equipment with a booking or independently.
- Tracks booking, rental, and payment status and uses any active venue membership benefits.
- Can book as a guest without creating an account when guest checkout is enabled; contact details are still needed for confirmation and protected booking access.
- A membership is an entitlement of a player, not a separate user persona.

## Business Owner

The person who owns or runs the sports business and is accountable for its venues.

- In a single-company installation, administers the company's venues; in a multi-tenant deployment, administers only their own business and its venues.
- Controls business and venue settings, prices, payment methods, booking policies, membership plans, refund decisions, and staff assignments.
- Assigns venue managers and staff and delegates operational permissions.

## Venue manager

The person responsible for day-to-day operations at one or more assigned venues.

- Manages schedules, availability, reservations, open-play sessions, equipment inventory and rentals, and membership operations within the Business Owner's settings.
- May approve reservations or verify direct-transfer payments when authorized.
- Cannot change prices, payment methods, policies, staff assignments, or issue refunds by default.

## Venue staff

Front-desk or operations personnel who carry out delegated venue tasks.

- Handle player check-in, booking support, session operations, and equipment checkout and return.
- Can create, change, or cancel bookings only when delegated; direct-transfer verification also requires explicit authorization.
- Cannot change prices, policies, or payment methods or issue refunds by default.
- Can access only the venue operations and player/payment details needed for their assigned duties.

## Platform Administrator (multi-tenant deployments only)

An OpenPlay staff member responsible for operating the multi-tenant service, not for running a Business Owner's venues.

- Onboards, manages, suspends, or restores business accounts and maintains platform-wide settings.
- Can access tenant data across businesses only for an authorized support or administrative task; access must be purpose-limited and auditable.
- Has no routine access to venue transactions and does not change business-specific prices or policies, manage venue schedules, issue venue refunds, or verify direct transfers.

Business Owners are scoped to their own business; venue managers and staff are scoped to their assigned venues. Fine-grained delegation rules and Platform Administrator access and audit controls remain to be defined.
