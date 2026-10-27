# Cloudflare deployment plan

Cloudflare will provide the public domain edge for the home-server deployment. The application should be published through Cloudflare Tunnel rather than exposing the Kubernetes services or home-server application ports directly.

## Target request path

```text
Browser
  │
  ▼
Cloudflare public hostname: app.<your-domain>
  │
  ▼
Cloudflare Tunnel (`cloudflared`)
  │
  ▼
Kubernetes ingress
  ├── /          ─────► Next.js UI Service
  └── /api/*     ─────► API gateway Service
                              │
                              └──► Internal microservice Services
```

The UI keeps using same-origin `/api/*` requests. The ingress sends those requests to the API gateway, and the gateway routes them to internal microservices. PostgreSQL is not part of the public request path.

## Planned setup

1. Add the domain to Cloudflare and delegate the domain's authoritative nameservers to Cloudflare at the registrar.
2. Create a named Cloudflare Tunnel for the home server.
3. Run `cloudflared` on the home-server network, preferably as a Kubernetes Deployment or other managed workload.
4. Store the tunnel token or credentials in a Kubernetes Secret and provide them to `cloudflared` at runtime.
5. Create a published hostname such as `app.<your-domain>` that routes to the Kubernetes ingress Service.
6. Configure the Kubernetes ingress routes:

   - `/` → the Next.js UI Service
   - `/api/*` → the API gateway Service

7. Keep the API gateway, microservices, and PostgreSQL private. Only the application hostname should be published through Cloudflare.
8. Add the tunnel workload and hostname configuration to the Git-managed Kubernetes manifests so Argo CD can reconcile them.

Cloudflare's published application route maps a public hostname to a local service through the tunnel. The tunnel uses outbound connections from `cloudflared`, so the home server does not need a direct inbound application port for the published hostname.

## Environment and secrets

The following values belong in server-managed secrets or environment configuration, not Git:

- Cloudflare Tunnel token or credentials
- `DATABASE_URL`
- Session and application secrets
- Mail provider credentials

The domain name can be added to the Kubernetes overlay once the final hostname is chosen. Until then, use `<your-domain>` as the placeholder in manifests and documentation.

## References

- [Cloudflare Tunnel](https://developers.cloudflare.com/tunnel/)
- [Cloudflare published applications](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/)
- [Cloudflare DNS proxy status](https://developers.cloudflare.com/dns/proxy-status/)
