-- ============================================================================
-- Migration: Create public_interfaces table
-- Created: 2025-01-20
-- Description: Stores public API interfaces exposed via Kong gateway
-- Part of: Services/Components/Connectors refactor - Phase 12-14
-- ============================================================================

CREATE TABLE IF NOT EXISTS public_interfaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_interface_id UUID NOT NULL REFERENCES service_interfaces(id) ON DELETE CASCADE,
  kong_route_id VARCHAR(255), -- Kong route identifier
  http_method VARCHAR(10) NOT NULL CHECK (http_method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS')),
  http_path VARCHAR(500) NOT NULL, -- API path (e.g., "/orders")
  auth_type VARCHAR(50) DEFAULT 'api_key' CHECK (auth_type IN ('api_key', 'oauth2', 'jwt', 'none')),
  auth_config JSONB DEFAULT '{}'::jsonb,
  rate_limit_per_minute INTEGER,
  rate_limit_per_hour INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(service_interface_id, http_method, http_path)
);

-- Indexes for performance
CREATE INDEX idx_public_interfaces_service_interface ON public_interfaces(service_interface_id);
CREATE INDEX idx_public_interfaces_kong_route ON public_interfaces(kong_route_id) WHERE kong_route_id IS NOT NULL;
CREATE INDEX idx_public_interfaces_method_path ON public_interfaces(http_method, http_path);

-- Comments
COMMENT ON TABLE public_interfaces IS 'Public interfaces expose service interfaces via Kong API gateway';
COMMENT ON COLUMN public_interfaces.kong_route_id IS 'Kong route identifier for managing the API route';
COMMENT ON COLUMN public_interfaces.http_method IS 'HTTP method: GET, POST, PATCH, DELETE, etc.';
COMMENT ON COLUMN public_interfaces.http_path IS 'API path pattern (e.g., /api/v1/services/{service_id}/actions/{interface_name})';
COMMENT ON COLUMN public_interfaces.auth_type IS 'Authentication type: api_key, oauth2, jwt, or none';
COMMENT ON COLUMN public_interfaces.auth_config IS 'Authentication configuration (API key settings, OAuth config, etc.)';
COMMENT ON COLUMN public_interfaces.rate_limit_per_minute IS 'Rate limit in requests per minute';

-- RLS Policies
ALTER TABLE public_interfaces ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view public interfaces for their own service interfaces
CREATE POLICY "Users can view own public interfaces"
  ON public_interfaces
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM service_interfaces
      JOIN workflows ON workflows.id = service_interfaces.workflow_id
      WHERE service_interfaces.id = public_interfaces.service_interface_id
      AND workflows.created_by = auth.uid()
    )
  );

-- Policy: Users can create public interfaces for their own service interfaces
CREATE POLICY "Users can create own public interfaces"
  ON public_interfaces
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM service_interfaces
      JOIN workflows ON workflows.id = service_interfaces.workflow_id
      WHERE service_interfaces.id = public_interfaces.service_interface_id
      AND workflows.created_by = auth.uid()
    )
  );

-- Policy: Users can update public interfaces for their own service interfaces
CREATE POLICY "Users can update own public interfaces"
  ON public_interfaces
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM service_interfaces
      JOIN workflows ON workflows.id = service_interfaces.workflow_id
      WHERE service_interfaces.id = public_interfaces.service_interface_id
      AND workflows.created_by = auth.uid()
    )
  );

-- Policy: Users can delete public interfaces for their own service interfaces
CREATE POLICY "Users can delete own public interfaces"
  ON public_interfaces
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM service_interfaces
      JOIN workflows ON workflows.id = service_interfaces.workflow_id
      WHERE service_interfaces.id = public_interfaces.service_interface_id
      AND workflows.created_by = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_public_interfaces_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_public_interfaces_updated_at
  BEFORE UPDATE ON public_interfaces
  FOR EACH ROW
  EXECUTE FUNCTION update_public_interfaces_updated_at();
