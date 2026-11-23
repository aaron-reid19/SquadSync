# Chat Service

The chat service owns event conversations and the `chat_db` database.

Expected implementation:

- Authenticate both REST requests and WebSocket upgrades with Identity.
- Implement room creation/listing, membership checks, message history, and message persistence.
- Keep message and room SQL in repositories and authorization rules in services.
- Use the WebSocket layer for connection lifecycle and delivery, not database rules.
- Support reconnects, ordered message timestamps, and safe broadcast behavior.

The current REST and WebSocket handlers are scaffolds and do not persist messages yet.
