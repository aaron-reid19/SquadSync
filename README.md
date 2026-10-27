# SquadSync

SquadSync is a Next.js UI backed by independently deployable services. PostgreSQL is hosted on the local server; application containers connect to it through `DATABASE_URL`.

## Repository layout

```text
app/
├── nextjs-ui/                  # Next.js frontend
└── microservices/
    ├── api-gateway/            # Single API entry point for the UI
    └── auth-service/           # Express authentication service
database/postgres/              # PostgreSQL migrations and database notes
deploy/                         # Docker Compose and deployment environment examples
```

The event, chat, and notification services are planned boundaries. The current UI still uses its seeded browser demo store for those features while their APIs are built.

All browser API requests go to `api-gateway`. The gateway currently routes `/api/auth/*` to `auth-service` and is the extension point for future services.

## Local development

Prerequisites: Node.js 22+ and a reachable PostgreSQL instance.

```bash
npm run install:all
cp app/microservices/auth-service/.env.example app/microservices/auth-service/.env
npm --prefix app/microservices/auth-service run migrate
npm run dev:all
```

The UI runs at <http://localhost:3000>, the API gateway at <http://localhost:4000>, and the auth service at <http://localhost:4001>.

The demo UI login is `admin / password`. Its current squads, events, voting, and chat data are stored in browser localStorage until those APIs are implemented.

## Docker

PostgreSQL is intentionally external to Docker because it is hosted on the local server.

```bash
cp deploy/.env.example deploy/.env
docker compose -f deploy/compose.yaml up --build
```

The Compose setup runs the Next.js UI, API gateway, and auth service. It connects to PostgreSQL using the `DATABASE_URL` in `deploy/.env`.

## Database migrations

```bash
npm --prefix app/microservices/auth-service run migrate
npm --prefix app/microservices/auth-service run seed -- you@example.com "AtLeast8Chars"
```

Migration files live in `database/postgres/migrations/`. Never commit database credentials or PostgreSQL data files.

## CI/CD

The intended pipeline is:

1. Install the UI and service lockfiles with `npm ci`.
2. Type-check both packages.
3. Build the Next.js application.
4. Build both Docker images.
5. Publish versioned images from the main branch.

Deployment to the local server should pull those images and run the Compose file with the server's environment file.
