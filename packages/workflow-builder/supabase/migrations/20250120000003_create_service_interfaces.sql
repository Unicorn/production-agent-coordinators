-- ============================================================================
-- Migration: Create service_interfaces table
-- Created: 2025-01-20
-- Description: Stores service interfaces (signals, queries, updates) for workflows
-- Part of: Services/Components/Connectors refactor - Phase 12-14
-- ============================================================================

CREATE TABLE IF NOT EXISTS service_interfaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  interface_type VARCHAR(50) NOT NULL CHECK (interface_type IN ('signal', 'query', 'update', 'start_child')),
  callable_name VARCHAR(255) NOT NULL, -- Temporal signal/query name
  input_schema JSONB, -- JSON schema for input validation (formerly payload_schema)
  output_schema JSONB, -- JSON schema for return value (queries/updates)
  activity_connection_id UUID REFERENCES components(id), -- Optional: connects to activity
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workflow_id, name)
);

-- Indexes for performance
CREATE INDEX idx_service_interfaces_workflow ON service_interfaces(workflow_id);
CREATE INDEX idx_service_interfaces_public ON service_interfaces(is_public) WHERE is_public = true;
CREATE INDEX idx_service_interfaces_type ON service_interfaces(interface_type);
CREATE INDEX idx_service_interfaces_activity ON service_interfaces(activity_connection_id) WHERE activity_connection_id IS NOT NULL;

-- Comments
COMMENT ON TABLE service_interfaces IS 'Interfaces that allow services to communicate with each other within a project';
COMMENT ON COLUMN service_interfaces.interface_type IS 'Type of Temporal callable: signal, query, update, or start_child';
COMMENT ON COLUMN service_interfaces.callable_name IS 'The actual name of the Temporal signal/query/update method';
COMMENT ON COLUMN service_interfaces.input_schema IS 'JSON schema for validating incoming payloads';
COMMENT ON COLUMN service_interfaces.output_schema IS 'JSON schema for return values (used for queries and updates)';
COMMENT ON COLUMN service_interfaces.is_public IS 'If true, this interface is exposed via Kong API gateway';

-- RLS Policies
ALTER TABLE service_interfaces ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view interfaces for their own workflows
CREATE POLICY "Users can view own service interfaces"
  ON service_interfaces
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workflows
      WHERE workflows.id = service_interfaces.workflow_id
      AND workflows.created_by = auth.uid()
    )
  );

-- Policy: Users can create interfaces for their own workflows
CREATE POLICY "Users can create own service interfaces"
  ON service_interfaces
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workflows
      WHERE workflows.id = service_interfaces.workflow_id
      AND workflows.created_by = auth.uid()
    )
  );

-- Policy: Users can update interfaces for their own workflows
CREATE POLICY "Users can update own service interfaces"
  ON service_interfaces
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workflows
      WHERE workflows.id = service_interfaces.workflow_id
      AND workflows.created_by = auth.uid()
    )
  );

-- Policy: Users can delete interfaces for their own workflows
CREATE POLICY "Users can delete own service interfaces"
  ON service_interfaces
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workflows
      WHERE workflows.id = service_interfaces.workflow_id
      AND workflows.created_by = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_service_interfaces_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_service_interfaces_updated_at
  BEFORE UPDATE ON service_interfaces
  FOR EACH ROW
  EXECUTE FUNCTION update_service_interfaces_updated_at();
