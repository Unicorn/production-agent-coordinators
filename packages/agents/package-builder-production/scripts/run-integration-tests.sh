#!/bin/bash
# Integration Test Runner for Claude CLI Integration
#
# This script runs integration tests against real services and workflows.
# Prerequisites must be met before running (see integration-testing-checklist.md)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo -e "${BLUE}=== Claude CLI Integration Test Runner ===${NC}\n"

# ─────────────────────────────────────────────────────────────────────────────
# Prerequisites Check
# ─────────────────────────────────────────────────────────────────────────────

echo -e "${YELLOW}Checking prerequisites...${NC}"

# Check Temporal
if ! command -v temporal &> /dev/null; then
  echo -e "${RED}✗ Temporal CLI not found${NC}"
  echo "  Install: https://docs.temporal.io/cli"
  exit 1
fi
echo -e "${GREEN}✓ Temporal CLI found${NC}"

# Check GitHub CLI
if ! command -v gh &> /dev/null; then
  echo -e "${RED}✗ GitHub CLI not found${NC}"
  echo "  Install: brew install gh"
  exit 1
fi

if ! gh auth status &> /dev/null; then
  echo -e "${RED}✗ GitHub CLI not authenticated${NC}"
  echo "  Run: gh auth login"
  exit 1
fi
echo -e "${GREEN}✓ GitHub CLI authenticated${NC}"

# Check Claude CLI
if ! command -v claude &> /dev/null; then
  echo -e "${RED}✗ Claude CLI not found${NC}"
  echo "  Install: npm install -g @anthropic-ai/claude-code"
  exit 1
fi

# Test Claude CLI
if ! claude --version &> /dev/null; then
  echo -e "${RED}✗ Claude CLI not working${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Claude CLI found${NC}"

# Check Node/npm
if ! command -v node &> /dev/null; then
  echo -e "${RED}✗ Node.js not found${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Node.js found${NC}"

# Check if Temporal server is running
if ! temporal workflow list &> /dev/null; then
  echo -e "${YELLOW}⚠ Temporal server connection failed${NC}"
  echo "  Make sure Temporal server is running"
  echo "  Run: temporal server start-dev"
  read -p "Continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
else
  echo -e "${GREEN}✓ Temporal server connected${NC}"
fi

echo -e "\n${GREEN}All prerequisites met!${NC}\n"

# ─────────────────────────────────────────────────────────────────────────────
# Test Selection
# ─────────────────────────────────────────────────────────────────────────────

echo -e "${BLUE}Available Tests:${NC}"
echo "  1. Credential Checks"
echo "  2. End-to-End Package Build"
echo "  3. Hook Execution Verification"
echo "  4. Optimization Dashboard"
echo "  5. Parallel Workflow"
echo "  6. Model Selection"
echo "  7. Session Management"
echo "  8. Error Handling"
echo "  9. All Tests"
echo "  0. Exit"

read -p "Select test to run (0-9): " test_choice

case $test_choice in
  1)
    echo -e "\n${BLUE}Running: Credential Checks${NC}"
    cd "$PROJECT_ROOT/packages/agents/package-builder-production"
    npm run test -- credentials.activities.test.ts
    ;;
  2)
    echo -e "\n${BLUE}Running: End-to-End Package Build${NC}"
    echo -e "${YELLOW}This will create a real PR. Continue? (y/n)${NC}"
    read -p "" -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      echo "TODO: Implement E2E test script"
      echo "This should run ClaudeAuditedBuildWorkflow with a test package"
    fi
    ;;
  3)
    echo -e "\n${BLUE}Running: Hook Execution Verification${NC}"
    echo "TODO: Implement hook verification test"
    echo "This should verify hooks are called during Claude CLI execution"
    ;;
  4)
    echo -e "\n${BLUE}Running: Optimization Dashboard${NC}"
    cd "$PROJECT_ROOT/packages/agents/package-builder-production"
    echo "Running optimization dashboard on test data..."
    # TODO: Point to test workspace with audit logs
    npm run optimization-dashboard -- /tmp/test-workspace
    ;;
  5)
    echo -e "\n${BLUE}Running: Parallel Workflow${NC}"
    echo "TODO: Implement parallel workflow test"
    echo "This should test ParallelBuildWorkflow with multiple tasks"
    ;;
  6)
    echo -e "\n${BLUE}Running: Model Selection${NC}"
    echo "TODO: Implement model selection test"
    echo "This should verify correct models are used for each phase"
    ;;
  7)
    echo -e "\n${BLUE}Running: Session Management${NC}"
    echo "TODO: Implement session management test"
    echo "This should verify session continuity across workflow steps"
    ;;
  8)
    echo -e "\n${BLUE}Running: Error Handling${NC}"
    echo "TODO: Implement error handling test"
    echo "This should verify errors are handled gracefully"
    ;;
  9)
    echo -e "\n${BLUE}Running: All Tests${NC}"
    echo -e "${YELLOW}This will run all integration tests. Continue? (y/n)${NC}"
    read -p "" -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      echo "Running all tests sequentially..."
      # TODO: Run all tests
    fi
    ;;
  0)
    echo "Exiting..."
    exit 0
    ;;
  *)
    echo -e "${RED}Invalid selection${NC}"
    exit 1
    ;;
esac

echo -e "\n${GREEN}Test completed!${NC}"

