-- ============================================================================
-- Add display_name to task_queues table
-- Created: 2025-11-17
-- ============================================================================

-- Add display_name column
ALTER TABLE task_queues
ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);

-- Set default display_name for existing queues (capitalize name)
UPDATE task_queues
SET display_name = INITCAP(REPLACE(name, '-', ' '))
WHERE display_name IS NULL;

-- Make display_name required going forward
ALTER TABLE task_queues
ALTER COLUMN display_name SET NOT NULL;

-- Add comment
COMMENT ON COLUMN task_queues.display_name IS 'Human-friendly display name for the task queue';

