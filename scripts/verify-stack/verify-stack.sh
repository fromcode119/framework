#!/bin/bash
# Isolated verify stack for the framework images — a SEPARATE compose project (`fcverify`).
#   ./verify-stack.sh up                 derive env from the framework project (read-only) and start api+frontend+admin+redis (images framework-*:verify)
#   ./verify-stack.sh seed [theme]       throwaway admin, enable cms/forms/seo, activate the theme, run its built seed,
#                                        point SEO siteUrl at the isolated frontend (default theme: fromcode)
#   ./verify-stack.sh status             containers, health, home title — and the framework-* containers, untouched
#   ./verify-stack.sh restart <service>  restart api | frontend (this project only)
#   ./verify-stack.sh logs <service>     tail logs
#   ./verify-stack.sh down               remove ONLY the fcverify containers/network/volumes and the state dir's data
# Never touches the `framework` project: no .env edit, no framework-* container, no app.db.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
# The platform root — the directory holding framework/, plugins/, themes/ and appearance/. This script
# lives at framework/Source/scripts/verify-stack/, which is FOUR levels down from it. It used to sit
# outside every git repository, where the only copy of it was on one disk.
export SOURCE_ROOT="$(cd "$HERE/../../../.." && pwd)"

# Compile one TypeScript helper into the state dir as an ESM artifact the api container can run.
build_helper() {
  local name="$1"
  "$SOURCE_ROOT/framework/Source/node_modules/.bin/esbuild" "$HERE/lib/$name.ts" \
    --bundle --format=esm --platform=node --packages=external \
    --outfile="$VERIFY_STATE_DIR/data/$name.mjs" >/dev/null
}
FRAMEWORK_DIR="$SOURCE_ROOT/framework/Source"
export VERIFY_STATE_DIR="${VERIFY_STATE_DIR:-${TMPDIR:-/tmp}/fcverify}"
export VERIFY_API_PORT="${VERIFY_API_PORT:-3999}"
export VERIFY_FRONTEND_PORT="${VERIFY_FRONTEND_PORT:-3998}"
export VERIFY_ADMIN_PORT="${VERIFY_ADMIN_PORT:-3997}"
export VERIFY_FRONTEND_APPROUTER_PORT="${VERIFY_FRONTEND_APPROUTER_PORT:-3996}"
export VERIFY_ISLANDS="${VERIFY_ISLANDS:-}"
export VERIFY_ADMIN_ORIGIN="http://127.0.0.1:$VERIFY_ADMIN_PORT"
export VERIFY_EXT_MOUNT_MODE="${VERIFY_EXT_MOUNT_MODE:-ro}"
API_ORIGIN="http://127.0.0.1:$VERIFY_API_PORT"
FRONTEND_ORIGIN="http://127.0.0.1:$VERIFY_FRONTEND_PORT"
PROJECT="fcverify"
ADMIN_EMAIL="${VERIFY_ADMIN_EMAIL:-verify@fromcode.local}"
# Plugins enabled before the theme seed runs. The atlantis theme needs cms/forms/seo; an ecommerce theme
# lists more (see its theme.json `dependencies`) — pass them: VERIFY_PLUGINS="cms forms seo ecommerce finance …".
VERIFY_PLUGINS="${VERIFY_PLUGINS:-cms forms seo}"

compose() { docker compose -p "$PROJECT" -f "$HERE/docker-compose.yml" "$@"; }

wait_for() { # wait_for <url> <substring> <seconds>
  local url="$1" needle="$2" secs="${3:-120}" i=0
  while [ "$i" -lt "$secs" ]; do
    # No pipe here: under pipefail a `grep -q` that exits on its first match hands SIGPIPE to the
    # writer and the whole pipeline reads as "not ready" — for a page that is up. Plain shell matching.
    local body; body="$(curl -sf --max-time 15 "$url" 2>/dev/null || true)"
    case "$body" in *"$needle"*) echo "ready: $url"; return 0 ;; esac
    sleep 2; i=$((i+2))
  done
  echo "TIMEOUT waiting for $url ($needle) — last HTTP $(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$url")" >&2; return 1
}
wait_api() { wait_for "$API_ORIGIN/api/v1/health" '"status":"ok"' 180; }
wait_frontend() { wait_for "$FRONTEND_ORIGIN/" '<html' 180; }
restart_api() { compose restart api >/dev/null; wait_api; }

cmd_up() {
  mkdir -p "$VERIFY_STATE_DIR/env" "$VERIFY_STATE_DIR/data" "$VERIFY_STATE_DIR/uploads" "$VERIFY_STATE_DIR/storage-private"
  # READ-ONLY look at the framework project's resolved config; nothing is started or changed there.
  (cd "$FRAMEWORK_DIR" && docker compose config --format json 2>/dev/null) > "$VERIFY_STATE_DIR/framework-config.json"
  : > "$VERIFY_STATE_DIR/env/empty.env"
  "$SOURCE_ROOT/framework/Source/node_modules/.bin/tsx" "$HERE/lib/derive-env.ts" "$VERIFY_STATE_DIR/framework-config.json" "$VERIFY_STATE_DIR/env" "$API_ORIGIN" "$FRONTEND_ORIGIN"
  compose up -d --no-build
  wait_api; wait_frontend
  echo "api: $API_ORIGIN  frontend: $FRONTEND_ORIGIN  state: $VERIFY_STATE_DIR"
}

