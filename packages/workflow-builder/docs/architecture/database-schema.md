# Database Schema

Complete database schema documentation for the Workflow Builder system.

## Design Principles

### 1. No PostgreSQL Enums

All enums are replaced with lookup tables + foreign keys for flexibility:
- `component_types` instead of enum
- `workflow_statuses` instead of enum
- `component_visibility` instead of enum

**Benefits**:
- Can add new types without migrations
- Supports metadata (icons, descriptions, colors)
- Easier to query and filter
- Better for RLS policies

### 2. Row-Level Security (RLS)

All tables have RLS enabled to ensure multi-tenant isolation:
- Users can only see their own private resources
- Public resources visible to all authenticated users
- Organization resources visible to organization members

### 3. Denormalization for Performance

Workflow nodes and edges are stored in separate tables:
- `workflow_nodes` - Denormalized node data
- `workflow_edges` - Denormalized edge data

**Benefits**:
- Faster queries (no JSON parsing)
- Easier to query and filter
- Better for RLS policies
- Supports efficient graph operations

### 4. JSONB for Flexible Schemas

Flexible data stored as JSONB:
- `definition` in `workflows` - Complete workflow JSON
- `config` in `workflow_nodes` - Node configuration
- `config_schema` in `components` - Component schema

## Core Tables

### User Management

#### `user_roles`
User role definitions (admin, developer, viewer).

**Columns**:
- `id` (UUID, PK)
- `name` (VARCHAR(50), UNIQUE) - Role name
- `description` (TEXT)
- `permissions` (JSONB) - Role permissions
- `created_at` (TIMESTAMPTZ)

#### `users`
User accounts linked to Supabase Auth.

**Columns**:
- `id` (UUID, PK)
- `auth_user_id` (UUID, UNIQUE, FK → auth.users)
- `email` (VARCHAR(255), UNIQUE)
- `display_name` (VARCHAR(100))
- `role_id` (UUID, FK → user_roles)
- `created_at`, `updated_at`, `last_login_at` (TIMESTAMPTZ)

**Indexes**: `auth_user_id`, `role_id`

### Component Registry

#### `component_types`
Component type definitions (activity, agent, signal, trigger).

**Columns**:
- `id` (UUID, PK)
- `name` (VARCHAR(50), UNIQUE) - Type name
- `description` (TEXT)
- `icon` (VARCHAR(50))
- `created_at` (TIMESTAMPTZ)

**Seed Data**: activity, agent, signal, trigger

#### `component_visibility`
Visibility levels (public, private, organization).

**Columns**:
- `id` (UUID, PK)
- `name` (VARCHAR(50), UNIQUE)
- `description` (TEXT)

**Seed Data**: public, private, organization

#### `components`
Reusable workflow components.

**Columns**:
- `id` (UUID, PK)
- `name` (VARCHAR(255)) - Component identifier
- `display_name` (VARCHAR(255))
- `description` (TEXT)
- `component_type_id` (UUID, FK → component_types)
- `version` (VARCHAR(50))
- `created_by` (UUID, FK → users)
- `visibility_id` (UUID, FK → component_visibility)
- `config_schema` (JSONB) - Configuration schema
- `input_schema` (JSONB) - Input schema
- `output_schema` (JSONB) - Output schema
- `tags` (TEXT[]) - Component tags
- `capabilities` (TEXT[]) - Component capabilities
- `agent_prompt_id` (UUID, FK → agent_prompts, optional)
- `model_provider`, `model_name` (VARCHAR) - For agent components
- `implementation_path`, `npm_package` (VARCHAR) - Implementation reference
- `deprecated` (BOOLEAN) - Deprecation flag
- `created_at`, `updated_at` (TIMESTAMPTZ)

**Indexes**: `component_type_id`, `created_by`, `visibility_id`, `tags` (GIN), `capabilities` (GIN), `name+version`

**Unique Constraint**: `(name, version, created_by)`

#### `agent_prompts`
AI agent prompt templates.

**Columns**:
- `id` (UUID, PK)
- `name` (VARCHAR(255))
- `display_name` (VARCHAR(255))
- `description` (TEXT)
- `version` (VARCHAR(50))
- `prompt_content` (TEXT) - Markdown prompt
- `prompt_variables` (JSONB) - Variable definitions
- `created_by` (UUID, FK → users)
- `visibility_id` (UUID, FK → component_visibility)
- `capabilities` (TEXT[])
- `tags` (TEXT[])
- `recommended_models` (JSONB)
- `deprecated` (BOOLEAN)
- `created_at`, `updated_at` (TIMESTAMPTZ)

