-- PostgreSQL initialization script for agent-coordinator
-- This script runs automatically when the database is first created

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create schemas for different components
CREATE SCHEMA IF NOT EXISTS coordinator;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS agents;

-- Grant permissions
GRANT ALL PRIVILEGES ON SCHEMA coordinator TO coordinator;
GRANT ALL PRIVILEGES ON SCHEMA storage TO coordinator;
GRANT ALL PRIVILEGES ON SCHEMA agents TO coordinator;

-- Set default search path
ALTER DATABASE coordinator SET search_path TO coordinator, storage, agents, public;

-- Create basic tables (these can be expanded as needed)
CREATE TABLE IF NOT EXISTS coordinator.workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS storage.artifacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id VARCHAR(255) NOT NULL,
    artifact_type VARCHAR(100) NOT NULL,
    artifact_path TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS agents.executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id VARCHAR(255) NOT NULL,
    agent_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    result JSONB,
    error JSONB
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_workflows_status ON coordinator.workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflows_created_at ON coordinator.workflows(created_at);
CREATE INDEX IF NOT EXISTS idx_artifacts_workflow_id ON storage.artifacts(workflow_id);
CREATE INDEX IF NOT EXISTS idx_executions_workflow_id ON agents.executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_executions_status ON agents.executions(status);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at trigger to workflows table
CREATE TRIGGER update_workflows_updated_at
    BEFORE UPDATE ON coordinator.workflows
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
