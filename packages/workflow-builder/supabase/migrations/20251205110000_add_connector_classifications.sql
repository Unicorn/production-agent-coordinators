-- ============================================================================
-- Add Connector Classifications System
-- Created: 2025-12-05
-- Description: Add connector classification system to allow components to query
--              connectors by type/classification (e.g., "redis", "http-log")
-- Part of: Kong API Components and Enhanced State Management - Phase 1
-- ============================================================================

BEGIN;

-- Create connector_classifications table
CREATE TABLE IF NOT EXISTS connector_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id UUID NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
  classification TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(connector_id, classification)
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_connector_classifications_classification 
  ON connector_classifications(classification);
CREATE INDEX IF NOT EXISTS idx_connector_classifications_connector 
  ON connector_classifications(connector_id);

-- Add classifications column to connectors table (denormalized for performance)
ALTER TABLE connectors 
  ADD COLUMN IF NOT EXISTS classifications JSONB DEFAULT '[]'::jsonb;

-- Comments
COMMENT ON TABLE connector_classifications IS 'Classifications for connectors (e.g., redis, http-log, syslog) to enable component queries by type';
COMMENT ON COLUMN connector_classifications.classification IS 'Classification type: redis, http-log, syslog, file-log, tcp-log, udp-log';
COMMENT ON COLUMN connectors.classifications IS 'Denormalized JSONB array of classifications for fast queries';

-- Insert classifications for existing Upstash/Redis connectors
INSERT INTO connector_classifications (connector_id, classification)
SELECT id, 'redis'
FROM connectors
WHERE name ILIKE '%upstash%' 
   OR name ILIKE '%redis%'
   OR connector_type = 'redis'
ON CONFLICT (connector_id, classification) DO NOTHING;

-- Update classifications JSONB column to match existing classifications
UPDATE connectors
SET classifications = (
  SELECT COALESCE(jsonb_agg(classification ORDER BY classification), '[]'::jsonb)
  FROM connector_classifications
  WHERE connector_classifications.connector_id = connectors.id
)
WHERE EXISTS (
  SELECT 1 FROM connector_classifications 
  WHERE connector_classifications.connector_id = connectors.id
);

-- Function to sync classifications JSONB column when classifications are added/removed
CREATE OR REPLACE FUNCTION sync_connector_classifications()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE connectors
  SET classifications = (
    SELECT COALESCE(jsonb_agg(classification ORDER BY classification), '[]'::jsonb)
    FROM connector_classifications
    WHERE connector_classifications.connector_id = connectors.id
  )
  WHERE id = COALESCE(NEW.connector_id, OLD.connector_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to keep classifications JSONB column in sync
CREATE TRIGGER trigger_sync_connector_classifications
  AFTER INSERT OR UPDATE OR DELETE ON connector_classifications
  FOR EACH ROW
  EXECUTE FUNCTION sync_connector_classifications();

-- Enable RLS on connector_classifications
ALTER TABLE connector_classifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only see classifications for connectors they have access to)
CREATE POLICY connector_classifications_select_policy ON connector_classifications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM connectors
      JOIN projects ON projects.id = connectors.project_id
      WHERE connectors.id = connector_classifications.connector_id
      AND projects.created_by = auth.uid()
    )
  );

CREATE POLICY connector_classifications_insert_policy ON connector_classifications
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM connectors
      JOIN projects ON projects.id = connectors.project_id
      WHERE connectors.id = connector_classifications.connector_id
      AND projects.created_by = auth.uid()
    )
  );

CREATE POLICY connector_classifications_update_policy ON connector_classifications
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM connectors
      JOIN projects ON projects.id = connectors.project_id
      WHERE connectors.id = connector_classifications.connector_id
      AND projects.created_by = auth.uid()
    )
  );

CREATE POLICY connector_classifications_delete_policy ON connector_classifications
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM connectors
      JOIN projects ON projects.id = connectors.project_id
      WHERE connectors.id = connector_classifications.connector_id
      AND projects.created_by = auth.uid()
    )
  );

COMMIT;

