# Database Schema Documentation

Complete reference for the Workflow Builder database schema in Supabase (PostgreSQL).

## Table of Contents

- [Overview](#overview)
- [Core Tables](#core-tables)
- [Workflow Tables](#workflow-tables)
- [Component Tables](#component-tables)
- [Execution Tables](#execution-tables)
- [Worker Tables](#worker-tables)
- [Relationships](#relationships)
- [Indexes](#indexes)
- [Row Level Security](#row-level-security)

---

## Overview

### Database Provider

**Supabase (PostgreSQL 15+)**
- Full PostgreSQL database
- Row-level security (RLS)
- Real-time subscriptions
- Built-in auth

### Naming Conventions

- **Tables:** `snake_case` (e.g., `workflow_nodes`)
- **Columns:** `snake_case` (e.g., `created_at`)
- **Foreign Keys:** `fk_` prefix (e.g., `fk_workflow_id`)
- **Indexes:** `idx_` prefix (e.g., `idx_workflows_created_by`)

### Shared Columns

Most tables include:
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

---

## Core Tables

### users

User accounts (synced with Supabase Auth).

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id),
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  role_id UUID NOT NULL REFERENCES user_roles(id),
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_auth_user_id ON users(auth_user_id);
CREATE INDEX idx_users_email ON users(email);
```

**Columns:**
- `id` - Internal user ID
- `auth_user_id` - Supabase Auth user ID
- `email` - User email address
- `display_name` - Display name (optional)
- `role_id` - User role reference
- `last_login_at` - Last login timestamp

### user_roles

User role definitions.

```sql
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default roles
INSERT INTO user_roles (name, permissions) VALUES
('admin', '{"workflows": {"create": true, "update": true, "delete": true}}'),
('developer', '{"workflows": {"create": true, "update": true}}'),
('viewer', '{"workflows": {"read": true}}');
```

### projects

Project containers for workflows.

```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  task_queue_name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  total_workflow_executions INTEGER DEFAULT 0,
  total_activity_executions INTEGER DEFAULT 0,
  avg_execution_duration_ms INTEGER,
  last_execution_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_user_project_name UNIQUE (created_by, name)
);

CREATE INDEX idx_projects_created_by ON projects(created_by);
CREATE INDEX idx_projects_task_queue ON projects(task_queue_name);
CREATE INDEX idx_projects_is_archived ON projects(is_archived);
```

**Columns:**
- `task_queue_name` - Unique Temporal task queue identifier
- `is_default` - Default project for user (cannot be deleted)
- `is_archived` - Soft delete flag
- `total_workflow_executions` - Aggregated stats
- `avg_execution_duration_ms` - Average execution time

### task_queues

Temporal task queue definitions.

```sql
CREATE TABLE task_queues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT,
  description TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  is_system_queue BOOLEAN NOT NULL DEFAULT false,
  max_concurrent_workflows INTEGER,
  max_concurrent_activities INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_task_queues_created_by ON task_queues(created_by);
CREATE INDEX idx_task_queues_name ON task_queues(name);
```

---

## Workflow Tables

### workflows

Workflow definitions.

```sql
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,  -- DEPRECATED: use kebab_name
  kebab_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  project_id UUID REFERENCES projects(id),
  status_id UUID NOT NULL REFERENCES workflow_statuses(id),
  visibility_id UUID NOT NULL REFERENCES component_visibility(id),
  task_queue_id UUID NOT NULL REFERENCES task_queues(id),

  -- Workflow configuration
  definition JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
  version TEXT NOT NULL DEFAULT '1.0.0',
  execution_timeout_seconds INTEGER,

  -- Compilation
  compiled_typescript TEXT,

  -- Temporal integration
  temporal_workflow_id TEXT,
  temporal_workflow_type TEXT,

  -- Scheduling
  is_scheduled BOOLEAN NOT NULL DEFAULT false,
  schedule_spec TEXT,  -- Cron expression
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  max_runs INTEGER,
  run_count INTEGER DEFAULT 0,

  -- Child workflow configuration
  parent_workflow_id UUID REFERENCES workflows(id),
  start_immediately BOOLEAN,
  end_with_parent BOOLEAN,
  signal_to_parent_name TEXT,
  query_parent_name TEXT,

  -- Concurrency
  max_concurrent_executions INTEGER DEFAULT 1,

  -- Lifecycle
  deployed_at TIMESTAMPTZ,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_user_workflow_name UNIQUE (created_by, kebab_name)
);

CREATE INDEX idx_workflows_created_by ON workflows(created_by);
CREATE INDEX idx_workflows_project_id ON workflows(project_id);
CREATE INDEX idx_workflows_status_id ON workflows(status_id);
CREATE INDEX idx_workflows_task_queue_id ON workflows(task_queue_id);
CREATE INDEX idx_workflows_temporal_workflow_id ON workflows(temporal_workflow_id);
CREATE INDEX idx_workflows_is_archived ON workflows(is_archived);
```

**Key Columns:**
- `definition` - React Flow JSON (nodes + edges)
- `compiled_typescript` - Generated TypeScript code
- `temporal_workflow_id` - Temporal workflow instance ID
- `schedule_spec` - Cron expression for scheduled workflows

### workflow_statuses

Workflow lifecycle statuses.

```sql
CREATE TABLE workflow_statuses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  color TEXT,
  description TEXT
);

-- Default statuses
INSERT INTO workflow_statuses (name, color, description) VALUES
('draft', '#9CA3AF', 'Workflow is being edited'),
('active', '#10B981', 'Workflow is deployed and active'),
('paused', '#F59E0B', 'Workflow is paused'),
('deprecated', '#EF4444', 'Workflow is deprecated');
```

### workflow_nodes

Individual workflow nodes (React Flow nodes).

```sql
CREATE TABLE workflow_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,  -- React Flow node ID
  node_type TEXT NOT NULL,
  component_id UUID REFERENCES components(id),
  position JSONB NOT NULL,  -- {x, y}
  config JSONB NOT NULL DEFAULT '{}',

  -- Work queue node configuration
  work_queue_target TEXT,
  block_until_queue TEXT,
  block_until_work_items JSONB,

  -- Signal/Query configuration
  signal_to_parent TEXT,
  query_parent TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_workflow_node_id UNIQUE (workflow_id, node_id)
);

CREATE INDEX idx_workflow_nodes_workflow_id ON workflow_nodes(workflow_id);
CREATE INDEX idx_workflow_nodes_component_id ON workflow_nodes(component_id);
```

### workflow_edges

Connections between nodes.

```sql
CREATE TABLE workflow_edges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  edge_id TEXT NOT NULL,  -- React Flow edge ID
  source_node_id TEXT NOT NULL,
  target_node_id TEXT NOT NULL,
  label TEXT,
  config JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_workflow_edge_id UNIQUE (workflow_id, edge_id)
);

CREATE INDEX idx_workflow_edges_workflow_id ON workflow_edges(workflow_id);
```

### workflow_signals

Workflow signal definitions.

```sql
CREATE TABLE workflow_signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  work_queue_id UUID REFERENCES workflow_work_queues(id),
  signal_name TEXT NOT NULL,
  description TEXT,
  parameters JSONB,
  auto_generated BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_workflow_signal_name UNIQUE (workflow_id, signal_name)
);

CREATE INDEX idx_workflow_signals_workflow_id ON workflow_signals(workflow_id);
```

### workflow_queries

Workflow query definitions.

```sql
CREATE TABLE workflow_queries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  work_queue_id UUID REFERENCES workflow_work_queues(id),
  query_name TEXT NOT NULL,
  description TEXT,
  return_type JSONB,
  auto_generated BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_workflow_query_name UNIQUE (workflow_id, query_name)
);

CREATE INDEX idx_workflow_queries_workflow_id ON workflow_queries(workflow_id);
```

### workflow_work_queues

Internal work queues within workflows.

```sql
CREATE TABLE workflow_work_queues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  queue_name TEXT NOT NULL,
  signal_name TEXT NOT NULL,
  query_name TEXT NOT NULL,
  description TEXT,
  max_size INTEGER,
  priority TEXT NOT NULL DEFAULT 'fifo',  -- fifo, lifo, priority
  deduplicate BOOLEAN NOT NULL DEFAULT false,
  work_item_schema JSONB,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_workflow_queue_name UNIQUE (workflow_id, queue_name)
);

