# Squad Service

The squad service owns squad membership and the `squad_db` database.

## Folder map

- `src/routes/` — registers squad and membership HTTP endpoints.
- `src/controllers/` — translates requests into squad use-case calls and responses.
- `src/services/` — enforces membership, join-code, role, and authorization rules.
- `src/repositories/` — contains all `squad_db` queries for squads and memberships.
- `src/schemas/` — validates squad payloads, join codes, identifiers, and response contracts; it does not define PostgreSQL tables.
- `src/auth.ts` — verifies Identity JWTs/JWKS and exposes the authenticated identity to handlers.
- `src/index.ts` — composes Fastify and starts the service.

## API

Every endpoint needs an identity token (cookie or `Authorization: Bearer`). The
token subject must be the auth-service user ID. Errors return
`{ "error", "requestId" }`, plus `field` or `code` where it helps the UI.

| Method and path | Purpose | Responses |
| --- | --- | --- |
| `GET /api/squads` | The caller's Squads, newest membership first | `200 { squads }` |
| `POST /api/squads` | Create `{ name, emoji? }`; caller becomes owner | `201 { squad }`, `400` |
| `POST /api/squads/join` | Join `{ code }` (case-insensitive) | `201 { squad, joined: true }`, `200 { squad, joined: false }` if already a member, `400` malformed code, `404` unknown code |
| `GET /api/squads/:squadId` | One Squad the caller belongs to | `200 { squad }`, `404` |
| `DELETE /api/squads/:squadId/membership` | Leave a Squad | `200 { left, squadDeleted }`, `404`, `409 OWNER_MUST_TRANSFER` |

A `squad` matches the UI's `Squad` type (`id`, `name`, `emoji`, `code`,
`memberIds`, `createdBy`) plus `role`, `memberCount`, and `createdAt`.

## Rules

- Names are 1–40 characters; emoji up to 16 characters (default 👥).
- Invite codes are six letters without I or O, unique, and generated with
  `crypto.randomInt`. A collision is retried up to five times.
- Exactly one owner per Squad (partial unique index). An owner can only leave
  when they are the last member, which deletes the Squad. Ownership transfer is
  not implemented yet.
- Leaving locks the Squad row (`FOR UPDATE`) and joining takes a share lock, so
  a join can't land in a Squad that is being deleted.
- `404` is returned both for missing Squads and for Squads the caller isn't in.
- Auth user IDs are external references; this service never queries `auth_db`.

Migrations live under `database/postgres/migrations/squad/`.
