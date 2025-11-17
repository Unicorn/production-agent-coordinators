-- ============================================================================
-- SEED DATA: Default Task Queue
-- Created: 2025-11-14
-- Description: Insert default task queue (requires at least one user)
-- ============================================================================

-- This will be executed after the first user signs up
-- For now, we'll create a function to ensure default queue exists

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
      INSERT INTO task_queues (name, description, created_by, is_system_queue)
      VALUES (
        'default-queue',
        'Default task queue for workflows',
        admin_user_id,
        TRUE
      );
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to ensure default queue after user creation
CREATE OR REPLACE FUNCTION ensure_default_queue_after_user()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM ensure_default_task_queue();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER ensure_default_queue_trigger
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION ensure_default_queue_after_user();

