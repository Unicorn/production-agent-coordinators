#!/bin/bash

################################################################################
# Demo Environment Stability Test Script
# Purpose: Verify demo environment is ready for stakeholder presentation
# Usage: ./scripts/test-demo-environment.sh
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to print test results
print_result() {
    local test_name=$1
    local result=$2
    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    if [ "$result" = "PASS" ]; then
        echo -e "${GREEN}✅ PASS${NC} - $test_name"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ FAIL${NC} - $test_name"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

# Function to check if service is responding
check_service() {
    local url=$1
    local name=$2

    if curl -sf "$url" > /dev/null 2>&1; then
        print_result "$name service is responding" "PASS"
        return 0
    else
        print_result "$name service is responding" "FAIL"
        return 1
    fi
}

echo "════════════════════════════════════════════════════════════════"
echo "  Demo Environment Stability Test"
echo "  Started: $(date)"
echo "════════════════════════════════════════════════════════════════"
echo ""

################################################################################
# Test 1: Infrastructure Health Checks
################################################################################

echo "📋 Test Group 1: Infrastructure Health Checks"
echo "────────────────────────────────────────────────────────────────"

# Test 1.1: Next.js App
if curl -sf http://localhost:3010/api/health > /dev/null 2>&1; then
    print_result "Next.js app is running on port 3010" "PASS"
else
    print_result "Next.js app is running on port 3010" "FAIL"
    echo -e "${YELLOW}💡 Hint: Run 'yarn dev' to start Next.js${NC}"
fi

# Test 1.2: Supabase
if [ -n "$NEXT_PUBLIC_SUPABASE_URL" ]; then
    if curl -sf "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/" > /dev/null 2>&1; then
        print_result "Supabase is accessible" "PASS"
    else
        print_result "Supabase is accessible" "FAIL"
        echo -e "${YELLOW}💡 Hint: Run 'supabase start' to start Supabase${NC}"
    fi
else
    print_result "Supabase environment variables are set" "FAIL"
    echo -e "${YELLOW}💡 Hint: Check .env.local for NEXT_PUBLIC_SUPABASE_URL${NC}"
fi

# Test 1.3: Temporal Server
if docker ps --filter "name=workflow-builder-temporal" --filter "status=running" | grep -q temporal; then
    print_result "Temporal server container is running" "PASS"

    # Check if Temporal is actually healthy
    if docker exec workflow-builder-temporal temporal --address 127.0.0.1:7233 operator search-attribute list > /dev/null 2>&1; then
        print_result "Temporal server is healthy" "PASS"
    else
        print_result "Temporal server is healthy" "FAIL"
        echo -e "${YELLOW}💡 Hint: Temporal may still be initializing. Wait 30 seconds.${NC}"
    fi
else
    print_result "Temporal server container is running" "FAIL"
    echo -e "${YELLOW}💡 Hint: Run 'docker-compose -f docker-compose.dev.yml up -d' to start Temporal${NC}"
fi

# Test 1.4: Temporal UI
if curl -sf http://localhost:8080 > /dev/null 2>&1; then
    print_result "Temporal UI is accessible" "PASS"
else
    print_result "Temporal UI is accessible" "FAIL"
fi

# Test 1.5: Kong Gateway (optional)
if docker ps --filter "name=workflow-builder-kong" --filter "status=running" | grep -q kong; then
    print_result "Kong gateway container is running" "PASS"

    if curl -sf http://localhost:8001 > /dev/null 2>&1; then
        print_result "Kong Admin API is accessible" "PASS"
    else
        print_result "Kong Admin API is accessible" "FAIL"
    fi
else
    echo -e "${YELLOW}⚠️  SKIP${NC} - Kong gateway (optional for demo)"
fi

echo ""

################################################################################
# Test 2: Database Verification
################################################################################

echo "📋 Test Group 2: Database Verification"
echo "────────────────────────────────────────────────────────────────"

# Test 2.1: Demo Workflows Project Exists
if [ -n "$DATABASE_URL" ] || [ -n "$NEXT_PUBLIC_SUPABASE_URL" ]; then
    # Use Supabase API to check for demo project
    DEMO_PROJECT_CHECK=$(curl -sf "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/projects?id=eq.dddddddd-0000-0000-0000-000000000001" \
        -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
        -H "Authorization: Bearer ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" 2>/dev/null || echo "[]")

    if echo "$DEMO_PROJECT_CHECK" | grep -q "Demo Workflows"; then
        print_result "Demo Workflows project exists in database" "PASS"
    else
        print_result "Demo Workflows project exists in database" "FAIL"
        echo -e "${YELLOW}💡 Hint: Run 'yarn tsx scripts/seed-demo-workflows.ts' to create demo data${NC}"
    fi

    # Test 2.2: Demo Workflows Count
    WORKFLOW_COUNT=$(curl -sf "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/workflows?project_id=eq.dddddddd-0000-0000-0000-000000000001&select=id" \
        -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
        -H "Authorization: Bearer ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" 2>/dev/null | grep -o '"id"' | wc -l || echo "0")

    if [ "$WORKFLOW_COUNT" -ge 4 ]; then
        print_result "Demo project has at least 4 workflows" "PASS"
        echo -e "   ${GREEN}Found $WORKFLOW_COUNT workflows${NC}"
    else
        print_result "Demo project has at least 4 workflows" "FAIL"
        echo -e "   ${RED}Found only $WORKFLOW_COUNT workflows (expected 4+)${NC}"
        echo -e "${YELLOW}💡 Hint: Run 'yarn tsx scripts/seed-demo-workflows.ts' to seed demo workflows${NC}"
    fi
else
    print_result "Database connection configured" "FAIL"
    echo -e "${YELLOW}💡 Hint: Set DATABASE_URL or NEXT_PUBLIC_SUPABASE_URL in .env.local${NC}"
fi

echo ""

################################################################################
# Test 3: Application Functionality
################################################################################

echo "📋 Test Group 3: Application Functionality"
echo "────────────────────────────────────────────────────────────────"

# Test 3.1: Home Page Loads
if curl -sf http://localhost:3010 | grep -q "workflow"; then
    print_result "Home page loads successfully" "PASS"
else
    print_result "Home page loads successfully" "FAIL"
fi

# Test 3.2: API Health Endpoint
API_HEALTH=$(curl -sf http://localhost:3010/api/health 2>/dev/null || echo "")
if echo "$API_HEALTH" | grep -q "ok"; then
    print_result "API health endpoint returns OK" "PASS"
else
    print_result "API health endpoint returns OK" "FAIL"
fi

# Test 3.3: tRPC Endpoint
# Check if tRPC endpoint responds (even with auth error is fine)
if curl -sf http://localhost:3010/api/trpc/workflows.list 2>&1 | grep -qE "(UNAUTHORIZED|workflows)"; then
    print_result "tRPC endpoints are responding" "PASS"
else
    print_result "tRPC endpoints are responding" "FAIL"
fi

echo ""

################################################################################
# Test 4: Performance Benchmarks
################################################################################

echo "📋 Test Group 4: Performance Benchmarks"
echo "────────────────────────────────────────────────────────────────"

# Test 4.1: Home Page Response Time
START_TIME=$(date +%s%N)
curl -sf http://localhost:3010 > /dev/null 2>&1
END_TIME=$(date +%s%N)
RESPONSE_TIME=$(( (END_TIME - START_TIME) / 1000000 ))  # Convert to milliseconds

if [ "$RESPONSE_TIME" -lt 2000 ]; then
    print_result "Home page response time < 2s (${RESPONSE_TIME}ms)" "PASS"
else
    print_result "Home page response time < 2s (${RESPONSE_TIME}ms)" "FAIL"
    echo -e "${YELLOW}💡 Hint: Response time is slow. Check system load.${NC}"
fi

# Test 4.2: API Response Time
START_TIME=$(date +%s%N)
curl -sf http://localhost:3010/api/health > /dev/null 2>&1
END_TIME=$(date +%s%N)
API_RESPONSE_TIME=$(( (END_TIME - START_TIME) / 1000000 ))

if [ "$API_RESPONSE_TIME" -lt 500 ]; then
    print_result "API response time < 500ms (${API_RESPONSE_TIME}ms)" "PASS"
else
    print_result "API response time < 500ms (${API_RESPONSE_TIME}ms)" "FAIL"
fi

echo ""

################################################################################
# Test 5: Docker Container Health
################################################################################

echo "📋 Test Group 5: Docker Container Health"
echo "────────────────────────────────────────────────────────────────"

# Test 5.1: Container Count
RUNNING_CONTAINERS=$(docker ps --filter "name=workflow-builder" --format "{{.Names}}" | wc -l)
if [ "$RUNNING_CONTAINERS" -ge 3 ]; then
    print_result "Required containers are running ($RUNNING_CONTAINERS/4)" "PASS"
else
    print_result "Required containers are running ($RUNNING_CONTAINERS/4)" "FAIL"
    echo -e "${YELLOW}💡 Hint: Run 'docker-compose -f docker-compose.dev.yml up -d' to start all containers${NC}"
fi

# Test 5.2: No Unhealthy Containers
UNHEALTHY=$(docker ps --filter "name=workflow-builder" --filter "health=unhealthy" --format "{{.Names}}" | wc -l)
if [ "$UNHEALTHY" -eq 0 ]; then
    print_result "No unhealthy containers" "PASS"
else
    print_result "No unhealthy containers" "FAIL"
    UNHEALTHY_NAMES=$(docker ps --filter "name=workflow-builder" --filter "health=unhealthy" --format "{{.Names}}")
    echo -e "${RED}   Unhealthy containers: $UNHEALTHY_NAMES${NC}"
fi

# Test 5.3: Container Resource Usage
HIGH_CPU=$(docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}" | grep workflow-builder | awk '{if ($2 > 80) print $1}' | wc -l)
if [ "$HIGH_CPU" -eq 0 ]; then
    print_result "No containers using >80% CPU" "PASS"
else
    print_result "No containers using >80% CPU" "FAIL"
    echo -e "${YELLOW}⚠️  Some containers are under high CPU load${NC}"
fi

echo ""

################################################################################
# Test 6: File System and Configuration
################################################################################

echo "📋 Test Group 6: File System and Configuration"
echo "────────────────────────────────────────────────────────────────"

# Test 6.1: Environment File Exists
if [ -f ".env.local" ]; then
    print_result ".env.local configuration file exists" "PASS"
else
    print_result ".env.local configuration file exists" "FAIL"
    echo -e "${YELLOW}💡 Hint: Copy .env.local.example to .env.local and configure${NC}"
fi

# Test 6.2: Required Environment Variables
REQUIRED_VARS=("NEXT_PUBLIC_SUPABASE_URL" "NEXT_PUBLIC_SUPABASE_ANON_KEY")
MISSING_VARS=0

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS=$((MISSING_VARS + 1))
        echo -e "   ${RED}Missing: $var${NC}"
    fi
done

if [ "$MISSING_VARS" -eq 0 ]; then
    print_result "All required environment variables are set" "PASS"
else
    print_result "All required environment variables are set" "FAIL"
    echo -e "${YELLOW}💡 Hint: Check .env.local for missing variables${NC}"
fi

# Test 6.3: Example Workflows Exist
if [ -f "examples/milestone-1/api-orchestration.json" ] && \
   [ -f "examples/milestone-1/data-pipeline.json" ] && \
   [ -f "examples/milestone-1/notification-chain.json" ] && \
   [ -f "examples/milestone-1/order-fulfillment.json" ]; then
    print_result "All example workflow files exist" "PASS"
else
    print_result "All example workflow files exist" "FAIL"
fi

# Test 6.4: Demo Documentation Exists
if [ -f "docs/demo/milestone-1-script.md" ] && \
   [ -f "docs/demo/talking-points.md" ] && \
   [ -f "docs/demo/success-metrics.md" ]; then
    print_result "Demo documentation files exist" "PASS"
else
    print_result "Demo documentation files exist" "FAIL"
fi

echo ""

################################################################################
# Test 7: E2E Test Readiness (Optional)
################################################################################

echo "📋 Test Group 7: E2E Test Readiness"
echo "────────────────────────────────────────────────────────────────"

# Test 7.1: Playwright Installed
if command -v playwright > /dev/null 2>&1 || [ -f "node_modules/.bin/playwright" ]; then
    print_result "Playwright is installed" "PASS"
else
    print_result "Playwright is installed" "FAIL"
    echo -e "${YELLOW}💡 Hint: Run 'yarn add -D @playwright/test' to install Playwright${NC}"
fi

# Test 7.2: Test Auth Credentials
if [ -f "playwright/.auth/user.json" ]; then
    print_result "Test authentication file exists" "PASS"
else
    print_result "Test authentication file exists" "FAIL"
    echo -e "${YELLOW}💡 Hint: Run 'yarn test:e2e:auth' to generate auth file${NC}"
fi

echo ""

################################################################################
# Summary
################################################################################

echo "════════════════════════════════════════════════════════════════"
echo "  Test Summary"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Total Tests:  $TOTAL_TESTS"
echo -e "${GREEN}Passed:       $PASSED_TESTS${NC}"
if [ "$FAILED_TESTS" -gt 0 ]; then
    echo -e "${RED}Failed:       $FAILED_TESTS${NC}"
else
    echo "Failed:       $FAILED_TESTS"
fi
echo ""

# Calculate pass rate
PASS_RATE=$(( PASSED_TESTS * 100 / TOTAL_TESTS ))
echo "Pass Rate:    $PASS_RATE%"
echo ""

# Overall Status
if [ "$FAILED_TESTS" -eq 0 ]; then
    echo -e "${GREEN}✅ DEMO ENVIRONMENT IS READY${NC}"
    echo ""
    echo "Next Steps:"
    echo "  1. Run demo rehearsal: Follow docs/demo/milestone-1-script.md"
    echo "  2. Test E2E: yarn test:e2e"
    echo "  3. Create backup recording: Follow docs/demo/recording-script.md"
    echo ""
    exit 0
elif [ "$PASS_RATE" -ge 80 ]; then
    echo -e "${YELLOW}⚠️  DEMO ENVIRONMENT MOSTLY READY (with minor issues)${NC}"
    echo ""
    echo "Fix the failed tests above before demo."
    echo "Most critical services are working."
    echo ""
    exit 1
else
    echo -e "${RED}❌ DEMO ENVIRONMENT NOT READY${NC}"
    echo ""
    echo "Critical issues detected. Fix failed tests before demo."
    echo "Review setup guide: docs/demo/demo-environment-setup.md"
    echo ""
    exit 2
fi
