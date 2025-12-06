# Migration Checklist - Component Organization

**Date:** 2025-01-XX  
**Status:** Ready to Apply  
**Priority:** High - Required for component organization system

---

## Migration Status Check Results

✅ **Checked:** Missing schema elements detected
- ❌ `components.is_active` column - Missing
- ❌ `component_categories` table - Missing  
- ❌ `component_category_mapping` table - Missing
- ❌ `component_keywords` table - Missing
- ❌ `component_use_cases` table - Missing

---

## Migrations to Apply (In Order)

### 1. Prerequisite: Add is_active Column
**File:** `20251117000006_add_custom_activity_code.sql`  
**Status:** ⚠️ May not have been applied  
**What it does:** Adds `is_active` column to `components` table

**Note:** Our new migration (`20251206000000`) also adds this column if missing, so it's safe to run even if this one wasn't applied.

### 2. Seed Missing Components
**File:** `20251206000000_seed_all_components_complete.sql`  
**Status:** ✅ Ready  
**What it does:**
- Adds `is_active` column if missing
- Seeds 4 missing API Gateway components:
  - kong-logging
  - kong-cache
  - kong-cors
  - graphql-gateway

### 3. Create Category Schema
**File:** `20251206000001_create_component_categories.sql`  
**Status:** ✅ Ready  
**What it does:**
- Creates `component_categories` table
- Creates `component_category_mapping` table
- Creates `component_keywords` table
- Creates `component_use_cases` table
- Sets up RLS policies
- Creates indexes

### 4. Seed Categories
**File:** `20251206000002_seed_component_categories.sql`  
**Status:** ✅ Ready  
**What it does:**
- Seeds 8 top-level categories
- Seeds 18 subcategories
- Sets up hierarchical structure

### 5. Map Components to Categories
**File:** `20251206000003_map_components_to_categories.sql`  
**Status:** ✅ Ready  
**What it does:**
- Maps all 23 components to appropriate categories
- Adds 50+ keywords for AI searchability
- Sets up component-category relationships

---

## Migration Order (Critical!)

Migrations must be run in this exact order:

```
1. 20251206000000_seed_all_components_complete.sql
2. 20251206000001_create_component_categories.sql
3. 20251206000002_seed_component_categories.sql
4. 20251206000003_map_components_to_categories.sql
```

---

## How to Apply

### Option 1: Supabase Dashboard (Recommended)
1. Go to: https://supabase.com/dashboard/project/jeaudyvxapooyfddfptr/sql/new
2. Copy and paste each migration file in order
3. Click "Run" for each migration
4. Verify success message

### Option 2: Supabase CLI (If Fixed)
```bash
cd packages/workflow-builder
npx supabase db push
```

### Option 3: psql
```bash
# Get connection string from Supabase dashboard
psql "connection-string" < supabase/migrations/20251206000000_seed_all_components_complete.sql
# Repeat for each migration
```

---

## Verification Queries

After applying migrations, run these to verify:

```sql
-- Check is_active column exists
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'components' AND column_name = 'is_active';

-- Check category tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'component_categories',
  'component_category_mapping',
  'component_keywords',
  'component_use_cases'
);

-- Check components were seeded
SELECT name, display_name 
FROM components 
WHERE name IN ('kong-logging', 'kong-cache', 'kong-cors', 'graphql-gateway');

-- Check categories were seeded
SELECT name, display_name, parent_category_id 
FROM component_categories 
ORDER BY sort_order;

-- Check component mappings
SELECT c.name, cc.display_name as category
FROM components c
JOIN component_category_mapping ccm ON c.id = ccm.component_id
JOIN component_categories cc ON ccm.category_id = cc.id
LIMIT 10;
```

---

## Expected Results

After all migrations:
- ✅ `components.is_active` column exists
- ✅ 4 new API Gateway components in database
- ✅ 8 top-level categories created
- ✅ 18 subcategories created
- ✅ All 23 components mapped to categories
- ✅ 50+ keywords added for searchability

---

## Notes

- All migrations are **idempotent** - safe to run multiple times
- Migrations use `IF NOT EXISTS` and `ON CONFLICT` for safety
- No data will be lost - migrations only add new data
- If a migration fails, you can re-run it after fixing the issue

---

## Troubleshooting

### Error: Column already exists
- Migration already applied, safe to continue

### Error: Table already exists
- Migration already applied, safe to continue

### Error: Foreign key constraint
- Ensure prerequisite migrations have been run
- Check that referenced tables exist

### Error: System user not found
- Run `20251118000000_create_system_user.sql` first
- Or ensure system@example.com user exists

