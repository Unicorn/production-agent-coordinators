-- Migration: Extend workflow_executions table
-- The table already exists from the initial schema, but we need to extend it
-- to support the workflow builder's execution tracking needs

-- Add columns needed for workflow builder
ALTER TABLE public.workflow_executions
  -- Make temporal fields optional (for simulated execution)
  ALTER COLUMN temporal_run_id DROP NOT NULL,
  ALTER COLUMN temporal_workflow_id DROP NOT NULL,
  
  -- Add user tracking
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Update status check constraint to include our new statuses
-- Drop old constraint if it exists
DO $$ BEGIN
  ALTER TABLE public.workflow_executions DROP CONSTRAINT IF EXISTS workflow_executions_status_check;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Add new constraint with extended status values
ALTER TABLE public.workflow_executions
  ADD CONSTRAINT workflow_executions_status_check 
  CHECK (status IN ('pending', 'building', 'running', 'completed', 'failed', 'cancelled', 'paused'));

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_workflow_executions_created_by ON public.workflow_executions(created_by);

-- Note: output column exists (use instead of 'result')
-- Note: error_message column exists (use instead of 'error')
-- RLS is already enabled

-- Drop existing RLS policies if they exist (from initial schema)
DROP POLICY IF EXISTS workflow_executions_read_own ON public.workflow_executions;
DROP POLICY IF EXISTS workflow_executions_insert_own ON public.workflow_executions;
DROP POLICY IF EXISTS workflow_executions_update_own ON public.workflow_executions;
DROP POLICY IF EXISTS workflow_executions_delete_own ON public.workflow_executions;

-- Create new RLS policies that work with created_by column
CREATE POLICY "Users can view their own workflow executions"
  ON public.workflow_executions
  FOR SELECT
  USING (
    created_by IS NULL  -- Allow viewing executions without created_by (legacy)
    OR created_by = (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    OR EXISTS (
      -- Also allow viewing executions of public workflows
      SELECT 1 FROM public.workflows w
      JOIN public.component_visibility cv ON w.visibility_id = cv.id
      WHERE w.id = workflow_executions.workflow_id
      AND cv.name = 'public'
    )
  );

CREATE POLICY "Users can create their own workflow executions"
  ON public.workflow_executions
  FOR INSERT
  WITH CHECK (
    created_by = (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "Users can update their own workflow executions"
  ON public.workflow_executions
  FOR UPDATE
  USING (
    created_by IS NULL  -- Allow updating executions without created_by (legacy)
    OR created_by = (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "Users can delete their own workflow executions"
  ON public.workflow_executions
  FOR DELETE
  USING (
    created_by = (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_workflow_executions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_workflow_executions_updated_at
  BEFORE UPDATE ON public.workflow_executions
  FOR EACH ROW
  EXECUTE FUNCTION update_workflow_executions_updated_at();

-- Add comment
COMMENT ON TABLE public.workflow_executions IS 'Tracks all workflow executions. Each time a workflow is built/run, an execution record is created with its status, input, result, and timing information.';

