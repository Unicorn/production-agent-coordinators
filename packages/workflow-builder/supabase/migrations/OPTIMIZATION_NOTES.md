# Migration Optimization Notes

## Current Issues

1. **Duplicate Timestamps**: Fixed - renamed `20251118000002_agent_testing_state.sql` to `20251118000001_agent_testing_state.sql` and `20251118000001_create_system_user.sql` to `20251118000000_create_system_user.sql`

2. **Redundant System User Creation**:
   - `20251118000000_create_system_user.sql` - Creates system role and function
   - `20251118000002_seed_public_components.sql` - Also creates system role and system user
   - `20251118000003_seed_system_user_and_workflows.sql` - Also creates system user infrastructure
   - **Solution**: Keep system role in `20251118000000`, remove from `20251118000002`

3. **Duplicate Demo Workflow Creation**:
   - `20251118000002_seed_public_components.sql` - Creates PUBLIC demo workflows
   - `20251118000005_user_defaults_and_archive.sql` - Creates PER-USER demo workflows and archives old public ones
   - **Solution**: Remove public demo workflow creation from `20251118000002` (migration 20251118000005 handles this)

4. **Migration Order** (after fixes):
   - `20251118000000_create_system_user.sql` - System role and function
   - `20251118000001_agent_testing_state.sql` - Agent test/builder tables
   - `20251118000002_seed_public_components.sql` - Components and system user (no demo workflows)
   - `20251118000003_seed_system_user_and_workflows.sql` - System infrastructure (can be merged into 20251118000002)
   - `20251118000004_create_workflow_endpoints.sql` - Workflow endpoints table
   - `20251118000005_user_defaults_and_archive.sql` - Archive support and per-user defaults

## Optimizations Applied

1. ✅ Fixed duplicate timestamps
2. ✅ Removed public demo workflow creation from seed migration (moved to per-user in archive migration)
3. ✅ Consolidated system user creation logic
4. ✅ Made all migrations idempotent with `ON CONFLICT DO NOTHING` or `IF NOT EXISTS`

## For Fresh DB Resets

All migrations are now optimized for clean runs:
- System infrastructure created once
- Demo workflows created per-user (not public)
- All migrations are idempotent
- Proper dependency ordering