**Indexes**: `created_by`, `visibility_id`, `capabilities` (GIN)

**Unique Constraint**: `(name, version, created_by)`

### Task Queues

#### `task_queues`
Temporal task queue configuration.

**Columns**:
- `id` (UUID, PK)
- `name` (VARCHAR(255), UNIQUE)
- `description` (TEXT)
- `display_name` (VARCHAR(255)) - User-friendly name
- `max_concurrent_workflows` (INTEGER, default 100)
- `max_concurrent_activities` (INTEGER, default 1000)
- `created_by` (UUID, FK → users)
- `is_system_queue` (BOOLEAN, default false)
- `created_at`, `updated_at` (TIMESTAMPTZ)

**Indexes**: `created_by`

### Workflows

#### `workflow_statuses`
Workflow status definitions (draft, active, paused, archived).

**Columns**:
- `id` (UUID, PK)
- `name` (VARCHAR(50), UNIQUE)
- `description` (TEXT)
- `color` (VARCHAR(7)) - Hex color for UI

**Seed Data**: draft, active, paused, archived

#### `workflows`
Workflow definitions.

**Columns**:
- `id` (UUID, PK)
- `name` (VARCHAR(255)) - Workflow identifier
- `display_name` (VARCHAR(255))
- `description` (TEXT)
- `kebab_name` (VARCHAR(255), UNIQUE) - Immutable kebab-case name
- `created_by` (UUID, FK → users)
- `visibility_id` (UUID, FK → component_visibility)
- `status_id` (UUID, FK → workflow_statuses)
- `project_id` (UUID, FK → projects, nullable)
- `task_queue_id` (UUID, FK → task_queues)
- `version` (VARCHAR(50), default '1.0.0')
- `definition` (JSONB) - Complete workflow JSON
- `compiled_typescript` (TEXT, nullable) - Legacy compiled code
- `temporal_workflow_id` (VARCHAR(255), nullable)
- `temporal_workflow_type` (VARCHAR(255), nullable)
- `max_concurrent_executions` (INTEGER, default 10)
- `execution_timeout_seconds` (INTEGER, default 3600)
- `created_at`, `updated_at`, `deployed_at` (TIMESTAMPTZ)

**Indexes**: `created_by`, `status_id`, `task_queue_id`, `temporal_workflow_id`, `project_id`, `kebab_name`

**Unique Constraint**: `(name, version, created_by)`, `kebab_name`

**Note**: `kebab_name` is immutable after creation (enforced by trigger).

#### `workflow_nodes`
Denormalized workflow nodes for efficient querying.

**Columns**:
- `id` (UUID, PK)
- `workflow_id` (UUID, FK → workflows, CASCADE)
- `node_id` (VARCHAR(255)) - Node identifier in workflow
- `node_type` (VARCHAR(50)) - Node type
- `component_id` (UUID, FK → components, nullable)
- `config` (JSONB, default '{}') - Node configuration
- `position` (JSONB) - Canvas position {x, y}
- `created_at` (TIMESTAMPTZ)

**Indexes**: `workflow_id`, `component_id`

**Unique Constraint**: `(workflow_id, node_id)`

#### `workflow_edges`
Denormalized workflow edges for efficient querying.

**Columns**:
- `id` (UUID, PK)
- `workflow_id` (UUID, FK → workflows, CASCADE)
- `edge_id` (VARCHAR(255)) - Edge identifier
- `source_node_id` (VARCHAR(255)) - Source node
- `target_node_id` (VARCHAR(255)) - Target node
- `label` (VARCHAR(255), nullable)
- `config` (JSONB, default '{}')
- `created_at` (TIMESTAMPTZ)

**Indexes**: `workflow_id`

**Unique Constraint**: `(workflow_id, edge_id)`

### Projects (Phase 2)

#### `projects`
User projects for organizing workflows.

**Columns**:
- `id` (UUID, PK)
- `name` (VARCHAR(255))
- `description` (TEXT)
- `created_by` (UUID, FK → users, CASCADE)
- `task_queue_name` (VARCHAR(255), UNIQUE) - Generated: user_id-project_id
- `is_active` (BOOLEAN, default true)
- `total_workflow_executions` (BIGINT, default 0)
- `total_activity_executions` (BIGINT, default 0)
- `avg_execution_duration_ms` (INTEGER, default 0)
- `last_execution_at` (TIMESTAMPTZ, nullable)
- `created_at`, `updated_at` (TIMESTAMPTZ)

