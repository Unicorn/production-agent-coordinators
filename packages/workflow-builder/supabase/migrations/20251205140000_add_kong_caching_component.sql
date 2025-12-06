-- ============================================================================
-- Add Kong Caching Component
-- Created: 2025-12-05
-- Description: Add kong-cache component type and cache key management
-- Part of: Kong API Components and Enhanced State Management - Phase 4
-- ============================================================================

BEGIN;

-- Add kong-cache component type
INSERT INTO component_types (name, description, icon) VALUES
  ('kong-cache', 'Kong proxy caching configuration with Redis backend', 'database')
ON CONFLICT (name) DO NOTHING;

-- Cache key management table
-- Tracks cache keys for kong-cache components
CREATE TABLE IF NOT EXISTS kong_cache_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id UUID NOT NULL, -- References the kong-cache component node ID
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  cache_key VARCHAR(255) NOT NULL, -- The actual cache key (UUID format)
  connector_id UUID NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
  ttl_seconds INTEGER DEFAULT 3600, -- Time to live in seconds
  cache_key_strategy VARCHAR(50) DEFAULT 'path', -- 'path', 'query', 'header', 'custom'
  content_types TEXT[] DEFAULT ARRAY['application/json'], -- Content types to cache
  response_codes INTEGER[] DEFAULT ARRAY[200, 201, 202], -- HTTP response codes to cache
  config JSONB DEFAULT '{}'::jsonb, -- Additional cache configuration
  is_saved BOOLEAN DEFAULT false, -- Whether the component has been saved (key becomes immutable)
  marked_for_deletion BOOLEAN DEFAULT false, -- Whether component was removed (cleanup on deploy)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(component_id),
  UNIQUE(cache_key, project_id) -- Ensure unique cache keys per project
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_kong_cache_keys_project 
  ON kong_cache_keys(project_id);
CREATE INDEX IF NOT EXISTS idx_kong_cache_keys_component 
  ON kong_cache_keys(component_id);
CREATE INDEX IF NOT EXISTS idx_kong_cache_keys_cache_key 
  ON kong_cache_keys(cache_key);
CREATE INDEX IF NOT EXISTS idx_kong_cache_keys_marked_for_deletion 
  ON kong_cache_keys(marked_for_deletion) WHERE marked_for_deletion = true;

-- Comments
COMMENT ON TABLE kong_cache_keys IS 'Cache key management for Kong caching components. Keys are auto-generated, editable until saved, then immutable.';
COMMENT ON COLUMN kong_cache_keys.cache_key IS 'The cache key (UUID format). Auto-generated on component creation, editable until is_saved=true, then immutable.';
COMMENT ON COLUMN kong_cache_keys.is_saved IS 'When true, the cache_key becomes immutable. Set to true when component is saved for the first time.';
COMMENT ON COLUMN kong_cache_keys.marked_for_deletion IS 'When true, the cache key should be removed from the data store on the next deploy. Set when component is removed.';

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_kong_cache_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_kong_cache_keys_updated_at
  BEFORE UPDATE ON kong_cache_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_kong_cache_keys_updated_at();

-- Enable RLS
ALTER TABLE kong_cache_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies for kong_cache_keys
CREATE POLICY kong_cache_keys_select_policy ON kong_cache_keys
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = kong_cache_keys.project_id
      AND projects.created_by = auth.uid()
    )
  );

CREATE POLICY kong_cache_keys_insert_policy ON kong_cache_keys
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = kong_cache_keys.project_id
      AND projects.created_by = auth.uid()
    )
  );

CREATE POLICY kong_cache_keys_update_policy ON kong_cache_keys
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = kong_cache_keys.project_id
      AND projects.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = kong_cache_keys.project_id
      AND projects.created_by = auth.uid()
    )
  );

CREATE POLICY kong_cache_keys_delete_policy ON kong_cache_keys
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = kong_cache_keys.project_id
      AND projects.created_by = auth.uid()
    )
  );

COMMIT;

