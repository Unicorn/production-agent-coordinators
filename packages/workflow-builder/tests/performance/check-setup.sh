#!/bin/bash

##
# Performance Test Setup Verification
#
# Verifies all prerequisites are installed and configured
#
# Usage:
#   ./tests/performance/check-setup.sh
##

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Performance Test Setup Check             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

# Track issues
ISSUES=0
WARNINGS=0

# Check k6 installation
echo -e "${BLUE}Checking k6 installation...${NC}"
if command -v k6 &> /dev/null; then
    K6_VERSION=$(k6 version 2>&1 | head -n 1)
    echo -e "  ${GREEN}✓${NC} k6 is installed: $K6_VERSION"
else
    echo -e "  ${RED}✗${NC} k6 is not installed"
    echo -e "    Install: https://k6.io/docs/getting-started/installation/"
    ISSUES=$((ISSUES + 1))
fi
echo ""

# Check Node.js
echo -e "${BLUE}Checking Node.js...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "  ${GREEN}✓${NC} Node.js is installed: $NODE_VERSION"
else
    echo -e "  ${RED}✗${NC} Node.js is not installed"
    ISSUES=$((ISSUES + 1))
fi
echo ""

# Check npm
echo -e "${BLUE}Checking npm...${NC}"
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo -e "  ${GREEN}✓${NC} npm is installed: v$NPM_VERSION"
else
    echo -e "  ${RED}✗${NC} npm is not installed"
    ISSUES=$((ISSUES + 1))
fi
echo ""

# Check .env.test.local
echo -e "${BLUE}Checking environment configuration...${NC}"
if [ -f "$SCRIPT_DIR/../../.env.test.local" ]; then
    echo -e "  ${GREEN}✓${NC} .env.test.local exists"

    # Check required variables
    source "$SCRIPT_DIR/../../.env.test.local" 2>/dev/null || true

    if [ -n "$SUPABASE_TEST_ACCESS_TOKEN" ]; then
        echo -e "  ${GREEN}✓${NC} SUPABASE_TEST_ACCESS_TOKEN is set"
    else
        echo -e "  ${RED}✗${NC} SUPABASE_TEST_ACCESS_TOKEN is not set"
        ISSUES=$((ISSUES + 1))
    fi

    if [ -n "$BASE_URL" ]; then
        echo -e "  ${GREEN}✓${NC} BASE_URL is set: $BASE_URL"
    else
        echo -e "  ${YELLOW}⚠${NC} BASE_URL is not set (will default to http://localhost:3010)"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "  ${YELLOW}⚠${NC} .env.test.local not found"
    echo -e "    Copy .env.test.local.example to .env.test.local and configure"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Check if application is running
echo -e "${BLUE}Checking application status...${NC}"
BASE_URL="${BASE_URL:-http://localhost:3010}"
if curl -f "$BASE_URL/api/health" 2>/dev/null > /dev/null; then
    echo -e "  ${GREEN}✓${NC} Application is running at $BASE_URL"
else
    echo -e "  ${YELLOW}⚠${NC} Application is not running at $BASE_URL"
    echo -e "    Start with: npm run dev"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Check test files exist
echo -e "${BLUE}Checking test files...${NC}"
declare -a TEST_FILES=(
    "workflow-creation.k6.js"
    "workflow-execution.k6.js"
    "compiler-stress.k6.js"
    "config.js"
    "run-all-tests.sh"
)

for file in "${TEST_FILES[@]}"; do
    if [ -f "$SCRIPT_DIR/$file" ]; then
        echo -e "  ${GREEN}✓${NC} $file"
    else
        echo -e "  ${RED}✗${NC} $file not found"
        ISSUES=$((ISSUES + 1))
    fi
done
echo ""

# Check reports directory
echo -e "${BLUE}Checking reports directory...${NC}"
if [ -d "$SCRIPT_DIR/reports" ]; then
    echo -e "  ${GREEN}✓${NC} Reports directory exists"

    # Check permissions
    if [ -w "$SCRIPT_DIR/reports" ]; then
        echo -e "  ${GREEN}✓${NC} Reports directory is writable"
    else
        echo -e "  ${RED}✗${NC} Reports directory is not writable"
        ISSUES=$((ISSUES + 1))
    fi
else
    echo -e "  ${YELLOW}⚠${NC} Reports directory not found (will be created)"
    mkdir -p "$SCRIPT_DIR/reports"
    echo -e "  ${GREEN}✓${NC} Created reports directory"
fi
echo ""

# Summary
echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Setup Check Summary                       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

if [ $ISSUES -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed! You're ready to run performance tests.${NC}"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo -e "  1. Start application: ${YELLOW}npm run dev${NC}"
    echo -e "  2. Run tests: ${YELLOW}npm run test:perf${NC}"
    echo ""
    exit 0
elif [ $ISSUES -eq 0 ]; then
    echo -e "${YELLOW}⚠ Setup complete with warnings: $WARNINGS${NC}"
    echo -e "You can run performance tests, but check the warnings above."
    echo ""
    exit 0
else
    echo -e "${RED}✗ Setup incomplete: $ISSUES issues, $WARNINGS warnings${NC}"
    echo -e "Please resolve the issues above before running performance tests."
    echo ""

    # Provide helpful next steps
    echo -e "${BLUE}Quick Fix Guide:${NC}"
    echo ""

    if ! command -v k6 &> /dev/null; then
        echo -e "${YELLOW}Install k6:${NC}"
        echo -e "  macOS:    ${GREEN}brew install k6${NC}"
        echo -e "  Linux:    See https://k6.io/docs/getting-started/installation/"
        echo ""
    fi

    if [ ! -f "$SCRIPT_DIR/../../.env.test.local" ]; then
        echo -e "${YELLOW}Create .env.test.local:${NC}"
        echo -e "  ${GREEN}cp .env.test.local.example .env.test.local${NC}"
        echo -e "  Edit the file and set SUPABASE_TEST_ACCESS_TOKEN"
        echo ""
    fi

    exit 1
fi