CREATE INDEX idx_workflow_work_queues_workflow_id ON workflow_work_queues(workflow_id);
```

---

## Component Tables

### component_types

Component type categories.

```sql
CREATE TABLE component_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  icon TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default types
INSERT INTO component_types (name, icon, description) VALUES
('activity', '⚡', 'Activity function'),
('agent', '🤖', 'AI agent'),
('trigger', '▶️', 'Workflow trigger'),
('signal', '📡', 'External signal');
```

### component_visibility

Component visibility levels.

```sql
CREATE TABLE component_visibility (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT
);

-- Default visibility levels
INSERT INTO component_visibility (name, description) VALUES
('public', 'Visible to all users'),
('private', 'Visible only to creator'),
('organization', 'Visible to organization');
```

### components

Reusable workflow components.

```sql
CREATE TABLE components (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  component_type_id UUID NOT NULL REFERENCES component_types(id),
  version TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  visibility_id UUID NOT NULL REFERENCES component_visibility(id),

  -- Schemas
  config_schema JSONB,
  input_schema JSONB,
  output_schema JSONB,

  -- Agent-specific
  agent_prompt_id UUID REFERENCES agent_prompts(id),
  model_provider TEXT,
  model_name TEXT,

  -- Implementation
  implementation_path TEXT,
  npm_package TEXT,
  implementation_language TEXT,
  implementation_code TEXT,

  -- Metadata
  tags TEXT[],
  capabilities TEXT[],

  -- Deprecation
  deprecated BOOLEAN NOT NULL DEFAULT false,
  deprecated_since TIMESTAMPTZ,
  deprecated_message TEXT,
  migrate_to_component_id UUID REFERENCES components(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_component_name_version UNIQUE (created_by, name, version)
);

CREATE INDEX idx_components_created_by ON components(created_by);
CREATE INDEX idx_components_component_type_id ON components(component_type_id);
CREATE INDEX idx_components_visibility_id ON components(visibility_id);
CREATE INDEX idx_components_deprecated ON components(deprecated);
```

### activities

System-registered activities.

```sql
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  function_name TEXT NOT NULL,
  module_path TEXT NOT NULL,
  package_name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  input_schema JSONB NOT NULL,
  output_schema JSONB,
  examples JSONB,
  tags TEXT[],

  -- Lifecycle
  is_active BOOLEAN NOT NULL DEFAULT true,
  deprecated BOOLEAN NOT NULL DEFAULT false,
  deprecated_since TIMESTAMPTZ,
  deprecated_message TEXT,
  migrate_to_activity_id UUID REFERENCES activities(id),

  -- Usage stats
  usage_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_activity_name UNIQUE (package_name, function_name)
);

