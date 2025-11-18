-- ============================================================================
-- Migration: Execution Monitoring Tables
-- Created: 2025-11-18
-- Description: Creates tables for workflow execution monitoring, component
--   execution tracking, project connections, and statistics
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Update workflow_executions table
-- ============================================================================

ALTER TABLE workflow_executions
  ADD COLUMN IF NOT EXISTS temporal_history_json JSONB, -- Full Temporal history for debugging
  ADD COLUMN IF NOT EXISTS history_synced_at TIMESTAMPTZ, -- When history was last synced from Temporal
  ADD COLUMN IF NOT EXISTS history_sync_status VARCHAR(50) DEFAULT 'pending'; -- 'pending', 'syncing', 'synced', 'failed'

CREATE INDEX IF NOT EXISTS idx_workflow_executions_sync_status ON workflow_executions(history_sync_status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_synced_at ON workflow_executions(history_synced_at);

-- ============================================================================
-- STEP 2: Create component_executions table
-- ============================================================================

CREATE TABLE IF NOT EXISTS component_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
  node_id VARCHAR(255) NOT NULL, -- Maps to workflow node ID
  component_id UUID REFERENCES components(id),
  component_name VARCHAR(255),
  
  -- Execution details
  status VARCHAR(50) NOT NULL, -- 'pending', 'running', 'completed', 'failed', 'retrying'
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  
  -- Data flow
  input_data JSONB, -- Inputs passed to component
  output_data JSONB, -- Outputs from component
  
  -- Error handling
  error_message TEXT,
  error_type VARCHAR(100), -- 'activity_failure', 'timeout', 'retry_exhausted', etc.
  retry_count INTEGER DEFAULT 0,
  is_expected_retry BOOLEAN DEFAULT false, -- True if retry was expected (based on node retry policy)
  
  -- Temporal references
  temporal_activity_id VARCHAR(255), -- Temporal activity execution ID
  temporal_attempt INTEGER DEFAULT 1,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_component_executions_workflow_execution_id ON component_executions(workflow_execution_id);
CREATE INDEX idx_component_executions_node_id ON component_executions(node_id);
CREATE INDEX idx_component_executions_status ON component_executions(status);
CREATE INDEX idx_component_executions_component_id ON component_executions(component_id);

-- ============================================================================
-- STEP 3: Create project_connections table
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  connection_type VARCHAR(50) NOT NULL, -- 'postgresql', 'redis', etc.
  name VARCHAR(255) NOT NULL, -- User-friendly connection name
  connection_url TEXT NOT NULL, -- Encrypted connection string
  config JSONB DEFAULT '{}', -- Additional connection configuration
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(project_id, name)
);

CREATE INDEX idx_project_connections_project_id ON project_connections(project_id);
CREATE INDEX idx_project_connections_type ON project_connections(connection_type);
CREATE INDEX idx_project_connections_created_by ON project_connections(created_by);

-- ============================================================================
-- STEP 4: Create workflow_statistics table
-- ============================================================================

CREATE TABLE IF NOT EXISTS workflow_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  
  -- Execution counts
  total_runs INTEGER DEFAULT 0,
  successful_runs INTEGER DEFAULT 0,
  failed_runs INTEGER DEFAULT 0,
  
  -- Timing
  avg_duration_ms INTEGER,
  min_duration_ms INTEGER,
  max_duration_ms INTEGER,
  
  -- Component usage
  most_used_component_id UUID REFERENCES components(id),
  most_used_component_count INTEGER DEFAULT 0,
  
  -- Error tracking
  total_errors INTEGER DEFAULT 0,
  last_error_at TIMESTAMPTZ,
  
  -- Last updated
  last_run_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(workflow_id)
);

CREATE INDEX idx_workflow_statistics_workflow_id ON workflow_statistics(workflow_id);
CREATE INDEX idx_workflow_statistics_last_run_at ON workflow_statistics(last_run_at);

