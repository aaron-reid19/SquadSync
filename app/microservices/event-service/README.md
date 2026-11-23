# Event Service

The event service owns event planning and the `event_db` database.

Expected implementation:

- Authenticate requests and verify squad membership through service boundaries.
- Implement event creation and listing, time-slot availability, RSVPs, suggestions, votes, and final-plan selection.
- Keep event-local foreign keys inside `event_db`; squad and user IDs remain external references.
- Put scheduling and voting invariants in services, not controllers or SQL-only conventions.
- Emit notification requests only after successful domain transactions.

The current endpoints are authenticated scaffolds and return `501` until this layer is implemented.
