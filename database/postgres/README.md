# PostgreSQL

PostgreSQL is hosted on the local server and is not created or persisted by the application containers.

Set `DATABASE_URL` for the microservices, then apply migrations from the repository root:

```bash
npm --prefix app/microservices/auth-service run migrate
```

The migration files are versioned in `database/postgres/migrations/`. Database credentials and data stay outside Git.
