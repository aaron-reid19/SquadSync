# Notification Worker

The notification worker is an internal service for email and future notification delivery. It does not currently own a database.

Expected implementation:

- Accept only authenticated service-to-service requests.
- Validate notification payloads before enqueueing or sending.
- Keep delivery/retry behavior in services and SMTP integration in transports.
- Add idempotency and retry limits so duplicate events do not send duplicate mail.
- Return durable failure information to the caller or a future queue when delivery fails.
