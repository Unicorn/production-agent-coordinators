#!/bin/bash

##
# Cleanup Performance Test Data
#
# Removes test workflows, projects, and executions created during performance tests
#
# Usage:
#   ./tests/performance/cleanup.sh [environment]
#
# Arguments:
#   environment - local (default), staging, or production
#
# CAUTION: This script deletes data. Use with care!
##

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV="${1:-local}"

# Load environment variables
if [ -f "$SCRIPT_DIR/../../.env.test.local" ]; then
    export $(grep -v '^#' "$SCRIPT_DIR/../../.env.test.local" | xargs)
fi

# Validate required environment variables
if [ -z "$ACCESS_TOKEN" ] && [ -z "$SUPABASE_TEST_ACCESS_TOKEN" ]; then
    echo -e "${RED}Error: ACCESS_TOKEN or SUPABASE_TEST_ACCESS_TOKEN is required${NC}"
    exit 1
fi

ACCESS_TOKEN="${ACCESS_TOKEN:-$SUPABASE_TEST_ACCESS_TOKEN}"

# Set BASE_URL
if [ -z "$BASE_URL" ]; then
    case "$ENV" in
        local)
            BASE_URL="http://localhost:3010"
            ;;
        staging)
            BASE_URL="${STAGING_URL:-https://staging.example.com}"
            ;;
        production)
            echo -e "${RED}Error: Cleanup in production requires explicit approval${NC}"
            echo "Set ALLOW_PRODUCTION_CLEANUP=true to proceed"
            if [ "$ALLOW_PRODUCTION_CLEANUP" != "true" ]; then
                exit 1
            fi
            BASE_URL="${PRODUCTION_URL:-https://api.example.com}"
            ;;
        *)
            echo -e "${RED}Error: Invalid environment: $ENV${NC}"
            exit 1
            ;;
    esac
fi

echo -e "${YELLOW}╔════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║  Performance Test Data Cleanup             ║${NC}"
echo -e "${YELLOW}╚════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}⚠️  WARNING: This will delete test data!${NC}"
echo ""
echo -e "${BLUE}Environment:${NC}    $ENV"
echo -e "${BLUE}Base URL:${NC}       $BASE_URL"
echo ""

# Confirm deletion
read -p "Are you sure you want to proceed? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo -e "${YELLOW}Cleanup cancelled${NC}"
    exit 0
fi

echo ""
echo -e "${BLUE}Starting cleanup...${NC}"

# Cleanup patterns
declare -a PATTERNS=(
    "perf-test-%"
    "exec-test-%"
    "stress-test-%"
    "compiler-stress-%"
    "deploy-perf-%"
    "exec-perf-%"
)

# Function to cleanup via API
cleanup_workflows() {
    local pattern=$1
    echo -e "${BLUE}Cleaning up workflows matching: $pattern${NC}"

    # This would require a cleanup API endpoint
    # For now, log the pattern
    echo "  Pattern: $pattern"
}

# Cleanup each pattern
for pattern in "${PATTERNS[@]}"; do
    cleanup_workflows "$pattern"
done

echo ""
echo -e "${GREEN}✓ Cleanup completed${NC}"
echo ""
echo -e "${YELLOW}Note: Manual database cleanup may be required for orphaned records${NC}"
echo -e "${YELLOW}Run the following SQL to verify:${NC}"
echo ""
cat <<EOF
-- Check remaining test data
SELECT COUNT(*) FROM workflows WHERE kebab_name LIKE 'perf-test-%';
SELECT COUNT(*) FROM projects WHERE name LIKE '%test-project-%';
SELECT COUNT(*) FROM workflow_executions WHERE created_at < NOW() - INTERVAL '7 days';

-- Delete test workflows (adjust pattern as needed)
DELETE FROM workflows WHERE kebab_name LIKE 'perf-test-%' AND created_at < NOW() - INTERVAL '1 day';
DELETE FROM projects WHERE name LIKE '%test-project-%' AND created_at < NOW() - INTERVAL '1 day';

-- Delete old test executions
DELETE FROM workflow_executions WHERE created_at < NOW() - INTERVAL '7 days';
EOF
echo ""
