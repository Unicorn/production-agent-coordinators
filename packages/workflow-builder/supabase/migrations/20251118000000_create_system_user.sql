-- ============================================================================
-- SYSTEM USER: Create system@example.com user for system workflows
-- Created: 2025-11-18
-- Description: Creates system user, role, project, and task queue for system workflows
-- ============================================================================

-- Create system role if it doesn't exist
INSERT INTO user_roles (name, description, permissions)
VALUES (
  'system',
  'System user for internal workflows',
  '{"workflows": ["create", "read", "update", "delete"], "components": ["create", "read", "update", "delete"], "agents": ["create", "read", "update", "delete"]}'
)
ON CONFLICT (name) DO NOTHING;

-- Note: We cannot create auth.users directly via SQL migration
-- The system user must be created via Supabase Auth API or manually
-- This migration creates the user record that will be linked to the auth user

-- Function to create system user record (call after creating auth user)
CREATE OR REPLACE FUNCTION create_system_user_record()
RETURNS UUID AS $$
DECLARE
  system_role_id UUID;
  system_user_id UUID;
  auth_user_id UUID;
BEGIN
  -- Get system role
  SELECT id INTO system_role_id FROM user_roles WHERE name = 'system';
  
  IF system_role_id IS NULL THEN
    RAISE EXCEPTION 'System role not found. Run migration 20251118000001 first.';
  END IF;
  
  -- Check if system user already exists
  SELECT id INTO system_user_id FROM users WHERE email = 'system@example.com';
  
  IF system_user_id IS NOT NULL THEN
    RETURN system_user_id;
  END IF;
  
  -- Try to find auth user (must be created via Supabase Auth first)
  -- Note: This requires admin access to auth.users table
  -- If auth user doesn't exist, we'll create a placeholder that can be updated later
  SELECT id INTO auth_user_id FROM auth.users WHERE email = 'system@example.com' LIMIT 1;
  
  IF auth_user_id IS NULL THEN
    -- Create a placeholder UUID - this will need to be updated when auth user is created
    -- The system user record will be created in the seed migration
    RAISE NOTICE 'Auth user for system@example.com not found. System user will be created in seed migration after auth user is set up.';
    RETURN NULL;
  END IF;
  
  -- Create user record
  INSERT INTO users (auth_user_id, email, display_name, role_id)
  VALUES (auth_user_id, 'system@example.com', 'System User', system_role_id)
  RETURNING id INTO system_user_id;
  
  RETURN system_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: System project, task queue, and workflows are created in migration 20251118000003

