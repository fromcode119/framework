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
COPY packages/media/package.json ./packages/media/
COPY packages/next/package.json ./packages/next/
COPY packages/plugins/package.json ./packages/plugins/
COPY packages/react/package.json ./packages/react/
COPY packages/scheduler/package.json ./packages/scheduler/
COPY packages/sdk/package.json ./packages/sdk/

# Install dependencies
RUN npm install --no-audit

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
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_VERSION=$NEXT_PUBLIC_API_VERSION
ENV API_VERSION_PREFIX=$API_VERSION_PREFIX
# Verify @fromcode119 workspace symlinks were created by npm install
RUN echo "--- @fromcode119 workspace packages ---" && ls node_modules/@fromcode119/ && echo "--- Node version ---" && node --version
# Five separate RUN steps so each process fully releases memory before the
# next one starts, and Docker can cache each layer independently.
# Output written to file then replayed so errors appear at the END of the layer
# log (Coolify log viewer only shows the tail of each step's output).

# Step 1: Build API runtime project graph only.
# This avoids compiling UI-only transitive packages via shared SDK aliases.
RUN ./node_modules/.bin/tsc -b packages/api > /tmp/tsc-api.log 2>&1; ec=$?; \
    cat /tmp/tsc-api.log; \
    [ $ec -ne 0 ] && echo "" && echo "=== build:api FAILED (exit $ec) — ERRORS ABOVE ===" && exit $ec; \
    echo "=== build:api OK ==="

# Step 2: Build SDK package used by plugin backend entrypoints at runtime.
RUN npm run build --workspace=@fromcode119/sdk > /tmp/build-sdk.log 2>&1; ec=$?; \
    tail -80 /tmp/build-sdk.log; \
    [ $ec -ne 0 ] && echo "" && echo "=== build:sdk FAILED (exit $ec) — ERRORS ABOVE ===" && exit $ec; \
    echo "=== build:sdk OK ==="

# Step 3: Build React package required by the AI extension.
RUN npm run build --workspace=@fromcode119/react > /tmp/build-react.log 2>&1; ec=$?; \
    tail -80 /tmp/build-react.log; \
    [ $ec -ne 0 ] && echo "" && echo "=== build:react FAILED (exit $ec) — ERRORS ABOVE ===" && exit $ec; \
    echo "=== build:react OK ==="

# Step 4: Build AI extension.
RUN npm run build --workspace=@fromcode119/ai > /tmp/build-ai.log 2>&1; ec=$?; \
    tail -80 /tmp/build-ai.log; \
    [ $ec -ne 0 ] && echo "" && echo "=== build:ai FAILED (exit $ec) — ERRORS ABOVE ===" && exit $ec; \
    echo "=== build:ai OK ==="

# Step 5: Build admin UI
RUN npm run build:admin > /tmp/build-admin.log 2>&1; ec=$?; \
    tail -80 /tmp/build-admin.log; \
    [ $ec -ne 0 ] && echo "" && echo "=== build:admin FAILED (exit $ec) — ERRORS ABOVE ===" && exit $ec; \
    echo "=== build:admin OK ==="

# Step 6: Build frontend
RUN npm run build:frontend > /tmp/build-frontend.log 2>&1; ec=$?; \
    tail -80 /tmp/build-frontend.log; \
    [ $ec -ne 0 ] && echo "" && echo "=== build:frontend FAILED (exit $ec) — ERRORS ABOVE ===" && exit $ec; \
    echo "=== build:frontend OK ==="

# ===================================
# MODE 1: API Only
# ===================================
FROM builder AS api-only
EXPOSE 3000
ENV DEPLOYMENT_MODE=api
CMD ["sh", "-lc", "npm run fromcode -- plugin deps-install-all && npm run start --workspace=@fromcode119/api"]

# ===================================
# MODE 2: API + Admin
# ===================================
FROM builder AS api-admin
EXPOSE 3000 3001
ENV DEPLOYMENT_MODE=api-admin
CMD ["sh", "-lc", "npm run fromcode -- plugin deps-install-all && npm run start:api-admin"]

# ===================================
# MODE 3: Full Stack (API + Admin + Frontend)
# ===================================
FROM builder AS full-stack
EXPOSE 3000 3001 3002
ENV DEPLOYMENT_MODE=full
CMD ["sh", "-lc", "npm run fromcode -- plugin deps-install-all && npm run start:all"]

# ===================================
# MODE 3B: Single-Domain Gateway
# ===================================
FROM base AS gateway-only
EXPOSE 3000
ENV DEPLOYMENT_MODE=gateway
CMD ["./node_modules/.bin/tsx", "scripts/single-domain-gateway.ts"]

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
