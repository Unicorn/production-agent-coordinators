-- ============================================================================
-- AGENT TESTING STATE: Tables for agent test sessions and builder sessions
-- Created: 2025-11-18
-- Description: Tables to track agent test workflow executions and AI-assisted builder sessions
-- ============================================================================

-- Agent test sessions: Track test workflow executions
CREATE TABLE agent_test_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_prompt_id UUID NOT NULL REFERENCES agent_prompts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  temporal_workflow_id VARCHAR(255) NOT NULL,
  temporal_run_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'timeout')),
  conversation_history JSONB DEFAULT '[]'::jsonb,
  message_count INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_test_sessions_agent_prompt_id ON agent_test_sessions(agent_prompt_id);
CREATE INDEX idx_agent_test_sessions_user_id ON agent_test_sessions(user_id);
CREATE INDEX idx_agent_test_sessions_temporal_workflow_id ON agent_test_sessions(temporal_workflow_id);
CREATE INDEX idx_agent_test_sessions_status ON agent_test_sessions(status);
CREATE INDEX idx_agent_test_sessions_active ON agent_test_sessions(user_id, agent_prompt_id, status) WHERE status = 'active';

-- Agent builder sessions: Track AI-assisted builder sessions (for analytics)
CREATE TABLE agent_builder_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_messages JSONB DEFAULT '[]'::jsonb,
  resulting_prompt_id UUID REFERENCES agent_prompts(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  message_count INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_builder_sessions_user_id ON agent_builder_sessions(user_id);
CREATE INDEX idx_agent_builder_sessions_status ON agent_builder_sessions(status);
CREATE INDEX idx_agent_builder_sessions_resulting_prompt_id ON agent_builder_sessions(resulting_prompt_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_agent_test_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_agent_test_sessions_updated_at
  BEFORE UPDATE ON agent_test_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_test_sessions_updated_at();

CREATE OR REPLACE FUNCTION update_agent_builder_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_agent_builder_sessions_updated_at
  BEFORE UPDATE ON agent_builder_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_builder_sessions_updated_at();

