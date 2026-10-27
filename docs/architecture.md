# Architecture

```text
Browser
  │
  ▼
Next.js UI container
  │ /api/* rewrite
  ▼
API gateway container
  │ /api/auth/*
  ▼
Auth service container ───────► PostgreSQL on the local server
```

The UI and services are separate deployable units. The UI does not connect directly to PostgreSQL. Services own their API and persistence boundaries.

The initial service is `auth-service`, migrated from the former SQLite server. The gateway is the only API entry point exposed to the UI. Event, chat, and notification services can be added behind it under `app/microservices/` without moving the UI again.
