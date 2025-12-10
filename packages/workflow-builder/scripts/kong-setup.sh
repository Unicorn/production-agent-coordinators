#!/usr/bin/env bash
# Kong Setup Script for Workflow Builder
# Configures Kong API Gateway with required services, routes, and plugins
#
# Usage:
#   ./scripts/kong-setup.sh           # Setup with defaults
#   ./scripts/kong-setup.sh --check   # Check Kong status only
#   ./scripts/kong-setup.sh --reset   # Reset all configuration
#
# Environment Variables:
#   KONG_ADMIN_URL    - Kong Admin API URL (default: http://localhost:8001)
#   KONG_ADMIN_TOKEN  - Kong Admin API token (optional)
#   APP_URL           - Application URL (default: http://localhost:3010)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
KONG_ADMIN_URL="${KONG_ADMIN_URL:-http://localhost:8001}"
KONG_ADMIN_TOKEN="${KONG_ADMIN_TOKEN:-}"
APP_URL="${APP_URL:-http://localhost:3010}"

# Headers for Kong Admin API
get_headers() {
  if [ -n "$KONG_ADMIN_TOKEN" ]; then
    echo "-H 'Kong-Admin-Token: $KONG_ADMIN_TOKEN'"
  fi
}

# Helper function to make Kong API calls
kong_api() {
  local method=$1
  local path=$2
  local data=$3

  local headers="Content-Type: application/json"
  if [ -n "$KONG_ADMIN_TOKEN" ]; then
    headers="$headers -H Kong-Admin-Token: $KONG_ADMIN_TOKEN"
  fi

  if [ -n "$data" ]; then
    curl -s -X "$method" "$KONG_ADMIN_URL$path" \
      -H "Content-Type: application/json" \
      ${KONG_ADMIN_TOKEN:+-H "Kong-Admin-Token: $KONG_ADMIN_TOKEN"} \
      -d "$data"
  else
    curl -s -X "$method" "$KONG_ADMIN_URL$path" \
      -H "Content-Type: application/json" \
      ${KONG_ADMIN_TOKEN:+-H "Kong-Admin-Token: $KONG_ADMIN_TOKEN"}
  fi
}

# Check Kong status
check_kong() {
  echo -e "${BLUE}Checking Kong status...${NC}"

  response=$(kong_api GET /status 2>/dev/null || echo "error")

  if [[ "$response" == "error" ]] || [[ -z "$response" ]]; then
    echo -e "${RED}Kong is not accessible at $KONG_ADMIN_URL${NC}"
    echo "Make sure Kong is running. Try: docker-compose -f docker-compose.dev.yml up -d"
    exit 1
  fi

  echo -e "${GREEN}Kong is running at $KONG_ADMIN_URL${NC}"

  # Show status details
  echo -e "${BLUE}Kong status:${NC}"
  kong_api GET /status | jq -r '.server // "OK"' 2>/dev/null || echo "Running"
}

# Create upstream
create_upstream() {
  local name=$1
  local target=$2

  echo -e "${BLUE}Creating upstream: $name${NC}"

  # Check if upstream exists
  existing=$(kong_api GET "/upstreams/$name" 2>/dev/null | jq -r '.id' 2>/dev/null)

  if [ "$existing" != "null" ] && [ -n "$existing" ]; then
    echo -e "${YELLOW}Upstream $name already exists${NC}"
    return 0
  fi

  # Create upstream
  result=$(kong_api POST /upstreams "{
    \"name\": \"$name\",
    \"algorithm\": \"round-robin\",
    \"healthchecks\": {
      \"active\": {
        \"healthy\": {\"interval\": 5, \"successes\": 2},
        \"unhealthy\": {\"interval\": 5, \"http_failures\": 3},
        \"http_path\": \"/api/health\",
        \"timeout\": 5
      }
    }
  }")

  # Add target
  kong_api POST "/upstreams/$name/targets" "{\"target\": \"$target\", \"weight\": 100}" > /dev/null

  echo -e "${GREEN}Created upstream: $name -> $target${NC}"
}

