-- ============================================================================
-- Add MCP Server Component
-- Created: 2025-12-05
-- Description: Add mcp-server component type for MCP (Model Context Protocol) server configuration
-- Part of: Kong API Components and Enhanced State Management - Phase 7
-- ============================================================================

BEGIN;

-- Add mcp-server component type
INSERT INTO component_types (name, description, icon) VALUES
  ('mcp-server', 'MCP (Model Context Protocol) server for exposing workflows as MCP resources and tools', 'server')
ON CONFLICT (name) DO NOTHING;

-- Add MCP config field to service_interfaces if it doesn't exist
ALTER TABLE service_interfaces 
  ADD COLUMN IF NOT EXISTS mcp_config JSONB;

-- Index for MCP config queries
CREATE INDEX IF NOT EXISTS idx_service_interfaces_mcp_config 
  ON service_interfaces USING GIN(mcp_config) 
  WHERE mcp_config IS NOT NULL;

-- Comments
COMMENT ON COLUMN service_interfaces.mcp_config IS 'MCP server configuration (resources, tools, server name, version)';

COMMIT;