CREATE INDEX idx_activities_package_name ON activities(package_name);
CREATE INDEX idx_activities_category ON activities(category);
```

### agent_prompts

AI agent prompt templates.

```sql
CREATE TABLE agent_prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  version TEXT NOT NULL,
  description TEXT,
  prompt_content TEXT NOT NULL,
  prompt_variables JSONB,
  recommended_models JSONB,
  capabilities TEXT[],
  tags TEXT[],
  created_by UUID NOT NULL REFERENCES users(id),
  visibility_id UUID NOT NULL REFERENCES component_visibility(id),

  -- Deprecation
  deprecated BOOLEAN NOT NULL DEFAULT false,
  deprecated_message TEXT,
  migrate_to_prompt_id UUID REFERENCES agent_prompts(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_agent_prompt_name_version UNIQUE (created_by, name, version)
);

CREATE INDEX idx_agent_prompts_created_by ON agent_prompts(created_by);
```

---

## Execution Tables

### workflow_executions

Workflow execution records.

```sql
CREATE TABLE workflow_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID NOT NULL REFERENCES workflows(id),
  created_by UUID NOT NULL REFERENCES users(id),

  -- Temporal integration
  temporal_workflow_id TEXT NOT NULL,
  temporal_run_id TEXT NOT NULL,

  -- Status
  status TEXT NOT NULL,  -- building, running, completed, failed, cancelled, timed_out

  -- Timing
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,

  -- Data
  input JSONB,
  output JSONB,
  error_message TEXT,

  -- Statistics
  activities_executed INTEGER DEFAULT 0,

  -- History sync (cache-aside pattern)
  history_sync_status TEXT,  -- pending, syncing, synced, failed
  history_synced_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX idx_workflow_executions_created_by ON workflow_executions(created_by);
