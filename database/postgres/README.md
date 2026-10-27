# PostgreSQL

PostgreSQL is hosted directly on the home server and is not created or persisted by the application containers or Kubernetes workloads.

Set `DATABASE_URL` for the microservices, then apply migrations from the repository root:

```bash
npm --prefix app/microservices/auth-service run migrate
```

The migration files are versioned in `database/postgres/migrations/`. Database credentials and data stay outside Git.

In the Kubernetes deployment, services receive the connection through `DATABASE_URL` from a server-managed Secret. Migrations should run as an explicit release step or a Kubernetes Job before application workloads are marked ready.

PostgreSQL is not exposed through the public Cloudflare hostname. Cloudflare routes web traffic to the Kubernetes ingress; database traffic stays on the home-server network.
