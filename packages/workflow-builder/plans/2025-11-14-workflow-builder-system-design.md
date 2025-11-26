# Workflow Builder System - Comprehensive Design

**Date:** 2025-11-14  
**Status:** Design - Ready for Implementation  
**Type:** POC → Production System

---

## Executive Summary

A visual workflow builder system that allows users to compose Temporal workflows from reusable components (activities, agents, signals) via drag-and-drop UI. Workflows are stored as JSON in Supabase, executed by dynamic workers, and integrated with the existing component registry standards.

**Key Goals:**
- Leverage existing `@bernierllc/workflow-ui` package for UI components
- Store all workflow definitions and components in Supabase (no enums, all tables with FKs)
- Support user authentication and permissions via Supabase Auth
- Enable dynamic task queue assignment and worker generation
- Allow users to create/share custom agent prompts and activities
- Build POC locally first, design for future SaaS deployment

**Tech Stack:**
- **Frontend:** Next.js 14 + Tamagui + `@bernierllc/workflow-ui`
- **Backend:** Next.js API Routes + tRPC
- **Database:** Supabase (PostgreSQL + Auth + Realtime)
- **Workflow Engine:** Temporal (existing coordinator patterns)
- **Language:** TypeScript (strict mode)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Schema](#database-schema)
3. [Backend API Design](#backend-api-design)
4. [Frontend Architecture](#frontend-architecture)
5. [Integration with Existing System](#integration-with-existing-system)
6. [Worker Generation Strategy](#worker-generation-strategy)
7. [AGENTINFO.md Specification](#agentinfo-specification)
8. [POC Implementation Phases](#poc-implementation-phases)
9. [Future Enhancements](#future-enhancements)

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                      User Browser (Next.js)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Workflow    │  │  Component   │  │  Agent/      │          │
│  │  Canvas      │  │  Palette     │  │  Activity    │          │
│  │  (drag-drop) │  │  (sidebar)   │  │  Editor      │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└───────────────────────────┬─────────────────────────────────────┘
                            │ tRPC
┌───────────────────────────▼─────────────────────────────────────┐
│                   Next.js API (Backend)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Workflow    │  │  Component   │  │  Worker      │          │
│  │  Management  │  │  Registry    │  │  Generator   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└───────────┬──────────────────┬──────────────────┬───────────────┘
            │                  │                  │
            ▼                  ▼                  ▼
┌───────────────────┐  ┌────────────────┐  ┌──────────────────┐
│   Supabase DB     │  │  Temporal      │  │  Local Workers   │
│   (PostgreSQL)    │  │  Server        │  │  (Dynamic Load)  │
│                   │  │                │  │                  │
│  - workflows      │  │  - Orchestrate │  │  - Load workflow │
│  - components     │  │  - Execute     │  │    definitions   │
│  - activities     │  │  - Monitor     │  │  - Register      │
│  - agents         │  │                │  │    activities    │
│  - task_queues    │  │                │  │  - Execute       │
│  - users (Auth)   │  │                │  │                  │
└───────────────────┘  └────────────────┘  └──────────────────┘
```

### Data Flow

1. **Design:** User drags components onto canvas (WorkflowBuilder from `@bernierllc/workflow-ui`)
2. **Save:** Workflow definition saved as JSON to Supabase
3. **Deploy:** System generates worker config, registers workflow with Temporal
4. **Execute:** Dynamic worker loads workflow definition, executes via Temporal
5. **Monitor:** User views execution in WorkflowDashboard (from `@bernierllc/workflow-ui`)

---

## Database Schema

All enums replaced with tables + foreign keys for dynamic extensibility.

### Core Tables

```sql
-- ============================================================================
-- USER MANAGEMENT (Supabase Auth Integration)
-- ============================================================================

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

-- User roles (replaces enum)
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL, -- 'admin', 'developer', 'viewer'
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '{}', -- { "workflows": ["create", "read", "update", "delete"], ... }
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default roles
INSERT INTO user_roles (name, description, permissions) VALUES
  ('admin', 'Full system access', '{"workflows": ["create", "read", "update", "delete"], "components": ["create", "read", "update", "delete"], "agents": ["create", "read", "update", "delete"]}'),
  ('developer', 'Create and manage workflows', '{"workflows": ["create", "read", "update"], "components": ["read"], "agents": ["create", "read"]}'),
  ('viewer', 'View-only access', '{"workflows": ["read"], "components": ["read"], "agents": ["read"]}');

-- ============================================================================
-- COMPONENT REGISTRY
-- ============================================================================

-- Component types (replaces enum)
CREATE TABLE component_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL, -- 'activity', 'agent', 'signal', 'trigger'
  description TEXT,
  icon VARCHAR(50), -- Icon name for UI
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
  name VARCHAR(50) UNIQUE NOT NULL, -- 'public', 'private', 'organization'
  description TEXT
);

INSERT INTO component_visibility (name, description) VALUES
  ('public', 'Available to all users'),
  ('private', 'Only available to creator'),
  ('organization', 'Available to organization members');

-- Main components table
CREATE TABLE components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL, -- 'runBuild', 'spawnFixAgent', 'analyzeProblem'
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  component_type_id UUID NOT NULL REFERENCES component_types(id),
  version VARCHAR(50) NOT NULL, -- Semver: '1.0.0'
  
  -- Ownership
  created_by UUID NOT NULL REFERENCES users(id),
  visibility_id UUID NOT NULL REFERENCES component_visibility(id),
  
  -- Configuration
  config_schema JSONB, -- JSON Schema for component configuration
  input_schema JSONB, -- JSON Schema for inputs
  output_schema JSONB, -- JSON Schema for outputs
  
  -- Metadata
  tags TEXT[], -- For searching/filtering
  capabilities TEXT[], -- ['fix-failing-tests', 'analyze-errors']
  
  -- Agent-specific (only for agent components)
  agent_prompt_id UUID REFERENCES agent_prompts(id),
  model_provider VARCHAR(50), -- 'anthropic', 'openai'
  model_name VARCHAR(100), -- 'claude-sonnet-4-5-20250929'
  
  -- Implementation reference
  implementation_path VARCHAR(500), -- Path to actual implementation
  npm_package VARCHAR(255), -- '@bernierllc/package-name' if published
  
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
  name VARCHAR(255) NOT NULL, -- 'fix-agent', 'test-writer-agent'
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  version VARCHAR(50) NOT NULL, -- Semver
  
  -- Content
  prompt_content TEXT NOT NULL, -- The actual agent prompt
  prompt_variables JSONB, -- Variables that can be interpolated
  
  -- Ownership
  created_by UUID NOT NULL REFERENCES users(id),
  visibility_id UUID NOT NULL REFERENCES component_visibility(id),
  
  -- Metadata
  capabilities TEXT[],
  tags TEXT[],
  recommended_models JSONB, -- [{"provider": "anthropic", "model": "claude-sonnet-4-5", "reason": "..."}]
  
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

-- ============================================================================
-- TASK QUEUES
-- ============================================================================

CREATE TABLE task_queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) UNIQUE NOT NULL, -- 'package-builder', 'agent-coordinator'
  description TEXT,
  
  -- Configuration
  max_concurrent_workflows INTEGER DEFAULT 100,
  max_concurrent_activities INTEGER DEFAULT 1000,
  
  -- Ownership
  created_by UUID NOT NULL REFERENCES users(id),
  is_system_queue BOOLEAN NOT NULL DEFAULT FALSE, -- System queues can't be deleted
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_task_queues_created_by ON task_queues(created_by);

-- Insert default system queues
INSERT INTO task_queues (name, description, created_by, is_system_queue)
SELECT 
  'default-queue',
  'Default task queue for workflows',
  (SELECT id FROM users WHERE role_id = (SELECT id FROM user_roles WHERE name = 'admin') LIMIT 1),
  TRUE;

-- ============================================================================
-- WORKFLOWS
-- ============================================================================

-- Workflow status (replaces enum)
CREATE TABLE workflow_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL, -- 'draft', 'active', 'paused', 'archived'
  description TEXT,
  color VARCHAR(7) -- Hex color for UI
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
  definition JSONB NOT NULL, -- React Flow format + metadata
  -- Example structure:
  -- {
  --   "nodes": [{"id": "1", "type": "activity", "data": {"componentId": "uuid"}, "position": {...}}],
  --   "edges": [{"source": "1", "target": "2"}],
  --   "metadata": {"timeout": "1h", "retryPolicy": {...}}
  -- }
  
  -- Compiled output (optional)
  compiled_typescript TEXT, -- Generated TS code for debugging
  
  -- Temporal metadata
  temporal_workflow_id VARCHAR(255), -- Actual ID in Temporal
  temporal_workflow_type VARCHAR(255), -- Workflow type name
  
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
  node_id VARCHAR(255) NOT NULL, -- ID from React Flow
  node_type VARCHAR(50) NOT NULL, -- 'activity', 'agent', 'decision', etc.
  component_id UUID REFERENCES components(id),
  
  -- Node configuration
  config JSONB NOT NULL DEFAULT '{}',
  position JSONB NOT NULL, -- {"x": 100, "y": 200}
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(workflow_id, node_id)
);

CREATE INDEX idx_workflow_nodes_workflow_id ON workflow_nodes(workflow_id);
CREATE INDEX idx_workflow_nodes_component_id ON workflow_nodes(component_id);

-- Workflow edges (denormalized)
CREATE TABLE workflow_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  edge_id VARCHAR(255) NOT NULL, -- ID from React Flow
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
-- WORKFLOW EXECUTION TRACKING (Optional for POC, needed for monitoring)
-- ============================================================================

CREATE TABLE workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id),
  temporal_run_id VARCHAR(255) UNIQUE NOT NULL,
  temporal_workflow_id VARCHAR(255) NOT NULL,
  
  -- Execution info
  status VARCHAR(50) NOT NULL, -- 'running', 'completed', 'failed', 'cancelled'
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

-- Example RLS policies (simplified for POC)
-- Users can read their own data
CREATE POLICY users_read_own ON users
  FOR SELECT
  USING (auth.uid() = auth_user_id);

-- Users can read public components or their own
CREATE POLICY components_read ON components
  FOR SELECT
  USING (
    visibility_id = (SELECT id FROM component_visibility WHERE name = 'public')
    OR created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

-- Users can create components
CREATE POLICY components_create ON components
  FOR INSERT
  WITH CHECK (created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- Similar policies for agent_prompts, workflows, etc.
```

---

## Backend API Design

### tRPC API Structure

```typescript
// File: packages/workflow-builder/src/server/api/root.ts

import { createTRPCRouter } from './trpc';
import { componentsRouter } from './routers/components';
import { workflowsRouter } from './routers/workflows';
import { agentPromptsRouter } from './routers/agent-prompts';
import { taskQueuesRouter } from './routers/task-queues';
import { usersRouter } from './routers/users';

export const appRouter = createTRPCRouter({
  components: componentsRouter,
  workflows: workflowsRouter,
  agentPrompts: agentPromptsRouter,
  taskQueues: taskQueuesRouter,
  users: usersRouter,
});

export type AppRouter = typeof appRouter;
```

### Component Router

```typescript
// File: packages/workflow-builder/src/server/api/routers/components.ts

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

export const componentsRouter = createTRPCRouter({
  // List all accessible components
  list: publicProcedure
    .input(z.object({
      type: z.string().optional(), // Filter by component type
      capability: z.string().optional(), // Filter by capability
      tags: z.array(z.string()).optional(),
      includeDeprecated: z.boolean().default(false),
      page: z.number().default(1),
      pageSize: z.number().default(50),
    }))
    .query(async ({ ctx, input }) => {
      const { supabase } = ctx;
      
      let query = supabase
        .from('components')
        .select(`
          *,
          component_type:component_types(name, icon),
          created_by_user:users(display_name),
          visibility:component_visibility(name)
        `);
      
      // Apply filters
      if (input.type) {
        query = query.eq('component_types.name', input.type);
      }
      
      if (input.capability) {
        query = query.contains('capabilities', [input.capability]);
      }
      
      if (input.tags && input.tags.length > 0) {
        query = query.overlaps('tags', input.tags);
      }
      
      if (!input.includeDeprecated) {
        query = query.eq('deprecated', false);
      }
      
      // Pagination
      const from = (input.page - 1) * input.pageSize;
      const to = from + input.pageSize - 1;
      
      const { data, error, count } = await query
        .range(from, to)
        .order('created_at', { ascending: false });
      
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      
      return {
        components: data,
        total: count,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil((count || 0) / input.pageSize),
      };
    }),

  // Get single component by ID
  get: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('components')
        .select(`
          *,
          component_type:component_types(name, icon),
          created_by_user:users(display_name),
          visibility:component_visibility(name),
          agent_prompt:agent_prompts(*)
        `)
        .eq('id', input.id)
        .single();
      
      if (error) throw new TRPCError({ code: 'NOT_FOUND', message: 'Component not found' });
      return data;
    }),

  // Create new component
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      displayName: z.string().min(1),
      description: z.string().optional(),
      componentType: z.string(), // 'activity', 'agent', 'signal', 'trigger'
      version: z.string().regex(/^\d+\.\d+\.\d+$/), // Semver
      visibility: z.enum(['public', 'private', 'organization']),
      configSchema: z.any().optional(),
      inputSchema: z.any().optional(),
      outputSchema: z.any().optional(),
      tags: z.array(z.string()).optional(),
      capabilities: z.array(z.string()).optional(),
      // Agent-specific
      agentPromptId: z.string().uuid().optional(),
      modelProvider: z.string().optional(),
      modelName: z.string().optional(),
      // Implementation
      implementationPath: z.string().optional(),
      npmPackage: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx;
      
      // Get type ID
      const { data: componentType } = await supabase
        .from('component_types')
        .select('id')
        .eq('name', input.componentType)
        .single();
      
      if (!componentType) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid component type' });
      }
      
      // Get visibility ID
      const { data: visibility } = await supabase
        .from('component_visibility')
        .select('id')
        .eq('name', input.visibility)
        .single();
      
      if (!visibility) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid visibility' });
      }
      
      // Create component
      const { data, error } = await supabase
        .from('components')
        .insert({
          name: input.name,
          display_name: input.displayName,
          description: input.description,
          component_type_id: componentType.id,
          version: input.version,
          created_by: user.id,
          visibility_id: visibility.id,
          config_schema: input.configSchema,
          input_schema: input.inputSchema,
          output_schema: input.outputSchema,
          tags: input.tags,
          capabilities: input.capabilities,
          agent_prompt_id: input.agentPromptId,
          model_provider: input.modelProvider,
          model_name: input.modelName,
          implementation_path: input.implementationPath,
          npm_package: input.npmPackage,
        })
        .select()
        .single();
      
      if (error) {
        throw new TRPCError({ 
          code: 'INTERNAL_SERVER_ERROR', 
          message: error.message 
        });
      }
      
      return data;
    }),

  // Update component
  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      displayName: z.string().optional(),
      description: z.string().optional(),
      tags: z.array(z.string()).optional(),
      deprecated: z.boolean().optional(),
      deprecatedMessage: z.string().optional(),
      migrateToComponentId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      
      // Check ownership
      const { data: component } = await ctx.supabase
        .from('components')
        .select('created_by')
        .eq('id', id)
        .single();
      
      if (!component || component.created_by !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not authorized' });
      }
      
      // Update
      const { data, error } = await ctx.supabase
        .from('components')
        .update({
          display_name: updates.displayName,
          description: updates.description,
          tags: updates.tags,
          deprecated: updates.deprecated,
          deprecated_message: updates.deprecatedMessage,
          migrate_to_component_id: updates.migrateToComponentId,
          deprecated_since: updates.deprecated ? new Date().toISOString() : undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      }
      
      return data;
    }),

  // Delete component
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Check ownership
      const { data: component } = await ctx.supabase
        .from('components')
        .select('created_by')
        .eq('id', input.id)
        .single();
      
      if (!component || component.created_by !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not authorized' });
      }
      
      // Check if component is used in any workflows
      const { count } = await ctx.supabase
        .from('workflow_nodes')
        .select('*', { count: 'exact', head: true })
        .eq('component_id', input.id);
      
      if (count && count > 0) {
        throw new TRPCError({ 
          code: 'BAD_REQUEST', 
          message: `Component is used in ${count} workflow(s). Deprecate it instead of deleting.` 
        });
      }
      
      // Delete
      const { error } = await ctx.supabase
        .from('components')
        .delete()
        .eq('id', input.id);
      
      if (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      }
      
      return { success: true };
    }),
});
```

### Workflows Router

```typescript
// File: packages/workflow-builder/src/server/api/routers/workflows.ts

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { generateWorkflowTypeScript } from '../../lib/workflow-compiler';
import { registerWithTemporal } from '../../lib/temporal-client';

