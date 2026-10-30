# Notifications implementation plan

The `notifications` module plus the `reminder-worker` process: transactional updates and reminders for players, guests, and venue teams. PostgreSQL holds every notification and reminder record — the database is the source of truth; the worker only claims and sends. A notification never changes business state.

## Sources

- [Notifications](../../../domain/specifications/NOTIFICATIONS.MD) — coverage, delivery rules, message privacy
- [ADR-0003](../../decisions/0003-docker-local-development.MD) — worker container, Mailpit, `SKIP LOCKED` claiming, `notifications` profile
- [Audit logging](../../security/AUDIT_LOGGING.MD) — arrival/terminal-failure event semantics
- [Test scenarios](../../../testing/TEST_SCENARIOS.MD) — reminder and delivery cases

## Deliverables

- **Notification records**: created in the same transaction as the triggering change (or via a transactional outbox), each with an idempotency key, `due_at`, status, channel, and recipient reference. Message content carries a link to the relevant page — never private booking, guest, or payment details.
- **`reminder-worker`**: a separate process with its own `docker/reminder-worker.Dockerfile`, running `npm run worker:dev` under the `notifications` Compose profile. The scan loop claims due reminders with `SELECT ... FOR UPDATE SKIP LOCKED` inside a transaction, so two replicas never take the same row; verifies the parent booking/event is still active; sends; records the delivery result. A terminal failure commits `reminder.status = 'failed'` plus a `reminder.failed` event in the catch's own transaction.
- **Scheduler discipline**: only the worker runs the reminder scheduler — the API process must not start a second one. `@nestjs/schedule` can drive the poll; no in-memory-only timers, because a container restart must not lose reminders. A queue like BullMQ can replace polling later if volume justifies it.
- **Channels**: in-app notices always; email via SMTP — Mailpit locally (SMTP internal-only, web UI on `127.0.0.1:8025`); SMS deferred behind a test adapter that records messages. No real providers in the local profile.
- **Templates** per event type: booking/event confirmation, pending status, change, cancellation; payment status and due-time updates (transfer verification results, checkout expiry); reminders for upcoming reservations and events, schedule changes, equipment pickup/return deadlines; venue alerts for new reservations/registrations, transfer evidence awaiting review, cancellations, and operational deadlines.
- **Alert routing**: venue alerts reach owners, managers, and delegated staff by venue assignment.
- **Dedup and status**: delivery status recorded per send; repeated triggers or callbacks never produce duplicate messages; a failed send never mutates booking, payment, event, or rental state.
- Audit: `reminder.failed` events and arrival events where an external trigger applies.

## Dependencies

- [Foundation](FOUNDATION.MD), [Tenant data](TENANT_DATA.MD) — worker context (`app.is_system`) and audit primitives.
- [Booking](BOOKING.MD), [Events](EVENTS.MD), [Commerce](COMMERCE.MD) — create reminder/notification rows inside their own transactions.

## Acceptance checks

- A due reminder delivers through Mailpit; a cancelled booking's reminder is skipped; a restarted worker resumes pending sends.
- `docker compose --profile notifications up -d --scale reminder-worker=2` never double-sends.
- A repeated trigger or callback sends no duplicate; a failed send records status without touching business state.
- Message bodies contain links, not private details.

## Open decisions

- Delivery channels and providers beyond local Mailpit, reminder timing, retry limits, user preferences and consent, message language — tracked in [Notifications](../../../domain/specifications/NOTIFICATIONS.MD).
