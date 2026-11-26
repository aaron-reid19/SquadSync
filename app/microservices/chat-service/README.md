# Chat Service

The chat service owns event conversations and the `chat_db` database.

## Folder map

- `src/routes/` — registers REST endpoints for rooms and message history.
- `src/controllers/` — translates REST requests into chat use cases and responses.
- `src/services/` — enforces room membership, message authorization, persistence, and broadcast coordination.
- `src/repositories/` — contains all `chat_db` queries for rooms, members, and messages.
- `src/schemas/` — validates room actions, message bodies, pagination, and WebSocket envelopes; it does not define PostgreSQL tables.
- `src/websocket/` — owns connection authentication, room subscriptions, message receipt, broadcast, disconnect, and reconnect behavior.
- `src/auth.ts` — verifies Identity JWTs/JWKS for REST and WebSocket requests.
- `src/index.ts` — composes Fastify/WebSocket plugins and starts the service.

Expected implementation:

- Authenticate both REST requests and WebSocket upgrades with Identity.
- Implement room creation/listing, membership checks, message history, and message persistence.
- Keep message and room SQL in repositories and authorization rules in services.
- Use the WebSocket layer for connection lifecycle and delivery, not database rules.
- Support reconnects, ordered message timestamps, and safe broadcast behavior.

The REST and WebSocket handlers persist event chat messages in PostgreSQL. Database creation and migrations live centrally under `database/postgres/migrations/`.
