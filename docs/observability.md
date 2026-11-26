# Logging and request tracing

## Request IDs

Every request gets an `x-request-id`:

1. The API gateway reuses a well-formed incoming `x-request-id`
   (8–128 characters of `A–Z a–z 0–9 . _ : -`) or generates a UUID.
2. The gateway forwards it to the upstream service, including chat WebSocket upgrades.
3. Each service uses the same ID for its own logs and echoes it in the
   `x-request-id` response header.
4. Error bodies include `requestId`, so a user-reported error can be matched
   to the logs.

To follow one request across services, search the logs for its ID:

```bash
docker compose -f deploy/compose.yaml logs | grep '"reqId":"<id>"'
for d in api-gateway auth-service squad-service event-service chat-service; do
  kubectl -n squadsync logs deploy/$d | grep '<id>'
done
```

## Log format

All services write one JSON object per line with pino's field names:
`level` (30 info, 40 warn, 50 error), `time`, `service`, `reqId`, `msg`.
Fastify services log through pino; the Express gateway and auth service use a
small logger with the same shape.

## What is never logged

- `Authorization`, `Cookie`, `x-internal-token`, and `x-service-token`
  headers (redacted in Fastify, never read in Express).
- Request bodies and query strings (they can carry passwords and reset tokens).
- Production email bodies (see [secrets.md](secrets.md)).

Clients receive generic `Something went wrong` messages for 5xx errors; details
stay in the server log.

## Probe noise

`/health` and `/ready` are called every few seconds by Docker and Kubernetes.
They are only logged when they fail (warn level and above in Fastify, 5xx in
Express).

The helpers live in `app/microservices/_shared/` and are copied into each
service by `scripts/sync-shared.sh`.

## Health and readiness

| Endpoint | Meaning | Used by |
| --- | --- | --- |
| `/health` | The process is running. Never checks dependencies. | Kubernetes liveness probe (restart on failure) |
| `/ready` | Required dependencies answer. `503` when a critical check fails. | Kubernetes readiness probe (traffic), Compose `healthcheck` / `depends_on` |

What each `/ready` checks:

| Service | Critical | Reported only |
| --- | --- | --- |
| api-gateway | — (no dependencies of its own) | — |
| auth-service | PostgreSQL | SMTP (`ok`, `failed`, or `not_configured`) |
| identity-service | signing keys loaded | — |
| squad / event / chat | PostgreSQL, identity JWKS has keys | — |
| notification-worker | — | SMTP configured |

The response body lists each check as `ok`, `failed`, or `not_configured`.
Failure reasons are logged at warn level and never returned to the caller.
Successful JWKS checks are cached for 30 seconds and SMTP checks for 60 seconds,
so probes do not hammer those dependencies. Each check times out after
`READINESS_TIMEOUT_MS` (default 2000 ms).

Kubernetes stops routing to a pod that is not ready and restarts a pod whose
liveness probe fails. Docker Compose does not restart unhealthy containers on
its own; every service uses `restart: unless-stopped` so crashed processes come
back, and `depends_on: condition: service_healthy` holds dependants until
`/ready` passes.
