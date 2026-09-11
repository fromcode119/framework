#!/usr/bin/env bash
#
# Deploy a released version, prove it is serving, and clean up after itself.
#
# Three things this exists to stop happening by hand:
#
#   1. A release that boots into a crash loop stays live. v0.2.10 did: the api could not load its own
#      extension bundle, staging served Bad Gateway, and the rollback was manual. Here a version that
#      does not answer /health within the window is reverted to the one it replaced, automatically.
#   2. Every pulled release accumulates. Nine releases in one day took the disk from 16G to 25G.
#      A deploy that succeeds now removes framework images older than the one it replaced.
#   3. The previous version is what a rollback needs, so it is the one thing never pruned.
#
# Usage: ./deploy.sh v0.2.13        (run from the deploy directory on the server)

set -euo pipefail

VERSION="${1:-}"
[ -n "$VERSION" ] || { echo "usage: $0 <version>   e.g. $0 v0.2.13" >&2; exit 2; }

# Asked from INSIDE the api container. The api publishes no host port here — it is reached only
# through the proxy — so a health check on 127.0.0.1 of the host answers nothing and would fail every
# deploy. Going through the public URL instead would test the proxy and the certificate as much as
# the release, and would report a stale cached answer as success.
# 3000 is the api's port INSIDE its container (compose sets PORT=3000); the host never sees it.
HEALTH_PATH="${HEALTH_PATH:-http://localhost:3000/api/v1/health}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-120}"
PREVIOUS_FILE=.previous-version
COMPOSE=(docker compose -f docker-compose.full-stack.yml -f docker-compose.images.yml)
SERVICES=(api admin frontend)
REGISTRY_PREFIX='ghcr.io/fromcode119/framework-'

PREVIOUS="$(grep -E '^VERSION=' .env | head -1 | cut -d= -f2)"
echo "==> ${PREVIOUS:-none} -> ${VERSION}"

# Pull BEFORE touching .env: a version that does not exist in the registry must change nothing.
VERSION="$VERSION" "${COMPOSE[@]}" pull "${SERVICES[@]}"

set_version() {
  if grep -qE '^VERSION=' .env; then
    sed -i "s|^VERSION=.*|VERSION=$1|" .env
  else
    printf 'VERSION=%s\n' "$1" >> .env
  fi
}

health() {
  "${COMPOSE[@]}" exec -T api node -e \
    "fetch('${HEALTH_PATH}').then(r=>r.text()).then(t=>process.stdout.write(t)).catch(()=>process.exit(1))" \
    2>/dev/null
}

serving() {
  local deadline=$((SECONDS + HEALTH_TIMEOUT))
  while [ "$SECONDS" -lt "$deadline" ]; do
    # The reported VERSION is the point: a container of the previous release still answering 200 is
    # not a successful deploy, and that is exactly what a crash-looping new image leaves behind.
    if health | grep -q "\"version\":\"${1#v}\""; then return 0; fi
    sleep 5
  done
  return 1
}

set_version "$VERSION"
"${COMPOSE[@]}" up -d "${SERVICES[@]}"

if ! serving "$VERSION"; then
  echo "!! ${VERSION} did not report itself healthy within ${HEALTH_TIMEOUT}s" >&2
  health >&2 || true
  "${COMPOSE[@]}" logs --tail 40 api >&2 || true

  if [ -n "$PREVIOUS" ]; then
    echo "==> rolling back to ${PREVIOUS}" >&2
    set_version "$PREVIOUS"
    "${COMPOSE[@]}" up -d "${SERVICES[@]}"
    serving "$PREVIOUS" && echo "==> rolled back; ${PREVIOUS} is serving" >&2
  fi
  exit 1
fi

echo "==> ${VERSION} is serving"

# Keep the live version and the one it replaced — the rollback target. Everything else is already
# superseded twice over and can be pulled from the registry again if it is ever wanted. Only OUR
# images are considered; postgres, redis, traefik and the rest are never touched.
#
# Re-deploying the SAME version is the case that needs the file: `PREVIOUS` is then this version, so
# a keep-set of the two would collapse to one and the pruner would delete the only image a rollback
# could use. The last version actually REPLACED is therefore remembered on disk.
if [ -n "$PREVIOUS" ] && [ "$PREVIOUS" != "$VERSION" ]; then
  printf '%s\n' "$PREVIOUS" > "$PREVIOUS_FILE"
fi
ROLLBACK="$( [ -f "$PREVIOUS_FILE" ] && cat "$PREVIOUS_FILE" || echo '__none__' )"
echo "==> keeping ${VERSION} and ${ROLLBACK}"

docker images --format '{{.Repository}}:{{.Tag}}' \
  | grep "^${REGISTRY_PREFIX}" \
  | grep -vE ":(${VERSION}|${ROLLBACK})$" \
  | while read -r image; do
      echo "    removing ${image}"
      docker rmi "$image" >/dev/null 2>&1 || true
    done

df -h / | tail -1
