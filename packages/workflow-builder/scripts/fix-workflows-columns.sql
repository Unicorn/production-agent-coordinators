-- Fix Missing Columns in workflows table
-- Run this in Supabase Dashboard SQL Editor
-- URL: https://supabase.com/dashboard/project/jeaudyvxapooyfddfptr/sql/new

-- Add is_archived to workflows
ALTER TABLE workflows
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false NOT NULL;

-- Add kebab_name to workflows  
ALTER TABLE workflows
  ADD COLUMN IF NOT EXISTS kebab_name VARCHAR(255);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_workflows_is_archived 
ON workflows(is_archived) 
WHERE is_archived = false;

-- Verify the columns were added
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'workflows'
  AND column_name IN ('is_archived', 'kebab_name')
ORDER BY column_name;

