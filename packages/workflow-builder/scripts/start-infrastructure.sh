#!/bin/bash
set -e

# Start all infrastructure services (Kong, Temporal)
# Supabase is managed separately via `supabase start`
# Next.js runs locally for hot reload

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo -e "${BLUE}🚀 Starting Infrastructure Services${NC}"
echo "========================================"
echo ""

# Check if Docker is running
echo -e "${BLUE}Checking Docker...${NC}"
if ! docker ps > /dev/null 2>&1; then
  echo -e "${RED}❌ Docker is not running!${NC}"
  echo -e "${YELLOW}Please start Docker Desktop and try again.${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Docker is running${NC}"
echo ""

# Start Docker Compose services
echo -e "${BLUE}Starting Docker services (Kong, Temporal)...${NC}"
cd "$PROJECT_ROOT"

if docker-compose -f docker-compose.dev.yml ps | grep -q "Up"; then
  echo -e "${GREEN}✓ Services already running${NC}"
else
  docker-compose -f docker-compose.dev.yml up -d
  echo -e "${GREEN}✓ Services started${NC}"
fi
echo ""

# Wait for services to be healthy
echo -e "${BLUE}Waiting for services to be ready...${NC}"
sleep 5

# Check Kong
if curl -s http://localhost:8001/status > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Kong is ready${NC}"
else
  echo -e "${YELLOW}⚠️  Kong is starting (may take a moment)${NC}"
fi

# Check Temporal
if curl -s http://localhost:8233 > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Temporal is ready${NC}"
else
  echo -e "${YELLOW}⚠️  Temporal is starting (may take a moment)${NC}"
fi
echo ""

# Show service URLs
echo -e "${GREEN}========================================"
echo "✅ Infrastructure Services Running"
echo "========================================${NC}"
echo ""
echo -e "${BLUE}Service URLs:${NC}"
echo "  • Kong Gateway:     http://localhost:8000"
echo "  • Kong Admin API:   http://localhost:8001"
echo "  • Temporal:         localhost:7233"
echo "  • Temporal Web UI:  http://localhost:8080"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "  1. Start Supabase:  cd packages/workflow-builder && supabase start"
echo "  2. Start Next.js:   yarn dev"
echo "  3. Open app:        http://localhost:3010"
echo ""
echo -e "${YELLOW}To stop services: docker-compose -f docker-compose.dev.yml down${NC}"
echo ""

