#!/bin/bash
# Run Rust Compiler E2E Tests
# Tests Kong routing to the Rust workflow compiler service
#
# Usage:
#   ./scripts/run-rust-compiler-e2e.sh          # Full test with Docker infrastructure
#   ./scripts/run-rust-compiler-e2e.sh direct   # Direct test (compiler must be running)
#
# Prerequisites:
#   - Docker and Docker Compose installed
#   - Rust compiler built (for direct mode, run 'pnpm rust:build' first)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
TEST_MODE="${1:-full}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=========================================="
echo "  Rust Compiler E2E Test Runner"
echo -e "==========================================${NC}"
echo ""

cd "$PROJECT_DIR"

if [ "$TEST_MODE" = "direct" ]; then
    echo -e "${YELLOW}Mode: Direct (testing against running Rust compiler)${NC}"
    echo ""

    # Check if Rust compiler is running
    if ! curl -s "http://localhost:3020/health" > /dev/null 2>&1; then
        echo -e "${RED}Error: Rust compiler is not running at http://localhost:3020${NC}"
        echo ""
        echo "Please start the Rust compiler first:"
        echo "  pnpm rust:run"
        echo ""
        echo "Or run with Docker infrastructure:"
        echo "  ./scripts/run-rust-compiler-e2e.sh"
        exit 1
    fi

    echo -e "${GREEN}Rust compiler is running${NC}"
    echo ""

    # Run tests directly against compiler
    export RUST_COMPILER_E2E=true
    export RUST_COMPILER_URL=http://localhost:3020

    echo "Running Rust compiler E2E tests..."
    pnpm test -- --run src/lib/kong/__tests__/rust-compiler-e2e.test.ts

else
    echo -e "${YELLOW}Mode: Full (starting Docker infrastructure)${NC}"
    echo ""

    # Cleanup function for trap
    cleanup() {
        echo ""
        echo -e "${YELLOW}Cleaning up Docker infrastructure...${NC}"
        docker-compose -f docker-compose.test.yml --profile rust-compiler down --remove-orphans 2>/dev/null || true
    }

    # Set trap to cleanup on exit
    trap cleanup EXIT

    # Build Rust compiler if not already built
    echo -e "${BLUE}Building Rust compiler...${NC}"
    if [ ! -f "workflow-compiler-rs/target/release/workflow-compiler" ]; then
        pnpm rust:build
    fi

    # Start Docker infrastructure with Rust compiler profile
    echo -e "${BLUE}Starting Docker infrastructure with Rust compiler...${NC}"
    docker-compose -f docker-compose.test.yml --profile rust-compiler up -d

    # Wait for services to be healthy
    echo -e "${BLUE}Waiting for services to be healthy...${NC}"

    # Wait for Kong
    echo -n "  Kong: "
    for i in {1..30}; do
        if curl -s "http://localhost:9001/status" > /dev/null 2>&1; then
            echo -e "${GREEN}ready${NC}"
            break
        fi
        echo -n "."
        sleep 2
    done

    # Wait for Rust compiler
    echo -n "  Rust Compiler: "
    for i in {1..30}; do
        if curl -s "http://localhost:3120/health" > /dev/null 2>&1; then
            echo -e "${GREEN}ready${NC}"
            break
        fi
        echo -n "."
        sleep 2
    done

    # Verify services are ready
    if ! curl -s "http://localhost:9001/status" > /dev/null 2>&1; then
        echo -e "${RED}Error: Kong is not healthy${NC}"
        docker-compose -f docker-compose.test.yml logs kong-test
        exit 1
    fi

    if ! curl -s "http://localhost:3120/health" > /dev/null 2>&1; then
        echo -e "${RED}Error: Rust compiler is not healthy${NC}"
        docker-compose -f docker-compose.test.yml logs rust-compiler-test
        exit 1
    fi

    echo ""
    echo -e "${GREEN}All services are ready!${NC}"
    echo ""

    # Run tests with full infrastructure
    export RUST_COMPILER_E2E=true
    export RUST_COMPILER_URL=http://localhost:3120
    export KONG_ADMIN_URL=http://localhost:9001
    export KONG_PROXY_URL=http://localhost:9000

    echo -e "${BLUE}Running Rust compiler E2E tests...${NC}"
    pnpm test -- --run src/lib/kong/__tests__/rust-compiler-e2e.test.ts
fi

TEST_EXIT_CODE=$?

echo ""
echo -e "${BLUE}=========================================="
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}  Rust Compiler E2E Tests PASSED${NC}"
else
    echo -e "${RED}  Rust Compiler E2E Tests FAILED (exit code: $TEST_EXIT_CODE)${NC}"
fi
echo -e "${BLUE}==========================================${NC}"

exit $TEST_EXIT_CODE
