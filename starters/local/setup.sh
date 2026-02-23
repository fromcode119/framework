#!/usr/bin/env bash
# setup.sh — one-time setup for starters/local
# Run: bash setup.sh  (from starters/local/ or anywhere in the repo)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRAMEWORK_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
ENV_EXAMPLE="$SCRIPT_DIR/.env.example"

echo "=== Fromcode local dev setup ==="

# ── 1. Copy .env if missing ───────────────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  echo "✓ Created $ENV_FILE"
  echo ""
  echo "  ⚠  Open $ENV_FILE and set a real JWT_SECRET before going to production."
  echo ""
else
  echo "✓ $ENV_FILE already exists — skipping copy"
fi

# ── 2. Install monorepo workspace deps (packages/api, packages/admin, etc.) ──
echo ""
echo "Installing framework workspace dependencies..."
(cd "$FRAMEWORK_ROOT" && npm install)
echo "✓ Framework dependencies installed"

# ── 3. Install starter's own deps (concurrently, http-proxy) ─────────────────
echo ""
echo "Installing starter dependencies (concurrently, http-proxy)..."
(cd "$SCRIPT_DIR" && npm install)
echo "✓ Starter dependencies installed"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "=== Setup complete ==="
echo ""
echo "  Start: cd starters/local && npm run dev:api-admin"
echo "  Open:  http://localhost:3000/admin/setup"
echo ""