export const workflowsRouter = createTRPCRouter({
  // List workflows
  list: protectedProcedure
    .input(z.object({
      status: z.string().optional(),
      page: z.number().default(1),
      pageSize: z.number().default(20),
    }))
    .query(async ({ ctx, input }) => {
      let query = ctx.supabase
        .from('workflows')
        .select(`
          *,
          status:workflow_statuses(name, color),
          task_queue:task_queues(name),
          created_by_user:users(display_name)
        `, { count: 'exact' });
      
      // Filter by creator or public visibility
      query = query.or(`created_by.eq.${ctx.user.id},visibility_id.eq.${ctx.publicVisibilityId}`);
      
      if (input.status) {
        query = query.eq('workflow_statuses.name', input.status);
      }
      
      const from = (input.page - 1) * input.pageSize;
      const to = from + input.pageSize - 1;
      
      const { data, error, count } = await query
        .range(from, to)
        .order('updated_at', { ascending: false });
      
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      
      return {
        workflows: data,
        total: count,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil((count || 0) / input.pageSize),
      };
    }),

  // Get workflow by ID
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('workflows')
        .select(`
          *,
          status:workflow_statuses(name, color),
          task_queue:task_queues(name),
          created_by_user:users(display_name),
          nodes:workflow_nodes(*),
          edges:workflow_edges(*)
        `)
        .eq('id', input.id)
        .single();
      
      if (error) throw new TRPCError({ code: 'NOT_FOUND', message: 'Workflow not found' });
      
      // Check access
      if (data.created_by !== ctx.user.id && data.visibility_id !== ctx.publicVisibilityId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not authorized' });
      }
      
      return data;
    }),

  // Create workflow
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      displayName: z.string().min(1),
      description: z.string().optional(),
      visibility: z.enum(['public', 'private', 'organization']),
      taskQueueId: z.string().uuid(),
      definition: z.any(), // React Flow JSON
    }))
    .mutation(async ({ ctx, input }) => {
      // Get status ID for 'draft'
      const { data: status } = await ctx.supabase
        .from('workflow_statuses')
        .select('id')
        .eq('name', 'draft')
        .single();
      
      // Get visibility ID
      const { data: visibility } = await ctx.supabase
        .from('component_visibility')
        .select('id')
        .eq('name', input.visibility)
        .single();
      
      // Create workflow
      const { data: workflow, error } = await ctx.supabase
        .from('workflows')
        .insert({
          name: input.name,
          display_name: input.displayName,
          description: input.description,
          created_by: ctx.user.id,
          visibility_id: visibility.id,
          status_id: status.id,
          task_queue_id: input.taskQueueId,
          definition: input.definition,
        })
        .select()
        .single();
      
      if (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      }
      
      return workflow;
    }),

  // Update workflow
  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      displayName: z.string().optional(),
      description: z.string().optional(),
      definition: z.any().optional(),
      taskQueueId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      
      // Check ownership
      const { data: workflow } = await ctx.supabase
        .from('workflows')
        .select('created_by')
        .eq('id', id)
        .single();
      
      if (!workflow || workflow.created_by !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not authorized' });
      }
      
      const { data, error } = await ctx.supabase
        .from('workflows')
        .update({
          display_name: updates.displayName,
          description: updates.description,
          definition: updates.definition,
          task_queue_id: updates.taskQueueId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      }
      
      return data;
    }),

  // Deploy workflow (activate)
  deploy: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Get workflow
      const { data: workflow } = await ctx.supabase
        .from('workflows')
        .select('*')
        .eq('id', input.id)
        .single();
      
      if (!workflow || workflow.created_by !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not authorized' });
      }
      
      // Generate TypeScript (optional, for debugging)
      const typescript = await generateWorkflowTypeScript(workflow.definition);
      
      // Register with Temporal
      const temporalWorkflowId = await registerWithTemporal(workflow);
      
      // Update status to active
      const { data: activeStatus } = await ctx.supabase
        .from('workflow_statuses')
        .select('id')
        .eq('name', 'active')
        .single();
      
      const { data, error } = await ctx.supabase
        .from('workflows')
        .update({
          status_id: activeStatus.id,
          compiled_typescript: typescript,
          temporal_workflow_id: temporalWorkflowId,
          temporal_workflow_type: workflow.name,
          deployed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.id)
        .select()
        .single();
      
      if (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      }
      
      return data;
    }),

  // Pause workflow
  pause: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data: pausedStatus } = await ctx.supabase
        .from('workflow_statuses')
        .select('id')
        .eq('name', 'paused')
        .single();
      
      const { data, error } = await ctx.supabase
        .from('workflows')
        .update({
          status_id: pausedStatus.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.id)
        .eq('created_by', ctx.user.id)
        .select()
        .single();
      
      if (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      }
      
      return data;
    }),

  // Delete workflow
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Check if workflow has executions
      const { count } = await ctx.supabase
        .from('workflow_executions')
        .select('*', { count: 'exact', head: true })
        .eq('workflow_id', input.id);
      
      if (count && count > 0) {
        throw new TRPCError({ 
          code: 'BAD_REQUEST', 
          message: `Workflow has ${count} execution(s). Archive it instead of deleting.` 
        });
      }
      
      const { error } = await ctx.supabase
        .from('workflows')
        .delete()
        .eq('id', input.id)
        .eq('created_by', ctx.user.id);
      
      if (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      }
      
      return { success: true };
    }),
});
```

*(Continued in next section due to length...)*

---

## Frontend Architecture

### NextJS App Structure

```
packages/workflow-builder/
├── src/
│   ├── app/                      # Next.js 14 App Router
│   │   ├── layout.tsx            # Root layout with auth
│   │   ├── page.tsx              # Home/dashboard
│   │   ├── workflows/
│   │   │   ├── page.tsx          # Workflow list
│   │   │   ├── new/
│   │   │   │   └── page.tsx      # Create new workflow
│   │   │   └── [id]/
│   │   │       ├── page.tsx      # Workflow detail
│   │   │       └── edit/
│   │   │           └── page.tsx  # Workflow editor
│   │   ├── components/
│   │   │   ├── page.tsx          # Component library
│   │   │   ├── new/
│   │   │   │   └── page.tsx      # Create component
│   │   │   └── [id]/
│   │   │       └── page.tsx      # Component detail
│   │   ├── agents/
│   │   │   ├── page.tsx          # Agent prompts
│   │   │   └── new/
│   │   │       └── page.tsx      # Create agent
│   │   ├── api/
│   │   │   └── trpc/
│   │   │       └── [trpc]/
│   │   │           └── route.ts  # tRPC handler
│   │   └── auth/
│   │       ├── signin/
│   │       │   └── page.tsx      # Sign in
│   │       └── signup/
│   │           └── page.tsx      # Sign up
│   │
│   ├── components/               # React components
│   │   ├── workflow/
│   │   │   ├── WorkflowCanvas.tsx        # Main canvas (uses @bernierllc/workflow-ui)
│   │   │   ├── ComponentPalette.tsx      # Drag source for components
│   │   │   ├── PropertyPanel.tsx         # Node configuration panel
│   │   │   ├── WorkflowToolbar.tsx       # Save, deploy, test buttons
│   │   │   └── NodeTypes/                # Custom node types
│   │   │       ├── ActivityNode.tsx
│   │   │       ├── AgentNode.tsx
│   │   │       ├── SignalNode.tsx
│   │   │       └── TriggerNode.tsx
│   │   ├── component/
│   │   │   ├── ComponentCard.tsx
│   │   │   ├── ComponentForm.tsx
│   │   │   └── ComponentList.tsx
│   │   ├── agent/
│   │   │   ├── AgentPromptEditor.tsx
│   │   │   └── AgentPromptList.tsx
│   │   └── shared/
│   │       ├── Header.tsx
│   │       ├── Sidebar.tsx
│   │       └── AuthGuard.tsx
│   │
│   ├── lib/                      # Utilities
│   │   ├── supabase/
│   │   │   ├── client.ts         # Supabase client
│   │   │   └── server.ts         # Server-side Supabase
│   │   ├── workflow-compiler.ts   # Generate TS from JSON
│   │   ├── temporal-client.ts     # Temporal integration
│   │   └── trpc.ts                # tRPC client
│   │
│   ├── server/                   # Backend code
│   │   ├── api/
│   │   │   ├── root.ts           # Root router
│   │   │   ├── trpc.ts           # tRPC setup
│   │   │   └── routers/          # API routers (see above)
│   │   └── db/
│   │       └── schema.sql        # Database schema
│   │
│   └── types/                    # TypeScript types
│       ├── database.ts           # Supabase generated types
│       ├── workflow.ts           # Workflow types
│       └── component.ts          # Component types
│
├── public/                       # Static assets
├── .env.local.example            # Environment variables template
├── package.json
├── tsconfig.json
├── next.config.js
└── AGENTINFO.md                  # AI agent instructions
```

### Key Frontend Components

#### Workflow Canvas (Using @bernierllc/workflow-ui)

```typescript
// File: src/components/workflow/WorkflowCanvas.tsx

