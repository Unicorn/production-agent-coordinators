-- ============================================================================
-- ADD DEPLOYMENT STATUS TRACKING
-- Created: 2025-11-19
-- Description: Add deployment_status field to workflows table for tracking
--              deployment lifecycle
-- ============================================================================

-- Add deployment_status column to workflows table
ALTER TABLE workflows
ADD COLUMN deployment_status VARCHAR(50) DEFAULT 'UNDEPLOYED';

-- Create index for deployment status queries
CREATE INDEX idx_workflows_deployment_status ON workflows(deployment_status);

-- Add comment
COMMENT ON COLUMN workflows.deployment_status IS 'Deployment status: UNDEPLOYED, DEPLOYING, DEPLOYED, DEPLOYMENT_FAILED, UNDEPLOYING';

-- Update existing workflows to have proper deployment status
-- If they have a deployed_at timestamp, mark as DEPLOYED
UPDATE workflows
SET deployment_status = 'DEPLOYED'
WHERE deployed_at IS NOT NULL;
