# Scheduled events

A scheduled event is an organized activity at a venue that players register to attend. A private reservation books a resource directly; an event registration enrolls a person or team. Open Play is the first fully described event format.

## Event formats and schedule

- Business Owners, venue managers, and delegated staff can create, publish, manage, and cancel scheduled events.
- Each event has an activity, a venue-defined format, a schedule, a registration window, a numeric capacity limit and unit, price/payment rules, and status. The core does not restrict venues to a fixed list of sports or event formats.
- Events can be one-off or part of a recurring series. A series can use configurable repeat rules, date exceptions, and edits to the full series or a selected occurrence.
- An event may use one or more bookable resources. Each occurrence occupies its assigned resources for its scheduled time, including any configured buffer.
- Event details show whether registration is open, full, closed, cancelled, or complete.

## Registration and capacity

- Events support individual registration, group registration that reserves multiple seats, and named team registration with a roster.
- Each event sets a numeric limit for its capacity unit: individual participants, group seats, or teams. Registration and resource capacity are enforced separately.
- Players or team captains can register while registration is open and capacity remains. The event's rules control who can add or change a team roster.
- Guest registration follows the guest-booking rules when enabled. Event charges use the supported payment methods and payment-verification flows.
- Registration is processed atomically so concurrent requests cannot exceed the configured capacity or create duplicate registrations.

## Entry fees and payment timing

- Business Owners set an entry fee for each event or mark it free. Venue managers may adjust event-level fees only when explicitly delegated. The fee basis is configured for the event, such as per participant, group seat, team, or event.
- Each event can require full payment before confirmation, require a deposit before confirmation, or allow payment later by a venue-set due time or at the venue.
- When upfront payment or a deposit is required, registration remains pending while a temporary place hold is active. The system confirms registration only after the required payment is verified; failed or expired payment releases the place.
- When payment is due later, the confirmed registration shows the amount and due time and follows the venue's payment grace and no-show policies.

Open Play is the first fully specified format and uses individual registration with a participant limit. The event core can represent other formats, such as classes, clinics, tournaments, or leagues, without adding sport-specific rules to shared booking logic.

## Basic results and standings

- Competitive events can enable basic standings; non-competitive events can leave them off.
- Authorized event organizers enter or correct results for individual players or teams.
- Each competitive event uses configured scoring and ranking rules, and OpenPlay calculates standings from recorded results.
- Standings are shown only to users permitted by the event's visibility rules.
- This feature does not add external ratings, automatic score capture, or one universal scoring system for every sport.

## Open event design details

The initial scope includes recurring series and individual, group, and team registration. Exact recurrence patterns, exception handling, team-size and roster rules, capacity counting, scoring tie-breaks, result corrections, and standings visibility remain to be defined.