-- ============================================================================
-- STEP 5: Create project_statistics table
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Workflow usage
  most_used_workflow_id UUID REFERENCES workflows(id),
  most_used_workflow_count INTEGER DEFAULT 0,
  
  -- Component usage
  most_used_component_id UUID REFERENCES components(id),
  most_used_component_count INTEGER DEFAULT 0,
  
  -- Task queue usage
  most_used_task_queue_id UUID REFERENCES task_queues(id),
  most_used_task_queue_count INTEGER DEFAULT 0,
  
  -- Execution metrics
  total_executions INTEGER DEFAULT 0,
  longest_run_duration_ms INTEGER,
  longest_run_workflow_id UUID REFERENCES workflows(id),
  
  -- Error tracking
  total_failures INTEGER DEFAULT 0,
  last_failure_at TIMESTAMPTZ,
  
  -- Last updated
  last_execution_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(project_id)
);

CREATE INDEX idx_project_statistics_project_id ON project_statistics(project_id);
CREATE INDEX idx_project_statistics_last_execution_at ON project_statistics(last_execution_at);

-- ============================================================================
-- STEP 6: Enable RLS on new tables
-- ============================================================================

ALTER TABLE component_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_statistics ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 7: Create RLS Policies
-- ============================================================================

-- Component Executions Policies
CREATE POLICY "Users can view component executions for their workflow executions"
  ON component_executions
  FOR SELECT
  USING (
    workflow_execution_id IN (
      SELECT id FROM workflow_executions
      WHERE created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid())
      OR workflow_id IN (
        SELECT id FROM workflows
        WHERE visibility_id IN (SELECT id FROM component_visibility WHERE name = 'public')
      )
    )
  );

CREATE POLICY "System can manage component executions"
  ON component_executions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workflow_executions we
      JOIN users u ON we.created_by = u.id
      JOIN user_roles ur ON u.role_id = ur.id
      WHERE we.id = component_executions.workflow_execution_id
      AND ur.name = 'system'
    )
  );

-- Project Connections Policies
CREATE POLICY "Users can view connections for their projects"
  ON project_connections
  FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
  );

CREATE POLICY "Users can manage connections for their projects"
  ON project_connections
  FOR ALL
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
  );

-- Workflow Statistics Policies
CREATE POLICY "Users can view statistics for their workflows"
  ON workflow_statistics
  FOR SELECT
  USING (
    workflow_id IN (
      SELECT id FROM workflows
      WHERE created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid())
      OR visibility_id IN (SELECT id FROM component_visibility WHERE name = 'public')
    )
  );

CREATE POLICY "System can manage workflow statistics"
  ON workflow_statistics
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workflows w
      JOIN users u ON w.created_by = u.id
      JOIN user_roles ur ON u.role_id = ur.id
      WHERE w.id = workflow_statistics.workflow_id
      AND ur.name = 'system'
    )
  );

-- Project Statistics Policies
CREATE POLICY "Users can view statistics for their projects"
  ON project_statistics
  FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
  );

CREATE POLICY "System can manage project statistics"
  ON project_statistics
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN users u ON p.created_by = u.id
      JOIN user_roles ur ON u.role_id = ur.id
      WHERE p.id = project_statistics.project_id
      AND ur.name = 'system'
    )
  );

-- ============================================================================
-- STEP 8: Create triggers for updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_project_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_project_connections_updated_at
  BEFORE UPDATE ON project_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_project_connections_updated_at();

CREATE OR REPLACE FUNCTION update_workflow_statistics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_workflow_statistics_updated_at
  BEFORE UPDATE ON workflow_statistics
  FOR EACH ROW
  EXECUTE FUNCTION update_workflow_statistics_updated_at();

CREATE OR REPLACE FUNCTION update_project_statistics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_project_statistics_updated_at
  BEFORE UPDATE ON project_statistics
  FOR EACH ROW
  EXECUTE FUNCTION update_project_statistics_updated_at();

-- ============================================================================
-- STEP 9: Add comments
-- ============================================================================

COMMENT ON TABLE component_executions IS 'Tracks component-level execution details for each workflow run, including inputs, outputs, errors, and retry information.';
COMMENT ON TABLE project_connections IS 'Stores project-level database and service connections (PostgreSQL, Redis, etc.).';
COMMENT ON TABLE workflow_statistics IS 'Aggregated statistics per workflow including execution counts, timing, and component usage.';
COMMENT ON TABLE project_statistics IS 'Aggregated statistics per project including workflow usage, component usage, and execution metrics.';

COMMIT;

