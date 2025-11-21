-- Add created_by field to workflow_executions table
-- This tracks which user initiated the workflow execution

-- Add the column (nullable initially for existing records)
ALTER TABLE workflow_executions
ADD COLUMN created_by TEXT;

-- Add foreign key constraint to users table
ALTER TABLE workflow_executions
ADD CONSTRAINT workflow_executions_created_by_fkey
FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX idx_workflow_executions_created_by
ON workflow_executions(created_by);

-- Create composite index for common queries
CREATE INDEX idx_workflow_executions_user_status
ON workflow_executions(created_by, status);

-- Add comment
COMMENT ON COLUMN workflow_executions.created_by IS 'User ID who initiated this workflow execution';
