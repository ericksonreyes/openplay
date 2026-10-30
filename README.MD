# OpenPlay

OpenPlay is a sport-agnostic platform concept for discovering and reserving courts and other activity spaces. It starts with pickleball, while aiming to support other sports and bookable activities without building sport-specific assumptions into the reservation core.

## What it’s for

Venues can make their spaces available for private reservations and open-play sessions, rent equipment with a booking or on its own, and offer venue-specific membership plans.

- **Private reservations:** Book a resource, such as a court or room, for a selected time.
- **Open play:** Join a scheduled session with a participant limit.

The goal is to give players a consistent way to find activities, make bookings, rent equipment, and use membership benefits, while giving venues a flexible way to manage their resources, sessions, rental inventory, and membership plans.

## Product direction

The core is intended to handle venues, bookable resources, availability, reservations, session capacity, and rentable equipment inventory. Sports and activities provide configuration around that shared foundation rather than requiring a separate booking system for each one.

Players use form-based search and inquiry by default. When a Business Owner enables it, the optional AI chatbot can answer typed or voice questions, read replies aloud, and prefill an unsaved booking form for the player to review and submit.

Where a Business Owner enables guest booking, players can book without creating an account; confirmation and booking access still use protected contact details.

The initial product scope is planned to include multiple venues, player and venue workflows, web and native mobile experiences, equipment rentals, venue-specific membership plans, and payment options that include GCash and Maya through integrated checkout or direct transfer, plus paying at the venue. Venues without gateway integrations can still accept direct transfers. OpenPlay is intended to support both single-company installations and multi-tenant deployments. Business Owners can configure membership benefits and booking policies; exact plan terms, policy values, and payment-provider details remain to be defined.

## Extensibility

Optional capabilities may be added as the product develops, such as skill-rating integrations, user wallets, and more advanced pricing. These are possibilities rather than requirements of the initial scope.