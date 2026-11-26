#!/usr/bin/env bash
# Copies app/microservices/_shared/*.ts into each service that uses them.
# Each service image builds from its own folder, so the helpers are vendored
# rather than imported across packages.
#   scripts/sync-shared.sh          update the copies
#   scripts/sync-shared.sh --check  fail if any copy has drifted (used in CI)
set -Eeuo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
shared="${root}/app/microservices/_shared"
check=false
[[ "${1:-}" == "--check" ]] && check=true

# service:file pairs
targets=(
  api-gateway:requestId.ts
  api-gateway:expressObservability.ts
  auth-service:config.ts
  auth-service:requestId.ts
  auth-service:expressObservability.ts
  auth-service:readiness.ts
)
for service in identity-service squad-service event-service chat-service notification-worker; do
  targets+=("${service}:config.ts" "${service}:requestId.ts" "${service}:fastifyObservability.ts")
done
for service in squad-service event-service chat-service; do
  targets+=("${service}:readiness.ts" "${service}:db.ts")
done

status=0
for target in "${targets[@]}"; do
  service="${target%%:*}"
  file="${target#*:}"
  dest="${root}/app/microservices/${service}/src/shared/${file}"
  if $check; then
    if ! cmp -s "${shared}/${file}" "${dest}"; then
      echo "Out of date: ${dest#"${root}"/} (run scripts/sync-shared.sh)" >&2
      status=1
    fi
  else
    mkdir -p "$(dirname "${dest}")"
    cp "${shared}/${file}" "${dest}"
  fi
done
exit "${status}"