# Create service
create_service() {
  local name=$1
  local upstream=$2

  echo -e "${BLUE}Creating service: $name${NC}"

  # Check if service exists
  existing=$(kong_api GET "/services/$name" 2>/dev/null | jq -r '.id' 2>/dev/null)

  if [ "$existing" != "null" ] && [ -n "$existing" ]; then
    echo -e "${YELLOW}Service $name already exists${NC}"
    return 0
  fi

  result=$(kong_api POST /services "{
    \"name\": \"$name\",
    \"url\": \"http://$upstream\",
    \"connect_timeout\": 60000,
    \"read_timeout\": 60000,
    \"write_timeout\": 60000,
    \"retries\": 5
  }")

  echo -e "${GREEN}Created service: $name${NC}"
}

# Create route
create_route() {
  local service=$1
  local name=$2
  local path=$3
  local methods=$4

  echo -e "${BLUE}Creating route: $name${NC}"

  # Check if route exists
  existing=$(kong_api GET "/routes/$name" 2>/dev/null | jq -r '.id' 2>/dev/null)

  if [ "$existing" != "null" ] && [ -n "$existing" ]; then
    echo -e "${YELLOW}Route $name already exists${NC}"
    return 0
  fi

  result=$(kong_api POST "/services/$service/routes" "{
    \"name\": \"$name\",
    \"paths\": [\"$path\"],
    \"methods\": $methods,
    \"strip_path\": false,
    \"preserve_host\": true,
    \"protocols\": [\"http\", \"https\"]
  }")

  echo -e "${GREEN}Created route: $name -> $path${NC}"
}

# Enable plugin on route
enable_plugin() {
  local route=$1
  local plugin=$2
  local config=$3

  echo -e "${BLUE}Enabling plugin: $plugin on route $route${NC}"

  result=$(kong_api POST "/routes/$route/plugins" "{
    \"name\": \"$plugin\",
    \"config\": $config
  }" 2>/dev/null)

  if echo "$result" | grep -q '"id"'; then
    echo -e "${GREEN}Enabled plugin: $plugin${NC}"
  else
    echo -e "${YELLOW}Plugin $plugin may already exist or failed${NC}"
  fi
}

# Enable global plugin
enable_global_plugin() {
  local plugin=$1
  local config=$2

  echo -e "${BLUE}Enabling global plugin: $plugin${NC}"

  result=$(kong_api POST "/plugins" "{
    \"name\": \"$plugin\",
    \"config\": $config
  }" 2>/dev/null)

  if echo "$result" | grep -q '"id"'; then
    echo -e "${GREEN}Enabled global plugin: $plugin${NC}"
  else
    echo -e "${YELLOW}Global plugin $plugin may already exist${NC}"
  fi
}

# Reset Kong configuration
reset_kong() {
  echo -e "${YELLOW}Resetting Kong configuration...${NC}"

  # Delete all routes
  routes=$(kong_api GET /routes | jq -r '.data[].id' 2>/dev/null || echo "")
  for route in $routes; do
    kong_api DELETE "/routes/$route" > /dev/null 2>&1 || true
    echo "Deleted route: $route"
  done

  # Delete all services
  services=$(kong_api GET /services | jq -r '.data[].id' 2>/dev/null || echo "")
  for service in $services; do
    kong_api DELETE "/services/$service" > /dev/null 2>&1 || true
    echo "Deleted service: $service"
  done

  # Delete all upstreams
  upstreams=$(kong_api GET /upstreams | jq -r '.data[].id' 2>/dev/null || echo "")
  for upstream in $upstreams; do
    kong_api DELETE "/upstreams/$upstream" > /dev/null 2>&1 || true
    echo "Deleted upstream: $upstream"
  done

  # Delete all plugins
  plugins=$(kong_api GET /plugins | jq -r '.data[].id' 2>/dev/null || echo "")
  for plugin in $plugins; do
    kong_api DELETE "/plugins/$plugin" > /dev/null 2>&1 || true
    echo "Deleted plugin: $plugin"
  done

  echo -e "${GREEN}Kong configuration reset${NC}"
}

