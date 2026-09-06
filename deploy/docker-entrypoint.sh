#!/bin/sh
# Runtime identities (T5c). The container starts as root so that ONE fork can keep root — the privileged
# spawner that starts plugin processes and theme render hosts as their own unprivileged users — and every
# app process drops to `node` inside itself right after (`PrivilegeDrop`). Before that happens, whatever
# the app will write at runtime has to belong to `node`: the mounted data roots, and the plugin
# dependencies `deps-install-all` writes into the mounted plugin tree.
#
# `chown -R` runs only when the app user cannot already write a root (the first start after this change),
# so a large uploads tree is not re-walked on every boot. A bind mount that refuses `chown` (Docker
# Desktop) is already writable by any container user there, so it is never touched.
set -eu

APP_USER=node
own_if_needed() {
  dir="$1"
  [ -d "$dir" ] || return 0
  if ! runuser -u "$APP_USER" -- test -w "$dir"; then
    echo "[entrypoint] making $dir writable by $APP_USER" >&2
    chown -R "$APP_USER:$APP_USER" "$dir" 2>/dev/null || echo "[entrypoint] could not chown $dir to $APP_USER; continuing" >&2
  fi
}

case "${DEPLOYMENT_MODE:-}" in
  api|api-admin|full)
    for dir in /app/data /app/backups /app/public/uploads /app/storage/private /app/plugins /app/themes /app/appearance; do
      own_if_needed "$dir"
    done
    # Plugin dependencies are installed as the app user, so the api (running as `node`) can update and
    # remove them later; root-owned node_modules in a mounted plugin dir would be undeletable by it.
    runuser -u "$APP_USER" -- env HOME=/home/node npm run fromcode -- plugin deps-install-all
    ;;
  admin)
    own_if_needed /app/appearance
    ;;
  frontend)
    ;;
esac

# Egress for guest processes (T5c). Plugin and theme processes run as uids 20000–21999 and talk to
# their host over Unix sockets only; the host makes their HTTP calls (`context.fetch`). So the kernel
# may refuse them every IP connection — an infected plugin then has no way to send anything out, not
# even DNS. `GUEST_EGRESS_POLICY=allow` keeps the old behaviour for a deployment that still has
# plugins doing raw network I/O; the log says which policy is in force. Needs CAP_NET_ADMIN (compose).
case "${GUEST_EGRESS_POLICY:-deny}" in
  deny)
    if command -v iptables >/dev/null 2>&1; then
      for ipt in iptables ip6tables; do
        "$ipt" -C OUTPUT -m owner --uid-owner 20000-21999 -j REJECT 2>/dev/null \
          || "$ipt" -A OUTPUT -m owner --uid-owner 20000-21999 -j REJECT 2>/dev/null \
          || echo "[entrypoint] $ipt: could not add the guest egress rule (CAP_NET_ADMIN missing?); guests can reach the network" >&2
      done
      echo "[entrypoint] guest egress: deny (uids 20000-21999)" >&2
    else
      echo "[entrypoint] iptables not installed; guests can reach the network" >&2
    fi
    ;;
  *) echo "[entrypoint] guest egress: allow (GUEST_EGRESS_POLICY=${GUEST_EGRESS_POLICY})" >&2 ;;
esac

# The apps start as root and drop privileges themselves (api: ApiEntry; admin/frontend: app-launcher).
# The command is whatever the image target or compose `command:` says; `deps-install-all` was already
# done above for the api targets, so their command is only the start.
case "$1" in
  npm|node|sh|./node_modules/.bin/tsx) exec "$@" ;;
  *) exec sh -lc "$*" ;;
esac
