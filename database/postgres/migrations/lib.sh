#!/usr/bin/env bash
# Shared helpers for run.sh and rollback.sh. Sourced, not executed.

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${MIGRATION_SERVICE:?MIGRATION_SERVICE is required}"

migrations_root="${MIGRATIONS_ROOT:-/migrations}"
migration_dir="${migrations_root}/${MIGRATION_SERVICE}"
if [[ ! "${MIGRATION_SERVICE}" =~ ^[a-z]+$ || ! -d "${migration_dir}" ]]; then
  echo "Unknown migration service: ${MIGRATION_SERVICE}" >&2
  exit 1
fi

# One lock for every migration runner on this database. Concurrent runners
# (two Job pods, a Job plus a developer) wait instead of racing.
# shellcheck disable=SC2034  # used by the scripts that source this file
lock_sql="SET client_min_messages = warning;
\\o /dev/null
SELECT pg_advisory_xact_lock(hashtext('squadsync:schema_migrations'));
\\o"

psql_run() {
  psql "${DATABASE_URL}" -X -q -v ON_ERROR_STOP=1 "$@"
}

checksum_of() {
  sha256sum "$1" | cut -d' ' -f1
}

ensure_migrations_table() {
  psql_run --single-transaction <<SQL
${lock_sql}
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum TEXT;
SQL
}
