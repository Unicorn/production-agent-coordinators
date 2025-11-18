#!/bin/bash
set -e

echo "🔧 Applying Phase 2 Migration via Supabase CLI"
echo "=============================================="
echo ""

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

cd /Users/mattbernier/projects/production-agent-coordinators/packages/workflow-builder

# Step 1: Temporarily move old migrations (already applied) to avoid conflicts
echo -e "${BLUE}Step 1: Temporarily moving previously-applied migrations...${NC}"
mkdir -p supabase/migrations/.applied_manually
mv supabase/migrations/20251116000001_*.sql supabase/migrations/.applied_manually/ 2>/dev/null || true
mv supabase/migrations/20251116000002_*.sql supabase/migrations/.applied_manually/ 2>/dev/null || true
mv supabase/migrations/20251116000003_*.sql supabase/migrations/.applied_manually/ 2>/dev/null || true
mv supabase/migrations/20251116000004_*.sql supabase/migrations/.applied_manually/ 2>/dev/null || true
rm -f supabase/migrations/20251116999999_*.sql 2>/dev/null || true

echo -e "${GREEN}✓ Old migrations moved to .applied_manually/${NC}"
echo ""

# Step 2: Apply only the Phase 2 migration
echo -e "${BLUE}Step 2: Applying Phase 2 migration (20251117000001)...${NC}"
echo ""

supabase db push --yes

echo ""
echo -e "${GREEN}✓ Phase 2 migration applied!${NC}"
echo ""

# Step 3: Move old migrations back for reference
echo -e "${BLUE}Step 3: Restoring old migration files for reference...${NC}"
mv supabase/migrations/.applied_manually/*.sql supabase/migrations/ 2>/dev/null || true
rmdir supabase/migrations/.applied_manually 2>/dev/null || true

echo -e "${GREEN}✓ Old migrations restored${NC}"
echo ""

# Step 4: Show current migration status
echo -e "${BLUE}Step 4: Current migration status:${NC}"
supabase migration list

echo ""
echo -e "${GREEN}=============================================="
echo "✓ Phase 2 Migration Complete!"
echo "==============================================${NC}"
echo ""
echo "New tables created:"
echo "  • projects (user+project → task queue)"
echo "  • workflow_compiled_code (database storage)"
echo "  • workflow_workers (worker registry)"
echo "  • activity_statistics (performance tracking)"
echo ""
echo "Next steps:"
echo "  1. yarn add @temporalio/client @temporalio/worker @temporalio/workflow @temporalio/activity @temporalio/common"
echo "  2. temporal server start-dev"
echo "  3. Continue with Phase 2 implementation"
echo ""

