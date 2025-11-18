#!/bin/bash
set -e

echo "🚀 Starting Local Development Environment"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Docker is running
echo -e "${BLUE}Checking Docker...${NC}"
if ! docker ps > /dev/null 2>&1; then
  echo -e "${RED}❌ Docker is not running!${NC}"
  echo -e "${YELLOW}Please start Docker Desktop and try again.${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Docker is running${NC}"
echo ""

# Start Supabase
echo -e "${BLUE}Starting local Supabase...${NC}"
cd /Users/mattbernier/projects/production-agent-coordinators/packages/workflow-builder

if supabase status > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Supabase already running${NC}"
else
  echo "This may take a few minutes on first run..."
  supabase start
  echo -e "${GREEN}✓ Supabase started${NC}"
fi
echo ""

# Get connection details
echo -e "${BLUE}Connection Details:${NC}"
supabase status | grep -E "API URL|Studio URL|anon key|service_role"
echo ""

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
  echo -e "${YELLOW}⚠️  .env.local not found${NC}"
  echo -e "${YELLOW}Creating from Supabase output...${NC}"
  
  API_URL=$(supabase status | grep "API URL" | awk '{print $NF}')
  ANON_KEY=$(supabase status | grep "anon key" | awk '{print $NF}')
  SERVICE_KEY=$(supabase status | grep "service_role key" | awk '{print $NF}')
  
  cat > .env.local << EOF
# Local Supabase
NEXT_PUBLIC_SUPABASE_URL=$API_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY

# Local Database
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres

# Temporal
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default

# App
NEXT_PUBLIC_APP_URL=http://localhost:3010
NODE_ENV=development
EOF
  
  echo -e "${GREEN}✓ Created .env.local${NC}"
else
  echo -e "${GREEN}✓ .env.local exists${NC}"
fi
echo ""

# Check migrations
echo -e "${BLUE}Checking migrations...${NC}"
MIGRATION_COUNT=$(supabase migration list | grep -c "sql" || true)
echo -e "${GREEN}✓ $MIGRATION_COUNT migrations applied${NC}"
echo ""

# Offer to create test user
echo -e "${BLUE}Test User Setup${NC}"
read -p "Create test user (test@example.com / testpassword123)? [Y/n] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
  echo "Creating test user..."
  supabase db execute --sql "
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      recovery_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'test@example.com',
      crypt('testpassword123', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '{\"provider\":\"email\",\"providers\":[\"email\"]}',
      '{}',
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    )
    ON CONFLICT (email) DO NOTHING;
  " 2>/dev/null || echo -e "${YELLOW}⚠️  User may already exist${NC}"
  
  echo -e "${GREEN}✓ Test user ready: test@example.com / testpassword123${NC}"
fi
echo ""

echo -e "${GREEN}========================================"
echo "✅ Local Development Environment Ready!"
echo "========================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Start Temporal: temporal server start-dev"
echo "  2. Start Next.js: yarn dev"
echo "  3. Open browser: http://localhost:3010"
echo "  4. Login: test@example.com / testpassword123"
echo ""
echo "Useful URLs:"
echo "  • App: http://localhost:3010"
echo "  • Supabase Studio: http://localhost:54323"
echo "  • Temporal Web: http://localhost:8233 (after starting Temporal)"
echo ""
echo -e "${BLUE}Happy coding! 🎉${NC}"

