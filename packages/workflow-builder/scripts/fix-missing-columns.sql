-- Fix Missing Columns in Cloud Supabase
-- Run this in Supabase Dashboard SQL Editor
-- URL: https://supabase.com/dashboard/project/jeaudyvxapooyfddfptr/sql/new
-- 
-- This script adds all missing columns that are causing errors

BEGIN;

-- ============================================================================
-- WORKFLOWS TABLE
-- ============================================================================

-- Add is_archived (required for workflows.list query)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'workflows' 
    AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE workflows ADD COLUMN is_archived BOOLEAN DEFAULT false NOT NULL;
    RAISE NOTICE 'Added is_archived to workflows';
  ELSE
    RAISE NOTICE 'is_archived already exists in workflows';
  END IF;
END $$;

-- Add index for is_archived
CREATE INDEX IF NOT EXISTS idx_workflows_is_archived 
ON workflows(is_archived) 
WHERE is_archived = false;

-- Add kebab_name (required for workflow naming)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'workflows' 
    AND column_name = 'kebab_name'
  ) THEN
    ALTER TABLE workflows ADD COLUMN kebab_name VARCHAR(255);
    RAISE NOTICE 'Added kebab_name to workflows';
  ELSE
    RAISE NOTICE 'kebab_name already exists in workflows';
  END IF;
END $$;

-- ============================================================================
-- PROJECTS TABLE
-- ============================================================================

-- Add is_archived to projects
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'projects' 
    AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE projects ADD COLUMN is_archived BOOLEAN DEFAULT false NOT NULL;
    RAISE NOTICE 'Added is_archived to projects';
  ELSE
    RAISE NOTICE 'is_archived already exists in projects';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_projects_is_archived 
ON projects(is_archived) 
WHERE is_archived = false;

-- Add is_default to projects
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'projects' 
    AND column_name = 'is_default'
  ) THEN
    ALTER TABLE projects ADD COLUMN is_default BOOLEAN DEFAULT false NOT NULL;
    RAISE NOTICE 'Added is_default to projects';
  ELSE
    RAISE NOTICE 'is_default already exists in projects';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_projects_is_default 
ON projects(is_default, created_by);

-- ============================================================================
-- TASK_QUEUES TABLE
-- ============================================================================

-- Add is_default to task_queues
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'task_queues' 
    AND column_name = 'is_default'
  ) THEN
    ALTER TABLE task_queues ADD COLUMN is_default BOOLEAN DEFAULT false NOT NULL;
    RAISE NOTICE 'Added is_default to task_queues';
  ELSE
    RAISE NOTICE 'is_default already exists in task_queues';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_task_queues_is_default 
ON task_queues(is_default, created_by);

COMMIT;

-- Verify the changes
SELECT 
  'workflows' as table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'workflows'
  AND column_name IN ('is_archived', 'kebab_name')
UNION ALL
SELECT 
  'projects' as table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'projects'
  AND column_name IN ('is_archived', 'is_default')
UNION ALL
SELECT 
  'task_queues' as table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'task_queues'
  AND column_name = 'is_default'
ORDER BY table_name, column_name;

