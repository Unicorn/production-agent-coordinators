-- ============================================================================
-- Add Kong CORS Component
-- Created: 2025-12-05
-- Description: Add kong-cors component type for CORS configuration
-- Part of: Kong API Components and Enhanced State Management - Phase 5
-- ============================================================================

BEGIN;

-- Add kong-cors component type
INSERT INTO component_types (name, description, icon) VALUES
  ('kong-cors', 'CORS (Cross-Origin Resource Sharing) configuration for API endpoints', 'globe')
ON CONFLICT (name) DO NOTHING;

-- Add CORS config field to public_interfaces if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'public_interfaces') THEN
    ALTER TABLE public_interfaces 
      ADD COLUMN IF NOT EXISTS cors_config JSONB;
  END IF;
END $$;

-- Index for CORS config queries (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'public_interfaces') THEN
    CREATE INDEX IF NOT EXISTS idx_public_interfaces_cors_config 
      ON public_interfaces USING GIN(cors_config) 
      WHERE cors_config IS NOT NULL;
  END IF;
END $$;

-- Comments (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'public_interfaces') THEN
    COMMENT ON COLUMN public_interfaces.cors_config IS 'CORS configuration (allowed origins, methods, headers, credentials, max-age)';
  END IF;
END $$;

COMMIT;

