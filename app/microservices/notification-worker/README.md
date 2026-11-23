# Notification Worker

The notification worker is an internal service for email and future notification delivery. It does not currently own a database.

## Folder map

- `src/routes/` — registers authenticated internal notification endpoints.
- `src/services/` — validates, deduplicates, queues, retries, and orchestrates notification delivery.
- `src/transports/` — adapts SMTP and future providers behind a provider-neutral interface.
- `src/schemas/` — validates notification payloads, recipients, templates, retry metadata, and results; it does not define database tables.
- `src/index.ts` — composes Fastify and starts the worker service.

Expected implementation:

- Accept only authenticated service-to-service requests.
- Validate notification payloads before enqueueing or sending.
- Keep delivery/retry behavior in services and SMTP integration in transports.
- Add idempotency and retry limits so duplicate events do not send duplicate mail.
- Return durable failure information to the caller or a future queue when delivery fails.
