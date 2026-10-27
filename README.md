# SquadSync

SquadSync is a Next.js UI backed by independently deployable services. The current deployment path uses Docker, with Kubernetes on the home server as the target runtime. PostgreSQL will remain hosted directly on the home server; application workloads connect to it through `DATABASE_URL`.

## Repository layout

```text
app/
├── nextjs-ui/                  # Next.js frontend
└── microservices/
    ├── api-gateway/            # Single HTTP and WebSocket entry point
    ├── auth-service/           # Credential authentication and account flows
    ├── identity-service/       # JWT issuer, JWKS, and identity contract
    ├── squad-service/          # Squad boundary scaffold
    ├── event-service/          # Event and voting boundary scaffold
    ├── chat-service/           # Authenticated chat and WebSocket scaffold
    └── notification-worker/    # Internal notification delivery scaffold
database/postgres/              # PostgreSQL migrations and database notes
deploy/                         # Docker Compose and deployment environment examples
```

The planned Kubernetes layout will add GitOps manifests alongside the application code:

```text
k8s/                            # Planned Kubernetes manifests
├── base/                        # Shared deployments, services, probes, and config
└── overlays/home-server/        # Home-server settings and image versions
argocd/                          # Planned Argo CD Application definitions
```

The identity, squad, event, chat, and notification services now have deployable Fastify scaffolds. Their domain persistence and business workflows are intentionally not implemented yet; scaffold endpoints return `501` until their contracts are built. The current UI still uses its seeded browser demo store for event, chat, and notification features.

All browser API requests go to `api-gateway`. It routes `/api/auth/*` to `auth-service`, `/api/identity/*` to `identity-service`, `/api/squads/*` to `squad-service`, `/api/events/*` to `event-service`, and `/api/chat/*` plus chat WebSocket upgrades to `chat-service`.

## Planned AI recommendations

SquadSync will eventually add a separate `recommendation-service` that ranks personalized event suggestions using event history, votes, attendance, member preferences, and availability. Deterministic application rules will enforce hard constraints such as availability, travel distance, and venue eligibility; AI will provide ranking, alternatives, and explanations rather than making authoritative scheduling decisions.

The recommendation service will consume approved event data through service APIs or future events instead of reading another service's database directly. It will be added as an independently deployable Fastify workload and routed through the API gateway when its contract and supporting domain persistence are implemented. This service is currently planned and does not exist in the repository yet.

## Local development

Prerequisites: Node.js 22+ and a reachable PostgreSQL instance.

```bash
npm run install:all
cp app/microservices/auth-service/.env.example app/microservices/auth-service/.env
npm --prefix app/microservices/auth-service run migrate
npm run dev:all
```

The UI runs at <http://localhost:3000>, the API gateway at <http://localhost:4000>, and the auth service at <http://localhost:4001>.

The demo UI login is `admin / password`. Its current squads, events, voting, and chat data are stored in browser localStorage until those APIs are implemented.

## Docker

PostgreSQL is intentionally external to Docker because it is hosted on the local server.

```bash
cp deploy/.env.example deploy/.env
docker compose -f deploy/compose.yaml up --build
```

The Compose setup runs the Next.js UI, API gateway, authentication, identity, squad, event, chat, and notification scaffolds. The planned recommendation service is not included yet. It connects PostgreSQL-backed services using the `DATABASE_URL` in `deploy/.env`.

Docker Compose is the interim deployment target for local development and initial home-server deployments. It keeps PostgreSQL outside the application stack because the database is hosted directly on the home server.

## Kubernetes and GitOps direction

The long-term deployment target is a Kubernetes cluster running on the home server:

- The Next.js UI, API gateway, and each implemented or planned microservice, including the future recommendation service, will run as independently deployable Kubernetes workloads.
- PostgreSQL will run directly on the home server, outside the Kubernetes application workloads. Database credentials will be provided through server-managed secrets and `DATABASE_URL`.
- Kubernetes readiness and liveness probes will use service health endpoints so traffic is sent only to ready pods and unhealthy pods are restarted when needed.
- Cloudflare will be the public edge. A Cloudflare Tunnel will route the domain to the Kubernetes ingress without exposing the home server's application ports directly.
- Argo CD will watch the Kubernetes manifests in Git, report sync and resource health, and reconcile the home-server cluster to the desired state.
- CI will build, test, and publish immutable Docker image tags. Argo CD will then deploy approved image changes through Git-managed manifests.

Argo CD reports the health of Kubernetes resources, while Kubernetes probes determine whether an application pod is ready to receive traffic or needs to be restarted. The gateway and auth service already expose `/health` endpoints that can become Kubernetes probes.

The migration from Compose to Kubernetes will be incremental: stabilize the Docker images and health checks first, add Kubernetes base manifests and a home-server overlay, then connect those manifests to Argo CD.

## Domain and Cloudflare

The production hostname will be managed through Cloudflare. The planned request path is:

```text
Browser → Cloudflare → Cloudflare Tunnel → Kubernetes ingress → Next.js UI
                                                        └── /api/* → API gateway
```

Only the application hostname should be public. The API gateway and microservices remain internal to the cluster, and PostgreSQL remains reachable only from the home server and authorized workloads. See [the Cloudflare deployment plan](docs/cloudflare.md).

## Database migrations

```bash
npm --prefix app/microservices/auth-service run migrate
npm --prefix app/microservices/auth-service run seed -- you@example.com "AtLeast8Chars"
```

Migration files live in `database/postgres/migrations/`. Never commit database credentials or PostgreSQL data files.

## CI/CD

The intended pipeline is:

1. Install the UI and service lockfiles with `npm ci`.
2. Type-check both packages.
3. Build the Next.js application.
4. Build the UI, gateway, authentication, identity, squad, event, chat, and notification images. Add the recommendation-service image after that service is implemented.
5. Publish immutable, versioned images from the main branch.

During the transition, deployment to the local server will pull those images and run the Compose file with the server's environment file. The final workflow will update the Kubernetes manifests, after which Argo CD will synchronize the home-server cluster and report deployment health.
