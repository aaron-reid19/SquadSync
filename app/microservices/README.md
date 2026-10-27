# Microservices

Each child directory is an independently deployable service with its own package manifest, lockfile, environment example, and Dockerfile.

Current service:

- `api-gateway`: the single API entry point exposed to the UI; routes requests to internal services.
- `auth-service`: login, signup, sessions, Google sign-in, and password resets backed by PostgreSQL.

Planned boundaries are event management, chat, and notifications. They should be added as real services when their API and data ownership are defined, rather than as empty containers.
