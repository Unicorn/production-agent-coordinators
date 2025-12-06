-- ============================================================================
-- Add State Variables System
-- Created: 2025-12-05
-- Description: Add project-level and workflow-level state variables with
--              support for different storage types (workflow, database, redis)
-- Part of: Kong API Components and Enhanced State Management - Phase 2
-- ============================================================================

BEGIN;

-- Project-level state variables
CREATE TABLE IF NOT EXISTS project_state_variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'string', 'number', 'boolean', 'object', 'array'
  storage_type TEXT NOT NULL, -- 'workflow', 'database', 'redis', 'external'
  storage_config JSONB, -- Configuration for storage adapter (e.g., connector_id for redis)
  schema JSONB, -- JSON schema for validation
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, name)
);

-- Workflow-level state variables
CREATE TABLE IF NOT EXISTS workflow_state_variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'string', 'number', 'boolean', 'object', 'array'
  storage_type TEXT NOT NULL, -- 'workflow', 'database', 'redis', 'external'
  storage_config JSONB, -- Configuration for storage adapter
  schema JSONB, -- JSON schema for validation
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workflow_id, name)
);

-- State variable metrics for monitoring
CREATE TABLE IF NOT EXISTS state_variable_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variable_id UUID NOT NULL,
  scope TEXT NOT NULL, -- 'project' or 'workflow'
  size_bytes BIGINT,
  access_count BIGINT DEFAULT 0,
  last_accessed TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_project_state_variables_project 
  ON project_state_variables(project_id);
CREATE INDEX IF NOT EXISTS idx_project_state_variables_storage_type 
  ON project_state_variables(storage_type);
CREATE INDEX IF NOT EXISTS idx_workflow_state_variables_workflow 
  ON workflow_state_variables(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_state_variables_storage_type 
  ON workflow_state_variables(storage_type);
CREATE INDEX IF NOT EXISTS idx_state_variable_metrics_variable 
  ON state_variable_metrics(variable_id);
CREATE INDEX IF NOT EXISTS idx_state_variable_metrics_scope 
  ON state_variable_metrics(scope);

-- Comments
COMMENT ON TABLE project_state_variables IS 'Project-level state variables shared across all services in a project';
COMMENT ON TABLE workflow_state_variables IS 'Workflow-level (service-level) state variables isolated to a specific workflow';
COMMENT ON TABLE state_variable_metrics IS 'Metrics for monitoring state variable usage (size, access count, etc.)';
COMMENT ON COLUMN project_state_variables.storage_type IS 'Storage backend: workflow (in-memory), database (PostgreSQL), redis (Redis cache), external (custom adapter)';
COMMENT ON COLUMN workflow_state_variables.storage_type IS 'Storage backend: workflow (in-memory), database (PostgreSQL), redis (Redis cache), external (custom adapter)';
COMMENT ON COLUMN project_state_variables.storage_config IS 'Storage adapter configuration (e.g., connector_id for redis, table name for database)';
COMMENT ON COLUMN workflow_state_variables.storage_config IS 'Storage adapter configuration (e.g., connector_id for redis, table name for database)';

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_project_state_variables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_project_state_variables_updated_at
  BEFORE UPDATE ON project_state_variables
  FOR EACH ROW
  EXECUTE FUNCTION update_project_state_variables_updated_at();

CREATE OR REPLACE FUNCTION update_workflow_state_variables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_workflow_state_variables_updated_at
  BEFORE UPDATE ON workflow_state_variables
  FOR EACH ROW
  EXECUTE FUNCTION update_workflow_state_variables_updated_at();

-- Enable RLS
ALTER TABLE project_state_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_state_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE state_variable_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for project_state_variables
CREATE POLICY project_state_variables_select_policy ON project_state_variables
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_state_variables.project_id
      AND projects.created_by = auth.uid()
    )
  );

CREATE POLICY project_state_variables_insert_policy ON project_state_variables
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_state_variables.project_id
      AND projects.created_by = auth.uid()
    )
  );

CREATE POLICY project_state_variables_update_policy ON project_state_variables
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_state_variables.project_id
      AND projects.created_by = auth.uid()
    )
  );

CREATE POLICY project_state_variables_delete_policy ON project_state_variables
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_state_variables.project_id
      AND projects.created_by = auth.uid()
    )
  );

-- RLS Policies for workflow_state_variables
CREATE POLICY workflow_state_variables_select_policy ON workflow_state_variables
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workflows
      JOIN projects ON projects.id = workflows.project_id
      WHERE workflows.id = workflow_state_variables.workflow_id
      AND projects.created_by = auth.uid()
    )
  );

CREATE POLICY workflow_state_variables_insert_policy ON workflow_state_variables
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workflows
      JOIN projects ON projects.id = workflows.project_id
      WHERE workflows.id = workflow_state_variables.workflow_id
      AND projects.created_by = auth.uid()
    )
  );

CREATE POLICY workflow_state_variables_update_policy ON workflow_state_variables
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workflows
      JOIN projects ON projects.id = workflows.project_id
      WHERE workflows.id = workflow_state_variables.workflow_id
      AND projects.created_by = auth.uid()
    )
  );

CREATE POLICY workflow_state_variables_delete_policy ON workflow_state_variables
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workflows
      JOIN projects ON projects.id = workflows.project_id
      WHERE workflows.id = workflow_state_variables.workflow_id
      AND projects.created_by = auth.uid()
    )
  );

-- RLS Policies for state_variable_metrics
CREATE POLICY state_variable_metrics_select_policy ON state_variable_metrics
  FOR SELECT
  USING (
    -- Allow access if user owns the project (for project scope) or workflow (for workflow scope)
    (scope = 'project' AND EXISTS (
      SELECT 1 FROM project_state_variables
      JOIN projects ON projects.id = project_state_variables.project_id
      WHERE project_state_variables.id = state_variable_metrics.variable_id
      AND projects.created_by = auth.uid()
    ))
    OR
    (scope = 'workflow' AND EXISTS (
      SELECT 1 FROM workflow_state_variables
      JOIN workflows ON workflows.id = workflow_state_variables.workflow_id
      JOIN projects ON projects.id = workflows.project_id
      WHERE workflow_state_variables.id = state_variable_metrics.variable_id
      AND projects.created_by = auth.uid()
    ))
  );

CREATE POLICY state_variable_metrics_insert_policy ON state_variable_metrics
  FOR INSERT
  WITH CHECK (
    (scope = 'project' AND EXISTS (
      SELECT 1 FROM project_state_variables
      JOIN projects ON projects.id = project_state_variables.project_id
      WHERE project_state_variables.id = state_variable_metrics.variable_id
      AND projects.created_by = auth.uid()
    ))
    OR
    (scope = 'workflow' AND EXISTS (
      SELECT 1 FROM workflow_state_variables
      JOIN workflows ON workflows.id = workflow_state_variables.workflow_id
      JOIN projects ON projects.id = workflows.project_id
      WHERE workflow_state_variables.id = state_variable_metrics.variable_id
      AND projects.created_by = auth.uid()
    ))
  );

COMMIT;

