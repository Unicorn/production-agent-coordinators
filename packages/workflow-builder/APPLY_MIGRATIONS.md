# Database Migrations

## ✅ Migration Status: COMPLETED

All migrations have been successfully applied to the Supabase database!

**Applied Migrations:**
1. ✅ `20251114000001_initial_schema.sql` - Base tables (workflows, components, nodes, etc.)
2. ✅ `20251114000002_seed_default_task_queue.sql` - Default task queue seed data
3. ✅ `20251114000003_fix_user_trigger.sql` - User trigger fix
4. ✅ `20251116000001_add_advanced_workflow_patterns.sql` - Advanced patterns (work queues, signals, queries, scheduled workflows)
5. ✅ `20251116000002_seed_advanced_patterns.sql` - Example workflows seed data

**🆕 New Migrations (Apply these next!):**
6. ⏳ `20251116000003_build_workflow_workflow.sql` - "Build Workflow" meta-workflow (system workflow)
7. ⏳ `20251116000004_workflow_executions.sql` - Workflow executions tracking table

**Last Updated:** November 16, 2025

---

## 🎉 What's Now Available

Your database now supports:
- ✅ **Work Queues**: Coordinator workflows can manage pending work items
- ✅ **Signals**: External communication into workflows
- ✅ **Queries**: Read-only state inspection of running workflows
- ✅ **Scheduled Workflows**: Cron-based child workflows
- ✅ **Enhanced Child Communication**: Parent-child workflow interactions
- ✅ **Example Workflows**: Pre-configured coordinator patterns

**🆕 After applying new migrations, you'll also have:**
- 🔄 **Build Workflow Meta-Workflow**: System workflow that builds other workflows (workflows all the way down!)
- 📊 **Execution Tracking**: Track workflow builds and executions with real-time status updates
- 🎯 **User-Friendly Execution**: No Temporal knowledge required - just click "Build Workflow"

---

## Next Steps

1. **Verify the migration** (see Verification section below)
2. **Start the development server**: `npm run dev`
3. **Explore example workflows** in the UI
4. **Build your first coordinator workflow** using the workflow builder

---

## Verification

Run these queries in Supabase SQL Editor to confirm everything is working:

```sql
-- Check all tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'workflows', 'components', 'workflow_nodes',
  'workflow_work_queues', 'workflow_signals', 'workflow_queries'
)
ORDER BY table_name;

-- Should return 6 tables

-- Check new workflow columns
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'workflows' 
AND column_name IN ('is_scheduled', 'schedule_spec', 'parent_workflow_id')
ORDER BY column_name;

-- Should return 3 columns

-- Check example workflows (if seed data was applied)
SELECT name, is_scheduled FROM workflows 
ORDER BY created_at DESC;

-- Should show example coordinator workflows
```

---

## Reference: How Migrations Were Applied

<details>
<summary>Click to view migration instructions (for reference only)</summary>

### Option 1: Supabase Dashboard (Easiest)

1. Go to your Supabase project dashboard: https://supabase.com/dashboard/project/jeaudyvxapooyfddfptr

2. Click **SQL Editor** in the left sidebar

3. Click **New Query**

4. **If this is a fresh database**, run ALL migrations in order:
   - `20251114000001_initial_schema.sql` ← Run this first!
   - `20251114000002_seed_default_task_queue.sql`
   - `20251114000003_fix_user_trigger.sql`
   - `20251116000001_add_advanced_workflow_patterns.sql` ← New migration
   - `20251116000002_seed_advanced_patterns.sql` ← Optional seed data

5. **If you already have the base schema**, just run the new ones:
   - `20251116000001_add_advanced_workflow_patterns.sql`
   - `20251116000002_seed_advanced_patterns.sql` (optional)

6. For each migration:
   - Copy and paste the entire SQL file contents
   - Click **Run** (bottom right)
   - Wait for success message before proceeding to next migration

---

## Option 2: Command Line (If you have psql installed)

```bash
# Get connection string from Supabase dashboard
# Go to: Settings > Database > Connection String > Transaction mode

# Navigate to workflow-builder directory
cd packages/workflow-builder

# If fresh database, run ALL migrations in order:
psql "YOUR_CONNECTION_STRING" -f supabase/migrations/20251114000001_initial_schema.sql
psql "YOUR_CONNECTION_STRING" -f supabase/migrations/20251114000002_seed_default_task_queue.sql
psql "YOUR_CONNECTION_STRING" -f supabase/migrations/20251114000003_fix_user_trigger.sql
psql "YOUR_CONNECTION_STRING" -f supabase/migrations/20251116000001_add_advanced_workflow_patterns.sql
psql "YOUR_CONNECTION_STRING" -f supabase/migrations/20251116000002_seed_advanced_patterns.sql

# If you already have base schema, just run the new ones:
psql "YOUR_CONNECTION_STRING" -f supabase/migrations/20251116000001_add_advanced_workflow_patterns.sql
psql "YOUR_CONNECTION_STRING" -f supabase/migrations/20251116000002_seed_advanced_patterns.sql
```

