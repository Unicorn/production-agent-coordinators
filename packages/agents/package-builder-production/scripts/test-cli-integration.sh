#!/bin/bash
# Test script for CLI agent integration
# This script runs end-to-end tests for the CLI agent integration

set -e

echo "🧪 CLI Agent Integration Test Script"
echo "===================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check Gemini CLI
if command -v gemini &> /dev/null; then
    GEMINI_VERSION=$(gemini --version 2>&1 || echo "unknown")
    echo -e "${GREEN}✅ Gemini CLI found: ${GEMINI_VERSION}${NC}"
    GEMINI_AVAILABLE=true
else
    echo -e "${YELLOW}⚠️  Gemini CLI not found - Gemini tests will be skipped${NC}"
    GEMINI_AVAILABLE=false
fi

# Check Claude CLI
if command -v claude &> /dev/null; then
    CLAUDE_VERSION=$(claude --version 2>&1 || echo "unknown")
    echo -e "${GREEN}✅ Claude CLI found: ${CLAUDE_VERSION}${NC}"
    CLAUDE_AVAILABLE=true
else
    echo -e "${YELLOW}⚠️  Claude CLI not found - Claude tests will be skipped${NC}"
    CLAUDE_AVAILABLE=false
fi

# Check Temporal server (try multiple endpoints)
TEMPORAL_AVAILABLE=false
if nc -z localhost 7233 2>/dev/null; then
    echo -e "${GREEN}✅ Temporal server port 7233 is open${NC}"
    TEMPORAL_AVAILABLE=true
elif curl -s http://localhost:7233/health &> /dev/null; then
    echo -e "${GREEN}✅ Temporal server is running${NC}"
    TEMPORAL_AVAILABLE=true
elif curl -s http://localhost:8080 &> /dev/null; then
    echo -e "${GREEN}✅ Temporal UI is accessible (assuming server is running)${NC}"
    TEMPORAL_AVAILABLE=true
else
    echo -e "${YELLOW}⚠️  Temporal server health check failed, but port may be open${NC}"
    echo "   Checking if Temporal container is running..."
    if docker ps --filter "name=temporal" --format "{{.Names}}" | grep -q temporal; then
        echo -e "${GREEN}✅ Temporal container is running - proceeding with tests${NC}"
        TEMPORAL_AVAILABLE=true
    else
        echo -e "${RED}❌ Temporal server not running${NC}"
        echo "   Start Temporal with: docker-compose up -d temporal"
        TEMPORAL_AVAILABLE=false
    fi
fi

# Check environment variables
if [ -z "$GEMINI_API_KEY" ] && [ "$GEMINI_AVAILABLE" = true ]; then
    echo -e "${YELLOW}⚠️  GEMINI_API_KEY not set (may be handled by CLI)${NC}"
fi

if [ -z "$ANTHROPIC_API_KEY" ] && [ "$CLAUDE_AVAILABLE" = true ]; then
    echo -e "${YELLOW}⚠️  ANTHROPIC_API_KEY not set (may be handled by CLI)${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Run tests
if [ "$TEMPORAL_AVAILABLE" = false ]; then
    echo -e "${RED}❌ Cannot run tests: Temporal server not available${NC}"
    exit 1
fi

if [ "$GEMINI_AVAILABLE" = false ] && [ "$CLAUDE_AVAILABLE" = false ]; then
    echo -e "${RED}❌ Cannot run tests: No CLI tools available${NC}"
    exit 1
fi

echo "🚀 Running CLI integration tests..."
echo ""

# Run unit tests first
echo "📦 Running unit tests..."
yarn test cli-agent.activities.test.ts || {
    echo -e "${RED}❌ Unit tests failed${NC}"
    exit 1
}

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Run integration tests
echo "🔗 Running integration tests..."
yarn test cli-integration.e2e.test.ts || {
    echo -e "${RED}❌ Integration tests failed${NC}"
    exit 1
}

echo ""
echo -e "${GREEN}✅ All tests passed!${NC}"
echo ""

