-- ============================================================================
-- Fix User Creation Trigger
-- Created: 2025-11-14
-- Description: Fix the handle_new_user trigger to properly handle user creation
-- ============================================================================

-- Drop existing trigger and function to recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Recreate function with better error handling
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
DECLARE
  default_role_id UUID;
BEGIN
  -- Get default role (developer)
  SELECT id INTO default_role_id 
  FROM public.user_roles 
  WHERE name = 'developer' 
  LIMIT 1;
  
  -- If no role found, raise error
  IF default_role_id IS NULL THEN
    RAISE EXCEPTION 'Default role "developer" not found';
  END IF;
  
  -- Insert into users table
  INSERT INTO public.users (
    auth_user_id, 
    email, 
    display_name, 
    role_id
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      split_part(NEW.email, '@', 1)
    ),
    default_role_id
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the signup
    RAISE WARNING 'Failed to create user record: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;

