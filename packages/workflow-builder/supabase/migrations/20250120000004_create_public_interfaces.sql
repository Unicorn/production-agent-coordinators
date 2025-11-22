-- ============================================================================
-- Create public_interfaces table
-- Created: 2025-01-20
-- Description: Public interfaces expose services via RESTful APIs through Kong gateway
-- Part of: Services/Components/Connectors refactor - Phase 1
-- ============================================================================

CREATE TABLE public_interfaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_interface_id UUID NOT NULL REFERENCES service_interfaces(id) ON DELETE CASCADE,
  kong_route_id VARCHAR(255), -- Kong route identifier
  http_method VARCHAR(10) NOT NULL, -- GET, POST, PATCH, etc.
  http_path VARCHAR(500) NOT NULL, -- API path
  auth_type VARCHAR(50) DEFAULT 'api_key', -- 'api_key', 'oauth2', 'jwt', 'none'
  auth_config JSONB, -- Auth-specific configuration
  rate_limit_per_minute INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_public_interfaces_service_interface ON public_interfaces(service_interface_id);
CREATE INDEX idx_public_interfaces_kong_route ON public_interfaces(kong_route_id) WHERE kong_route_id IS NOT NULL;
CREATE INDEX idx_public_interfaces_http_path ON public_interfaces(http_path);

-- Comments
COMMENT ON TABLE public_interfaces IS 'Public interfaces expose service interfaces via Kong API gateway';
COMMENT ON COLUMN public_interfaces.kong_route_id IS 'Kong route identifier for managing the API route';
COMMENT ON COLUMN public_interfaces.http_method IS 'HTTP method: GET, POST, PATCH, DELETE, etc.';
COMMENT ON COLUMN public_interfaces.http_path IS 'API path pattern (e.g., /api/v1/services/{service_id}/actions/{interface_name})';
COMMENT ON COLUMN public_interfaces.auth_type IS 'Authentication type: api_key, oauth2, jwt, or none';
COMMENT ON COLUMN public_interfaces.auth_config IS 'Authentication configuration (API key settings, OAuth config, etc.)';
COMMENT ON COLUMN public_interfaces.rate_limit_per_minute IS 'Rate limit in requests per minute';

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_public_interfaces_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_public_interfaces_updated_at
  BEFORE UPDATE ON public_interfaces
  FOR EACH ROW
  EXECUTE FUNCTION update_public_interfaces_updated_at();

-- Enable RLS
ALTER TABLE public_interfaces ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only see public interfaces for their services)
CREATE POLICY public_interfaces_select_policy ON public_interfaces
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM service_interfaces
      JOIN workflows ON workflows.id = service_interfaces.service_id
      WHERE service_interfaces.id = public_interfaces.service_interface_id
      AND workflows.created_by = auth.uid()
    )
  );

CREATE POLICY public_interfaces_insert_policy ON public_interfaces
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM service_interfaces
      JOIN workflows ON workflows.id = service_interfaces.service_id
      WHERE service_interfaces.id = public_interfaces.service_interface_id
      AND workflows.created_by = auth.uid()
    )
  );

CREATE POLICY public_interfaces_update_policy ON public_interfaces
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM service_interfaces
      JOIN workflows ON workflows.id = service_interfaces.service_id
      WHERE service_interfaces.id = public_interfaces.service_interface_id
      AND workflows.created_by = auth.uid()
    )
  );

CREATE POLICY public_interfaces_delete_policy ON public_interfaces
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM service_interfaces
      JOIN workflows ON workflows.id = service_interfaces.service_id
      WHERE service_interfaces.id = public_interfaces.service_interface_id
      AND workflows.created_by = auth.uid()
    )
  );

