# Workflow Builder Worker Service Dockerfile
# Multi-stage build for optimal image size

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and tsconfig
# Build context is now monorepo root, so paths are relative to that
COPY packages/workflow-worker-service/package.json ./
COPY packages/workflow-worker-service/tsconfig.json ./
COPY tsconfig.base.json ./
# tsconfig.json extends ../../tsconfig.base.json, so we need it at that relative path
# Create a temporary tsconfig that extends from current directory instead
RUN sed 's|"extends": "../../tsconfig.base.json"|"extends": "./tsconfig.base.json"|' tsconfig.json > tsconfig.tmp.json && mv tsconfig.tmp.json tsconfig.json

# Install dependencies (using npm install since this is a yarn workspace)
# Note: If package-lock.json exists, use npm ci; otherwise use npm install
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy source code
COPY packages/workflow-worker-service/src ./src

# Build TypeScript
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy package files
COPY packages/workflow-worker-service/package.json ./

# Install production dependencies only
# Note: If package-lock.json exists, use npm ci; otherwise use npm install
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Create temp directory for workflow bundles
RUN mkdir -p /tmp/workflow-builder && \
    chown -R node:node /tmp/workflow-builder

# Use non-root user
USER node

# Expose worker service port
EXPOSE 3011

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3011/health || exit 1

# Start the worker service
CMD ["node", "dist/server.js"]
