-- ============================================================================
-- ACTIVITY REGISTRY: Activity Management and Discovery
-- Created: 2025-01-19
-- Description: Registry for tracking available activities, their signatures,
--              and usage metadata to enable workflow activity discovery
-- ============================================================================

-- Activities table - Registry of all available activities in the system
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core identification
  name VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,

  -- Type signatures (JSON Schema for validation)
  input_schema JSONB NOT NULL,          -- JSON Schema for input validation
  output_schema JSONB,                  -- JSON Schema for output validation

  -- Implementation details
  package_name VARCHAR(255) NOT NULL,   -- e.g., "workflow-worker-service"
  module_path VARCHAR(500) NOT NULL,    -- e.g., "./activities/sample.activities"
  function_name VARCHAR(255) NOT NULL,  -- e.g., "sampleActivity"

  -- Categorization and discovery
  category VARCHAR(100),                -- e.g., "HTTP", "Database", "File"
  tags TEXT[],                          -- Searchable tags
  examples JSONB,                       -- Usage examples

  -- Usage tracking for popularity ranking
  usage_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- Activity lifecycle
  is_active BOOLEAN NOT NULL DEFAULT true,
  deprecated BOOLEAN NOT NULL DEFAULT false,
  deprecated_message TEXT,
  deprecated_since TIMESTAMPTZ,
  migrate_to_activity_id UUID REFERENCES activities(id),

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id),

  CONSTRAINT valid_name CHECK (name ~ '^[a-zA-Z][a-zA-Z0-9_]*$'),
  CONSTRAINT valid_function_name CHECK (function_name ~ '^[a-zA-Z][a-zA-Z0-9_]*$')
);

-- Indexes for performance
CREATE INDEX idx_activities_name ON activities(name) WHERE is_active = true AND deprecated = false;
CREATE INDEX idx_activities_category ON activities(category) WHERE is_active = true;
CREATE INDEX idx_activities_package ON activities(package_name);
CREATE INDEX idx_activities_usage ON activities(usage_count DESC) WHERE is_active = true;
CREATE INDEX idx_activities_tags ON activities USING GIN(tags);
CREATE INDEX idx_activities_created_by ON activities(created_by);

-- Full-text search index on name and description
CREATE INDEX idx_activities_search ON activities USING GIN(
  to_tsvector('english', name || ' ' || COALESCE(description, ''))
) WHERE is_active = true;

-- Activity categories lookup table (for standardization)
CREATE TABLE activity_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO activity_categories (name, description, icon) VALUES
  ('HTTP', 'HTTP requests and API calls', 'globe'),
  ('Database', 'Database operations and queries', 'database'),
  ('File', 'File system operations', 'file'),
  ('Build', 'Build and deployment operations', 'package'),
  ('Sample', 'Sample and demonstration activities', 'code'),
  ('Agent', 'AI agent activities', 'brain'),
  ('Transform', 'Data transformation activities', 'shuffle'),
  ('Notification', 'Notification and messaging', 'bell');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_activities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_activities_updated_at
  BEFORE UPDATE ON activities
  FOR EACH ROW
  EXECUTE FUNCTION update_activities_updated_at();

-- Function to track activity deprecation
CREATE OR REPLACE FUNCTION track_activity_deprecation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deprecated = true AND OLD.deprecated = false THEN
    NEW.deprecated_since = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_track_activity_deprecation
  BEFORE UPDATE ON activities
  FOR EACH ROW
  WHEN (OLD.deprecated IS DISTINCT FROM NEW.deprecated)
  EXECUTE FUNCTION track_activity_deprecation();

COMMENT ON TABLE activities IS 'Registry of available activities that workflows can invoke';
COMMENT ON COLUMN activities.name IS 'Unique activity name used in workflow definitions';
COMMENT ON COLUMN activities.input_schema IS 'JSON Schema defining valid input parameters';
COMMENT ON COLUMN activities.output_schema IS 'JSON Schema defining expected output structure';
COMMENT ON COLUMN activities.package_name IS 'NPM package containing the activity implementation';
COMMENT ON COLUMN activities.module_path IS 'Module path within the package';
COMMENT ON COLUMN activities.function_name IS 'Function name to invoke';
COMMENT ON COLUMN activities.usage_count IS 'Number of times this activity has been used';
COMMENT ON COLUMN activities.examples IS 'JSON object with usage examples';