CREATE INDEX idx_workflow_executions_temporal_workflow_id ON workflow_executions(temporal_workflow_id);
CREATE INDEX idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX idx_workflow_executions_started_at ON workflow_executions(started_at DESC);
```

### component_executions

Individual component/activity executions within workflow.

```sql
CREATE TABLE component_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
  component_id UUID REFERENCES components(id),
  activity_id UUID REFERENCES activities(id),

  -- Execution details
  component_name TEXT NOT NULL,
  status TEXT NOT NULL,  -- pending, running, completed, failed
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,

  -- Data
  input JSONB,
  output JSONB,
  error_message TEXT,

  -- Temporal integration
  activity_id_temporal TEXT,
  attempt_number INTEGER DEFAULT 1,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_component_executions_workflow_execution_id ON component_executions(workflow_execution_id);
CREATE INDEX idx_component_executions_component_id ON component_executions(component_id);
CREATE INDEX idx_component_executions_started_at ON component_executions(started_at);
```

### workflow_statistics

Aggregated workflow statistics (materialized view).

```sql
CREATE TABLE workflow_statistics (
  workflow_id UUID PRIMARY KEY REFERENCES workflows(id),
  total_runs INTEGER NOT NULL DEFAULT 0,
  successful_runs INTEGER NOT NULL DEFAULT 0,
  failed_runs INTEGER NOT NULL DEFAULT 0,
  avg_duration_ms INTEGER,
  min_duration_ms INTEGER,
  max_duration_ms INTEGER,
  most_used_component_id UUID,
  most_used_component_count INTEGER DEFAULT 0,
  total_errors INTEGER DEFAULT 0,
  last_error_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### project_statistics

Aggregated project statistics.

```sql
CREATE TABLE project_statistics (
  project_id UUID PRIMARY KEY REFERENCES projects(id),
  most_used_workflow_id UUID,
  most_used_workflow_count INTEGER DEFAULT 0,
  most_used_component_id UUID,
  most_used_component_count INTEGER DEFAULT 0,
  most_used_task_queue_id UUID,
  most_used_task_queue_count INTEGER DEFAULT 0,
  total_executions INTEGER DEFAULT 0,
  longest_run_duration_ms INTEGER,
  longest_run_workflow_id UUID,
  total_failures INTEGER DEFAULT 0,
  last_failure_at TIMESTAMPTZ,
  last_execution_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Worker Tables

### workflow_workers

Temporal worker instances.

```sql
CREATE TABLE workflow_workers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id TEXT NOT NULL UNIQUE,
  project_id UUID NOT NULL REFERENCES projects(id),
  task_queue_name TEXT NOT NULL,

  -- Status
  status TEXT NOT NULL,  -- starting, running, stopping, stopped, failed

  -- Runtime info
  host TEXT,
  process_id TEXT,
  metadata JSONB,

  -- Lifecycle
  started_at TIMESTAMPTZ NOT NULL,
  stopped_at TIMESTAMPTZ,
  last_heartbeat TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflow_workers_project_id ON workflow_workers(project_id);
CREATE INDEX idx_workflow_workers_status ON workflow_workers(status);
CREATE INDEX idx_workflow_workers_last_heartbeat ON workflow_workers(last_heartbeat);
```

---

## Relationships

### Entity Relationship Diagram

```
users
  ├─ projects (created_by)
  ├─ workflows (created_by)
  ├─ components (created_by)
  └─ workflow_executions (created_by)

projects
  ├─ workflows (project_id)
  ├─ task_queues (via task_queue_name)
  └─ workflow_workers (project_id)

workflows
  ├─ workflow_nodes (workflow_id)
  ├─ workflow_edges (workflow_id)
  ├─ workflow_signals (workflow_id)
  ├─ workflow_queries (workflow_id)
  ├─ workflow_work_queues (workflow_id)
  ├─ workflow_executions (workflow_id)
  └─ workflows (parent_workflow_id) -- child workflows

components
  ├─ workflow_nodes (component_id)
  └─ component_executions (component_id)

workflow_executions
  └─ component_executions (workflow_execution_id)
```

---

## Indexes

### Performance Indexes

```sql
-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_auth_user_id ON users(auth_user_id);

-- Projects
CREATE INDEX idx_projects_created_by ON projects(created_by);
CREATE INDEX idx_projects_task_queue ON projects(task_queue_name);
CREATE INDEX idx_projects_is_archived ON projects(is_archived) WHERE is_archived = false;

-- Workflows
CREATE INDEX idx_workflows_created_by ON workflows(created_by);
CREATE INDEX idx_workflows_project_id ON workflows(project_id);
CREATE INDEX idx_workflows_status_id ON workflows(status_id);
CREATE INDEX idx_workflows_temporal_workflow_id ON workflows(temporal_workflow_id);
CREATE INDEX idx_workflows_active ON workflows(status_id) WHERE is_archived = false;

-- Executions
CREATE INDEX idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX idx_workflow_executions_temporal_workflow_id ON workflow_executions(temporal_workflow_id);
CREATE INDEX idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX idx_workflow_executions_started_at ON workflow_executions(started_at DESC);

-- Workers
CREATE INDEX idx_workflow_workers_project_id ON workflow_workers(project_id);
CREATE INDEX idx_workflow_workers_status ON workflow_workers(status) WHERE status IN ('running', 'starting');
CREATE INDEX idx_workflow_workers_heartbeat ON workflow_workers(last_heartbeat) WHERE status = 'running';
```

---

## Row Level Security

### Enable RLS

```sql
-- Enable RLS on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE components ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
```

### RLS Policies

```sql
-- Users can see their own projects
CREATE POLICY projects_select_policy ON projects
  FOR SELECT
  USING (created_by = auth.uid());

-- Users can see their own workflows
CREATE POLICY workflows_select_policy ON workflows
  FOR SELECT
  USING (
    created_by = auth.uid()
    OR visibility_id IN (
      SELECT id FROM component_visibility WHERE name = 'public'
    )
  );

-- Users can only create workflows in their projects
CREATE POLICY workflows_insert_policy ON workflows
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
    )
  );

