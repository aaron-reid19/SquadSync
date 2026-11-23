# API Gateway

The gateway is the single browser-facing API and WebSocket entry point. It owns transport routing only; it must not contain domain CRUD, business rules, or database queries.

Expected implementation:

- `routes/` maps public `/api/*` paths to internal services.
- `proxy/` owns HTTP and WebSocket forwarding, headers, timeouts, and upstream errors.
- `middleware/` owns request IDs, trusted proxy handling, and gateway-wide request behavior.
- Keep authentication and authorization decisions in the destination service.

The gateway has no database.
