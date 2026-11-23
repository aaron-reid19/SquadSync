# Auth Service

The auth service owns account authentication and the `auth_db` database.

Expected implementation:

- Handle signup, password login, logout, current-user lookup, Google login, CSRF, and password reset flows.
- Store users, profiles, sessions, and password-reset records through repositories only.
- Keep password hashing, session creation, and token exchange in services/use cases.
- Validate every request and response with schemas before calling application logic.
- Complete the planned internal exchange with `identity-service` so successful login receives a signed identity token.

Routes should stay thin: route → controller → service → repository.
