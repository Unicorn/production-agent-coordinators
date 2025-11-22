-- ============================================================================
-- Migration: Add encryption fields to project_connections table
-- Created: 2025-01-20
-- Description: Adds encrypted_credentials and encryption_key_id columns
-- ============================================================================

-- Add encryption fields to project_connections table
ALTER TABLE project_connections 
  ADD COLUMN IF NOT EXISTS encrypted_credentials BYTEA,
  ADD COLUMN IF NOT EXISTS encryption_key_id VARCHAR(255);

-- Create index for encryption key lookups
CREATE INDEX IF NOT EXISTS idx_project_connections_encryption_key 
  ON project_connections(encryption_key_id) 
  WHERE encryption_key_id IS NOT NULL;

-- Note: Existing connection_url values will remain unencrypted
-- Migration script should be run to encrypt existing data if needed

