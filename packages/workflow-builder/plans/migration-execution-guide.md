# Migration Execution Guide

**Date:** 2025-01-XX  
**Status:** Ready to Execute  
**Total Migrations:** 48

---

## Connection Issue

The provided connection string is not working. Please verify:
1. **Get correct connection string** from: https://supabase.com/dashboard/project/jeaudyvxapooyfddfptr/settings/database
2. **Use direct connection** (port 5432) for migrations, not pooler (port 6543)
3. **Verify password** is correct

---

## Recommended Method: Supabase Dashboard

**Best approach:** Use Supabase Dashboard SQL Editor

1. Go to: https://supabase.com/dashboard/project/jeaudyvxapooyfddfptr/sql/new
2. Copy and paste each migration file in order (alphabetically)
3. Click "Run" for each migration
4. Verify success before moving to next

---

## Migration Order (Alphabetical)

All migrations are **idempotent** and safe to run multiple times.

### January 2025 Migrations (Run First - Dependencies)
1. `20250119000002_create_activities_table.sql`
2. `20250119000003_seed_initial_activities.sql`
3. `20250119_add_created_by_to_workflow_executions.sql`
4. `20250120000000_seed_all_components_complete.sql` ⭐ (adds is_active column)
5. `20250120000001_add_service_display_name.sql`
6. `20250120000002_rename_task_queue_display_name.sql`
7. `20250120000003_create_service_interfaces.sql` ⭐ (required for public_interfaces)
8. `20250120000004_create_public_interfaces.sql` ⭐ (required for Kong migrations)
9. `20250120000005_create_connectors.sql` ⭐ (required for Kong logging)
10. `20250120000006_create_project_connectors.sql` ⭐ (handles missing service_interfaces)
11. `20250120000007_create_api_keys.sql`
12. `20250120000008_add_encryption_to_connections.sql`

### November 2025 Migrations
13. `20251114000001_initial_schema.sql`
14. `20251114000002_seed_default_task_queue.sql`
15. `20251114000003_fix_user_trigger.sql`
16. `20251116000001_add_advanced_workflow_patterns.sql`
17. `20251116000002_seed_advanced_patterns.sql`
18. `20251116000003_build_workflow_workflow.sql`
19. `20251116000004_workflow_executions.sql`
20. `20251117000001_phase2_temporal_integration.sql`
21. `20251117000002_seed_build_workflow_components.sql`
22. `20251117000003_add_workflow_kebab_name.sql`
23. `20251117000004_prevent_kebab_name_updates.sql`
24. `20251117000005_add_task_queue_display_name.sql` ⭐ (fixed for idempotency)
25. `20251117000006_add_custom_activity_code.sql` ⭐ (adds is_active column)
26. `20251117000008_fix_task_queue_display_name.sql`
27. `20251118000000_create_system_user.sql`
28. `20251118000001_agent_testing_state.sql` ⭐ (fixed for idempotency)
29. `20251118000002_seed_public_components.sql`
30. `20251118000003_seed_system_user_and_workflows.sql`
31. `20251118000004_create_workflow_endpoints.sql`
32. `20251118000005_user_defaults_and_archive.sql`
33. `20251118000006_execution_monitoring_tables.sql`
34. `20251118000007_seed_sync_workflow_and_components.sql`
35. `20251119000001_add_deployment_status.sql` ⭐ (fixed for idempotency)

### December 2025 Migrations
36. `20251203183155_add_interface_component_types.sql`
37. `20251205110000_add_connector_classifications.sql`
38. `20251205120000_add_state_variables.sql`
39. `20251205130000_add_kong_logging_component.sql` ⭐ (handles missing public_interfaces & connectors)
40. `20251205130000_add_workflow_type_classification.sql`
41. `20251205140000_add_kong_caching_component.sql`
42. `20251205150000_add_kong_cors_component.sql` ⭐ (handles missing public_interfaces)
43. `20251205160000_add_graphql_gateway_component.sql`
44. `20251205170000_add_mcp_server_component.sql`

### Component Organization Migrations (Final)
45. `20251206000000_seed_all_components_complete.sql` ⭐ (adds is_active if missing)
46. `20251206000001_create_component_categories.sql` ⭐ (creates category system)
47. `20251206000002_seed_component_categories.sql` ⭐ (seeds categories)
48. `20251206000003_map_components_to_categories.sql` ⭐ (maps components & adds keywords)

---

## Critical Dependencies

**Run these FIRST:**
- `20250120000003_create_service_interfaces.sql` (before public_interfaces)
- `20250120000004_create_public_interfaces.sql` (before Kong migrations)
- `20250120000005_create_connectors.sql` (before Kong logging)

**All other migrations handle missing dependencies gracefully.**

---

## Verification Queries

After running all migrations, verify:

```sql
-- Check is_active column
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'components' AND column_name = 'is_active';

-- Check category tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('component_categories', 'component_category_mapping', 'component_keywords');

-- Check components were seeded
SELECT name FROM components WHERE name IN ('kong-logging', 'kong-cache', 'kong-cors', 'graphql-gateway');

-- Check categories
SELECT COUNT(*) FROM component_categories;
```

---

## All Migrations Are Idempotent

✅ Safe to run multiple times  
✅ Use `IF NOT EXISTS` on all CREATE statements  
✅ Use `ON CONFLICT` on all INSERT statements  
✅ Handle missing dependencies gracefully

---

## Quick Run Script

To output all migrations for copy-paste:

```bash
tsx scripts/prepare-migrations-for-dashboard.ts > migrations-output.txt
```

Then copy from `migrations-output.txt` to Supabase Dashboard.