'use client';

import { useState, useCallback } from 'react';
import { WorkflowBuilder } from '@bernierllc/workflow-ui';
import type { WorkflowTemplate } from '@bernierllc/workflow-ui';
import { api } from '@/lib/trpc';
import { YStack, XStack, Button } from 'tamagui';
import { ComponentPalette } from './ComponentPalette';
import { PropertyPanel } from './PropertyPanel';
import { WorkflowToolbar } from './WorkflowToolbar';

interface WorkflowCanvasProps {
  workflowId?: string;
  initialDefinition?: any;
}

export function WorkflowCanvas({ workflowId, initialDefinition }: WorkflowCanvasProps) {
  const [workflow, setWorkflow] = useState<WorkflowTemplate | null>(initialDefinition || null);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  
  // Load components for palette
  const { data: components } = api.components.list.useQuery({
    includeDeprecated: false,
  });
  
  // Save mutation
  const saveMutation = api.workflows.update.useMutation();
  const deployMutation = api.workflows.deploy.useMutation();
  
  const handleSave = useCallback(async () => {
    if (!workflowId || !workflow) return;
    
    await saveMutation.mutateAsync({
      id: workflowId,
      definition: workflow,
    });
  }, [workflowId, workflow, saveMutation]);
  
  const handleDeploy = useCallback(async () => {
    if (!workflowId) return;
    
    // Save first
    await handleSave();
    
    // Deploy
    await deployMutation.mutateAsync({ id: workflowId });
  }, [workflowId, handleSave, deployMutation]);
  
  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(node);
  }, []);
  
  const handleWorkflowChange = useCallback((updatedWorkflow: WorkflowTemplate) => {
    setWorkflow(updatedWorkflow);
  }, []);
  
  return (
    <XStack flex={1} height="100vh">
      {/* Component Palette (Left Sidebar) */}
      <ComponentPalette components={components?.components || []} />
      
      {/* Main Canvas (Center) */}
      <YStack flex={1}>
        <WorkflowToolbar
          onSave={handleSave}
          onDeploy={handleDeploy}
          isSaving={saveMutation.isLoading}
          isDeploying={deployMutation.isLoading}
        />
        
        <WorkflowBuilder
          initialWorkflow={workflow || undefined}
          onSave={handleWorkflowChange}
          onPreview={(wf) => console.log('Preview:', wf)}
          availableStates={[]} // From component metadata
          availableActions={[]} // From component metadata
          readOnly={false}
        />
      </YStack>
      
      {/* Property Panel (Right Sidebar) */}
      {selectedNode && (
        <PropertyPanel
          node={selectedNode}
          onUpdate={(updated) => {
            // Update node in workflow
            const updatedWorkflow = {
              ...workflow,
              nodes: workflow.nodes.map(n =>
                n.id === selectedNode.id ? { ...n, ...updated } : n
              ),
            };
            setWorkflow(updatedWorkflow);
          }}
        />
      )}
    </XStack>
  );
}
```

#### Component Palette

```typescript
// File: src/components/workflow/ComponentPalette.tsx

