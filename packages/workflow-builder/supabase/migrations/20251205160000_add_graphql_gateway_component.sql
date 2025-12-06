-- ============================================================================
-- Add GraphQL Gateway Component
-- Created: 2025-12-05
-- Description: Add graphql-gateway component type for GraphQL endpoint configuration
-- Part of: Kong API Components and Enhanced State Management - Phase 6
-- ============================================================================

BEGIN;

-- Add graphql-gateway component type
INSERT INTO component_types (name, description, icon) VALUES
  ('graphql-gateway', 'GraphQL endpoint gateway with schema definition and resolver mapping', 'network')
ON CONFLICT (name) DO NOTHING;

-- Add GraphQL schema field to service_interfaces if it doesn't exist
ALTER TABLE service_interfaces 
  ADD COLUMN IF NOT EXISTS graphql_schema JSONB;

-- Index for GraphQL schema queries
CREATE INDEX IF NOT EXISTS idx_service_interfaces_graphql_schema 
  ON service_interfaces USING GIN(graphql_schema) 
  WHERE graphql_schema IS NOT NULL;

-- Comments
COMMENT ON COLUMN service_interfaces.graphql_schema IS 'GraphQL schema definition (SDL format stored as JSON)';

COMMIT;