# Main setup
setup() {
  echo -e "${BLUE}Setting up Kong for Workflow Builder...${NC}"
  echo "Kong Admin URL: $KONG_ADMIN_URL"
  echo "Application URL: $APP_URL"
  echo ""

  check_kong
  echo ""

  # Parse APP_URL to get host:port
  APP_HOST=$(echo "$APP_URL" | sed -E 's#https?://##' | sed 's#/.*##')

  # Create upstream
  create_upstream "workflow-builder-upstream" "$APP_HOST"
  echo ""

  # Create services
  create_service "workflow-builder-service" "workflow-builder-upstream"
  create_service "workflow-api-handler" "workflow-builder-upstream"
  echo ""

  # Create routes
  create_route "workflow-builder-service" "trpc-route" "/api/trpc" '["GET", "POST"]'
  create_route "workflow-builder-service" "auth-route" "/api/auth" '["GET", "POST"]'
  create_route "workflow-builder-service" "compiler-route" "/api/compiler" '["POST"]'
  create_route "workflow-builder-service" "deploy-route" "/api/deploy" '["POST"]'
  create_route "workflow-builder-service" "health-route" "/api/health" '["GET"]'
  create_route "workflow-api-handler" "workflow-api-v1-route" "/api/v1" '["GET", "POST", "PUT", "DELETE", "PATCH"]'
  echo ""

  # Enable global plugins
  enable_global_plugin "correlation-id" '{"header_name": "X-Request-ID", "generator": "uuid", "echo_downstream": true}'
  echo ""

  # Enable rate limiting per route
  enable_plugin "compiler-route" "rate-limiting" '{"minute": 100, "policy": "local", "fault_tolerant": true}'
  enable_plugin "deploy-route" "rate-limiting" '{"minute": 50, "policy": "local", "fault_tolerant": true}'
  enable_plugin "auth-route" "rate-limiting" '{"minute": 20, "policy": "local", "fault_tolerant": true}'
  enable_plugin "workflow-api-v1-route" "rate-limiting" '{"minute": 60, "policy": "local", "fault_tolerant": true}'
  echo ""

  # Enable API key auth for workflow API
  enable_plugin "workflow-api-v1-route" "key-auth" '{"key_names": ["X-API-Key"], "hide_credentials": true}'
  echo ""

  echo -e "${GREEN}Kong setup complete!${NC}"
  echo ""
  echo "Kong Gateway URL: http://localhost:8000"
  echo "Kong Admin URL: $KONG_ADMIN_URL"
  echo ""
  echo "Test routes:"
  echo "  curl http://localhost:8000/api/health"
  echo "  curl http://localhost:8000/api/trpc/health"
}

# Parse arguments
case "$1" in
  --check)
    check_kong
    ;;
  --reset)
    check_kong
    reset_kong
    ;;
  --help|-h)
    echo "Kong Setup Script for Workflow Builder"
    echo ""
    echo "Usage:"
    echo "  $0           # Setup Kong with default configuration"
    echo "  $0 --check   # Check Kong status only"
    echo "  $0 --reset   # Reset all Kong configuration"
    echo "  $0 --help    # Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  KONG_ADMIN_URL    - Kong Admin API URL (default: http://localhost:8001)"
    echo "  KONG_ADMIN_TOKEN  - Kong Admin API token (optional)"
    echo "  APP_URL           - Application URL (default: http://localhost:3010)"
    ;;
  *)
    check_kong
    echo ""
    setup
    ;;
esac
