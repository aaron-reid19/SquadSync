# Secrets and environment configuration

Secrets live outside Git. Development uses each service's `.env` (copied from
`.env.example`); Compose uses `deploy/.env`; Kubernetes uses server-managed
Secrets (`squadsync-app-secrets` and `squadsync-database-urls`).

## Development vs production

`NODE_ENV=production` is the switch. In production every service checks its
required settings at startup and **refuses to start** when one is missing or
still holds a placeholder from an `.env.example` (`change-me`,
`your-client-id…`, `example.com`). In development the same check only prints a
warning so `pnpm run dev:all` keeps working with defaults. Errors name the
variable, never its value.

The Kubernetes ConfigMap sets `NODE_ENV=production`, so a pod with a missing
Secret key crash-loops with a clear message instead of serving traffic in an
unsafe state.

## Required settings per service

| Service | Required in production | Optional |
| --- | --- | --- |
| auth-service | `DATABASE_URL`, `APP_URL` | `SMTP_URL`, `MAIL_FROM`, `GOOGLE_CLIENT_ID` |
| identity-service | `IDENTITY_ISSUER`, `IDENTITY_PRIVATE_KEY_PEM`, `IDENTITY_PUBLIC_KEY_PEM`, `IDENTITY_INTERNAL_TOKEN` | `IDENTITY_KEY_ID`, `ACCESS_TOKEN_TTL_SECONDS` |
| squad-service | `DATABASE_URL`, `IDENTITY_JWKS_URL`, `IDENTITY_ISSUER` | `DB_POOL_MAX`, `DATABASE_SSL` |
| event-service | `DATABASE_URL`, `IDENTITY_JWKS_URL`, `IDENTITY_ISSUER` | `DB_POOL_MAX`, `DATABASE_SSL` |
| chat-service | `DATABASE_URL`, `IDENTITY_JWKS_URL`, `IDENTITY_ISSUER` | `DB_POOL_MAX`, `DATABASE_SSL` |
| notification-worker | `SERVICE_TOKEN` | `SMTP_URL` |

Without `SMTP_URL`, auth-service prints emails to the terminal in development
only. In production it logs that the email could not be sent and never prints
the message body, because reset emails contain a one-time token.

## Generating values

```bash
# Internal tokens (IDENTITY_INTERNAL_TOKEN, SERVICE_TOKEN)
openssl rand -base64 32

# Identity signing keys
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out identity-private.pem
openssl rsa -in identity-private.pem -pubout -out identity-public.pem
```

Load the PEMs into the Secret and delete the local files. `*.pem` and `*.key`
are ignored by Git as a safety net, but they should not sit in the repository
folder at all.

## Shared helper

The startup check lives in `app/microservices/_shared/config.ts` and is copied
into each service's `src/shared/` (each image builds from its own folder). Edit
the `_shared` file, then run `scripts/sync-shared.sh`. CI runs
`scripts/sync-shared.sh --check` and fails if a copy has drifted.
