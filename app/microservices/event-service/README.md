# Event Service

The event service owns event planning and the `event_db` database.

## Folder map

- `src/routes/` — registers event, slot, RSVP, voting, and finalization endpoints.
- `src/controllers/` — translates HTTP requests into event use cases and responses.
- `src/services/` — enforces event lifecycle, scheduling, voting, RSVP, and final-plan rules.
- `src/repositories/` — contains all `event_db` queries and transaction boundaries.
- `src/schemas/` — validates event payloads, coordinates, time slots, deadlines, votes, and responses; it does not define PostgreSQL tables.
- `src/auth.ts` — verifies Identity JWTs/JWKS and provides the authenticated identity.
- `src/index.ts` — composes Fastify and starts the service.

Expected implementation:

- Authenticate requests and verify squad membership through service boundaries.
- Implement event creation and listing, time-slot availability, RSVPs, suggestions, votes, and final-plan selection.
- Keep event-local foreign keys inside `event_db`; squad and user IDs remain external references.
- Put scheduling and voting invariants in services, not controllers or SQL-only conventions.
- Emit notification requests only after successful domain transactions.

The authenticated event endpoints persist events, slots, availability, suggestions, votes, RSVPs, and finalized plans in PostgreSQL. Database creation and migrations live centrally under `database/postgres/migrations/`.
