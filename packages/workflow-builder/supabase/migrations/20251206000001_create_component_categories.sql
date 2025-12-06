-- ============================================================================
-- MIGRATION: Create Component Categories System
-- Created: 2025-01-XX
-- Description: Creates hierarchical category system for component organization
--              Supports both human and AI searchability
-- ============================================================================

BEGIN;

-- ============================================================================
-- COMPONENT CATEGORIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS component_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  icon_provider VARCHAR(50) DEFAULT 'lucide',
  color VARCHAR(50),
  parent_category_id UUID REFERENCES component_categories(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_component_categories_parent 
  ON component_categories(parent_category_id);
CREATE INDEX IF NOT EXISTS idx_component_categories_sort 
  ON component_categories(parent_category_id, sort_order);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_component_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_component_categories_updated_at
  BEFORE UPDATE ON component_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_component_categories_updated_at();

-- ============================================================================
-- COMPONENT CATEGORY MAPPING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS component_category_mapping (
  component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES component_categories(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  PRIMARY KEY (component_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_component_category_mapping_component 
  ON component_category_mapping(component_id);
CREATE INDEX IF NOT EXISTS idx_component_category_mapping_category 
  ON component_category_mapping(category_id);

-- ============================================================================
-- COMPONENT KEYWORDS TABLE (for AI searchability)
-- ============================================================================

CREATE TABLE IF NOT EXISTS component_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  keyword VARCHAR(100) NOT NULL,
  weight DECIMAL(3,2) DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(component_id, keyword)
);

CREATE INDEX IF NOT EXISTS idx_component_keywords_component 
  ON component_keywords(component_id);
CREATE INDEX IF NOT EXISTS idx_component_keywords_keyword 
  ON component_keywords(keyword);

-- ============================================================================
-- COMPONENT USE CASES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS component_use_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  use_case TEXT NOT NULL,
  example JSONB,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_component_use_cases_component 
  ON component_use_cases(component_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE component_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE component_category_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE component_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE component_use_cases ENABLE ROW LEVEL SECURITY;

-- Categories are public (read-only for all, write for system)
CREATE POLICY component_categories_select_policy ON component_categories
  FOR SELECT
  USING (true);

CREATE POLICY component_categories_insert_policy ON component_categories
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.email = 'system@example.com'
    )
  );

-- Mappings are readable by all, writable by component owners
CREATE POLICY component_category_mapping_select_policy ON component_category_mapping
  FOR SELECT
  USING (true);

CREATE POLICY component_category_mapping_insert_policy ON component_category_mapping
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM components
      WHERE components.id = component_category_mapping.component_id
      AND components.created_by = auth.uid()
    )
  );

-- Keywords are readable by all, writable by component owners
CREATE POLICY component_keywords_select_policy ON component_keywords
  FOR SELECT
  USING (true);

CREATE POLICY component_keywords_insert_policy ON component_keywords
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM components
      WHERE components.id = component_keywords.component_id
      AND components.created_by = auth.uid()
    )
  );

-- Use cases are readable by all, writable by component owners
CREATE POLICY component_use_cases_select_policy ON component_use_cases
  FOR SELECT
  USING (true);

CREATE POLICY component_use_cases_insert_policy ON component_use_cases
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM components
      WHERE components.id = component_use_cases.component_id
      AND components.created_by = auth.uid()
    )
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE component_categories IS 'Hierarchical categories for organizing components. Supports parent-child relationships for nested organization.';
COMMENT ON TABLE component_category_mapping IS 'Maps components to categories. A component can belong to multiple categories.';
COMMENT ON TABLE component_keywords IS 'Search keywords for components. Used for AI and human searchability. Weight indicates relevance (0.0-1.0).';
COMMENT ON TABLE component_use_cases IS 'Common use cases for components. Helps users understand when to use each component.';

COMMIT;

