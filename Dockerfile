# FROMCODE FRAMEWORK DOCKERFILE
# Based on framework-plan.md Section 12.1

FROM node:20-alpine AS base

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
COPY packages/sdk/package.json ./packages/sdk/

# Install dependencies
RUN npm install --prefer-offline --no-audit

# Now copy the rest of the source
COPY . .

# Clean any accidentally copied host artifacts from packages
RUN find packages -name "dist" -type d -exec rm -rf {} + 2>/dev/null || true && \
    find . -name "*.tsbuildinfo" -delete 2>/dev/null || true

# Build common packages (core, react, etc.)
RUN npm run build

# ===================================
# MODE 1: API Only
# ===================================
FROM base AS api-only
RUN npm run build:api
EXPOSE 3000
ENV DEPLOYMENT_MODE=api
CMD ["npm", "run", "start", "--workspace=@fromcode/api"]

# ===================================
# MODE 2: API + Admin
# ===================================
FROM base AS api-admin
RUN npm run build:api && npm run build:admin
EXPOSE 3000 3001
ENV DEPLOYMENT_MODE=api-admin
CMD ["npm", "run", "start:api-admin"]

# ===================================
# MODE 3: Full Stack (API + Admin + Frontend)
# ===================================
FROM base AS full-stack
RUN npm run build:api && npm run build:admin && npm run build:frontend
EXPOSE 3000 3001 3002
ENV DEPLOYMENT_MODE=full
CMD ["npm", "run", "start:all"]

# ===================================
# MODE 4: Frontend Only (Edge deployment)
# ===================================
FROM base AS frontend-only
RUN npm run build:frontend
EXPOSE 3000
ENV DEPLOYMENT_MODE=frontend
ENV API_URL=https://api.example.com
CMD ["npm", "run", "start", "--workspace=@fromcode/frontend"]

# ===================================
# MODE 5: Admin Only
# ===================================
FROM base AS admin-only
RUN npm run build:admin
EXPOSE 3000
ENV DEPLOYMENT_MODE=admin
CMD ["npm", "run", "start", "--workspace=@fromcode/admin"]
