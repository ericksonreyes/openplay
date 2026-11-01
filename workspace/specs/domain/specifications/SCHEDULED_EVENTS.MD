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
- Each event defines its team-size limits, who can add or change the roster, and when roster changes close; OpenPlay sets no universal team size. Players or team captains can register while registration is open and capacity remains.
- Guest registration follows the guest-booking rules when enabled. Event charges use the supported payment methods and payment-verification flows.
- Registration is processed atomically so concurrent requests cannot exceed the configured capacity or create duplicate registrations.

## Waitlists

- A Business Owner can enable a waitlist for an event after its organizer sets an offer response deadline.
- When enabled, a player can join the queue after registration capacity is reached. A waitlisted player does not occupy event capacity or owe a fee.
- When a place becomes available, OpenPlay offers it to the next eligible player in queue order. The player must accept before the event's deadline through the normal registration flow; waitlisting does not silently register or charge them.
- Eligibility for group or team registrations remains to be defined.

## Entry fees and payment timing

- Business Owners set a default entry-fee basis for their business before the first paid event. Paid events inherit it unless the Business Owner or a delegated organizer overrides it for that event; the basis can be per participant, group seat, team, or event. An event can also be marked free.
- Business Owners set the entry fee for each event. Venue managers may adjust event-level fees only when explicitly delegated.
- Each event can require full payment before confirmation, require a deposit before confirmation, or allow payment later by a venue-set due time or at the venue.
- When upfront payment or a deposit is required, registration remains pending while a temporary place hold is active. The system confirms registration only after the required payment is verified; failed or expired payment releases the place.
- When payment is due later, the confirmed registration shows the amount and due time and follows the venue's payment grace and no-show policies.

Open Play is the first fully specified format and uses individual registration with a participant limit. The event core can represent other formats, such as classes, clinics, tournaments, or leagues, without adding sport-specific rules to shared booking logic. Events may use configurable recurrence patterns, date exceptions, and edits to a full series or a selected occurrence.

## Basic results and standings

- Competitive events can enable basic standings; non-competitive events can leave them off.
- Authorized event organizers enter or correct results for individual players or teams.
- Each competitive event selects or configures its own scoring and ranking rules, and OpenPlay calculates standings from recorded results. OpenPlay sets no universal sport-scoring preset.
- Standings are shown only to users permitted by the event's visibility rules.
- This feature does not add external ratings, automatic score capture, or one universal scoring system for every sport.

## Open event design details

The initial scope includes recurring series, event waitlists, and individual, group, and team registration. Exact recurrence patterns, exception handling, group/team waitlist eligibility, team-size bounds and roster rules, group/team capacity counting, scoring tie-breaks, result corrections, and standings visibility remain to be defined.
