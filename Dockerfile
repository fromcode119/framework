# FROMCODE FRAMEWORK DOCKERFILE
# Based on framework-plan.md Section 12.1

FROM node:22-alpine AS base

# Install dependencies for native modules (better-sqlite3) and postgres
RUN apk add --no-cache \
    postgresql-client \
    python3 \
    make \
    g++ \
    gcc \
    libc-dev

WORKDIR /app

# Optimization: Copy package manifests first to leverage Docker cache
COPY package.json package-lock.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/react/package.json ./packages/react/
COPY packages/database/package.json ./packages/database/
COPY packages/api/package.json ./packages/api/
COPY packages/admin/package.json ./packages/admin/
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/auth/package.json ./packages/auth/
COPY packages/cache/package.json ./packages/cache/
COPY packages/cli/package.json ./packages/cli/
COPY packages/email/package.json ./packages/email/
COPY packages/marketplace-client/package.json ./packages/marketplace-client/
COPY packages/media/package.json ./packages/media/
COPY packages/next/package.json ./packages/next/
COPY packages/scheduler/package.json ./packages/scheduler/
COPY packages/sdk/package.json ./packages/sdk/

# Install dependencies
RUN npm install --prefer-offline --no-audit

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
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN NODE_OPTIONS="--max-old-space-size=1536" npm run build:api && \
    NODE_OPTIONS="--max-old-space-size=1536" npm run build:admin && \
    NODE_OPTIONS="--max-old-space-size=1536" npm run build:frontend

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
