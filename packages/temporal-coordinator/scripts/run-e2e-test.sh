#!/bin/bash
# Run E2E integration test (assumes worker is already running)
#
# This script runs the E2E integration test. It expects a worker to be
# running on the test task queue (start it separately with start-test-worker.sh).
#
# Usage:
#   ./scripts/run-e2e-test.sh [plan-file] [options]
#
# Examples:
#   ./scripts/run-e2e-test.sh src/test-package-spec.md
#   ./scripts/run-e2e-test.sh src/test-package-spec.md --create-pr
#   ./scripts/run-e2e-test.sh src/test-package-spec.md --task-queue agent-coordinator-e2e

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Script is in packages/temporal-coordinator/scripts/, so go up one level
COORDINATOR_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Get plan file from first argument
PLAN_FILE="${1:-src/test-package-spec.md}"
shift || true

# Remaining arguments are passed to the test script
EXTRA_ARGS="$@"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Running E2E Integration Test                             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}\n"

# Change to temporal-coordinator directory
cd "$COORDINATOR_DIR"

# Check if plan file exists
if [ ! -f "$PLAN_FILE" ]; then
  echo -e "${RED}❌ Plan file not found: ${PLAN_FILE}${NC}"
  exit 1
fi

echo -e "${GREEN}📋 Test Configuration:${NC}"
echo -e "   Plan File: ${PLAN_FILE}"
echo -e "   Extra Args: ${EXTRA_ARGS:-none}"
echo ""

# Check if Temporal server is accessible
echo -e "${BLUE}🔍 Checking Temporal server...${NC}"
if ! nc -z localhost 7233 2>/dev/null && ! curl -s http://localhost:7233/health &>/dev/null; then
  echo -e "${RED}❌ Temporal server is not accessible${NC}"
  echo -e "${YELLOW}   Start it with: temporal server start-dev${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Temporal server is accessible${NC}\n"

# Note about worker
echo -e "${YELLOW}ℹ️  Note: Make sure a worker is running for your test task queue${NC}"
echo -e "${YELLOW}   Start worker with: ./scripts/start-test-worker.sh [task-queue]${NC}"
echo -e "${YELLOW}   Default task queue: agent-coordinator-e2e${NC}\n"

# Run the test
echo -e "${BLUE}🧪 Running test...${NC}\n"
npx tsx src/test-integration-e2e.ts -p "$PLAN_FILE" $EXTRA_ARGS

