-- ============================================================================
-- Create connectors table
-- Created: 2025-01-20
-- Description: Connectors for external services (SendGrid, Slack, databases, APIs)
-- Part of: Services/Components/Connectors refactor - Phase 2
-- ============================================================================

CREATE TABLE connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  connector_type VARCHAR(100) NOT NULL, -- 'email', 'slack', 'database', 'api', 'oauth'
  name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  config_schema JSONB NOT NULL, -- JSON schema for configuration
  config_data JSONB NOT NULL, -- Encrypted configuration data
  credentials_encrypted BYTEA, -- Encrypted credentials (API keys, passwords, tokens)
  oauth_config JSONB, -- OAuth configuration if applicable
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, connector_type, name)
);

-- Indexes
CREATE INDEX idx_connectors_project ON connectors(project_id);
CREATE INDEX idx_connectors_type ON connectors(connector_type);
CREATE INDEX idx_connectors_created_by ON connectors(created_by);
CREATE INDEX idx_connectors_active ON connectors(is_active) WHERE is_active = true;

-- Comments
COMMENT ON TABLE connectors IS 'Connectors for external services (SendGrid, Slack, databases, APIs, OAuth)';
COMMENT ON COLUMN connectors.connector_type IS 'Type of connector: email, slack, database, api, oauth';
COMMENT ON COLUMN connectors.config_schema IS 'JSON schema defining the structure of config_data';
COMMENT ON COLUMN connectors.config_data IS 'Encrypted configuration data (non-sensitive settings)';
COMMENT ON COLUMN connectors.credentials_encrypted IS 'Encrypted credentials (API keys, passwords, tokens) - use Supabase Vault or application-level encryption';
COMMENT ON COLUMN connectors.oauth_config IS 'OAuth 2.0 configuration if connector uses OAuth';

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_connectors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_connectors_updated_at
  BEFORE UPDATE ON connectors
  FOR EACH ROW
  EXECUTE FUNCTION update_connectors_updated_at();

-- Enable RLS
ALTER TABLE connectors ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only see connectors for projects they have access to)
CREATE POLICY connectors_select_policy ON connectors
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = connectors.project_id
      AND projects.created_by = auth.uid()
    )
  );

CREATE POLICY connectors_insert_policy ON connectors
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = connectors.project_id
      AND projects.created_by = auth.uid()
    )
    AND created_by = auth.uid()
  );

CREATE POLICY connectors_update_policy ON connectors
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = connectors.project_id
      AND projects.created_by = auth.uid()
    )
  );

CREATE POLICY connectors_delete_policy ON connectors
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = connectors.project_id
      AND projects.created_by = auth.uid()
    )
  );

