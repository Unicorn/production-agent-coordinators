#!/bin/bash

# Stop all infrastructure services

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo -e "${BLUE}🛑 Stopping Infrastructure Services${NC}"
echo ""

cd "$PROJECT_ROOT"

# Stop Docker Compose services
echo -e "${BLUE}Stopping Docker services...${NC}"
docker-compose -f docker-compose.dev.yml down

echo -e "${GREEN}✓ Infrastructure services stopped${NC}"
echo ""
echo -e "${YELLOW}Note: Supabase is still running.${NC}"
echo -e "${YELLOW}To stop Supabase: supabase stop${NC}"
echo ""

