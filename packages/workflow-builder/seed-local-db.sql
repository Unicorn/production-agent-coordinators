-- Quick seed script for local development
-- Run with: psql "$DATABASE_URL" < seed-local-db.sql

\echo '🌱 Seeding local database...'
\echo ''

-- Create Build Workflow (run the DO block from migration 20251116000003)
\i supabase/migrations/20251116000003_build_workflow_workflow.sql

\echo ''
\echo '✅ Build Workflow created'
\echo ''

-- Create Build Workflow components (run the DO block from migration 20251117000002)  
\i supabase/migrations/20251117000002_seed_build_workflow_components.sql

\echo ''
\echo '✅ Components seeded'
\echo ''

-- Verify
\echo '📊 Verification:'
\echo ''

SELECT '  System Project:' as item, COUNT(*) as count 
FROM projects 
WHERE id = '00000000-0000-0000-0000-000000000001';

SELECT '  Components:' as item, COUNT(*) as count
FROM components 
WHERE id::text LIKE '11111111-0000-0000-0000-%';

SELECT '  Build Workflow:' as item, COUNT(*) as count
FROM workflows 
WHERE id = 'aaaaaaaa-bbbb-cccc-dddd-000000000001';

SELECT '  Workflow Nodes:' as item, COUNT(*) as count
FROM workflow_nodes
WHERE workflow_id = 'aaaaaaaa-bbbb-cccc-dddd-000000000001';

\echo ''
\echo '✅ Local database seeded successfully!'
\echo ''
\echo 'Login credentials:'
\echo '  Email: test@example.com'
\echo '  Password: testpassword123'
\echo ''

