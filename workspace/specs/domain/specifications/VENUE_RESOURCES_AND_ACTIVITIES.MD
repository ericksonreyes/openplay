# Venue resources and activities

- A venue can publish bookable spaces or resources.
- Resources can be associated with the sports or activities offered at that venue.
- The shared reservation flow must not require pickleball-specific data or rules; activity-specific configuration should be optional.
- Each venue has a configured time zone. Players and venue staff see schedules in that local time; exact timestamps are stored in UTC and converted for display.
- Business Owners define operating hours, reservation durations, booking start-time increments, buffers, booking horizons, prices, and venue policies; managers maintain day-to-day schedules and availability within those settings. The owner-policy map is in [Business onboarding and verification](BUSINESS_ONBOARDING_AND_VERIFICATION.MD); operational house rules are covered in [Facility Use Rules](FACILITY_USE_RULES.MD).
- Court reservations have a default 10-minute turnover buffer after the scheduled end time; Business Owners can override it, including setting it to zero. Other resource types have a zero-minute default buffer, which Business Owners can change.
- The booking start-time grid is separate from the turnover buffer and is venue-configurable.
- Business Owners set standard prices for resources and events; managers do not change prices by default.
- Venue-specific values can override platform defaults; no single setting is imposed on every venue.
