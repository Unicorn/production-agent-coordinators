-- ============================================================================
-- Prevent kebab_name updates on workflows
-- Created: 2025-11-17
-- Description: Add trigger to prevent any updates to kebab_name after creation
-- ============================================================================

-- Create function to prevent kebab_name updates
CREATE OR REPLACE FUNCTION prevent_kebab_name_update()
RETURNS TRIGGER AS $$
BEGIN
  -- If kebab_name is being changed, raise an exception
  IF NEW.kebab_name IS DISTINCT FROM OLD.kebab_name THEN
    RAISE EXCEPTION 'kebab_name cannot be modified after workflow creation';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on workflows table
CREATE TRIGGER prevent_kebab_name_update_trigger
  BEFORE UPDATE ON workflows
  FOR EACH ROW
  EXECUTE FUNCTION prevent_kebab_name_update();

-- Add comment
COMMENT ON FUNCTION prevent_kebab_name_update() IS 'Prevents updates to kebab_name column in workflows table';
COMMENT ON TRIGGER prevent_kebab_name_update_trigger ON workflows IS 'Ensures kebab_name cannot be modified after creation';

