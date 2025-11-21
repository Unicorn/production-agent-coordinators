#!/bin/bash
# Start script for Workflow Builder Worker Service
# Usage:
#   ./scripts/start-worker.sh           # Production mode
#   ./scripts/start-worker.sh dev       # Development mode with hot reload

set -e

# Change to script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Workflow Builder Worker Service                         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check for .env file
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  No .env file found${NC}"
    echo -e "${YELLOW}   Creating from .env.example...${NC}"
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${GREEN}✅ Created .env file${NC}"
        echo -e "${YELLOW}   Please update .env with your configuration${NC}"
    else
        echo -e "${RED}❌ No .env.example found${NC}"
        echo -e "${YELLOW}   Please create .env file manually${NC}"
    fi
    echo ""
fi

# Load environment variables
if [ -f .env ]; then
    echo -e "${BLUE}📋 Loading environment variables...${NC}"
    export $(grep -v '^#' .env | xargs)
fi

# Check for required environment variables
MISSING_VARS=()

if [ -z "$TEMPORAL_ADDRESS" ]; then
    MISSING_VARS+=("TEMPORAL_ADDRESS")
fi

if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
    MISSING_VARS+=("NEXT_PUBLIC_SUPABASE_URL")
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    MISSING_VARS+=("SUPABASE_SERVICE_ROLE_KEY")
fi

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo -e "${RED}❌ Missing required environment variables:${NC}"
    for var in "${MISSING_VARS[@]}"; do
        echo -e "${RED}   - $var${NC}"
    done
    echo ""
    exit 1
fi

# Display configuration
echo -e "${GREEN}✅ Environment loaded${NC}"
echo -e "${BLUE}   Temporal Address: ${TEMPORAL_ADDRESS}${NC}"
echo -e "${BLUE}   Temporal Namespace: ${TEMPORAL_NAMESPACE:-default}${NC}"
echo -e "${BLUE}   Worker Port: ${WORKER_SERVICE_PORT:-3011}${NC}"
echo -e "${BLUE}   Node Environment: ${NODE_ENV:-development}${NC}"
echo ""

# Check if Temporal is accessible
echo -e "${BLUE}🔍 Checking Temporal connection...${NC}"
TEMPORAL_HOST=$(echo $TEMPORAL_ADDRESS | cut -d':' -f1)
TEMPORAL_PORT=$(echo $TEMPORAL_ADDRESS | cut -d':' -f2)

if command -v nc &> /dev/null; then
    if nc -z -w5 $TEMPORAL_HOST $TEMPORAL_PORT 2>/dev/null; then
        echo -e "${GREEN}✅ Temporal server is accessible${NC}"
    else
        echo -e "${YELLOW}⚠️  Cannot reach Temporal server at ${TEMPORAL_ADDRESS}${NC}"
        echo -e "${YELLOW}   Make sure Temporal is running:${NC}"
        echo -e "${YELLOW}   docker-compose -f docker/docker-compose.yml up temporal${NC}"
        echo ""
    fi
else
    echo -e "${YELLOW}⚠️  Cannot verify Temporal connection (nc not installed)${NC}"
fi
echo ""

# Development mode
if [ "$1" = "dev" ] || [ "$1" = "development" ]; then
    echo -e "${BLUE}🚀 Starting in DEVELOPMENT mode with hot reload...${NC}"
    echo -e "${BLUE}   Press Ctrl+C to stop${NC}"
    echo ""

    # Check if tsx is installed
    if ! command -v tsx &> /dev/null; then
        echo -e "${YELLOW}⚠️  tsx not found, installing...${NC}"
        npm install -g tsx
    fi

    exec tsx watch src/server.ts

# Production mode
else
    echo -e "${BLUE}🔨 Building TypeScript...${NC}"
    npm run build

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Build successful${NC}"
        echo ""
    else
        echo -e "${RED}❌ Build failed${NC}"
        exit 1
    fi

    echo -e "${BLUE}🚀 Starting in PRODUCTION mode...${NC}"
    echo -e "${BLUE}   Press Ctrl+C to stop${NC}"
    echo ""

    exec node dist/server.js
fi
