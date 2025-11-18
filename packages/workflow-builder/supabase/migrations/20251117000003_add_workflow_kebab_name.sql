-- ============================================================================
-- Add kebab_name field to workflows table
-- Created: 2025-11-17
-- Description: Rename 'name' to 'kebab_name' and add unique constraint on (created_by, kebab_name)
-- ============================================================================

-- Rename the name column to kebab_name
ALTER TABLE workflows 
  RENAME COLUMN name TO kebab_name;

-- Add unique constraint on (created_by, kebab_name)
ALTER TABLE workflows 
  ADD CONSTRAINT workflows_created_by_kebab_name_unique 
  UNIQUE (created_by, kebab_name);

-- Add comment to kebab_name column
COMMENT ON COLUMN workflows.kebab_name IS 'Kebab-case identifier for the workflow. Unique per user. Cannot be changed after creation.';

-- Add comment to display_name column
COMMENT ON COLUMN workflows.display_name IS 'Human-friendly display name for the workflow.';

