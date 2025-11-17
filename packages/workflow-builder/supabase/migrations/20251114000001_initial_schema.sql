-- ============================================================================
-- INITIAL SCHEMA: Workflow Builder System
-- Created: 2025-11-14
-- Description: Complete database schema for workflow builder system
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USER MANAGEMENT (Supabase Auth Integration)
-- ============================================================================

-- User roles (replaces enum)
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default roles
INSERT INTO user_roles (name, description, permissions) VALUES
  ('admin', 'Full system access', '{"workflows": ["create", "read", "update", "delete"], "components": ["create", "read", "update", "delete"], "agents": ["create", "read", "update", "delete"]}'),
  ('developer', 'Create and manage workflows', '{"workflows": ["create", "read", "update"], "components": ["read"], "agents": ["create", "read"]}'),
  ('viewer', 'View-only access', '{"workflows": ["read"], "components": ["read"], "agents": ["read"]}');

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(100),
  role_id UUID NOT NULL REFERENCES user_roles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE INDEX idx_users_auth_user_id ON users(auth_user_id);
CREATE INDEX idx_users_role_id ON users(role_id);

-- ============================================================================
-- COMPONENT REGISTRY
-- ============================================================================

-- Component types (replaces enum)
CREATE TABLE component_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO component_types (name, description, icon) VALUES
  ('activity', 'Temporal activity that performs work', 'activity'),
  ('agent', 'AI agent that makes decisions', 'brain'),
  ('signal', 'Signal handler for workflow communication', 'signal'),
  ('trigger', 'Workflow trigger/start condition', 'play');

-- Component visibility (replaces enum)
CREATE TABLE component_visibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT
);

INSERT INTO component_visibility (name, description) VALUES
  ('public', 'Available to all users'),
  ('private', 'Only available to creator'),
  ('organization', 'Available to organization members');

-- Main components table
CREATE TABLE components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  component_type_id UUID NOT NULL REFERENCES component_types(id),
  version VARCHAR(50) NOT NULL,
  
  -- Ownership
  created_by UUID NOT NULL REFERENCES users(id),
  visibility_id UUID NOT NULL REFERENCES component_visibility(id),
  
  -- Configuration
  config_schema JSONB,
  input_schema JSONB,
  output_schema JSONB,
  
  -- Metadata
  tags TEXT[],
  capabilities TEXT[],
  
  -- Agent-specific (only for agent components)
  agent_prompt_id UUID,
  model_provider VARCHAR(50),
  model_name VARCHAR(100),
  
  -- Implementation reference
  implementation_path VARCHAR(500),
  npm_package VARCHAR(255),
  
  -- Lifecycle
  deprecated BOOLEAN NOT NULL DEFAULT FALSE,
  deprecated_message TEXT,
  deprecated_since TIMESTAMPTZ,
  migrate_to_component_id UUID REFERENCES components(id),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(name, version, created_by)
);

CREATE INDEX idx_components_type ON components(component_type_id);
CREATE INDEX idx_components_created_by ON components(created_by);
CREATE INDEX idx_components_visibility ON components(visibility_id);
CREATE INDEX idx_components_tags ON components USING GIN(tags);
CREATE INDEX idx_components_capabilities ON components USING GIN(capabilities);
CREATE INDEX idx_components_name_version ON components(name, version);

-- ============================================================================
-- AGENT PROMPTS
-- ============================================================================

CREATE TABLE agent_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  version VARCHAR(50) NOT NULL,
  
  -- Content
  prompt_content TEXT NOT NULL,
  prompt_variables JSONB,
  
  -- Ownership
  created_by UUID NOT NULL REFERENCES users(id),
  visibility_id UUID NOT NULL REFERENCES component_visibility(id),
  
  -- Metadata
  capabilities TEXT[],
  tags TEXT[],
  recommended_models JSONB,
  
  -- Lifecycle
  deprecated BOOLEAN NOT NULL DEFAULT FALSE,
  deprecated_message TEXT,
  migrate_to_prompt_id UUID REFERENCES agent_prompts(id),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(name, version, created_by)
);

CREATE INDEX idx_agent_prompts_created_by ON agent_prompts(created_by);
CREATE INDEX idx_agent_prompts_visibility ON agent_prompts(visibility_id);
CREATE INDEX idx_agent_prompts_capabilities ON agent_prompts USING GIN(capabilities);

