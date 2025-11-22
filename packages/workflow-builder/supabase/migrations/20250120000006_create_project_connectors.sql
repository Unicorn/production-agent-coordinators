-- ============================================================================
-- Create project_connectors table
-- Created: 2025-01-20
-- Description: Connectors for cross-project communication via Temporal Nexus
-- Part of: Services/Components/Connectors refactor - Phase 2
-- ============================================================================

CREATE TABLE project_connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  target_project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  target_service_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  target_interface_id UUID NOT NULL REFERENCES service_interfaces(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  nexus_endpoint_name VARCHAR(255) NOT NULL, -- Nexus endpoint identifier
  visibility VARCHAR(50) DEFAULT 'private', -- 'private', 'public', 'organization'
  auth_config JSONB, -- Auth configuration if public
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_project_id, name)
);

-- Indexes
CREATE INDEX idx_project_connectors_source ON project_connectors(source_project_id);
CREATE INDEX idx_project_connectors_target ON project_connectors(target_project_id);
CREATE INDEX idx_project_connectors_target_service ON project_connectors(target_service_id);
CREATE INDEX idx_project_connectors_target_interface ON project_connectors(target_interface_id);
CREATE INDEX idx_project_connectors_created_by ON project_connectors(created_by);

-- Comments
COMMENT ON TABLE project_connectors IS 'Connectors for cross-project communication via Temporal Nexus';
COMMENT ON COLUMN project_connectors.source_project_id IS 'Project that will use this connector';
COMMENT ON COLUMN project_connectors.target_project_id IS 'Project containing the target service';
COMMENT ON COLUMN project_connectors.target_service_id IS 'Target service (workflow) to connect to';
COMMENT ON COLUMN project_connectors.target_interface_id IS 'Target service interface to connect to';
COMMENT ON COLUMN project_connectors.nexus_endpoint_name IS 'Temporal Nexus endpoint identifier';
COMMENT ON COLUMN project_connectors.visibility IS 'Visibility level: private, public, or organization';
COMMENT ON COLUMN project_connectors.auth_config IS 'Authentication configuration if connector is public';

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_project_connectors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_project_connectors_updated_at
  BEFORE UPDATE ON project_connectors
  FOR EACH ROW
  EXECUTE FUNCTION update_project_connectors_updated_at();

-- Enable RLS
ALTER TABLE project_connectors ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only see connectors for projects they own)
CREATE POLICY project_connectors_select_policy ON project_connectors
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_connectors.source_project_id
      AND projects.created_by = auth.uid()
    )
  );

CREATE POLICY project_connectors_insert_policy ON project_connectors
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_connectors.source_project_id
      AND projects.created_by = auth.uid()
    )
    AND created_by = auth.uid()
  );

CREATE POLICY project_connectors_update_policy ON project_connectors
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_connectors.source_project_id
      AND projects.created_by = auth.uid()
    )
  );

CREATE POLICY project_connectors_delete_policy ON project_connectors
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_connectors.source_project_id
      AND projects.created_by = auth.uid()
    )
  );

