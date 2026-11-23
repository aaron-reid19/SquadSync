# Identity Service

The identity service is a stateless JWT issuer and JWKS provider. It does not currently own a database.

## Folder map

- `src/routes/` — registers JWKS, internal token, and identity inspection endpoints.
- `src/controllers/` — translates HTTP requests into identity service calls and responses.
- `src/services/` — loads signing keys, signs tokens, verifies claims, and builds JWKS responses.
- `src/schemas/` — validates internal token requests, scopes, and identity response contracts.
- `src/index.ts` — composes Fastify plugins and starts the service.

Expected implementation:

- Load persistent RSA signing keys from Kubernetes Secrets.
- Issue short-lived access tokens for trusted internal callers.
- Publish the public verification key at the JWKS endpoint.
- Validate issuer, audience, expiry, and signing algorithm consistently.
- Keep token issuance and verification in services, not route handlers.

An identity database should only be introduced for future refresh tokens, revocation, device sessions, key metadata, or audit records. There is intentionally no `repositories/` folder today, and database migrations do not belong in this service.
