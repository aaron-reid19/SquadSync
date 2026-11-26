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
