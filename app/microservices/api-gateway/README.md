# API Gateway

The gateway is the single browser-facing API and WebSocket entry point. It owns transport routing only; it must not contain domain CRUD, business rules, or database queries.

## Folder map

- `src/routes/` — declares public `/api/*` and WebSocket path mappings.
- `src/proxy/` — forwards HTTP/WebSocket traffic and preserves required headers and cookies.
- `src/middleware/` — handles gateway-wide concerns such as request IDs, trusted proxies, limits, and error translation.
- `src/index.ts` — starts the gateway and composes the route, proxy, and middleware layers.

Expected implementation:

- `routes/` maps public `/api/*` paths to internal services.
- `proxy/` owns HTTP and WebSocket forwarding, headers, timeouts, and upstream errors.
- `middleware/` owns request IDs, trusted proxy handling, and gateway-wide request behavior.
- Keep authentication and authorization decisions in the destination service.

The gateway has no database. Database migrations live centrally under `database/postgres/migrations/`, not in this service.
