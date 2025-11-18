-- ============================================================================
-- Migration: Create workflow_endpoints table for Kong API Gateway integration
-- Created: 2025-11-18
-- Description: Stores API endpoint configurations with hash-based routing
-- ============================================================================

CREATE TABLE IF NOT EXISTS workflow_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Endpoint configuration
  endpoint_path VARCHAR(255) NOT NULL, -- e.g., "/orders" (relative path)
  method VARCHAR(10) NOT NULL CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH')),
  description TEXT,
  
  -- Hash-based routing
  route_hash VARCHAR(17) NOT NULL UNIQUE, -- e.g., "a3f2b1c4-d5e6f7g8"
  full_path VARCHAR(500) NOT NULL, -- e.g., "/api/v1/a3f2b1c4-d5e6f7g8/orders"
  
  -- Workflow mapping
  target_type VARCHAR(50) NOT NULL CHECK (target_type IN ('signal', 'query', 'start')),
  target_name VARCHAR(255) NOT NULL, -- Signal/query name or 'start'
  
  -- Kong configuration
  kong_route_id VARCHAR(255), -- Kong route ID
  kong_service_id VARCHAR(255), -- Kong service ID
  kong_route_name VARCHAR(255), -- Kong route name
  
  -- Authentication
  auth_type VARCHAR(50) DEFAULT 'api-key' CHECK (auth_type IN ('api-key', 'jwt', 'none')),
  auth_config JSONB DEFAULT '{}'::jsonb,
  
  -- Rate limiting
  rate_limit_per_minute INTEGER DEFAULT 60,
  rate_limit_per_hour INTEGER DEFAULT 1000,
  
  -- Request/response transformation
  request_schema JSONB, -- JSON schema for request validation
  response_schema JSONB, -- JSON schema for response
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(workflow_id, endpoint_path, method)
);

-- Indexes for performance
CREATE INDEX idx_workflow_endpoints_workflow ON workflow_endpoints(workflow_id);
CREATE INDEX idx_workflow_endpoints_hash ON workflow_endpoints(route_hash);
CREATE INDEX idx_workflow_endpoints_kong_route ON workflow_endpoints(kong_route_id);
CREATE INDEX idx_workflow_endpoints_user_project ON workflow_endpoints(user_id, project_id);
CREATE INDEX idx_workflow_endpoints_active ON workflow_endpoints(is_active) WHERE is_active = true;

-- RLS Policies
ALTER TABLE workflow_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own endpoints"
  ON workflow_endpoints FOR SELECT
  USING (auth.uid() IN (
    SELECT auth_user_id FROM users WHERE id = user_id
  ));

CREATE POLICY "Users can create their own endpoints"
  ON workflow_endpoints FOR INSERT
  WITH CHECK (auth.uid() IN (
    SELECT auth_user_id FROM users WHERE id = user_id
  ));

CREATE POLICY "Users can update their own endpoints"
  ON workflow_endpoints FOR UPDATE
  USING (auth.uid() IN (
    SELECT auth_user_id FROM users WHERE id = user_id
  ));

CREATE POLICY "Users can delete their own endpoints"
  ON workflow_endpoints FOR DELETE
  USING (auth.uid() IN (
    SELECT auth_user_id FROM users WHERE id = user_id
  ));

-- Add comment
COMMENT ON TABLE workflow_endpoints IS 'API endpoints for workflows, registered with Kong API Gateway. Uses hash-based routing for unique URLs per user/project/workflow.';

