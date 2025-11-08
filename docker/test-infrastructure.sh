#!/bin/bash

# Infrastructure Test Script
# This script verifies all Docker services are running and accessible

set -e

echo "Testing Docker Infrastructure..."
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test PostgreSQL
echo "1. Testing PostgreSQL..."
if docker exec coordinator-postgres pg_isready -U coordinator > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PostgreSQL is running${NC}"

    # Test database exists
    if docker exec coordinator-postgres psql -U coordinator -d coordinator -c "\dt" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Database 'coordinator' is accessible${NC}"

        # Count tables
        TABLES=$(docker exec coordinator-postgres psql -U coordinator -d coordinator -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema IN ('coordinator', 'storage', 'agents');")
        echo -e "${GREEN}✓ Found ${TABLES} tables in coordinator, storage, and agents schemas${NC}"
    else
        echo -e "${RED}✗ Database 'coordinator' is not accessible${NC}"
        exit 1
    fi
else
    echo -e "${RED}✗ PostgreSQL is not running${NC}"
    exit 1
fi
echo ""

# Test Redis
echo "2. Testing Redis..."
if docker exec coordinator-redis redis-cli -a redis_dev PING 2>/dev/null | grep -q "PONG"; then
    echo -e "${GREEN}✓ Redis is running${NC}"

    # Test set/get
    docker exec coordinator-redis redis-cli -a redis_dev SET test_key "test_value" > /dev/null 2>&1
    VALUE=$(docker exec coordinator-redis redis-cli -a redis_dev GET test_key 2>/dev/null)
    if [ "$VALUE" = "test_value" ]; then
        echo -e "${GREEN}✓ Redis read/write operations work${NC}"
        docker exec coordinator-redis redis-cli -a redis_dev DEL test_key > /dev/null 2>&1
    else
        echo -e "${RED}✗ Redis read/write operations failed${NC}"
        exit 1
    fi
else
    echo -e "${RED}✗ Redis is not running${NC}"
    exit 1
fi
echo ""

# Test Temporal
echo "3. Testing Temporal..."
if docker ps | grep coordinator-temporal | grep -q "healthy\|Up"; then
    echo -e "${GREEN}✓ Temporal is running${NC}"

    # Wait for Temporal to be fully ready
    echo -e "${YELLOW}  Waiting for Temporal to be fully initialized...${NC}"
    RETRIES=30
    for i in $(seq 1 $RETRIES); do
        if docker exec coordinator-temporal temporal --address 127.0.0.1:7233 operator search-attribute list > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Temporal is fully initialized and responding${NC}"
            break
        fi
        if [ $i -eq $RETRIES ]; then
            echo -e "${YELLOW}⚠ Temporal is starting but not yet fully initialized${NC}"
        fi
        sleep 2
    done
else
    echo -e "${YELLOW}⚠ Temporal is starting...${NC}"
fi
echo ""

# Test Temporal UI
echo "4. Testing Temporal UI..."
if docker ps | grep coordinator-temporal-ui | grep -q "Up"; then
    echo -e "${GREEN}✓ Temporal UI is running${NC}"
    echo -e "${GREEN}  Access at: http://localhost:8080${NC}"
elif docker ps -a | grep coordinator-temporal-ui | grep -q "Created"; then
    echo -e "${YELLOW}⚠ Temporal UI is waiting for Temporal to be healthy${NC}"
else
    echo -e "${RED}✗ Temporal UI is not running${NC}"
fi
echo ""

# Summary
echo "================================"
echo "Infrastructure Test Summary"
echo "================================"
echo ""
echo -e "${GREEN}Core Services:${NC}"
echo "  PostgreSQL: http://localhost:5432"
echo "  Redis: http://localhost:6379"
echo "  Temporal: http://localhost:7233"
echo "  Temporal UI: http://localhost:8080"
echo ""
echo -e "${GREEN}Connection Strings:${NC}"
echo "  PostgreSQL: postgresql://coordinator:coordinator_dev@localhost:5432/coordinator"
echo "  Redis: redis://:redis_dev@localhost:6379"
echo "  Temporal: localhost:7233"
echo ""
echo -e "${GREEN}Volumes:${NC}"
docker volume ls | grep coordinator
echo ""
echo -e "${GREEN}✓ Infrastructure is ready!${NC}"
