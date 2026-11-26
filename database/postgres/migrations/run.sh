#!/usr/bin/env bash
set -Eeuo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${MIGRATION_SERVICE:?MIGRATION_SERVICE is required}"

if [[ "${MIGRATION_SERVICE}" == "auth" ]]; then
  migration_dir="/migrations/auth"
else
  migration_dir="/migrations/${MIGRATION_SERVICE}"
fi
if [[ ! -d "${migration_dir}" ]]; then
  echo "Unknown migration service: ${MIGRATION_SERVICE}" >&2
  exit 1
fi

psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
SQL

shopt -s nullglob
migration_files=("${migration_dir}"/*.sql)
if [[ ${#migration_files[@]} -eq 0 ]]; then
  echo "No migrations found for ${MIGRATION_SERVICE}" >&2
  exit 1
fi

for migration_file in "${migration_files[@]}"; do
  version="$(basename "${migration_file}" .sql)"
  applied="$(psql "${DATABASE_URL}" -Atqc "SELECT 1 FROM schema_migrations WHERE version = '${version}' LIMIT 1")"
  if [[ "${applied}" == "1" ]]; then
    echo "${MIGRATION_SERVICE}: ${version} already applied"
    continue
  fi

  echo "${MIGRATION_SERVICE}: applying ${version}"
  psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${migration_file}"
  psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -c "INSERT INTO schema_migrations (version) VALUES ('${version}')"
done
