# Squad Service

The squad service owns squad membership and the `squad_db` database.

Expected implementation:

- Authenticate every protected request with Identity JWKS.
- Implement squad creation, listing, joining, leaving, and membership-role changes.
- Keep SQL in repositories and business rules in services.
- Treat auth user IDs as external references; do not query `auth_db` directly.
- Enforce join-code uniqueness, membership authorization, and transaction boundaries.

The current endpoints are authenticated scaffolds and return `501` until this layer is implemented.