-- Users can update their own workflows
CREATE POLICY workflows_update_policy ON workflows
  FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Users can see public components or their own
CREATE POLICY components_select_policy ON components
  FOR SELECT
  USING (
    visibility_id IN (
      SELECT id FROM component_visibility WHERE name = 'public'
    )
    OR created_by = auth.uid()
  );

-- Users can see their own executions
CREATE POLICY workflow_executions_select_policy ON workflow_executions
  FOR SELECT
  USING (created_by = auth.uid());
```

---

## TypeScript Types

All database types are generated in:

**File:** `packages/workflow-builder/src/types/database.ts`

```typescript
export type Database = {
  public: {
    Tables: {
      workflows: {
        Row: {
          id: string;
          kebab_name: string;
          display_name: string;
          description: string | null;
          created_by: string;
          project_id: string | null;
          status_id: string;
          // ... all columns
        };
        Insert: {
          kebab_name: string;
          display_name: string;
          created_by: string;
          // ... required for insert
        };
        Update: {
          display_name?: string;
          description?: string;
          // ... optional for update
        };
      };
      // ... other tables
    };
  };
};

// Usage with Supabase client
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types/database';

const supabase = createClient<Database>(url, key);

// Type-safe queries
const { data } = await supabase
  .from('workflows')
  .select('*')
  .eq('id', workflowId)
  .single();

// data is typed as Database['public']['Tables']['workflows']['Row']
```

---

## Migrations

### Running Migrations

```bash
# Generate new migration
supabase migration new my_migration_name

# Apply migrations
supabase db push

# Reset database (dev only)
supabase db reset
```

### Example Migration

**File:** `supabase/migrations/20240101000000_add_workflow_archiving.sql`

```sql
-- Add is_archived column to workflows
ALTER TABLE workflows
ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT false;

-- Add index for active workflows
CREATE INDEX idx_workflows_is_archived
  ON workflows(is_archived)
  WHERE is_archived = false;

-- Update RLS policies
DROP POLICY IF EXISTS workflows_select_policy ON workflows;

CREATE POLICY workflows_select_policy ON workflows
  FOR SELECT
  USING (
    (created_by = auth.uid() AND is_archived = false)
    OR visibility_id IN (
      SELECT id FROM component_visibility WHERE name = 'public'
    )
  );
```

---

## Next Steps

- [API Reference](../api/reference.md) - Using the database via tRPC
- [Compiler Architecture](../architecture/compiler.md) - How definitions are stored
- [Worker Registration](../architecture/worker-registration.md) - Worker database tables
- [Extension Guide](../development/extension-guide.md) - Adding new tables/types