'use client';

import { ScrollView, YStack, Text, Separator } from 'tamagui';
import { ComponentCard } from '../component/ComponentCard';
import type { Component } from '@/types/component';

interface ComponentPaletteProps {
  components: Component[];
}

export function ComponentPalette({ components }: ComponentPaletteProps) {
  // Group by type
  const groupedComponents = components.reduce((acc, comp) => {
    const type = comp.component_type.name;
    if (!acc[type]) acc[type] = [];
    acc[type].push(comp);
    return acc;
  }, {} as Record<string, Component[]>);
  
  return (
    <YStack width={280} backgroundColor="$background" borderRightWidth={1} borderColor="$borderColor">
      <YStack padding="$4" borderBottomWidth={1} borderColor="$borderColor">
        <Text fontSize="$6" fontWeight="bold">Components</Text>
      </YStack>
      
      <ScrollView flex={1}>
        <YStack padding="$2" gap="$4">
          {Object.entries(groupedComponents).map(([type, comps]) => (
            <YStack key={type} gap="$2">
              <Text fontSize="$4" fontWeight="600" paddingHorizontal="$2" color="$gray11">
                {type.charAt(0).toUpperCase() + type.slice(1)}s
              </Text>
              
              {comps.map((component) => (
                <ComponentCard
                  key={component.id}
                  component={component}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/json', JSON.stringify(component));
                  }}
                />
              ))}
            </YStack>
          ))}
        </YStack>
      </ScrollView>
    </YStack>
  );
}
```

---

## Integration with Existing System

### Using Existing Registries

```typescript
// File: src/lib/registry-sync.ts

