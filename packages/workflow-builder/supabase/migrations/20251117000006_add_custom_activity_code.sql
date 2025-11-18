-- Add support for custom activity code
-- Users can write their own TypeScript activity implementations

BEGIN;

-- Add columns for custom activity code
ALTER TABLE public.components
  ADD COLUMN IF NOT EXISTS implementation_language VARCHAR(50),
  ADD COLUMN IF NOT EXISTS implementation_code TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Index for active components
CREATE INDEX IF NOT EXISTS idx_components_is_active 
  ON public.components(is_active) WHERE is_active = true;

-- Add helpful comment
COMMENT ON COLUMN public.components.implementation_language IS 'Programming language for custom activity implementation (e.g., typescript)';
COMMENT ON COLUMN public.components.implementation_code IS 'Custom activity code that users can write for custom activities';
COMMENT ON COLUMN public.components.is_active IS 'Whether this component is active and available for use';

COMMIT;