**Indexes**: `task_queue_name`, `created_by`, `is_active`

**Unique Constraint**: `(created_by, name)`

### Compiled Code (Phase 2)

#### `workflow_compiled_code`
Stored compiled workflow code.

**Columns**:
- `id` (UUID, PK)
- `workflow_id` (UUID, FK → workflows, CASCADE)
- `version` (VARCHAR(50))
- `workflow_code` (TEXT) - Main workflow code
- `activities_code` (TEXT) - Activities code
- `worker_code` (TEXT) - Worker setup code
- `package_json` (TEXT) - Package.json
- `tsconfig_json` (TEXT) - TypeScript config
- `compiled_at` (TIMESTAMPTZ)
- `compiled_by` (UUID, FK → users, nullable)
- `is_active` (BOOLEAN, default true)
- `execution_count` (BIGINT, default 0)
- `avg_execution_duration_ms` (INTEGER, default 0)
- `last_executed_at` (TIMESTAMPTZ, nullable)

**Indexes**: `workflow_id`, `is_active`, `compiled_at`

#### `workflow_workers`
Worker registry and status tracking.

**Columns**:
- `id` (UUID, PK)
- `project_id` (UUID, FK → projects, CASCADE)
- `worker_id` (VARCHAR(255), UNIQUE) - Temporal worker ID
- `task_queue_name` (VARCHAR(255))
- `status` (VARCHAR(50)) - running, stopped, error
- `last_heartbeat_at` (TIMESTAMPTZ)
- `started_at` (TIMESTAMPTZ)
- `stopped_at` (TIMESTAMPTZ, nullable)
- `error_message` (TEXT, nullable)
- `created_at`, `updated_at` (TIMESTAMPTZ)

**Indexes**: `project_id`, `worker_id`, `status`, `last_heartbeat_at`

**Unique Constraint**: `worker_id`

### Execution Tracking

#### `workflow_executions`
Workflow execution history.

**Columns**:
- `id` (UUID, PK)
- `workflow_id` (UUID, FK → workflows)
- `temporal_run_id` (VARCHAR(255), UNIQUE)
- `temporal_workflow_id` (VARCHAR(255))
- `status` (VARCHAR(50)) - running, completed, failed, canceled
- `inputs` (JSONB) - Execution inputs
- `outputs` (JSONB, nullable) - Execution outputs
- `error` (TEXT, nullable) - Error message if failed
- `started_at` (TIMESTAMPTZ)
- `completed_at` (TIMESTAMPTZ, nullable)
- `duration_ms` (INTEGER, nullable)

**Indexes**: `workflow_id`, `temporal_run_id`, `status`, `started_at`

#### `activity_statistics`
Activity performance metrics.

**Columns**:
- `id` (UUID, PK)
- `component_id` (UUID, FK → components)
- `workflow_id` (UUID, FK → workflows, nullable)
- `execution_count` (BIGINT, default 0)
- `success_count` (BIGINT, default 0)
- `failure_count` (BIGINT, default 0)
- `avg_duration_ms` (INTEGER, default 0)
- `min_duration_ms` (INTEGER, nullable)
- `max_duration_ms` (INTEGER, nullable)
- `last_executed_at` (TIMESTAMPTZ, nullable)
- `updated_at` (TIMESTAMPTZ)

**Indexes**: `component_id`, `workflow_id`, `last_executed_at`

**Unique Constraint**: `(component_id, workflow_id)` (workflow_id can be NULL for global stats)

### Advanced Patterns

#### `workflow_work_queues`
Work queues for batch processing.

**Columns**:
- `id` (UUID, PK)
- `workflow_id` (UUID, FK → workflows, CASCADE)
- `queue_name` (VARCHAR(100))
- `description` (TEXT)
- `signal_name` (VARCHAR(100)) - Auto-generated signal
- `query_name` (VARCHAR(100)) - Auto-generated query
- `max_size` (INTEGER, nullable) - NULL = unlimited
- `priority` (VARCHAR(20)) - fifo, lifo, priority
- `deduplicate` (BOOLEAN, default false)
- `work_item_schema` (JSONB) - Work item schema
- `created_by` (UUID, FK → users)
- `created_at`, `updated_at` (TIMESTAMPTZ)

