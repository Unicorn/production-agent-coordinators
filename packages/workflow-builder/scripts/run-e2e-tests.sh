#!/bin/bash
# Run E2E Tests
# Starts fresh test environment, runs E2E tests, then tears down
# Usage: ./scripts/run-e2e-tests.sh [test-pattern]
#
# Examples:
#   ./scripts/run-e2e-tests.sh                           # Run all E2E tests
#   ./scripts/run-e2e-tests.sh kong-e2e                  # Run Kong E2E tests
#   ./scripts/run-e2e-tests.sh "src/lib/kong/**/*.ts"    # Run specific pattern

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
TEST_PATTERN="${1:-}"

# Cleanup function for trap
cleanup() {
    echo ""
    echo "Cleaning up test environment..."
    "$SCRIPT_DIR/stop-test-env.sh"
}

# Set trap to cleanup on exit (success or failure)
trap cleanup EXIT

echo "=========================================="
echo "  E2E Test Runner"
echo "=========================================="
echo ""

# Start test environment
"$SCRIPT_DIR/start-test-env.sh"

echo ""
echo "=========================================="
echo "  Running E2E Tests"
echo "=========================================="
echo ""

# Set environment variables for test infrastructure
export KONG_E2E=true
export KONG_ADMIN_URL=http://localhost:9001
export KONG_PROXY_URL=http://localhost:9000
export TEMPORAL_ADDRESS=localhost:9233

# Run the tests
cd "$PROJECT_DIR"

if [ -n "$TEST_PATTERN" ]; then
    echo "Running tests matching: $TEST_PATTERN"
    pnpm test -- --run "$TEST_PATTERN"
else
    echo "Running all E2E tests..."
    pnpm test -- --run "src/**/*e2e*.test.ts"
fi

TEST_EXIT_CODE=$?

echo ""
echo "=========================================="
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "  E2E Tests PASSED"
else
    echo "  E2E Tests FAILED (exit code: $TEST_EXIT_CODE)"
fi
echo "=========================================="

exit $TEST_EXIT_CODE
