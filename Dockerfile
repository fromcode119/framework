# FROMCODE FRAMEWORK DOCKERFILE
# Based on framework-plan.md Section 12.1

ARG NODE_BASE_IMAGE=public.ecr.aws/docker/library/node:22-bookworm-slim
FROM ${NODE_BASE_IMAGE} AS base

# Install dependencies for native modules (better-sqlite3) and postgres.
# Support both Alpine and Debian-based Node images so builds can override the base tag.
RUN if command -v apk >/dev/null 2>&1; then \
            apk add --no-cache \
                postgresql-client \
                python3 \
                make \
                g++ \
                gcc \
                libc-dev; \
        elif command -v apt-get >/dev/null 2>&1; then \
            apt-get update && apt-get install -y --no-install-recommends \
                postgresql-client \
                python3 \
                build-essential \
                iptables \
            && rm -rf /var/lib/apt/lists/*; \
        else \
            echo "Unsupported base image package manager" >&2; \
            exit 1; \
        fi

WORKDIR /app

# Optimization: Copy package manifests first to leverage Docker cache
COPY package.json package-lock.json ./
COPY packages/admin/package.json ./packages/admin/
COPY packages/ai/package.json ./packages/ai/
COPY packages/api/package.json ./packages/api/
COPY packages/auth/package.json ./packages/auth/
COPY packages/cache/package.json ./packages/cache/
COPY packages/cli/package.json ./packages/cli/
COPY packages/core/package.json ./packages/core/
COPY packages/create/package.json ./packages/create/
COPY packages/database/package.json ./packages/database/
COPY packages/email/package.json ./packages/email/
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/marketplace-client/package.json ./packages/marketplace-client/
COPY packages/mcp/package.json ./packages/mcp/
COPY packages/mcp-server/package.json ./packages/mcp-server/
COPY packages/media/package.json ./packages/media/
COPY packages/next/package.json ./packages/next/
COPY packages/plugins/package.json ./packages/plugins/
COPY packages/react/package.json ./packages/react/
COPY packages/scheduler/package.json ./packages/scheduler/
COPY packages/sdk/package.json ./packages/sdk/
COPY packages/reactor/package.json ./packages/reactor/
COPY packages/nextor/package.json ./packages/nextor/
COPY packages/typor/package.json ./packages/typor/
COPY packages/arch-guard/package.json ./packages/arch-guard/

# Install dependencies
RUN npm install --no-audit

# Headless Chromium for server-side HTML→PDF rendering (plugin reading/report exports). Installed
# right after npm install so the ~150MB browser layer caches until dependencies change, instead of
# re-downloading on every source edit.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install --with-deps chromium

# Now copy the rest of the source
COPY . .

# Clean any accidentally copied host artifacts from packages
RUN find packages -name "dist" -type d -exec rm -rf {} + 2>/dev/null || true && \
    find . -name "*.tsbuildinfo" -delete 2>/dev/null || true

# ===================================
# SHARED BUILDER — compiles all packages sequentially.
# All per-service targets inherit from this stage so that
# docker compose build (which starts all services in parallel)
# never runs more than one tsc/next-build at a time.
# On a memory-constrained host (4 GB) parallel tsc processes
# caused OOM → exit code 2.
# ===================================
FROM base AS builder
ARG NEXT_PUBLIC_API_URL=http://localhost:3000
ARG NEXT_PUBLIC_API_VERSION=v1
ARG API_VERSION_PREFIX=v1
ARG NEXT_PUBLIC_ADMIN_APPEARANCE=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_VERSION=$NEXT_PUBLIC_API_VERSION
ENV API_VERSION_PREFIX=$API_VERSION_PREFIX
ENV NEXT_PUBLIC_ADMIN_APPEARANCE=$NEXT_PUBLIC_ADMIN_APPEARANCE
# Verify @fromcode119 workspace symlinks were created by npm install
RUN echo "--- @fromcode119 workspace packages ---" && ls node_modules/@fromcode119/ && echo "--- Node version ---" && node --version
# Separate RUN steps so each process fully releases memory before the
# next one starts, and Docker can cache each layer independently.
# Output written to file then replayed so errors appear at the END of the layer
# log (Coolify log viewer only shows the tail of each step's output).

# The ORDER of these steps is defined ONCE, in the root package.json (build:tooling / build:runtime /
# build:libs, composed as build:packages). Every consumer that builds this framework from source — this
# Dockerfile, the marketplace image, CI — calls those scripts. Never inline the sequence again: the
# marketplace carried a hand-copied `tsc -b <hardcoded list>` that silently went stale when reactor/typor/
# nextor were added, and its deploys died with 939 "Cannot find module '@fromcode119/reactor'" errors.

# Step 1: reactor → typor → nextor. reactor FIRST of all — core (LocaleSwitcher etc.), react
# (PluginComponent), the AI extension and admin (AdminComponent) all `extends Reactor`, so its built type
# declarations must exist before ANY project (including the api graph, which compiles core) is compiled.
# typor owns the package-private @alias build; nextor's esbuild plugins are consumed by the ai package's
# post-build `nextor stamp-client` and by admin's `nextor with-middleware`.
RUN npm run build:tooling > /tmp/build-tooling.log 2>&1; ec=$?; \
    tail -80 /tmp/build-tooling.log; \
    [ $ec -ne 0 ] && echo "" && echo "=== build:tooling FAILED (exit $ec) — ERRORS ABOVE ===" && exit $ec; \
    echo "=== build:tooling OK ==="

# Step 2: API runtime project graph only (avoids compiling UI-only transitive packages via shared SDK
# aliases), then mirror the api's non-TS assets into dist — `tsc -b` does not copy Handlebars templates.
RUN npm run build:runtime > /tmp/build-runtime.log 2>&1; ec=$?; \
    cat /tmp/build-runtime.log; \
    [ $ec -ne 0 ] && echo "" && echo "=== build:runtime FAILED (exit $ec) — ERRORS ABOVE ===" && exit $ec; \
    echo "=== build:runtime OK ==="

# Step 3: react → sdk → ai. The SDK (and the AI extension) consume react's built type declarations
# (e.g. PluginContextRegistry), so react must be compiled before sdk.
RUN npm run build:libs > /tmp/build-libs.log 2>&1; ec=$?; \
    tail -120 /tmp/build-libs.log; \
    [ $ec -ne 0 ] && echo "" && echo "=== build:libs FAILED (exit $ec) — ERRORS ABOVE ===" && exit $ec; \
    echo "=== build:libs OK ==="

# Step 3b: Per-icon data modules for BOTH apps BEFORE the app builds — the Next bundles bake the lucide
# version string into the icon URL, so the files must exist for exactly that version (the drift test
# guards it) or every icon 404s in the image.
RUN npm run build:frontend-icons > /tmp/build-frontend-icons.log 2>&1; ec=$?; \
    tail -n 40 /tmp/build-frontend-icons.log; exit $ec

# Step 4: Build admin UI
RUN npm run build:admin > /tmp/build-admin.log 2>&1; ec=$?; \
    tail -80 /tmp/build-admin.log; \
    [ $ec -ne 0 ] && echo "" && echo "=== build:admin FAILED (exit $ec) — ERRORS ABOVE ===" && exit $ec; \
    echo "=== build:admin OK ==="

# Step 5: Build frontend
RUN npm run build:frontend > /tmp/build-frontend.log 2>&1; ec=$?; \
    tail -80 /tmp/build-frontend.log; \
    [ $ec -ne 0 ] && echo "" && echo "=== build:frontend FAILED (exit $ec) — ERRORS ABOVE ===" && exit $ec; \
    echo "=== build:frontend OK ==="

# Step 6: Build the storefront runtime bundle — ONE classic script under public/fc-runtime/, built by
# Vite from the SAME alias/stub map next.config.js reads (config/next-config-env.js). Runs after
# build:frontend because Next serves public/ from disk at runtime; nothing in .next depends on it.
RUN npm run build:frontend-runtime > /tmp/build-frontend-runtime.log 2>&1; ec=$?; \
    tail -80 /tmp/build-frontend-runtime.log; \
    [ $ec -ne 0 ] && echo "" && echo "=== build:frontend-runtime FAILED (exit $ec) — ERRORS ABOVE ===" && exit $ec; \
    echo "=== build:frontend-runtime OK ==="

# Step 7: The theme render host — the one storefront module that runs OUTSIDE Next, as its own process
# per theme world (T5b). Bundled here so the image ships it; without it the storefront says so and renders
# worlds in-process.
RUN npm run build:frontend-host > /tmp/build-frontend-host.log 2>&1; ec=$?; \
    tail -40 /tmp/build-frontend-host.log; \
    [ $ec -ne 0 ] && echo "" && echo "=== build:frontend-host FAILED (exit $ec) — ERRORS ABOVE ===" && exit $ec; \
    echo "=== build:frontend-host OK ==="

# Step 8: Runtime identities (T5c). Every app process gives up root for `node` the moment it starts
# (`PrivilegeDrop`), so what it writes at runtime must be writable by `node`: the Next caches. The build
# caches are dropped first — they are build-time state, and `chown -R` over them would double the layer.
# `deploy/docker-entrypoint.sh` does the same for the MOUNTED directories, which do not exist yet here.
RUN rm -rf packages/frontend/.next/cache packages/admin/.next/cache && \
    mkdir -p packages/frontend/.next/cache packages/admin/.next/cache /home/node && \
    chown -R node:node packages/frontend/.next/cache packages/admin/.next/cache /home/node && \
    chmod +x deploy/docker-entrypoint.sh
ENTRYPOINT ["/app/deploy/docker-entrypoint.sh"]

# ===================================
# MODE 1: API Only
# ===================================
FROM builder AS api-only
EXPOSE 3000
ENV DEPLOYMENT_MODE=api
CMD ["npm", "run", "start", "--workspace=@fromcode119/api"]

# ===================================
# MODE 2: API + Admin
# ===================================
FROM builder AS api-admin
EXPOSE 3000 3001
ENV DEPLOYMENT_MODE=api-admin
CMD ["npm", "run", "start:api-admin"]

# ===================================
# MODE 3: Full Stack (API + Admin + Frontend)
# ===================================
FROM builder AS full-stack
EXPOSE 3000 3001 3002
ENV DEPLOYMENT_MODE=full
CMD ["npm", "run", "start:all"]

# ===================================
# MODE 3B: Single-Domain Gateway
# ===================================
FROM builder AS gateway-only
EXPOSE 3000
ENV DEPLOYMENT_MODE=gateway
CMD ["./node_modules/.bin/tsx", "packages/cli/src/bin.ts", "system", "gateway"]

# ===================================
# MODE 4: Frontend Only (Edge deployment)
# ===================================
FROM builder AS frontend-only
EXPOSE 3000
ENV DEPLOYMENT_MODE=frontend
ENV API_URL=https://api.example.com
CMD ["npm", "run", "start", "--workspace=@fromcode119/frontend"]

# ===================================
# MODE 5: Admin Only
# ===================================
FROM builder AS admin-only
EXPOSE 3000
ENV DEPLOYMENT_MODE=admin
CMD ["npm", "run", "start", "--workspace=@fromcode119/admin"]
