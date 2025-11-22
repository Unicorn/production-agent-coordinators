-- ============================================================================
-- Create service_interfaces table
-- Created: 2025-01-20
-- Description: Service interfaces allow services to communicate with each other
-- Part of: Services/Components/Connectors refactor - Phase 1
-- ============================================================================

CREATE TABLE service_interfaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  interface_type VARCHAR(50) NOT NULL, -- 'signal', 'query', 'update', 'start_child'
  temporal_callable_name VARCHAR(255) NOT NULL, -- The actual Temporal signal/query/update name
  payload_schema JSONB NOT NULL, -- JSON schema for payload validation
  return_schema JSONB, -- JSON schema for return value (queries/updates)
  activity_connection_id UUID REFERENCES components(id), -- Optional: connects to activity
  is_public BOOLEAN DEFAULT false, -- If true, exposed via Kong API
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(service_id, name)
);

-- Indexes
CREATE INDEX idx_service_interfaces_service ON service_interfaces(service_id);
CREATE INDEX idx_service_interfaces_type ON service_interfaces(interface_type);
CREATE INDEX idx_service_interfaces_public ON service_interfaces(is_public) WHERE is_public = true;

-- Comments
COMMENT ON TABLE service_interfaces IS 'Interfaces that allow services to communicate with each other within a project';
COMMENT ON COLUMN service_interfaces.interface_type IS 'Type of Temporal callable: signal, query, update, or start_child';
COMMENT ON COLUMN service_interfaces.temporal_callable_name IS 'The actual name of the Temporal signal/query/update method';
COMMENT ON COLUMN service_interfaces.payload_schema IS 'JSON schema for validating incoming payloads';
COMMENT ON COLUMN service_interfaces.return_schema IS 'JSON schema for return values (used for queries and updates)';
COMMENT ON COLUMN service_interfaces.is_public IS 'If true, this interface is exposed via Kong API gateway';

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_service_interfaces_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_service_interfaces_updated_at
  BEFORE UPDATE ON service_interfaces
  FOR EACH ROW
  EXECUTE FUNCTION update_service_interfaces_updated_at();

-- Enable RLS
ALTER TABLE service_interfaces ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only see interfaces for services they own)
CREATE POLICY service_interfaces_select_policy ON service_interfaces
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workflows
      WHERE workflows.id = service_interfaces.service_id
      AND workflows.created_by = auth.uid()
    )
  );

CREATE POLICY service_interfaces_insert_policy ON service_interfaces
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workflows
      WHERE workflows.id = service_interfaces.service_id
      AND workflows.created_by = auth.uid()
    )
  );

CREATE POLICY service_interfaces_update_policy ON service_interfaces
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workflows
      WHERE workflows.id = service_interfaces.service_id
      AND workflows.created_by = auth.uid()
    )
  );

CREATE POLICY service_interfaces_delete_policy ON service_interfaces
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workflows
      WHERE workflows.id = service_interfaces.service_id
      AND workflows.created_by = auth.uid()
    )
  );

