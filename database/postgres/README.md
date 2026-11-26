# PostgreSQL

PostgreSQL is managed by CloudNativePG in the Kubernetes cluster. The single-node
`pg-main` cluster uses the server's hostpath storage and owns four service databases:
`auth_db`, `squad_db`, `event_db`, and `chat_db`.

Each database has its own role, connection URL, and migration history. Auth owns
users, profiles, sessions, and password resets. Squad, event, and chat own their
domain tables. Cross-service IDs are application-level references rather than
cross-database foreign keys.

PostgreSQL is not exposed through the public Cloudflare hostname. Cloudflare routes web traffic to the Kubernetes ingress; database traffic stays on the home-server network.

## Layout

```text
migrations/
├── auth/  squad/  event/  chat/    # one folder per service database
│   ├── 001_initial_schema.sql      # forward migrations, applied in order
│   └── down/001_initial_schema.sql # matching rollback for each version
├── lib.sh                          # shared helpers
├── run.sh                          # apply pending migrations (image entrypoint)
├── rollback.sh                     # revert the latest applied migration
└── Dockerfile                      # postgres-migrations image
```

## Rules for writing migrations

1. **Name** files `NNN_description.sql` (three digits, lowercase, underscores).
   The runner rejects anything else, so ordering is never ambiguous.
2. **Never edit an applied migration.** The runner stores each file's SHA-256 in
   `schema_migrations.checksum` and fails if an applied file has changed. Fix
   mistakes with a new migration.
3. **One transaction per file.** The runner wraps each file and its
   `schema_migrations` row in a single transaction, so a failing migration
   leaves nothing behind. Do not put `BEGIN`/`COMMIT` in files, and avoid
   statements that cannot run in a transaction (`CREATE INDEX CONCURRENTLY`,
   `VACUUM`). If one is ever needed, discuss it first.
4. **Write the down file** in `down/` with the same name, reversing the change.
   If a change cannot be reversed safely (data was transformed), say so in a
   comment and make the down file raise an error.
5. **Prefer additive changes** (new tables, nullable columns, new indexes) so the
   previous application version keeps working during a rollout.
6. Stay inside your service's database; services never read each other's tables.

## Running migrations

### Kubernetes (normal path)

The migration Jobs in `k8s/base/migration-jobs.yaml` are Argo CD Sync hooks at
sync wave 10. Application Deployments are at wave 20, so Argo CD only rolls out
a new version after every migration Job has succeeded. A failing migration
fails the Job, the sync stops, and the previous pods keep serving.

Several runners are safe: they share a PostgreSQL advisory lock, and a runner
that finds a version already applied skips it.

### Manually or locally

```bash
docker build -f database/postgres/migrations/Dockerfile -t squadsync-migrations .

# Apply
docker run --rm -e MIGRATION_SERVICE=squad -e DATABASE_URL="$SQUAD_DATABASE_URL" squadsync-migrations

# Show applied and pending versions
docker run --rm -e MIGRATION_SERVICE=squad -e DATABASE_URL="$SQUAD_DATABASE_URL" squadsync-migrations --status
```

With `psql` installed you can run the script directly; point `MIGRATIONS_ROOT`
at this folder:

```bash
MIGRATIONS_ROOT=database/postgres/migrations MIGRATION_SERVICE=squad \
  DATABASE_URL=postgresql://... database/postgres/migrations/run.sh
```

For local auth development, `pnpm --filter squadsync-auth-service migrate`
applies `migrations/auth/` with the same rules.

## Rollback and recovery runbook

Pick the least destructive option that fixes the problem.

### 1. The migration failed during a deploy

Nothing to undo: the failed file's transaction rolled back and no version was
recorded. The old pods are still serving. Fix the migration in a new commit
(it was never applied, so editing it is allowed) and sync again. Read the Job
log first:

```bash
kubectl -n squadsync logs job/squad-db-migration
```

### 2. The migration applied, but the new application version is broken

Roll the application back first; additive migrations are compatible with the
previous version:

```bash
git revert <bad commit>   # restores the previous image tags in the overlay
git push                  # Argo CD reconciles to the previous version
```

Only revert the schema if the old version cannot run against it.

### 3. The schema change itself must be reverted

1. **Back up the database** (most down files drop data):

   ```bash
   kubectl -n squadsync exec pg-main-1 -- pg_dump -Fc squad_db > squad_db-$(date +%F).dump
   ```

2. Pause automated sync for the application in Argo CD so it does not re-apply
   the migration.
3. Revert the latest version. `CONFIRM_ROLLBACK` must name it exactly:

   ```bash
   kubectl -n squadsync apply -f - <<'YAML'
   apiVersion: batch/v1
   kind: Job
   metadata:
     name: squad-db-rollback
   spec:
     backoffLimit: 0
     template:
       spec:
         restartPolicy: Never
         containers:
           - name: rollback
             image: ghcr.io/aaron-reid19/squadsync/postgres-migrations:<tag>
             command: ["/migrations/rollback.sh"]
             env:
               - { name: MIGRATION_SERVICE, value: squad }
               - { name: CONFIRM_ROLLBACK, value: 002_squad_details }
               - name: DATABASE_URL
                 valueFrom:
                   secretKeyRef: { name: squadsync-database-urls, key: SQUAD_DATABASE_URL }
   YAML
   kubectl -n squadsync logs -f job/squad-db-rollback
   kubectl -n squadsync delete job squad-db-rollback
   ```

   The down file and the removal of the `schema_migrations` row run in one
   transaction.
4. Remove or replace the migration file in Git, then resume sync.

### 4. Data is damaged

Restore the backup into a fresh database and point the service at it:

```bash
kubectl -n squadsync exec -i pg-main-1 -- pg_restore --clean --if-exists -d squad_db < squad_db-<date>.dump
```

Credentials and data never go into Git.
