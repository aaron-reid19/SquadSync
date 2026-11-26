#!/usr/bin/env bash
# Applies pending migrations for one service database.
#
#   MIGRATION_SERVICE=squad DATABASE_URL=... run.sh           apply pending migrations
#   MIGRATION_SERVICE=squad DATABASE_URL=... run.sh --status  list applied and pending
#
# Rules (see database/postgres/README.md):
# - Files are named NNN_description.sql and applied in order.
# - Each file runs in its own transaction together with its schema_migrations
#   row, so a failure leaves no half-applied migration and no record of it.
# - An applied file must not change: its SHA-256 is stored and checked on every run.
# - Any failure exits non-zero, which fails the Kubernetes Job / Argo CD sync
#   before the new application version is rolled out.
set -Eeuo pipefail

# shellcheck source=lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

mode="apply"
[[ "${1:-}" == "--status" ]] && mode="status"

ensure_migrations_table

shopt -s nullglob
migration_files=("${migration_dir}"/*.sql)
if [[ ${#migration_files[@]} -eq 0 ]]; then
  echo "No migrations found for ${MIGRATION_SERVICE}" >&2
  exit 1
fi

for migration_file in "${migration_files[@]}"; do
  name="$(basename "${migration_file}")"
  if [[ ! "${name}" =~ ^[0-9]{3}_[a-z0-9_]+\.sql$ ]]; then
    echo "${MIGRATION_SERVICE}: invalid migration file name '${name}' (expected NNN_description.sql)" >&2
    exit 1
  fi
done

for migration_file in "${migration_files[@]}"; do
  version="$(basename "${migration_file}" .sql)"
  checksum="$(checksum_of "${migration_file}")"
  # NULL checksum means the row predates checksums; shown as '-'.
  recorded="$(psql_run -Atc "SELECT COALESCE(checksum, '-') FROM schema_migrations WHERE version = '${version}'")"

  if [[ -n "${recorded}" ]]; then
    if [[ "${recorded}" == "-" ]]; then
      [[ "${mode}" == "status" ]] && { echo "applied  ${version} (no checksum recorded yet)"; continue; }
      psql_run -c "UPDATE schema_migrations SET checksum = '${checksum}' WHERE version = '${version}' AND checksum IS NULL"
      echo "${MIGRATION_SERVICE}: ${version} already applied (recorded checksum)"
    elif [[ "${recorded}" != "${checksum}" ]]; then
      echo "${MIGRATION_SERVICE}: ${version} was edited after it was applied." >&2
      echo "  Applied migrations are immutable. Revert the edit and add a new migration instead." >&2
      exit 1
    else
      [[ "${mode}" == "status" ]] && { echo "applied  ${version}"; continue; }
      echo "${MIGRATION_SERVICE}: ${version} already applied"
    fi
    continue
  fi

  if [[ "${mode}" == "status" ]]; then
    echo "pending  ${version}"
    continue
  fi

  echo "${MIGRATION_SERVICE}: applying ${version}"
  # Re-checked under the lock in case another runner applied it meanwhile.
  psql_run --single-transaction \
    -v version="${version}" -v checksum="${checksum}" -v file="${migration_file}" <<SQL
${lock_sql}
SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE version = :'version') AS already_applied \gset
\if :already_applied
\echo ${MIGRATION_SERVICE}: ${version} was applied by another runner
\else
\i :file
INSERT INTO schema_migrations (version, checksum) VALUES (:'version', :'checksum');
\endif
SQL
done

[[ "${mode}" == "apply" ]] && echo "${MIGRATION_SERVICE}: database is up to date"
exit 0