import { ActivityRegistry, WorkflowRegistry } from '@coordinator/temporal-registry';
import { api } from './trpc';

/**
 * Sync components from in-memory registries to Supabase
 */
export async function syncRegistriesToDatabase() {
  // Get all activities from ActivityRegistry
  const activities = ActivityRegistry.list();
  
  for (const activity of activities) {
    // Check if exists in Supabase
    const existing = await api.components.list.query({
      name: activity.name,
      version: activity.version,
    });
    
    if (existing.components.length === 0) {
      // Create in Supabase
      await api.components.create.mutate({
        name: activity.name,
        displayName: activity.displayName,
        description: activity.description,
        componentType: 'activity',
        version: activity.version,
        visibility: 'public',
        capabilities: activity.capabilities,
        tags: activity.tags,
        configSchema: {}, // Derive from activity metadata
        inputSchema: {}, // Derive from TypeScript types
        outputSchema: {}, // Derive from TypeScript types
        implementationPath: activity.implementationPath,
        npmPackage: activity.npmPackage,
      });
    }
  }
  
  // Same for workflows
  const workflows = WorkflowRegistry.list();
  // ... sync workflows
}

/**
 * Load components from Supabase into registries at worker startup
 */
export async function loadComponentsIntoRegistries() {
  const { components } = await api.components.list.query({});
  
  for (const component of components) {
    if (component.component_type.name === 'activity') {
      // Register with ActivityRegistry
      ActivityRegistry.register({
        name: component.name,
        displayName: component.display_name,
        description: component.description,
        activityType: 'standard', // or derive from metadata
        version: component.version,
        capabilities: component.capabilities,
        tags: component.tags,
      });
    }
  }
}
```

---

## Worker Generation Strategy

### Dynamic Worker Loading

```typescript
// File: packages/workflow-builder/src/worker/dynamic-worker.ts

