#!/bin/bash

# Stop Next.js dev server

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🛑 Stopping Next.js Dev Server${NC}"
echo ""

# Find Next.js processes (typically runs on port 3010)
NEXTJS_PIDS=$(lsof -ti:3010 2>/dev/null)

if [ -z "$NEXTJS_PIDS" ]; then
  echo -e "${YELLOW}⚠️  No Next.js process found on port 3010${NC}"
  
  # Also check for node processes that might be Next.js
  NODE_PIDS=$(pgrep -f "next dev" 2>/dev/null)
  if [ -z "$NODE_PIDS" ]; then
    echo -e "${YELLOW}⚠️  No Next.js dev server process found${NC}"
    exit 0
  else
    echo -e "${BLUE}Found Next.js process(es): $NODE_PIDS${NC}"
    echo -e "${YELLOW}Killing process(es)...${NC}"
    kill $NODE_PIDS 2>/dev/null
    sleep 1
    
    # Force kill if still running
    if pgrep -f "next dev" > /dev/null; then
      echo -e "${YELLOW}Force killing...${NC}"
      kill -9 $NODE_PIDS 2>/dev/null
    fi
  fi
else
  echo -e "${BLUE}Found process(es) on port 3010: $NEXTJS_PIDS${NC}"
  echo -e "${YELLOW}Killing process(es)...${NC}"
  kill $NEXTJS_PIDS 2>/dev/null
  sleep 1
  
  # Force kill if still running
  if lsof -ti:3010 > /dev/null 2>&1; then
    echo -e "${YELLOW}Force killing...${NC}"
    kill -9 $NEXTJS_PIDS 2>/dev/null
  fi
fi

# Verify it's stopped
if lsof -ti:3010 > /dev/null 2>&1 || pgrep -f "next dev" > /dev/null; then
  echo -e "${RED}❌ Failed to stop Next.js${NC}"
  exit 1
else
  echo -e "${GREEN}✓ Next.js stopped${NC}"
fi

