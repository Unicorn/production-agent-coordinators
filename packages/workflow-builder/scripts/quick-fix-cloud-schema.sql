-- Quick Fix: Add Missing Columns to Cloud Supabase
-- Run this in Supabase Dashboard SQL Editor to fix immediate errors
-- URL: https://supabase.com/dashboard/project/jeaudyvxapooyfddfptr/sql/new

-- Add is_archived to workflows (if missing)
ALTER TABLE workflows
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workflows_is_archived ON workflows(is_archived) WHERE is_archived = false;

-- Add is_archived to projects (if missing)
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false NOT NULL;

CREATE INDEX IF NOT EXISTS idx_projects_is_archived ON projects(is_archived) WHERE is_archived = false;

-- Add is_default to projects (if missing)
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false NOT NULL;

CREATE INDEX IF NOT EXISTS idx_projects_is_default ON projects(is_default, created_by);

-- Add is_default to task_queues (if missing)
ALTER TABLE task_queues
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false NOT NULL;

CREATE INDEX IF NOT EXISTS idx_task_queues_is_default ON task_queues(is_default, created_by);

-- Add kebab_name to workflows (if missing - from migration 20251117000003)
ALTER TABLE workflows
  ADD COLUMN IF NOT EXISTS kebab_name VARCHAR(255);

-- Note: Full migrations still need to be applied for complete functionality
-- See: scripts/apply-migrations-cloud.ts for full migration list