import { Worker, NativeConnection } from '@temporalio/worker';
import { createClient } from '@supabase/supabase-js';
import { loadComponentsIntoRegistries } from '../lib/registry-sync';
import { generateWorkflowFunction } from '../lib/workflow-runtime';

async function main() {
  // Connect to Supabase
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
  
  // Load all active workflows
  const { data: workflows } = await supabase
    .from('workflows')
    .select('*, task_queue:task_queues(name)')
    .eq('workflow_statuses.name', 'active');
  
  if (!workflows || workflows.length === 0) {
    console.log('No active workflows found');
    return;
  }
  
  // Load components into registries
  await loadComponentsIntoRegistries();
  
  // Group workflows by task queue
  const workflowsByQueue = workflows.reduce((acc, wf) => {
    const queueName = wf.task_queue.name;
    if (!acc[queueName]) acc[queueName] = [];
    acc[queueName].push(wf);
    return acc;
  }, {} as Record<string, any[]>);
  
  // Create worker for each task queue
  const workers: Worker[] = [];
  
  for (const [queueName, queueWorkflows] of Object.entries(workflowsByQueue)) {
    console.log(`Creating worker for queue: ${queueName} (${queueWorkflows.length} workflows)`);
    
    // Generate workflow functions from definitions
    const workflowFunctions = queueWorkflows.reduce((acc, wf) => {
      const workflowFn = generateWorkflowFunction(wf.definition);
      acc[wf.name] = workflowFn;
      return acc;
    }, {} as Record<string, any>);
    
    // Create worker
    const connection = await NativeConnection.connect({
      address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
    });
    
    const worker = await Worker.create({
      connection,
      taskQueue: queueName,
      workflowsPath: require.resolve('./dynamic-workflows'),
      // Inject generated workflows
      workflowsOverride: workflowFunctions,
      activities: {
        // Load all registered activities
        // ... dynamically loaded from registries
      },
    });
    
    workers.push(worker);
  }
  
  // Run all workers
  await Promise.all(workers.map(w => w.run()));
}

main().catch((err) => {
  console.error('Worker failed:', err);
  process.exit(1);
});
```

### Workflow Runtime Generator

```typescript
// File: packages/workflow-builder/src/lib/workflow-runtime.ts

import { proxyActivities } from '@temporalio/workflow';
import type { WorkflowDefinition } from '@/types/workflow';

/**
 * Generate executable workflow function from JSON definition
 */
export function generateWorkflowFunction(definition: WorkflowDefinition) {
  return async function generatedWorkflow(input: any): Promise<any> {
    // Create activity proxies
    const activities = proxyActivities({
      startToCloseTimeout: '10 minutes',
      retry: {
        maximumAttempts: 3,
      },
    });
    
    // Build execution graph from definition
    const { nodes, edges } = definition;
    
    // Sort nodes topologically
    const sortedNodes = topologicalSort(nodes, edges);
    
    // Execute nodes in order
    const results = new Map<string, any>();
    results.set('input', input);
    
    for (const node of sortedNodes) {
      const nodeData = node.data;
      
      // Get inputs for this node
      const nodeInputs = getNodeInputs(node, edges, results);
      
      // Execute based on node type
      switch (node.type) {
        case 'activity':
          const activityName = nodeData.componentName;
          const result = await activities[activityName](nodeInputs);
          results.set(node.id, result);
          break;
          
        case 'agent':
          // Execute agent activity
          const agentResult = await activities.executeAgent({
            promptId: nodeData.agentPromptId,
            input: nodeInputs,
          });
          results.set(node.id, agentResult);
          break;
          
        case 'condition':
          // Evaluate condition
          const conditionResult = evaluateCondition(nodeData.condition, nodeInputs);
          results.set(node.id, conditionResult);
          break;
          
        // ... other node types
      }
    }
    
    // Return final output
    return results.get('output') || results;
  };
}

function topologicalSort(nodes: any[], edges: any[]): any[] {
  // Standard topological sort implementation
  // ...
}

function getNodeInputs(node: any, edges: any[], results: Map<string, any>): any {
  // Get inputs from predecessor nodes
  const incomingEdges = edges.filter(e => e.target === node.id);
  const inputs: any = {};
  
  for (const edge of incomingEdges) {
    const sourceResult = results.get(edge.source);
    if (sourceResult !== undefined) {
      inputs[edge.sourceHandle || 'default'] = sourceResult;
    }
  }
  
  return inputs;
}

function evaluateCondition(condition: string, inputs: any): boolean {
  // Safe condition evaluation
  // ... use a sandboxed evaluator
}
```

---

## AGENTINFO Specification

Create `AGENTINFO.md` in the root of the workflow-builder package:

```markdown
# AGENTINFO.md - Workflow Builder System

**Project:** Workflow Builder System for Temporal Coordinators  
**Type:** Next.js + Supabase + Temporal Integration  
**Stack:** TypeScript (strict), Next.js 14, Tamagui, tRPC, Supabase

---

## Architecture Principles

### Database Design
- **No Enums**: All enums replaced with lookup tables (e.g., `component_types`, `workflow_statuses`)
- **Foreign Keys**: All relationships use UUIDs with proper FK constraints
- **Row-Level Security**: Supabase RLS enabled on all tables for multi-tenant security
- **Denormalization**: Some data denormalized for query performance (e.g., `workflow_nodes`)

### API Design
- **tRPC**: Type-safe RPC calls between frontend and backend
- **Protected Routes**: All mutations require authentication
- **Pagination**: All list endpoints support pagination
- **Ownership Checks**: Mutations verify user owns the resource

### Integration Patterns
- **Existing Registries**: Sync with `ActivityRegistry` and `WorkflowRegistry` from `@coordinator/temporal-registry`
- **Dynamic Workers**: Workers load workflow definitions from Supabase at startup
- **Workflow Compiler**: JSON definitions compiled to executable Temporal workflows

---

## Component Structure

### UI Components (Tamagui)
- Use `YStack` and `XStack` for layout (no CSS grid/flexbox)
- Use Tamagui primitives: `Button`, `Input`, `Dialog`, `Sheet`, `ScrollView`
- Theme tokens: `$background`, `$color`, `$borderColor`, `$space4`, etc.
- No custom CSS except minimal overrides in `styles/overrides.css`

### Workflow Canvas
- Uses `@bernierllc/workflow-ui` package (React Flow based)
- Custom node types: `ActivityNode`, `AgentNode`, `SignalNode`, `TriggerNode`
- Drag-and-drop from component palette
- Real-time validation of connections

