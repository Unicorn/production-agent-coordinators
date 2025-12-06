-- ============================================================================
-- Add Kong Logging Component
-- Created: 2025-12-05
-- Description: Add kong-logging component type and project logging configuration
-- Part of: Kong API Components and Enhanced State Management - Phase 3
-- ============================================================================

BEGIN;

-- Add kong-logging component type
INSERT INTO component_types (name, description, icon) VALUES
  ('kong-logging', 'Logging configuration for API endpoints (project-level)', 'file-text')
ON CONFLICT (name) DO NOTHING;

-- Project logging configuration
CREATE TABLE IF NOT EXISTS project_logging_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  connector_id UUID,
  logging_component_id UUID NOT NULL,
  enabled_endpoints JSONB DEFAULT '[]'::jsonb, -- Array of endpoint IDs (data-in/data-out component IDs)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id)
);

-- Add foreign key constraint for connectors if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'connectors') THEN
    -- Add foreign key constraint if connectors table exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'project_logging_config_connector_id_fkey'
      AND table_name = 'project_logging_config'
    ) THEN
      ALTER TABLE project_logging_config
        ADD CONSTRAINT project_logging_config_connector_id_fkey
        FOREIGN KEY (connector_id) REFERENCES connectors(id) ON DELETE CASCADE;
    END IF;
    
    -- Make it required if table exists
    ALTER TABLE project_logging_config
      ALTER COLUMN connector_id SET NOT NULL;
  END IF;
END $$;

-- Add logging fields to public_interfaces (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'public_interfaces') THEN
    ALTER TABLE public_interfaces 
      ADD COLUMN IF NOT EXISTS logging_enabled BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS logging_config JSONB;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_project_logging_config_project 
  ON project_logging_config(project_id);
CREATE INDEX IF NOT EXISTS idx_project_logging_config_component 
  ON project_logging_config(logging_component_id);

-- Comments
COMMENT ON TABLE project_logging_config IS 'Project-level logging configuration shared across all services';
COMMENT ON COLUMN project_logging_config.enabled_endpoints IS 'Array of endpoint component IDs (data-in/data-out) that have logging enabled';

-- Comments for public_interfaces (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'public_interfaces') THEN
    COMMENT ON COLUMN public_interfaces.logging_enabled IS 'Whether logging is enabled for this public interface';
    COMMENT ON COLUMN public_interfaces.logging_config IS 'Logging configuration (connector, format, etc.)';
  END IF;
END $$;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_project_logging_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_project_logging_config_updated_at
  BEFORE UPDATE ON project_logging_config
  FOR EACH ROW
  EXECUTE FUNCTION update_project_logging_config_updated_at();

-- Enable RLS
ALTER TABLE project_logging_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies for project_logging_config
CREATE POLICY project_logging_config_select_policy ON project_logging_config
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_logging_config.project_id
      AND projects.created_by = auth.uid()
    )
  );

CREATE POLICY project_logging_config_insert_policy ON project_logging_config
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_logging_config.project_id
      AND projects.created_by = auth.uid()
    )
  );

CREATE POLICY project_logging_config_update_policy ON project_logging_config
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_logging_config.project_id
      AND projects.created_by = auth.uid()
    )
  );

CREATE POLICY project_logging_config_delete_policy ON project_logging_config
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_logging_config.project_id
      AND projects.created_by = auth.uid()
    )
  );

COMMIT;

