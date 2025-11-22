-- ============================================================================
-- Rename display_name to channel_display_name in task_queues table
-- Created: 2025-01-20
-- Description: Rename display_name to channel_display_name for user-facing channel terminology
-- Part of: Services/Components/Connectors refactor - Phase 0
-- ============================================================================

-- Rename display_name column to channel_display_name
ALTER TABLE task_queues
RENAME COLUMN display_name TO channel_display_name;

-- Update comment
COMMENT ON COLUMN task_queues.channel_display_name IS 'User-facing channel name (replaces task queue terminology in UI)';