**Indexes**: `workflow_id`, `priority`

**Unique Constraints**: `(workflow_id, queue_name)`, `(workflow_id, signal_name)`, `(workflow_id, query_name)`

#### `workflow_signals`
Signal handlers for workflow communication.

**Columns**:
- `id` (UUID, PK)
- `workflow_id` (UUID, FK → workflows, CASCADE)
- `signal_name` (VARCHAR(100))
- `description` (TEXT)
- `parameters` (JSONB) - Signal parameter schema
- `auto_generated` (BOOLEAN, default false)
- `work_queue_id` (UUID, FK → workflow_work_queues, nullable)
- `created_by` (UUID, FK → users)
- `created_at`, `updated_at` (TIMESTAMPTZ)

**Indexes**: `workflow_id`, `auto_generated`, `work_queue_id`

**Unique Constraint**: `(workflow_id, signal_name)`

#### `workflow_queries`
Query handlers for read-only state inspection.

**Columns**:
- `id` (UUID, PK)
- `workflow_id` (UUID, FK → workflows, CASCADE)
- `query_name` (VARCHAR(100))
- `description` (TEXT)
- `return_type` (JSONB) - Return type schema
- `auto_generated` (BOOLEAN, default false)
- `work_queue_id` (UUID, FK → workflow_work_queues, nullable)
- `created_by` (UUID, FK → users)
- `created_at`, `updated_at` (TIMESTAMPTZ)

**Indexes**: `workflow_id`, `auto_generated`, `work_queue_id`

**Unique Constraint**: `(workflow_id, query_name)`

#### `workflow_scheduled_workflows`
Scheduled workflows (cron).

**Columns**:
- `id` (UUID, PK)
- `workflow_id` (UUID, FK → workflows, CASCADE)
- `cron_expression` (VARCHAR(100))
- `timezone` (VARCHAR(50), default 'UTC')
- `start_immediately` (BOOLEAN, default false)
- `max_runs` (INTEGER, nullable) - NULL = unlimited
- `work_queue_id` (UUID, FK → workflow_work_queues, nullable)
- `created_by` (UUID, FK → users)
- `created_at`, `updated_at` (TIMESTAMPTZ)

**Indexes**: `workflow_id`, `work_queue_id`

#### `workflow_child_workflows`
Child workflow definitions.

**Columns**:
- `id` (UUID, PK)
- `parent_workflow_id` (UUID, FK → workflows, CASCADE)
- `child_workflow_id` (UUID, FK → workflows)
- `child_workflow_name` (VARCHAR(255)) - Workflow name to start
- `parent_close_policy` (VARCHAR(50)) - terminate, abandon, request_cancel
- `can_signal_parent` (BOOLEAN, default false)
- `can_query_parent` (BOOLEAN, default false)
- `block_until` (JSONB, nullable) - Dependency configuration
- `created_by` (UUID, FK → users)
- `created_at`, `updated_at` (TIMESTAMPTZ)

**Indexes**: `parent_workflow_id`, `child_workflow_id`

## Relationships

### User → Projects → Workflows
```
users (1) ──→ (N) projects
projects (1) ──→ (N) workflows
```

### Workflows → Components
```
workflows (N) ──→ (N) components (via workflow_nodes.component_id)
```

### Workflows → Compiled Code
```
workflows (1) ──→ (N) workflow_compiled_code
```

### Projects → Workers
```
projects (1) ──→ (1) workflow_workers
```

## Indexes

All foreign keys are indexed for performance. Additional indexes:
- GIN indexes on array columns (`tags`, `capabilities`)
- Composite indexes on frequently queried columns
- Partial indexes for filtered queries (`is_active`)

## Row-Level Security

All tables have RLS enabled with policies:
- **SELECT**: Users can see their own resources + public resources
- **INSERT**: Users can create resources they own
- **UPDATE**: Users can update their own resources
- **DELETE**: Users can delete their own resources

## Migrations

Migrations are stored in `supabase/migrations/` and applied sequentially:
- `20251114000001_initial_schema.sql` - Core schema
- `20251116000001_add_advanced_workflow_patterns.sql` - Advanced patterns
- `20251117000001_phase2_temporal_integration.sql` - Phase 2 features

## Related Documentation

- [System Design](system-design.md) - Architecture overview
- [Temporal Integration](temporal-integration.md) - Workflow execution
- [Development Guide](../development/database-migrations.md) - Creating migrations

