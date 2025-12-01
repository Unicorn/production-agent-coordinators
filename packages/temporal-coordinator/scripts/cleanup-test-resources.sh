#!/bin/bash
# Cleanup script for test resources
# 
# Cleans up:
# - Running Temporal workflows matching test patterns
# - Old workspace directories
# - Orphaned processes

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Test Resource Cleanup ===${NC}\n"

# Check Temporal CLI
if ! command -v temporal &> /dev/null; then
  echo -e "${RED}✗ Temporal CLI not found${NC}"
  exit 1
fi

# Cleanup workflows matching test patterns
echo -e "${YELLOW}Cleaning up test workflows...${NC}"
PATTERNS=(
  "integration-test-"
  "claude-build-"
  "test-e2e-"
)

for pattern in "${PATTERNS[@]}"; do
  echo -e "${BLUE}Checking workflows matching: ${pattern}*${NC}"
  
  # List running workflows
  RUNNING=$(temporal workflow list --query "WorkflowId LIKE '${pattern}%'" --status RUNNING 2>/dev/null | grep -c "${pattern}" || echo "0")
  RUNNING=$(echo "$RUNNING" | tr -d '\n' | head -c 1)  # Get first digit only
  
  if [ -n "$RUNNING" ] && [ "$RUNNING" -gt 0 ] 2>/dev/null; then
    echo -e "${YELLOW}Found ${RUNNING} running workflows matching ${pattern}${NC}"
    
    # Cancel each workflow
    temporal workflow list --query "WorkflowId LIKE '${pattern}%'" --status RUNNING 2>/dev/null | \
      grep "${pattern}" | \
      awk '{print $2}' | \
      while read workflow_id; do
        if [ -n "$workflow_id" ]; then
          echo -e "  Cancelling: ${workflow_id}"
          temporal workflow cancel --workflow-id "$workflow_id" 2>/dev/null || true
        fi
      done
  else
    echo -e "${GREEN}No running workflows found${NC}"
  fi
done

# Cleanup old workspaces
echo -e "\n${YELLOW}Cleaning up old workspaces...${NC}"
WORKSPACE_BASE="/tmp/claude-builds"

if [ -d "$WORKSPACE_BASE" ]; then
  # Find directories older than 24 hours
  find "$WORKSPACE_BASE" -type d -name "build-*" -mtime +1 -exec rm -rf {} + 2>/dev/null || true
  echo -e "${GREEN}Cleaned up old workspaces${NC}"
else
  echo -e "${GREEN}No workspace directory found${NC}"
fi

# Check for orphaned processes (optional - be careful)
if [ "$1" == "--kill-processes" ]; then
  echo -e "\n${YELLOW}Checking for orphaned processes...${NC}"
  
  # Find node processes that might be workers
  NODE_WORKERS=$(pgrep -f "node.*worker" || true)
  if [ -n "$NODE_WORKERS" ]; then
    echo -e "${YELLOW}Found node worker processes:${NC}"
    ps -p $NODE_WORKERS -o pid,cmd || true
    echo -e "${YELLOW}⚠️  Not killing automatically - use --force-kill to kill${NC}"
  fi
fi

echo -e "\n${GREEN}✅ Cleanup completed!${NC}"

