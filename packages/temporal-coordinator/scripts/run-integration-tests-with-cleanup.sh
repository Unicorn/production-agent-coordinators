#!/bin/bash
# Run integration tests with automatic cleanup
#
# This script:
# 1. Runs integration tests
# 2. Cleans up workflows and workspaces after completion
# 3. Handles errors gracefully

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo -e "${BLUE}=== Integration Tests with Cleanup ===${NC}\n"

# Cleanup function
cleanup() {
  echo -e "\n${YELLOW}🧹 Running cleanup...${NC}"
  
  # Run cleanup script
  if [ -f "$SCRIPT_DIR/../scripts/cleanup-test-resources.sh" ]; then
    bash "$SCRIPT_DIR/../scripts/cleanup-test-resources.sh" || true
  fi
  
  echo -e "${GREEN}✅ Cleanup completed${NC}\n"
}

# Register cleanup on exit
trap cleanup EXIT INT TERM

# Run credential and hook tests
echo -e "${BLUE}Running Test 1: Credential Checks${NC}"
cd "$PROJECT_ROOT/packages/agents/package-builder-production"
npm test -- integration-test-1-credentials.test.ts || {
  echo -e "${RED}❌ Test 1 failed${NC}"
  exit 1
}

echo -e "\n${BLUE}Running Test 2: Hook Execution${NC}"
npm test -- integration-test-2-hooks.test.ts || {
  echo -e "${RED}❌ Test 2 failed${NC}"
  exit 1
}

echo -e "\n${GREEN}✅ All integration tests passed!${NC}"
echo -e "${YELLOW}ℹ️  Cleanup will run automatically on exit${NC}"

