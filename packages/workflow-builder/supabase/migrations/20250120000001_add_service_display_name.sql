-- ============================================================================
-- Add service_display_name to workflows table
-- Created: 2025-01-20
-- Description: Add service_display_name column for user-facing service terminology
-- Part of: Services/Components/Connectors refactor - Phase 0
-- ============================================================================

-- Add service_display_name column
ALTER TABLE workflows
ADD COLUMN service_display_name VARCHAR(255);

-- Populate service_display_name from existing display_name or name
UPDATE workflows
SET service_display_name = COALESCE(display_name, name)
WHERE service_display_name IS NULL;

-- Make service_display_name required going forward
ALTER TABLE workflows
ALTER COLUMN service_display_name SET NOT NULL;

-- Add comment
COMMENT ON COLUMN workflows.service_display_name IS 'User-facing service name (replaces workflow terminology in UI)';

-- Add index for common queries
CREATE INDEX IF NOT EXISTS idx_workflows_service_display_name ON workflows(service_display_name);