### Data Flow
```
User Action → tRPC Mutation → Supabase DB → RLS Check → Response
                                    ↓
                            Real-time subscription (optional)
```

---

## Database Conventions

### Table Naming
- **Lowercase + underscores**: `workflow_nodes`, `component_types`
- **Plural for data tables**: `components`, `workflows`, `users`
- **Singular for lookup tables**: `component_visibility`, `workflow_statuses`

### Column Naming
- **snake_case**: `created_at`, `display_name`, `component_type_id`
- **Foreign keys**: `{table_singular}_id` (e.g., `component_type_id`, `created_by`)
- **Timestamps**: Always `TIMESTAMPTZ`, always `NOT NULL DEFAULT NOW()`
- **UUIDs**: Use `gen_random_uuid()` for primary keys

### JSON Columns
- Use `JSONB` for structured data (not `JSON`)
- Examples: `definition`, `config_schema`, `permissions`
- Always provide default: `JSONB NOT NULL DEFAULT '{}'`

---

## TypeScript Patterns

### Strict Mode
```json
{
  "strict": true,
  "noImplicitAny": true,
  "strictNullChecks": true,
  "noUncheckedIndexedAccess": true
}
```

### Type Generation
- Supabase types: `npx supabase gen types typescript --project-id <id> > src/types/database.ts`
- tRPC types: Automatically inferred from routers
- Temporal types: Import from `@coordinator/contracts`

### Naming Conventions
- **Interfaces**: PascalCase with `I` prefix for pure interfaces: `IComponent`, `IWorkflow`
- **Types**: PascalCase without prefix: `Component`, `WorkflowDefinition`
- **Enums**: PascalCase: `ComponentType`, `WorkflowStatus`
- **Functions**: camelCase: `generateWorkflowFunction`, `topologicalSort`

---

## Error Handling

### Backend (tRPC)
```typescript
throw new TRPCError({ 
  code: 'NOT_FOUND' | 'FORBIDDEN' | 'BAD_REQUEST' | 'INTERNAL_SERVER_ERROR',
  message: 'User-friendly error message'
});
```

### Frontend
```typescript
try {
  await mutation.mutateAsync({ ... });
} catch (error) {
  if (error instanceof TRPCClientError) {
    toast.error(error.message);
  }
}
```

### Temporal Workflows
- Use `ApplicationFailure` for business logic errors
- Use `TemporalFailure` for infrastructure errors
- Always set retry policies on activities

---

## Security Guidelines

### Authentication
- Use Supabase Auth for user management
- Store auth tokens in httpOnly cookies
- Refresh tokens automatically via Supabase client

### Authorization
- Row-Level Security (RLS) on all tables
- Check ownership in tRPC procedures
- Validate permissions against user role

### Input Validation
- Zod schemas on all tRPC inputs
- JSON Schema validation for component configs
- Sanitize user-provided prompts and code

---

## Testing Strategy

### Unit Tests (Vitest)
- Test utility functions: `topologicalSort`, `evaluateCondition`
- Test tRPC routers with mock Supabase client
- Test workflow compiler: JSON → executable function

### Integration Tests
- Test full tRPC flow: create workflow → save → deploy
- Test Supabase RLS policies
- Test dynamic worker loading

### E2E Tests (Playwright - future)
- Test complete user flow: sign in → create workflow → deploy
- Test drag-and-drop canvas
- Test real-time updates

---

## Development Workflow

### Local Setup
```bash
# Install dependencies
yarn install

# Start Supabase locally (optional)
npx supabase start

# Run migrations
npx supabase db push

# Start Next.js dev server
yarn dev

# Start Temporal dev server (separate terminal)
temporal server start-dev

# Start dynamic worker (separate terminal)
yarn worker:dev
```

### Environment Variables
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx
SUPABASE_SERVICE_KEY=eyJxxx

# Temporal
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default

# Next.js
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=xxx
```

---

## Common Patterns

### Creating a New tRPC Route
1. Define Zod schema for input
2. Create procedure (public or protected)
3. Query Supabase with proper filters
4. Apply RLS checks
5. Return typed data

### Adding a New Component Type
1. Insert into `component_types` table
2. Create custom node component (e.g., `MyNode.tsx`)
3. Add to node type registry in `WorkflowCanvas`
4. Update workflow compiler to handle new type

### Deploying a Workflow
1. Save workflow definition to Supabase
2. Generate TypeScript (optional, for debugging)
3. Update workflow status to 'active'
4. Dynamic worker auto-loads on next poll
5. Workflow available in Temporal

---

## Performance Considerations

### Database
- Index all foreign keys
- Index commonly queried columns (`created_at`, `status_id`)
- Use `EXPLAIN ANALYZE` for slow queries
- Denormalize data for read-heavy access patterns

### Frontend
- Use React Query (built into tRPC) for caching
- Paginate all list views
- Lazy load large workflow definitions
- Debounce auto-save on canvas

### Workers
- One worker per task queue
- Poll Supabase every 30s for new workflows
- Cache component metadata in memory
- Use Temporal's built-in retry logic

---

## Troubleshooting

### "Component not found" error
- Check if component is synced from ActivityRegistry
- Verify component visibility (public vs private)
- Check RLS policies on `components` table

### Workflow not executing
- Verify workflow status is 'active'
- Check if worker is running for task queue
- Look at Temporal UI for workflow history
- Check worker logs for errors

### Type errors in generated workflow
- Regenerate Supabase types: `yarn gen:types`
- Check tRPC router exports
- Verify component schemas match actual implementation

---

## Future Enhancements

### Admin UI
- User management
- Component marketplace
- Workflow analytics dashboard
- System health monitoring

### Advanced Features
- Workflow versioning and rollback
- A/B testing different workflow versions
- Visual debugging (step through execution)
- Workflow templates marketplace

### Integrations
- GitHub Actions (trigger workflows from PRs)
- Slack (notifications)
- Datadog (metrics and monitoring)
- OpenTelemetry (distributed tracing)

---

## References

- **Temporal Docs**: https://docs.temporal.io/
- **Supabase Docs**: https://supabase.com/docs
- **tRPC Docs**: https://trpc.io/docs
- **Tamagui Docs**: https://tamagui.dev/docs
- **Component Registry Standard**: `docs/standards/component-discoverability-and-reusability.md`
- **Workflow Product Vision**: `docs/product-vision/workflow-builder-ui-product.md`
```

---

## POC Implementation Phases

### Phase 1: Foundation ✅ COMPLETE

