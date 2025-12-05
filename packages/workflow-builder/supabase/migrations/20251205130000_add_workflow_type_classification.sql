-- ============================================================================
-- Add Workflow Type Classification
-- Created: 2025-12-05
-- Description: Add workflow_type column for automatic service/task classification.
--              This is used internally to determine if continue-as-new should be enabled.
--              All classification is automatic - users never see or configure this.
-- Part of: Automatic Continue-as-New Handling
-- ============================================================================

BEGIN;

-- Add workflow_type column to workflows table
ALTER TABLE workflows
  ADD COLUMN IF NOT EXISTS workflow_type VARCHAR(20) DEFAULT 'auto' 
    CHECK (workflow_type IN ('service', 'task', 'auto'));

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_workflows_workflow_type 
  ON workflows(workflow_type);

-- Add comment explaining the column
COMMENT ON COLUMN workflows.workflow_type IS 
  'Internal classification: service (long-running) or task (short-running). Auto-detected from workflow structure. Users never see or configure this.';

COMMIT;

