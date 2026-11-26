# Deployment

SquadSync has two deployment phases. Docker Compose is the current deployment path; Kubernetes, Argo CD, and Cloudflare are the target home-server platform.

## Current Docker Compose deployment

1. Build and publish the `nextjs-ui`, `api-gateway`, `auth-service`, `identity-service`, `squad-service`, `event-service`, `chat-service`, and `notification-worker` images from CI.
2. Copy `deploy/.env.example` to `deploy/.env` on the home server and fill in the PostgreSQL and mail settings.
3. Apply database migrations for each service database from a machine that can reach PostgreSQL
   (see [database/postgres/README.md](../database/postgres/README.md)):

   ```bash
   docker build -f database/postgres/migrations/Dockerfile -t squadsync-migrations .
   docker run --rm -e MIGRATION_SERVICE=auth  -e DATABASE_URL="$AUTH_DATABASE_URL"  squadsync-migrations
   docker run --rm -e MIGRATION_SERVICE=squad -e DATABASE_URL="$SQUAD_DATABASE_URL" squadsync-migrations
   docker run --rm -e MIGRATION_SERVICE=event -e DATABASE_URL="$EVENT_DATABASE_URL" squadsync-migrations
   docker run --rm -e MIGRATION_SERVICE=chat  -e DATABASE_URL="$CHAT_DATABASE_URL"  squadsync-migrations
   ```

   Each service needs its own database, as in Kubernetes. Pointing all four at one
   database makes their version numbers collide (every service has a `001_…`), and
   the runner stops with a checksum error rather than skipping a migration.

4. Start the application stack:

   ```bash
   docker compose -f deploy/compose.yaml up -d
   ```

PostgreSQL data and credentials stay outside the repository and outside the application containers.

## Target Kubernetes deployment

The long-term target is a Kubernetes cluster running on the home server:

1. CI builds, tests, and publishes immutable Docker image tags.
2. Kubernetes manifests under `k8s/` define the UI, API gateway, microservices, Services, configuration, and readiness/liveness probes.
3. The `home-server` overlay sets image versions and environment-specific values.
4. PostgreSQL remains hosted directly on the home server. Connection credentials are stored as server-managed Kubernetes Secrets and exposed through `DATABASE_URL`.
5. Argo CD watches the repository's Kubernetes manifests and synchronizes the application to the cluster.
6. Argo CD reports sync status and resource health while Kubernetes uses probes to route traffic only to ready pods and restart unhealthy containers.

Argo CD Application definitions will live under `argocd/`. Secrets and PostgreSQL data must not be committed to Git.

The identity service requires persistent signing keys in server-managed Secrets. The chat service requires an ingress route that supports WebSocket upgrades; its REST and WebSocket traffic still enters through the API gateway.

## Cloudflare domain routing

The production domain should use a Cloudflare Tunnel to reach the Kubernetes ingress:

1. Add the domain to Cloudflare and manage its authoritative DNS there.
2. Create a Cloudflare Tunnel and run `cloudflared` on the home-server network, preferably as a Kubernetes workload.
3. Configure a published hostname such as `app.<your-domain>` to route to the Kubernetes ingress Service.
4. Configure the ingress so `/` routes to the Next.js UI and `/api/*` routes to the API gateway.
5. Store the tunnel token or credentials as a server-managed Kubernetes Secret; never commit them to Git.
6. Keep the gateway, microservices, and PostgreSQL private. Only the public application hostname should be reachable through Cloudflare.

Cloudflare Tunnel is preferred for this home-server deployment because the tunnel creates outbound connections from the server to Cloudflare instead of requiring direct inbound application ports. The exact hostname and ingress service address will be set once the domain and Kubernetes ingress controller are selected. See [cloudflare.md](cloudflare.md) for the detailed plan.

## Database migrations in Kubernetes

Migrations run as Argo CD Sync-hook Jobs (sync wave 10) before the application
Deployments (sync wave 20). A failed migration fails the sync and the previous
pods keep serving. Rules for writing migrations and the rollback runbook are in
[database/postgres/README.md](../database/postgres/README.md).
