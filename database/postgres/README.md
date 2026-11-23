# PostgreSQL

PostgreSQL is managed by CloudNativePG in the Kubernetes cluster. The single-node
`pg-main` cluster uses the server's hostpath storage and owns four service databases:
`auth_db`, `squad_db`, `event_db`, and `chat_db`.

Each database has its own role, connection URL, and migration history. Auth owns
users, profiles, sessions, and password resets. Squad, event, and chat own their
domain tables. Cross-service IDs are application-level references rather than
cross-database foreign keys.

The migration image runs the service-owned SQL migrations:

```bash
docker build -f database/postgres/migrations/Dockerfile .
```

The Kubernetes migration Jobs use `MIGRATION_SERVICE` and the corresponding
`*_DATABASE_URL` Secret value. They are Argo CD sync hooks and are rerun when a
new sync occurs. Migration files are versioned under
`database/postgres/migrations/`; database credentials and data stay outside Git.

For local development, the existing auth-service migration command remains
available and uses the auth migration source.

PostgreSQL is not exposed through the public Cloudflare hostname. Cloudflare routes web traffic to the Kubernetes ingress; database traffic stays on the home-server network.
