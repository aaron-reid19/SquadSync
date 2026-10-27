# Architecture

## Current application flow

```text
Browser
  │
  ▼
Next.js UI container
  │ /api/* rewrite
  ▼
API gateway container
  ├── /api/auth/*       ─────► Auth service container ─────► PostgreSQL
  ├── /api/identity/*   ─────► Identity service (JWT/JWKS)
  ├── /api/squads/*     ─────► Squad service
  ├── /api/events/*     ─────► Event service
  └── /api/chat/*       ─────► Chat service / WebSocket
                                      │
                                      └──────────────► PostgreSQL on the home server
```

The UI and services are separate deployable units. The UI never connects directly to PostgreSQL. The API gateway is the only API entry point exposed to the UI and routes requests to internal services.

`auth-service` is the existing credential-authentication service migrated from the former SQLite server. `identity-service` is intentionally separate and owns the JWT/JWKS identity contract. The squad, event, and chat services have authenticated Fastify scaffolds, while notification delivery is an internal worker scaffold.

## Target home-server architecture

```text
Git repository
     │ manifests and image versions
     ▼
  Argo CD ───────────────► Kubernetes cluster on home server
                                │
                                ├── Next.js UI pod(s)
                                ├── API gateway pod(s)
                                └── Microservice pod(s)
                                      │
                                      └────► PostgreSQL hosted directly
                                             on the home server
```

Kubernetes will run the application workloads while PostgreSQL remains outside the cluster and outside the application containers. Services will receive the database connection through `DATABASE_URL` and server-managed secrets.

Each workload will define readiness and liveness probes. Readiness controls whether a pod receives traffic; liveness allows Kubernetes to restart a stuck process. The gateway and all service scaffolds expose `/health` and `/ready` endpoints that can be used by their probes.

Argo CD will watch the Kubernetes manifests in Git, report synchronization and resource health, and reconcile the home-server cluster to the desired state. CI will build and publish immutable image tags; approved image changes will be represented in the Git-managed Kubernetes manifests.

## Planned repository layout

```text
k8s/
├── base/                    # Shared workloads, services, probes, and config
└── overlays/home-server/    # Home-server settings and image versions
argocd/                      # Argo CD Application definitions
```

The migration from Docker Compose to Kubernetes is incremental: stabilize images and health checks first, add the Kubernetes base and home-server overlay, then connect those manifests to Argo CD.

## Cloudflare edge

The public request path will use the domain through Cloudflare:

```text
Browser
  │
  ▼
Cloudflare public hostname
  │ outbound Cloudflare Tunnel
  ▼
Kubernetes ingress
  ├── /          ─────► Next.js UI Service
  └── /api/*     ─────► API gateway Service
                              │
                              └──► Internal microservice Services
```

The tunnel connector (`cloudflared`) will run on the home-server network, preferably as a Kubernetes workload, and will make outbound connections to Cloudflare. No direct inbound application port should be required on the home-server firewall. The API gateway and microservices remain internal; browser API calls still enter through the gateway route.
