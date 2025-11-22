-- Add created_by field to workflow_executions table
-- This tracks which user initiated the workflow execution

-- Add the column (nullable initially for existing records)
-- Use IF NOT EXISTS pattern for idempotency
DO $$
BEGIN
  -- Add column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workflow_executions' 
    AND column_name = 'created_by'
  ) THEN
    ALTER TABLE workflow_executions ADD COLUMN created_by TEXT;
  END IF;
  
  -- Add foreign key constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'workflow_executions_created_by_fkey'
  ) THEN
    ALTER TABLE workflow_executions
    ADD CONSTRAINT workflow_executions_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
  
  -- Create index if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_workflow_executions_created_by'
  ) THEN
    CREATE INDEX idx_workflow_executions_created_by
    ON workflow_executions(created_by);
  END IF;
  
  -- Create composite index if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_workflow_executions_user_status'
  ) THEN
    CREATE INDEX idx_workflow_executions_user_status
    ON workflow_executions(created_by, status);
  END IF;
END $$;

-- Add comment
COMMENT ON COLUMN workflow_executions.created_by IS 'User ID who initiated this workflow execution';
