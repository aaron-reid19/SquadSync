# Auth Service

The auth service owns account authentication and the `auth_db` database.

## Folder map

- `src/routes/` — registers authentication endpoints and connects them to controllers.
- `src/controllers/` — translates Express requests and service results into HTTP responses.
- `src/services/` — implements signup, login, logout, Google login, password reset, session policy, and Identity token exchange.
- `src/repositories/` — contains all `auth_db` queries for users, profiles, sessions, and password resets.
- `src/schemas/` — validates request bodies, query parameters, and response contracts; it does not create database tables.
- `src/middleware/` — contains CSRF, rate limiting, cookie, and shared error-handling behavior.
- `src/db.ts` — owns the PostgreSQL pool and low-level database connection setup.
- `src/mailer.ts` — adapts the configured mail provider for password-reset delivery.
- `src/index.ts` — composes the Express application and starts the service.
- `src/seedDemo.ts` — idempotently creates the admin test account and sample PostgreSQL workspace.

Expected implementation:

- Handle signup, password login, logout, current-user lookup, Google login, CSRF, and password reset flows.
- Store users, profiles, sessions, and password-reset records through repositories only.
- Keep password hashing, session creation, and token exchange in services/use cases.
- Validate every request and response with schemas before calling application logic.
- Complete the planned internal exchange with `identity-service` so successful login receives a signed identity token.

Routes should stay thin: route → controller → service → repository. Database creation and migrations live centrally under `database/postgres/migrations/`.
