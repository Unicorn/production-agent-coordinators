#!/bin/bash
set -e

# Complete development environment startup
# Starts: Supabase, Kong, Temporal, and optionally Next.js

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo -e "${BLUE}🚀 Starting Complete Development Environment${NC}"
echo "========================================"
echo ""

# Check Docker
if ! docker ps > /dev/null 2>&1; then
  echo -e "${RED}❌ Docker is not running!${NC}"
  exit 1
fi

cd "$PROJECT_ROOT"

# 1. Start Infrastructure (Kong, Temporal)
echo -e "${BLUE}Step 1: Starting infrastructure services...${NC}"
"$SCRIPT_DIR/start-infrastructure.sh"
echo ""

# 2. Start Supabase
echo -e "${BLUE}Step 2: Starting Supabase...${NC}"
if supabase status > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Supabase already running${NC}"
else
  echo "This may take a few minutes on first run..."
  supabase start
  echo -e "${GREEN}✓ Supabase started${NC}"
fi
echo ""

# 3. Get Supabase connection details
echo -e "${BLUE}Step 3: Supabase Connection Details${NC}"
SUPABASE_STATUS=$(supabase status 2>/dev/null || echo "")
API_URL=$(echo "$SUPABASE_STATUS" | grep "API URL" | awk '{print $NF}' || echo "http://localhost:54332")
STUDIO_URL=$(echo "$SUPABASE_STATUS" | grep "Studio URL" | awk '{print $NF}' || echo "http://localhost:54334")
ANON_KEY=$(echo "$SUPABASE_STATUS" | grep "anon key" | awk '{print $NF}' || echo "")
SERVICE_KEY=$(echo "$SUPABASE_STATUS" | grep "service_role key" | awk '{print $NF}' || echo "")

echo "  API URL: $API_URL"
echo "  Studio URL: $STUDIO_URL"
echo ""

# 4. Update .env.local if needed
ENV_FILE=".env.local"
if [ ! -f "$ENV_FILE" ] || [ -z "$ANON_KEY" ]; then
  echo -e "${YELLOW}⚠️  .env.local missing or incomplete${NC}"
  echo -e "${BLUE}Creating/updating .env.local...${NC}"
  
  cat > "$ENV_FILE" << EOF
# Local Supabase
NEXT_PUBLIC_SUPABASE_URL=${API_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_KEY}

# Local Database
DATABASE_URL=postgresql://postgres:postgres@localhost:54333/postgres

# Temporal
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default

# Kong
KONG_ADMIN_URL=http://localhost:8001
KONG_GATEWAY_URL=http://localhost:8000
KONG_ADMIN_API_KEY=

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3010
WORKFLOW_API_BASE_URL=http://localhost:3010/api/workflows
NODE_ENV=development
EOF
  
  echo -e "${GREEN}✓ Created/updated .env.local${NC}"
else
  echo -e "${GREEN}✓ .env.local exists${NC}"
fi
echo ""

# 5. Summary
echo -e "${GREEN}========================================"
echo "✅ Development Environment Ready!"
echo "========================================${NC}"
echo ""
echo -e "${BLUE}Service URLs:${NC}"
echo "  • App:              http://localhost:3010"
echo "  • Supabase Studio:  $STUDIO_URL"
echo "  • Kong Gateway:     http://localhost:8000"
echo "  • Kong Admin API:   http://localhost:8001"
echo "  • Temporal Web UI:  http://localhost:8080"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "  1. Start Next.js:    yarn dev"
echo "  2. Login:            test@example.com / testpassword123"
echo ""
echo -e "${YELLOW}To stop all services:${NC}"
echo "  • Infrastructure: docker-compose -f docker-compose.dev.yml down"
echo "  • Supabase:      supabase stop"
echo ""

# 6. Note about Next.js
echo -e "${BLUE}To start Next.js:${NC}"
echo "  cd packages/workflow-builder && yarn dev"
echo ""
echo -e "${YELLOW}Note: If Next.js is already running, stop it first:${NC}"
echo "  ./scripts/stop-nextjs.sh"
echo ""