-- Add FK constraint after agent_prompts is created
ALTER TABLE components ADD CONSTRAINT fk_components_agent_prompt 
  FOREIGN KEY (agent_prompt_id) REFERENCES agent_prompts(id);

-- ============================================================================
-- TASK QUEUES
-- ============================================================================

CREATE TABLE task_queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  
  -- Configuration
  max_concurrent_workflows INTEGER DEFAULT 100,
  max_concurrent_activities INTEGER DEFAULT 1000,
  
  -- Ownership
  created_by UUID NOT NULL REFERENCES users(id),
  is_system_queue BOOLEAN NOT NULL DEFAULT FALSE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_task_queues_created_by ON task_queues(created_by);

-- ============================================================================
-- WORKFLOWS
-- ============================================================================

-- Workflow status (replaces enum)
CREATE TABLE workflow_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  color VARCHAR(7)
);

INSERT INTO workflow_statuses (name, description, color) VALUES
  ('draft', 'Workflow is being designed', '#9E9E9E'),
  ('active', 'Workflow is deployed and running', '#4CAF50'),
  ('paused', 'Workflow is temporarily stopped', '#FF9800'),
  ('archived', 'Workflow is archived', '#607D8B');

-- Main workflows table
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Ownership
  created_by UUID NOT NULL REFERENCES users(id),
  visibility_id UUID NOT NULL REFERENCES component_visibility(id),
  
  -- Status
  status_id UUID NOT NULL REFERENCES workflow_statuses(id),
  
  -- Configuration
  task_queue_id UUID NOT NULL REFERENCES task_queues(id),
  version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
  
  -- Workflow Definition (JSON)
  definition JSONB NOT NULL,
  
  -- Compiled output (optional)
  compiled_typescript TEXT,
  
  -- Temporal metadata
  temporal_workflow_id VARCHAR(255),
  temporal_workflow_type VARCHAR(255),
  
  -- Execution settings
  max_concurrent_executions INTEGER DEFAULT 10,
  execution_timeout_seconds INTEGER DEFAULT 3600,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deployed_at TIMESTAMPTZ,
  
  UNIQUE(name, version, created_by)
);

CREATE INDEX idx_workflows_created_by ON workflows(created_by);
CREATE INDEX idx_workflows_status ON workflows(status_id);
CREATE INDEX idx_workflows_task_queue ON workflows(task_queue_id);
CREATE INDEX idx_workflows_temporal_id ON workflows(temporal_workflow_id);

-- Workflow nodes (denormalized for easier querying)
CREATE TABLE workflow_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  node_id VARCHAR(255) NOT NULL,
  node_type VARCHAR(50) NOT NULL,
  component_id UUID REFERENCES components(id),
  
  -- Node configuration
  config JSONB NOT NULL DEFAULT '{}',
  position JSONB NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(workflow_id, node_id)
);

CREATE INDEX idx_workflow_nodes_workflow_id ON workflow_nodes(workflow_id);
CREATE INDEX idx_workflow_nodes_component_id ON workflow_nodes(component_id);

-- Workflow edges (denormalized)
CREATE TABLE workflow_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  edge_id VARCHAR(255) NOT NULL,
  source_node_id VARCHAR(255) NOT NULL,
  target_node_id VARCHAR(255) NOT NULL,
  
  -- Edge configuration
  label VARCHAR(255),
  config JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(workflow_id, edge_id)
);

CREATE INDEX idx_workflow_edges_workflow_id ON workflow_edges(workflow_id);

-- ============================================================================
-- WORKFLOW EXECUTION TRACKING
-- ============================================================================

CREATE TABLE workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id),
  temporal_run_id VARCHAR(255) UNIQUE NOT NULL,
  temporal_workflow_id VARCHAR(255) NOT NULL,
  
  -- Execution info
  status VARCHAR(50) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Results
  input JSONB,
  output JSONB,
  error_message TEXT,
  
  -- Metrics
  duration_ms INTEGER,
  activities_executed INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX idx_workflow_executions_temporal_run_id ON workflow_executions(temporal_run_id);
