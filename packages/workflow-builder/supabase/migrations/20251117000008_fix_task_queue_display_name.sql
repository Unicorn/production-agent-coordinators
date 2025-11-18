-- ============================================================================
-- Fix ensure_default_task_queue function to include display_name
-- Created: 2025-11-17
-- ============================================================================

CREATE OR REPLACE FUNCTION ensure_default_task_queue()
RETURNS VOID AS $$
DECLARE
  admin_user_id UUID;
  queue_exists BOOLEAN;
BEGIN
  -- Check if default queue exists
  SELECT EXISTS(SELECT 1 FROM task_queues WHERE name = 'default-queue') INTO queue_exists;
  
  IF NOT queue_exists THEN
    -- Get first admin or developer user
    SELECT id INTO admin_user_id FROM users WHERE role_id IN (
      SELECT id FROM user_roles WHERE name IN ('admin', 'developer')
    ) LIMIT 1;
    
    -- If we have a user, create default queue
    IF admin_user_id IS NOT NULL THEN
      INSERT INTO task_queues (name, display_name, description, created_by, is_system_queue)
      VALUES (
        'default-queue',
        'Default Queue',
        'Default task queue for workflows',
        admin_user_id,
        TRUE
      );
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

