# SquadSync: Login

React + TypeScript (Vite) front end and an Express + SQLite back end.

## Structure
```
squadsync/
  src/                       FRONT END
    pages/LoginPage.tsx        layout only
    hooks/useLoginForm.ts      all login behaviour (validation, submit, cooldown, Google)
    components/                MapBackground, PasswordField, EyeIcons
    lib/validation.ts          client-side validation (friendly feedback)
    lib/auth.ts                API client (CSRF, timeout, generic errors)
    styles.css                 brand tokens + styles
  server/src/                BACK END
    index.ts                   app setup, Helmet, body limit, error handler
    auth.ts                    /api/auth: csrf, login, google, me, logout
    schemas.ts                 server-side validation (zod)
    db.ts                      SQLite tables: users, sessions
    seed.ts                    create a test user
```

## Run it
```bash
npm run install:all
cp .env.example .env                 # VITE_GOOGLE_CLIENT_ID
cp server/.env.example server/.env   # GOOGLE_CLIENT_ID (same value)
cd server && npm run seed -- test@squadsync.app "StrongPass123" && cd ..
npm run dev:all                      # web: http://localhost:5173  api: http://localhost:4000
```
Google: create a Web OAuth client, add `http://localhost:5173` as an authorized JavaScript origin.

## Security summary
- Passwords hashed with Argon2id; all queries parameterized
- Same generic error and similar timing for unknown email, wrong password and locked account
- 20 attempts per IP per 15 min; account locks 15 min after 5 failures
- Session token in an HttpOnly cookie, stored server-side only as a hash, renewed on every login
- CSRF token (cookie + header) on every POST
- Google ID token verified server-side (signature, audience, expiry, verified email)
- Server-side validation with zod, 10 KB body limit, Helmet headers, no error details leaked

## Before production
HTTPS (set `NODE_ENV=production` so cookies become `Secure`), `trust proxy` behind a proxy, hosted database, sign-up and password-reset flows, and a CSP that allows `accounts.google.com`.
