-- ============================================================================
-- Migration: Add interface component types (data-in, data-out)
-- Created: 2025-12-03
-- Description: Adds data-in and data-out component types for interface components
-- ============================================================================

-- Add data-in component type
INSERT INTO component_types (name, description, icon) VALUES
  ('data-in', 'Interface component for receiving data via signals, creates POST/PATCH endpoints', 'download')
ON CONFLICT (name) DO NOTHING;

-- Add data-out component type
INSERT INTO component_types (name, description, icon) VALUES
  ('data-out', 'Interface component for providing data via queries, creates GET endpoints', 'upload')
ON CONFLICT (name) DO NOTHING;

-- Comments
COMMENT ON TABLE component_types IS 'Component types including interface components (data-in, data-out)';