---

## What Gets Created

### Migration 1 (Schema):
- ✅ 3 new tables: `workflow_work_queues`, `workflow_signals`, `workflow_queries`
- ✅ Extended `workflows` table with 11 new columns for scheduled workflows
- ✅ Extended `workflow_nodes` table with 5 new columns for parent communication
- ✅ 3 new component types: `query`, `scheduled-workflow`, `work-queue`
- ✅ RLS policies for all new tables
- ✅ Auto-generation trigger for work queue handlers
- ✅ Validation functions

### Migration 2 (Seed Data - Optional):
- ✅ Example: Plan Writer Coordinator workflow
- ✅ Example: Build with Test Dependencies workflow
- ⚠️  Will only create if at least one user exists

---

## After Migration

You can verify with these queries:

```sql
-- Check new tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('workflow_work_queues', 'workflow_signals', 'workflow_queries');

-- Check new columns on workflows
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'workflows' 
AND column_name IN ('is_scheduled', 'schedule_spec', 'parent_workflow_id');

-- Check example workflows (if seed data was applied)
SELECT name, is_scheduled FROM workflows WHERE name LIKE '%Plan Writer%' OR name LIKE '%Build with%';
```

---

## Troubleshooting

**"relation does not exist" errors (e.g., `workflow_work_queues`):**
- ❌ You're trying to run advanced migrations before the initial schema
- ✅ **Solution**: Run ALL migrations in order (see Migration Order above)
- Start with `20251114000001_initial_schema.sql` first

**"relation already exists" errors:**
- The tables might already exist from a previous attempt
- You can either:
  - Drop the tables manually and rerun
  - Or modify the migration to use `CREATE TABLE IF NOT EXISTS`

**"permission denied" errors:**
- Make sure you're running the SQL with admin/service role permissions
- In Supabase dashboard, this should work by default

**Seed data not creating:**
- This is normal if no users exist yet
- Create a user first (sign up via the app)
- Then rerun migration 2

**How to check which migrations have been run:**
```sql
-- Check if initial schema exists
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('workflows', 'components', 'workflow_nodes');

-- Check if advanced patterns exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('workflow_work_queues', 'workflow_signals', 'workflow_queries');
```

---

**Need help?** Make sure you run all migrations in the correct order. Start fresh if needed.

</details>

---

## Database Schema Overview

### Core Tables
- `users` - User accounts and authentication
- `user_roles` - Role-based permissions
- `components` - Reusable workflow components (activities, agents)
- `workflows` - Workflow definitions
- `workflow_nodes` - Nodes within workflows
- `workflow_edges` - Connections between nodes

### Advanced Pattern Tables
- `workflow_work_queues` - Work queues for coordinator workflows
- `workflow_signals` - Signal handlers for external communication
- `workflow_queries` - Query handlers for state inspection

### Execution Tables (NEW)
- `workflow_executions` - Track workflow builds and executions with status, results, and timing

### Supporting Tables
- `component_types` - Component type definitions
- `component_visibility` - Visibility settings
- `task_queues` - Temporal task queue configurations
- `agent_prompts` - AI agent prompt templates

---

## Migration History

| Date | Migration | Description | Status |
|------|-----------|-------------|--------|
| 2025-11-14 | `20251114000001_initial_schema.sql` | Initial database schema | ✅ Applied |
| 2025-11-14 | `20251114000002_seed_default_task_queue.sql` | Default task queue | ✅ Applied |
| 2025-11-14 | `20251114000003_fix_user_trigger.sql` | User trigger fix | ✅ Applied |
| 2025-11-16 | `20251116000001_add_advanced_workflow_patterns.sql` | Advanced patterns | ✅ Applied |
| 2025-11-16 | `20251116000002_seed_advanced_patterns.sql` | Example workflows | ✅ Applied |
| 2025-11-16 | `20251116000003_build_workflow_workflow.sql` | Build Workflow meta-workflow | ⏳ Pending |
| 2025-11-16 | `20251116000004_workflow_executions.sql` | Workflow executions table | ⏳ Pending |

---

## Future Migrations

When new migrations are added:
1. Add the migration file to `supabase/migrations/`
2. Run it via Supabase Dashboard or `psql`
3. Update this document with the new migration status
4. Test the changes in development before applying to production

