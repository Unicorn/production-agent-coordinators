# Workflow Builder Worker Service Dockerfile
# Multi-stage build for optimal image size

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json ./
COPY tsconfig.json ./

# Install dependencies (using npm install since this is a yarn workspace)
# Note: If package-lock.json exists, use npm ci; otherwise use npm install
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy package files
COPY package.json ./

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
