# OpenPlay

OpenPlay is a sport-agnostic platform concept for discovering and reserving courts and other activity spaces. It starts with pickleball, while aiming to support other sports and bookable activities without building sport-specific assumptions into the reservation core.

## What it’s for

Venues can offer private reservations and scheduled events, with Open Play as the first defined event format. Business Owners can publish public Business Profile Pages for their venues and events and set Facility Use Rules. Venues can also rent equipment with a booking or on its own and offer membership plans that can cover selected venues or all venues in the business.

- **Private reservations:** Book a resource, such as a court or room, for a selected time.
- **Scheduled events:** Register for an organized venue activity. Open Play is the first defined event format.

The goal is to give players a consistent way to find activities, make bookings, register for events, rent equipment, and use membership benefits, while giving venues a flexible way to manage resources, event schedules, rental inventory, membership plans, public business profiles, and facility-use rules.

## Product direction

The core is intended to handle venues, bookable resources, availability, reservations, event schedules and capacity, rentable equipment inventory, and public Business Profile Pages. Sports and activities provide configuration around that shared foundation rather than requiring a separate booking system for each one.

Players use form-based search and inquiry by default. When a Business Owner enables it, the optional AI chatbot can answer typed or voice questions, read replies aloud, and prefill an unsaved booking form for the player to review and submit.

Where a Business Owner enables guest booking, players can book without creating an account; confirmation and booking access still use protected contact details.

The initial product scope is planned to include multiple venues, responsive web workflows for players and venue teams, search and discovery, transactional notifications, business onboarding, scheduled events, equipment rentals, business membership plans for selected or all venues, public Business Profile Pages, and payment options that include GCash and Maya through integrated checkout or direct transfer, plus paying at the venue. Native iOS and Android apps are deferred until usage shows they are needed. Venues without gateway integrations can still accept direct transfers. OpenPlay is intended to support both single-company installations and multi-tenant deployments. Business Owners can configure membership benefits and booking policies; exact plan terms, policy values, and payment-provider details remain to be defined.

## Extensibility

Optional capabilities may be added as the product develops, such as skill-rating integrations, user wallets, and more advanced pricing. These are possibilities rather than requirements of the initial scope.