cmd_seed() {
  local theme="${1:-fromcode}"
  local seed_src="$SOURCE_ROOT/dist/packages/build/themes/$theme/seed.mjs"
  [ -f "$seed_src" ] || { echo "missing built seed $seed_src — run ./build-plugins.sh pack theme $theme first" >&2; exit 1; }
  local pw_file="$VERIFY_STATE_DIR/admin-password"
  [ -f "$pw_file" ] || openssl rand -hex 12 > "$pw_file"
  local pw; pw="$(cat "$pw_file")"
  wait_api
  # Idempotent: a re-seed on the same database keeps the admin that exists (same password file).
  compose exec -T api npm run atlantis --silent -- auth create-admin "$ADMIN_EMAIL" "$pw" || echo "admin exists — reusing"
  for slug in $VERIFY_PLUGINS; do compose exec -T api npm run atlantis --silent -- plugin enable "$slug"; done
  # Two boots: the forms plugin creates its default form on the second boot that sees it enabled.
  restart_api; restart_api
  # COMPILED, not copied. The sources are TypeScript like everything else here; what the container runs
  # is build output, the same way every shipped entry point is. `--packages=external` keeps
  # `@fromcode119/*` resolving from the container's own /app/node_modules, which is the whole reason
  # these run in there rather than on the host.
  build_helper verify-admin
  build_helper verify-seed-runner
  # The built seed locates the theme root from ITS OWN file (a `public/` sibling), so it is staged inside
  # a per-theme folder next to a copy of the theme's public assets — sample images it copies into uploads.
  rm -rf "$VERIFY_STATE_DIR/data/theme-$theme"; mkdir -p "$VERIFY_STATE_DIR/data/theme-$theme"
  cp "$seed_src" "$VERIFY_STATE_DIR/data/theme-$theme/seed.mjs"
  [ -d "$SOURCE_ROOT/themes/$theme/public" ] && cp -R "$SOURCE_ROOT/themes/$theme/public" "$VERIFY_STATE_DIR/data/theme-$theme/public"
  compose exec -T -e VERIFY_ADMIN_EMAIL="$ADMIN_EMAIL" -e VERIFY_ADMIN_PASSWORD="$pw" -w /app api node data/verify-admin.mjs activate-theme "$theme"
  compose exec -T -w /app api node data/verify-seed-runner.mjs "$theme"
  # The api caches plugin settings at boot: restart before writing the SEO row the seed created.
  restart_api
  compose exec -T -e VERIFY_ADMIN_EMAIL="$ADMIN_EMAIL" -e VERIFY_ADMIN_PASSWORD="$pw" -w /app api node data/verify-admin.mjs set-plugin-setting seo siteUrl "$FRONTEND_ORIGIN"
  # A changed setting makes the api ask the frontend to exit-and-restart (the restart policy brings it
  # back); give that its moment before restarting again ourselves, then a second restart for a clean SSR.
  sleep 8; wait_frontend || { compose restart frontend >/dev/null; wait_frontend; }
  compose restart frontend >/dev/null; wait_frontend
  echo "home title: $(curl -s "$FRONTEND_ORIGIN/" | grep -o '<title>[^<]*</title>' | head -1)"
}

cmd_status() {
  compose ps
  echo "api health: $(curl -s --max-time 3 "$API_ORIGIN/api/v1/health" | head -c 200)"
  echo "frontend home: $(curl -s --max-time 5 "$FRONTEND_ORIGIN/" | grep -o '<title>[^<]*</title>' | head -1)"
  echo "framework project (untouched by this script):"
  docker ps -a --filter name=framework- --format '  {{.ID}} {{.Names}} {{.Status}}'
}

cmd_down() {
  compose down -v --remove-orphans
  rm -rf "$VERIFY_STATE_DIR/data" "$VERIFY_STATE_DIR/uploads" "$VERIFY_STATE_DIR/storage-private" "$VERIFY_STATE_DIR/env" \
    "$VERIFY_STATE_DIR/framework-config.json" "$VERIFY_STATE_DIR/admin-password"
  echo "removed project $PROJECT and $VERIFY_STATE_DIR/{data,uploads,storage-private,env,framework-config.json,admin-password}"
}

case "${1:-}" in
  up) cmd_up ;;
  seed) cmd_seed "${2:-fromcode}" ;;
  status) cmd_status ;;
  restart) [ "${2:-}" = api ] && restart_api || { compose restart "${2:?service}"; wait_frontend; } ;;
  logs) compose logs --tail="${3:-100}" "${2:?service}" ;;
  down) cmd_down ;;
  *) sed -n 2,10p "$0"; exit 2 ;;
esac
