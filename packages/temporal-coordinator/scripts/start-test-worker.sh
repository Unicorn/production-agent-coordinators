#!/bin/bash
# Start a Temporal worker for integration tests
#
# This script starts a worker bound to a specific task queue for test isolation.
# The worker runs in the foreground so you can see its output and stop it with Ctrl+C.
#
# Usage:
#   ./scripts/start-test-worker.sh [task-queue]
#
# Examples:
#   ./scripts/start-test-worker.sh agent-coordinator-e2e
#   ./scripts/start-test-worker.sh agent-coordinator-cli
#
# Environment variables:
#   TEMPORAL_ADDRESS - Temporal server address (default: localhost:7233)
#   TEMPORAL_NAMESPACE - Temporal namespace (default: default)

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Script is in packages/temporal-coordinator/scripts/, so go up one level
COORDINATOR_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Get task queue from argument or use default
TASK_QUEUE="${1:-agent-coordinator-e2e}"

# Set environment variables
export TEMPORAL_TASK_QUEUE="${TASK_QUEUE}"
export TEMPORAL_ADDRESS="${TEMPORAL_ADDRESS:-localhost:7233}"
export TEMPORAL_NAMESPACE="${TEMPORAL_NAMESPACE:-default}"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Starting Temporal Worker for Tests                      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}\n"

echo -e "${GREEN}📋 Configuration:${NC}"
echo -e "   Task Queue: ${TASK_QUEUE}"
echo -e "   Temporal Address: ${TEMPORAL_ADDRESS}"
echo -e "   Namespace: ${TEMPORAL_NAMESPACE}"
echo -e "   Worker Script: src/worker.ts"
echo ""

# Check if Temporal server is accessible
echo -e "${BLUE}🔍 Checking Temporal server...${NC}"
if ! nc -z localhost 7233 2>/dev/null && ! curl -s "http://${TEMPORAL_ADDRESS}/health" &>/dev/null; then
  echo -e "${YELLOW}⚠️  Warning: Cannot verify Temporal server at ${TEMPORAL_ADDRESS}${NC}"
  echo -e "${YELLOW}   Make sure Temporal is running: temporal server start-dev${NC}"
  echo ""
else
  echo -e "${GREEN}✅ Temporal server is accessible${NC}\n"
fi

# Change to temporal-coordinator directory
cd "$COORDINATOR_DIR"

echo -e "${BLUE}🚀 Starting worker...${NC}"
echo -e "${YELLOW}   Press Ctrl+C to stop the worker${NC}\n"

# Start worker using tsx (runs TypeScript directly)
exec npx tsx src/worker.ts

