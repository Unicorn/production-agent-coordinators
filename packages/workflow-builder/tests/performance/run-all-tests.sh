#!/bin/bash

##
# Run All K6 Performance Tests
#
# This script runs all performance tests in sequence and generates
# a combined performance report.
#
# Usage:
#   ./tests/performance/run-all-tests.sh [environment]
#
# Arguments:
#   environment - local (default), staging, or production
#
# Environment Variables:
#   BASE_URL         - Override base URL
#   ACCESS_TOKEN     - Authentication token (required)
#   SKIP_CLEANUP     - Skip cleanup after tests (default: false)
##

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPORTS_DIR="$SCRIPT_DIR/reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ENV="${1:-local}"

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    echo -e "${RED}Error: k6 is not installed${NC}"
    echo "Install k6: https://k6.io/docs/getting-started/installation/"
    exit 1
fi

# Create reports directory
mkdir -p "$REPORTS_DIR"

# Load environment variables from .env.test.local
if [ -f "$SCRIPT_DIR/../../.env.test.local" ]; then
    echo -e "${BLUE}Loading test environment variables...${NC}"
    export $(grep -v '^#' "$SCRIPT_DIR/../../.env.test.local" | xargs)
fi

# Validate required environment variables
if [ -z "$ACCESS_TOKEN" ] && [ -z "$SUPABASE_TEST_ACCESS_TOKEN" ]; then
    echo -e "${RED}Error: ACCESS_TOKEN or SUPABASE_TEST_ACCESS_TOKEN is required${NC}"
    echo "Set it in .env.test.local or as an environment variable"
    exit 1
fi

# Use SUPABASE_TEST_ACCESS_TOKEN if ACCESS_TOKEN not set
ACCESS_TOKEN="${ACCESS_TOKEN:-$SUPABASE_TEST_ACCESS_TOKEN}"

# Set BASE_URL based on environment
if [ -z "$BASE_URL" ]; then
    case "$ENV" in
        local)
            BASE_URL="http://localhost:3010"
            ;;
        staging)
            BASE_URL="${STAGING_URL:-https://staging.example.com}"
            ;;
        production)
            BASE_URL="${PRODUCTION_URL:-https://api.example.com}"
            ;;
        *)
            echo -e "${RED}Error: Invalid environment: $ENV${NC}"
            echo "Valid environments: local, staging, production"
            exit 1
            ;;
    esac
fi

echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  K6 Performance Test Suite                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Environment:${NC}    $ENV"
echo -e "${BLUE}Base URL:${NC}       $BASE_URL"
echo -e "${BLUE}Reports Dir:${NC}    $REPORTS_DIR"
echo -e "${BLUE}Timestamp:${NC}      $TIMESTAMP"
echo ""

# Test configuration
declare -a TESTS=(
    "workflow-creation.k6.js:Workflow Creation Test"
    "workflow-execution.k6.js:Workflow Execution Test"
    "compiler-stress.k6.js:Compiler Stress Test"
)

# Track test results
PASSED_TESTS=0
FAILED_TESTS=0
declare -a FAILED_TEST_NAMES

# Run each test
for test_entry in "${TESTS[@]}"; do
    IFS=':' read -r test_file test_name <<< "$test_entry"
    test_path="$SCRIPT_DIR/$test_file"

    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}Running: $test_name${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    if [ ! -f "$test_path" ]; then
        echo -e "${RED}✗ Test file not found: $test_file${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        FAILED_TEST_NAMES+=("$test_name (file not found)")
        continue
    fi

    # Run test
    if k6 run \
        --out json="$REPORTS_DIR/${test_file%.k6.js}_${TIMESTAMP}.json" \
        -e BASE_URL="$BASE_URL" \
        -e ACCESS_TOKEN="$ACCESS_TOKEN" \
        -e TEST_ENV="$ENV" \
        "$test_path"; then
        echo -e "${GREEN}✓ $test_name completed successfully${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗ $test_name failed${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        FAILED_TEST_NAMES+=("$test_name")
    fi

    echo ""
    sleep 2  # Brief pause between tests
done

# Summary
echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Test Summary                              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Total Tests:    ${BLUE}$((PASSED_TESTS + FAILED_TESTS))${NC}"
echo -e "Passed:         ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed:         ${RED}$FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -gt 0 ]; then
    echo -e "${RED}Failed Tests:${NC}"
    for failed_test in "${FAILED_TEST_NAMES[@]}"; do
        echo -e "  ${RED}✗${NC} $failed_test"
    done
    echo ""
fi

echo -e "Reports saved to: ${BLUE}$REPORTS_DIR${NC}"
echo ""

# Generate combined report
COMBINED_REPORT="$REPORTS_DIR/combined-report-${TIMESTAMP}.md"
cat > "$COMBINED_REPORT" <<EOF
# Performance Test Report

**Generated:** $(date)
**Environment:** $ENV
**Base URL:** $BASE_URL

## Summary

- **Total Tests:** $((PASSED_TESTS + FAILED_TESTS))
- **Passed:** $PASSED_TESTS
- **Failed:** $FAILED_TESTS

## Test Results

EOF

for test_entry in "${TESTS[@]}"; do
    IFS=':' read -r test_file test_name <<< "$test_entry"
    report_json="$REPORTS_DIR/${test_file%.k6.js}-report.json"

    if [ -f "$report_json" ]; then
        cat >> "$COMBINED_REPORT" <<EOF

### $test_name

\`\`\`json
$(cat "$report_json")
\`\`\`

EOF
    fi
done

echo -e "${GREEN}Combined report saved to: $COMBINED_REPORT${NC}"
echo ""

# Cleanup (optional)
if [ -z "$SKIP_CLEANUP" ] || [ "$SKIP_CLEANUP" = "false" ]; then
    echo -e "${YELLOW}Note: Test data cleanup should be performed separately${NC}"
    echo -e "${YELLOW}Run: npm run test:cleanup${NC}"
    echo ""
fi

# Exit with appropriate code
if [ $FAILED_TESTS -gt 0 ]; then
    exit 1
else
    exit 0
fi
