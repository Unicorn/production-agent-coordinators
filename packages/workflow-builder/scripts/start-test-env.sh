#!/bin/bash
# Start Test Environment
# Spins up fresh, isolated infrastructure for E2E tests
# Usage: ./scripts/start-test-env.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

KONG_ADMIN="http://localhost:9001"

echo "Starting test environment..."

# Ensure any previous test containers are removed
echo "Cleaning up any existing test containers..."
docker compose -f "$PROJECT_DIR/docker-compose.test.yml" down --volumes --remove-orphans 2>/dev/null || true

# Start fresh test environment
echo "Starting fresh test infrastructure..."
docker compose -f "$PROJECT_DIR/docker-compose.test.yml" up -d

# Wait for Kong to be healthy
echo "Waiting for Kong to be healthy..."
MAX_RETRIES=60
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s ${KONG_ADMIN}/status > /dev/null 2>&1; then
        echo "Kong is healthy!"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "Waiting for Kong... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "ERROR: Kong failed to start within timeout"
    docker compose -f "$PROJECT_DIR/docker-compose.test.yml" logs kong-test
    exit 1
fi

# Wait for Temporal to be healthy
echo "Waiting for Temporal to be healthy..."
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:9233 > /dev/null 2>&1; then
        echo "Temporal is healthy!"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "Waiting for Temporal... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "WARNING: Temporal may not be fully ready (non-critical for Kong tests)"
fi

# Configure Kong with test services and plugins
echo "Configuring Kong with test services..."

# ============================================
# Global Plugins
# ============================================

# Enable correlation-id plugin globally
echo "Enabling correlation-id plugin..."
curl -s -X POST ${KONG_ADMIN}/plugins \
    --data "name=correlation-id" \
    --data "config.header_name=X-Request-ID" \
    --data "config.generator=uuid" \
    --data "config.echo_downstream=true" > /dev/null

# ============================================
# Health Check Route (no auth required)
# ============================================

echo "Creating health service and route..."
curl -s -X POST ${KONG_ADMIN}/services \
    --data "name=health-service" \
    --data "url=http://mock-upstream:80" > /dev/null

curl -s -X POST ${KONG_ADMIN}/services/health-service/routes \
    --data "name=health-route" \
    --data "paths[]=/api/health" > /dev/null

# Enable rate limiting on health route
curl -s -X POST ${KONG_ADMIN}/routes/health-route/plugins \
    --data "name=rate-limiting" \
    --data "config.minute=1000" \
    --data "config.policy=local" > /dev/null

# ============================================
# Test Service (for JWT authentication tests)
# ============================================

echo "Creating E2E test service with JWT auth..."
curl -s -X POST ${KONG_ADMIN}/services \
    --data "name=e2e-test-service" \
    --data "url=http://mock-upstream:80" > /dev/null

curl -s -X POST ${KONG_ADMIN}/services/e2e-test-service/routes \
    --data "name=e2e-test-route" \
    --data "paths[]=/api/e2e-test" \
    --data "methods[]=GET" \
    --data "methods[]=POST" > /dev/null

# Create JWT consumer and credentials for testing
echo "Creating JWT consumer..."
curl -s -X POST ${KONG_ADMIN}/consumers \
    --data "username=e2e-test-consumer" > /dev/null

# Create JWT credential with test secret
JWT_SECRET="${SUPABASE_JWT_SECRET:-test-jwt-secret-for-development-only}"
curl -s -X POST ${KONG_ADMIN}/consumers/e2e-test-consumer/jwt \
    --data "key=e2e-test-key" \
    --data "secret=${JWT_SECRET}" \
    --data "algorithm=HS256" > /dev/null

# Enable JWT auth on test route
curl -s -X POST ${KONG_ADMIN}/routes/e2e-test-route/plugins \
    --data "name=jwt" \
    --data "config.claims_to_verify=exp" > /dev/null

# ============================================
# Compiler Service (rate limited)
# ============================================

echo "Creating compiler service with rate limiting..."
curl -s -X POST ${KONG_ADMIN}/services \
    --data "name=compiler-service" \
    --data "url=http://mock-upstream:80" > /dev/null

curl -s -X POST ${KONG_ADMIN}/services/compiler-service/routes \
    --data "name=compiler-route" \
    --data "paths[]=/api/compiler" \
    --data "paths[]=/api/v1/compile" > /dev/null

# Enable rate limiting on compiler route (100/minute)
curl -s -X POST ${KONG_ADMIN}/routes/compiler-route/plugins \
    --data "name=rate-limiting" \
    --data "config.minute=100" \
    --data "config.policy=local" > /dev/null

# ============================================
# tRPC Routes
# ============================================

echo "Creating tRPC service..."
curl -s -X POST ${KONG_ADMIN}/services \
    --data "name=trpc-service" \
    --data "url=http://mock-upstream:80" > /dev/null

curl -s -X POST ${KONG_ADMIN}/services/trpc-service/routes \
    --data "name=trpc-route" \
    --data "paths[]=/api/trpc" > /dev/null

# Rate limiting on tRPC
curl -s -X POST ${KONG_ADMIN}/routes/trpc-route/plugins \
    --data "name=rate-limiting" \
    --data "config.minute=1000" \
    --data "config.policy=local" > /dev/null

# ============================================
# Workflow Service
# ============================================

echo "Creating workflow service..."
curl -s -X POST ${KONG_ADMIN}/services \
    --data "name=workflow-service" \
    --data "url=http://mock-upstream:80" > /dev/null

curl -s -X POST ${KONG_ADMIN}/services/workflow-service/routes \
    --data "name=workflow-route" \
    --data "paths[]=/api/workflows" > /dev/null

echo ""
echo "Test environment is ready!"
echo ""
echo "Services:"
echo "  Kong Proxy:  http://localhost:9000"
echo "  Kong Admin:  http://localhost:9001"
echo "  Temporal:    localhost:9233"
echo ""
echo "Configured routes:"
echo "  /api/health     - Health check (no auth, rate limited)"
echo "  /api/e2e-test   - JWT authenticated route"
echo "  /api/compiler   - Rate limited (100/min)"
echo "  /api/trpc       - tRPC routes"
echo "  /api/workflows  - Workflow routes"
echo ""
echo "Run E2E tests with:"
echo "  KONG_E2E=true KONG_ADMIN_URL=http://localhost:9001 KONG_PROXY_URL=http://localhost:9000 pnpm test -- --run src/lib/kong/__tests__/kong-e2e.test.ts"
echo ""
echo "To stop the test environment:"
echo "  ./scripts/stop-test-env.sh"
