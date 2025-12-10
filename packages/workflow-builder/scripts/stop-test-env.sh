#!/bin/bash
# Stop Test Environment
# Tears down the isolated test infrastructure
# Usage: ./scripts/stop-test-env.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Stopping test environment..."

# Stop and remove all test containers, networks, and volumes
docker compose -f "$PROJECT_DIR/docker-compose.test.yml" down --volumes --remove-orphans

echo "Test environment stopped and cleaned up."
