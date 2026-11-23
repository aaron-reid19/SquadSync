# Microservices

Each child directory is an independently deployable service with its own package manifest, lockfile, environment example, and Dockerfile.

Each service is intended to run as its own Docker image and, eventually, as its own Kubernetes workload on the home server. Every scaffold exposes `/health` and `/ready` for Kubernetes readiness and liveness probes.

## Source layout

Database-backed services use the same request boundary:

```text
route → controller → service/use case → repository → database
```

Their source folders are organized as:

```text
src/
├── routes/          # HTTP route registration and request wiring
├── controllers/     # request/response handlers
├── services/        # business rules and use cases
├── repositories/    # SQL and database access
├── schemas/         # request and response validation
└── middleware/      # authentication and cross-cutting request behavior
```

The current service-specific scaffold is:

- `auth-service`: routes, controllers, services, repositories, schemas, middleware
- `identity-service`: routes, controllers, services, schemas; it remains stateless and has no repository layer
- `squad-service`: routes, controllers, services, repositories, schemas
- `event-service`: routes, controllers, services, repositories, schemas
- `chat-service`: routes, controllers, services, repositories, schemas, websocket
- `notification-worker`: routes, services, transports, schemas; it sends mail and has no database repository yet
- `api-gateway`: routes, middleware, and proxy; it does not contain domain CRUD or database access

Current services:

- `api-gateway`: the single HTTP and WebSocket entry point exposed to the UI; routes requests to internal services.
- `auth-service`: credential authentication, signup, sessions, Google sign-in, and password resets backed by PostgreSQL.
- `identity-service`: separate JWT issuer and JWKS boundary. It owns the identity-token contract; production signing keys must be persistent secrets.
- `squad-service`: authenticated squad and membership boundary scaffold.
- `event-service`: authenticated event, availability, RSVP, and voting boundary scaffold.
- `chat-service`: authenticated REST and WebSocket boundary scaffold for event conversations.
- `notification-worker`: internal service-to-service notification delivery scaffold.

The gateway and every scaffold expose `/health`. The gateway is the only service that should be exposed to the UI; internal services should be reachable through Kubernetes Services or the equivalent internal Docker network.

Cloudflare should route only to the Kubernetes ingress. It should not publish direct hostnames for the gateway, auth service, or PostgreSQL.

The identity service exposes `/.well-known/jwks.json` and an internal token scaffold endpoint. Business-service scaffolds validate bearer tokens or the identity cookie against the configured JWKS URL before handling protected routes. Do not use the scaffold token endpoint as a public login endpoint.
