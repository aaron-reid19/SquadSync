# Identity Service

The identity service is a stateless JWT issuer and JWKS provider. It does not currently own a database.

Expected implementation:

- Load persistent RSA signing keys from Kubernetes Secrets.
- Issue short-lived access tokens for trusted internal callers.
- Publish the public verification key at the JWKS endpoint.
- Validate issuer, audience, expiry, and signing algorithm consistently.
- Keep token issuance and verification in services, not route handlers.

An identity database should only be introduced for future refresh tokens, revocation, device sessions, key metadata, or audit records.