CREATE INDEX idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX idx_workflow_executions_started_at ON workflow_executions(started_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE components ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;

-- Users can read their own data
CREATE POLICY users_read_own ON users
  FOR SELECT
  USING (auth.uid() = auth_user_id);

-- Users can update their own data
CREATE POLICY users_update_own ON users
  FOR UPDATE
  USING (auth.uid() = auth_user_id);

-- Users can read public components or their own
CREATE POLICY components_read ON components
  FOR SELECT
  USING (
    visibility_id IN (SELECT id FROM component_visibility WHERE name = 'public')
    OR created_by IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

-- Users can create components
CREATE POLICY components_create ON components
  FOR INSERT
  WITH CHECK (created_by IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- Users can update their own components
CREATE POLICY components_update ON components
  FOR UPDATE
  USING (created_by IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- Users can delete their own components
CREATE POLICY components_delete ON components
  FOR DELETE
  USING (created_by IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- Similar policies for agent_prompts
CREATE POLICY agent_prompts_read ON agent_prompts
  FOR SELECT
  USING (
    visibility_id IN (SELECT id FROM component_visibility WHERE name = 'public')
    OR created_by IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

CREATE POLICY agent_prompts_create ON agent_prompts
  FOR INSERT
  WITH CHECK (created_by IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY agent_prompts_update ON agent_prompts
  FOR UPDATE
  USING (created_by IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY agent_prompts_delete ON agent_prompts
  FOR DELETE
  USING (created_by IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- Task queues: read all, create/update/delete own
CREATE POLICY task_queues_read ON task_queues
  FOR SELECT
  USING (TRUE);

CREATE POLICY task_queues_create ON task_queues
  FOR INSERT
  WITH CHECK (created_by IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY task_queues_update ON task_queues
  FOR UPDATE
  USING (created_by IN (SELECT id FROM users WHERE auth_user_id = auth.uid()) AND NOT is_system_queue);

CREATE POLICY task_queues_delete ON task_queues
  FOR DELETE
  USING (created_by IN (SELECT id FROM users WHERE auth_user_id = auth.uid()) AND NOT is_system_queue);

-- Workflows: read public or own, create/update/delete own
CREATE POLICY workflows_read ON workflows
  FOR SELECT
  USING (
    visibility_id IN (SELECT id FROM component_visibility WHERE name = 'public')
    OR created_by IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

CREATE POLICY workflows_create ON workflows
  FOR INSERT
  WITH CHECK (created_by IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY workflows_update ON workflows
  FOR UPDATE
  USING (created_by IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY workflows_delete ON workflows
  FOR DELETE
  USING (created_by IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- Workflow nodes: inherit from parent workflow
CREATE POLICY workflow_nodes_read ON workflow_nodes
  FOR SELECT
  USING (
    workflow_id IN (
      SELECT id FROM workflows
      WHERE visibility_id IN (SELECT id FROM component_visibility WHERE name = 'public')
        OR created_by IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
  );

CREATE POLICY workflow_nodes_manage ON workflow_nodes
  FOR ALL
  USING (
    workflow_id IN (
      SELECT id FROM workflows
      WHERE created_by IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
  );

-- Workflow edges: inherit from parent workflow
CREATE POLICY workflow_edges_read ON workflow_edges
  FOR SELECT
  USING (
    workflow_id IN (
      SELECT id FROM workflows
      WHERE visibility_id IN (SELECT id FROM component_visibility WHERE name = 'public')
        OR created_by IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
  );

CREATE POLICY workflow_edges_manage ON workflow_edges
  FOR ALL
  USING (
    workflow_id IN (
      SELECT id FROM workflows
      WHERE created_by IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
  );

-- Workflow executions: read own workflows
CREATE POLICY workflow_executions_read ON workflow_executions
  FOR SELECT
  USING (
    workflow_id IN (
      SELECT id FROM workflows
      WHERE created_by IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
  );

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to automatically create user record on auth signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_role_id UUID;
BEGIN
  -- Get default role (developer)
  SELECT id INTO default_role_id FROM user_roles WHERE name = 'developer' LIMIT 1;
  
  -- Insert into users table
  INSERT INTO users (auth_user_id, email, display_name, role_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    default_role_id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_components_updated_at BEFORE UPDATE ON components
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_prompts_updated_at BEFORE UPDATE ON agent_prompts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_task_queues_updated_at BEFORE UPDATE ON task_queues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

