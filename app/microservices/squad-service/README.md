# Squad Service

The squad service owns squad membership and the `squad_db` database.

## Folder map

- `src/routes/` — registers squad and membership HTTP endpoints.
- `src/controllers/` — translates requests into squad use-case calls and responses.
- `src/services/` — enforces membership, join-code, role, and authorization rules.
- `src/repositories/` — contains all `squad_db` queries for squads and memberships.
- `src/schemas/` — validates squad payloads, join codes, identifiers, and response contracts; it does not define PostgreSQL tables.
- `src/auth.ts` — verifies Identity JWTs/JWKS and exposes the authenticated identity to handlers.
- `src/index.ts` — composes Fastify and starts the service.

Expected implementation:

- Authenticate every protected request with Identity JWKS.
- Implement squad creation, listing, joining, leaving, and membership-role changes.
- Keep SQL in repositories and business rules in services.
- Treat auth user IDs as external references; do not query `auth_db` directly.
- Enforce join-code uniqueness, membership authorization, and transaction boundaries.

The current endpoints are authenticated scaffolds and return `501` until this layer is implemented. Database creation and migrations live centrally under `database/postgres/migrations/`.
