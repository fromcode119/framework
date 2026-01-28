# FROMCODE FRAMEWORK DOCKERFILE
# Based on framework-plan.md Section 12.1

FROM node:20-alpine AS base

RUN apk add --no-cache postgresql-client

WORKDIR /app

# Copy everything first
COPY . .

# Install dependencies
RUN npm install --prefer-offline --no-audit

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
