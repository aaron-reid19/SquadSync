# Microservices

Each child directory is an independently deployable service with its own package manifest, lockfile, environment example, and Dockerfile.

Each service is intended to run as its own Docker image and, eventually, as its own Kubernetes workload on the home server. Every scaffold exposes `/health` and `/ready` for Kubernetes readiness and liveness probes.

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