**Goal:** Database + Auth + Basic UI

- [x] Set up Next.js 14 project with App Router
- [x] Install dependencies: Tamagui, tRPC, Supabase client, `@bernierllc/temporal-workflow-ui@1.1.0`
- [x] Create Supabase project and run schema migrations (5 migrations applied)
- [x] Implement Supabase Auth (sign up, sign in, sign out)
- [x] Create basic layout with header, sidebar
- [x] Set up tRPC with context, protected procedures
- [x] Test: User can sign up, sign in, see authenticated UI

### Phase 2: Component Library ✅ COMPLETE

**Goal:** CRUD for components and agents

- [x] Implement components tRPC router (list, get, create, update, delete)
- [x] Implement agent prompts tRPC router (full CRUD)
- [x] Create Component List page with Tamagui cards
- [x] Create Component Form for creating new components
- [x] Create Agent Prompt Editor (textarea with Tamagui)
- [ ] Sync existing ActivityRegistry components to Supabase (manual task)
- [x] Test: User can create, view, edit components and agents

### Phase 3: Workflow Builder UI ✅ COMPLETE

**Goal:** Visual workflow designer + Advanced Patterns

- [x] Install `@bernierllc/temporal-workflow-ui@1.1.0`
- [x] Create ComponentPalette with search/filter functionality
- [x] Implement custom node types (Activity, Agent, Signal, Query, Work Queue, Scheduled Workflow, Child Workflow)
- [x] Create PropertyPanel for all node configuration types
- [x] Implement workflows tRPC router (CRUD operations)
- [x] Implement work queues tRPC router (full CRUD + auto-handler generation)
- [x] Implement signals/queries tRPC router (full CRUD)
- [x] Create Work Queue management UI (cards, forms, pages)
- [x] Create Scheduled Workflow UI (cards, forms, cron builder)
- [x] Create Signal/Query handler UI (cards)
- [x] Build workflow builder canvas page with sidebars
- [x] Implement TemporalWorkflowCanvas container (ready for integration)
- [ ] Uncomment TemporalWorkflowBuilder integration (final step)
- [x] Test: User can view components, configure advanced patterns

### Phase 4: Worker Generation ✅ COMPLETE

**Goal:** Deploy and execute workflows (Temporal abstracted from user)

- [x] Implement workflow compiler (`generateWorkflowFunction`)
- [x] Create code generation API (`compiler` tRPC router)
- [x] Create execution API (`execution` tRPC router)
- [x] Build WorkflowExecutionPanel component with real-time status
- [x] Add "Build Workflow" button (workflow builds are workflows!)
- [x] Generate workflow.ts, activities.ts, worker.ts, package.json, tsconfig.json
- [x] Show execution progress with live updates
- [x] Display execution results in user-friendly format
- [x] "View Code" button for advanced users (optional)
- [x] **Create "Build Workflow" meta-workflow** 🔄
  - System workflow that builds other workflows
  - ID: `aaaaaaaa-bbbb-cccc-dddd-000000000001`
  - Steps: Compile → Validate → Register → Initialize → Execute → Update
  - Agent-powered execution coordination
  - Visible in UI like any other workflow
  - Complete dogfooding of the system
  - See `META_WORKFLOW.md` for details
- [x] Create `workflow_executions` table for tracking builds
- [x] Migrations: `20251116000003_build_workflow_workflow.sql`, `20251116000004_workflow_executions.sql`
- [ ] Create dynamic worker that loads from Supabase (deferred - using simulated execution for POC)
- [ ] Implement task queue management (deferred)
- [ ] Test local Temporal execution (deferred)
- [x] Test: User can build workflow, see it execute in UI (simulated execution working)

### Phase 5: Monitoring & Polish (Week 5)

**Goal:** Production-ready POC

- [ ] Implement workflow execution tracking
- [ ] Integrate WorkflowDashboard from `@bernierllc/temporal-workflow-ui`
- [ ] Add real-time updates (Supabase Realtime)
- [ ] Implement workflow pause/resume
- [ ] Add error handling and user feedback
- [ ] Create AGENTINFO.md
- [ ] Test: Complete E2E flow works reliably

---

## Future Enhancements

### Post-POC Features

1. **Admin UI** (Never Admin style)
   - User role management
   - System-wide component management
   - Workflow analytics and metrics
   - Audit logs

2. **Component Marketplace**
   - Publish components publicly
   - Rating and review system
   - Version history and changelogs
   - Usage statistics

3. **Advanced Workflow Features**
   - Loops and conditionals
   - Parallel execution
   - Subworkflows
   - Dynamic task generation

4. **Deployment Options**
   - Export workflow as npm package
   - Generate Docker container with worker
   - Cloud deployment (Vercel + Temporal Cloud)
   - Self-hosted deployment guide

5. **Collaboration**
   - Team workspaces
   - Shared component libraries
   - Workflow commenting
   - Version control integration (Git)

6. **Integrations**
   - GitHub Actions integration
   - Slack notifications
   - Webhook triggers
   - External API connectors

---

## Success Metrics

### POC Success Criteria

- [ ] User can sign up and authenticate via Supabase Auth
- [ ] User can create at least 3 different component types
- [ ] User can design a workflow with 5+ connected nodes
- [ ] User can deploy workflow to local Temporal instance
- [ ] Workflow executes successfully end-to-end
- [ ] User can view execution history and results
- [ ] All database queries respect RLS policies
- [ ] TypeScript strict mode with zero errors
- [ ] AGENTINFO.md accurately reflects system design

### Production Readiness Criteria (Future)

- [ ] 10+ users creating workflows
- [ ] 50+ components in library
- [ ] 99.9% uptime for workflow execution
- [ ] Sub-200ms API response times
- [ ] Comprehensive test coverage (>80%)
- [ ] Security audit passed
- [ ] Documentation complete

---

## Document Control

| Version | Date       | Author                    | Changes                        |
|---------|------------|---------------------------|--------------------------------|
| 1.0.0   | 2025-11-14 | AI Assistant + Matt B.    | Initial comprehensive design   |

**Related Documents:**
- [Component Discoverability Standards](../standards/component-discoverability-and-reusability.md)
- [Workflow Builder Product Vision](../product-vision/workflow-builder-ui-product.md)
- [Agentic Coordinator Workflow Design](./2025-11-14-agentic-coordinator-workflow-design.md)
- [Temporal Workflow Standardization](./2025-11-13-temporal-workflow-standardization-and-service-architecture.md)

---

**END OF DESIGN DOCUMENT**

