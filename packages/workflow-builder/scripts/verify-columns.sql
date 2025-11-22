-- Verify Missing Columns
-- Run this in Supabase Dashboard SQL Editor to check what's missing
-- URL: https://supabase.com/dashboard/project/jeaudyvxapooyfddfptr/sql/new

-- Check workflows table columns
SELECT 
  'workflows' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'workflows'
  AND column_name IN ('is_archived', 'kebab_name')
ORDER BY column_name;

-- Check projects table columns
SELECT 
  'projects' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'projects'
  AND column_name IN ('is_archived', 'is_default')
ORDER BY column_name;

-- Check task_queues table columns
SELECT 
  'task_queues' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'task_queues'
  AND column_name = 'is_default';

-- If any of these return 0 rows, the column is missing!
-- Run scripts/fix-missing-columns.sql to add them.

