#!/usr/bin/env bash
# Reverts the most recently applied migration for one service database.
#
#   MIGRATION_SERVICE=squad DATABASE_URL=... CONFIRM_ROLLBACK=002_squad_details rollback.sh
#
# CONFIRM_ROLLBACK must name the latest applied version, so a wrong service or a
# stale command cannot revert the wrong thing. Runs <service>/down/<version>.sql
# and removes the schema_migrations row in a single transaction.
# Take a backup first: most down files drop data. See database/postgres/README.md.
set -Eeuo pipefail

# shellcheck source=lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

ensure_migrations_table

latest="$(psql_run -Atc "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1")"
if [[ -z "${latest}" ]]; then
  echo "${MIGRATION_SERVICE}: nothing to roll back" >&2
  exit 1
fi

if [[ ! "${latest}" =~ ^[0-9]{3}_[a-z0-9_]+$ ]]; then
  echo "${MIGRATION_SERVICE}: unexpected version '${latest}' in schema_migrations" >&2
  exit 1
fi

if [[ "${CONFIRM_ROLLBACK:-}" != "${latest}" ]]; then
  echo "${MIGRATION_SERVICE}: latest applied migration is ${latest}." >&2
  echo "  Re-run with CONFIRM_ROLLBACK=${latest} to revert it." >&2
  exit 1
fi

down_file="${migration_dir}/down/${latest}.sql"
if [[ ! -f "${down_file}" ]]; then
  echo "${MIGRATION_SERVICE}: no down migration at down/${latest}.sql; restore from backup instead" >&2
  exit 1
fi

echo "${MIGRATION_SERVICE}: rolling back ${latest}"
psql_run --single-transaction -v version="${latest}" -v file="${down_file}" <<SQL
${lock_sql}
SELECT COALESCE(MAX(version) = :'version', false) AS still_latest FROM schema_migrations \gset
\if :still_latest
\i :file
DELETE FROM schema_migrations WHERE version = :'version';
\else
DO \$\$ BEGIN RAISE EXCEPTION 'latest migration changed while rolling back; nothing was changed'; END \$\$;
\endif
SQL
echo "${MIGRATION_SERVICE}: rolled back ${latest}"
