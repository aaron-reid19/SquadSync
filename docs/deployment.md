# Deployment

1. Build and publish the `nextjs-ui`, `api-gateway`, and `auth-service` images from CI.
2. Copy `deploy/.env.example` to `deploy/.env` on the local server and fill in the PostgreSQL and mail settings.
3. Apply database migrations from a machine that can reach PostgreSQL:

   ```bash
   npm --prefix app/microservices/auth-service run migrate
   ```

4. Start the application stack:

   ```bash
   docker compose -f deploy/compose.yaml up -d
   ```

PostgreSQL data and credentials stay outside the repository and outside the application containers.
