# Database Types

TypeScript type definitions for database entities.

## Overview

Types are generated from Supabase schema using `yarn gen:types`. Types are located in `src/types/database.ts`.

## Core Types

### User Types

```typescript
interface User {
  id: string;
  auth_user_id: string;
  email: string;
  display_name: string | null;
  role_id: string;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

interface UserRole {
  id: string;
  name: string;
  description: string | null;
  permissions: Record<string, any>;
  created_at: string;
}
```

### Component Types

```typescript
interface Component {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  component_type_id: string;
  version: string;
  created_by: string;
  visibility_id: string;
  config_schema: Record<string, any> | null;
  input_schema: Record<string, any> | null;
  output_schema: Record<string, any> | null;
  tags: string[] | null;
  capabilities: string[] | null;
  agent_prompt_id: string | null;
  model_provider: string | null;
  model_name: string | null;
  implementation_path: string | null;
  npm_package: string | null;
  deprecated: boolean;
  created_at: string;
  updated_at: string;
}

interface ComponentType {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  created_at: string;
}
```

### Workflow Types

```typescript
interface Workflow {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  kebab_name: string;
  created_by: string;
  visibility_id: string;
  status_id: string;
  project_id: string | null;
  task_queue_id: string;
  version: string;
  definition: Record<string, any>;
  compiled_typescript: string | null;
  temporal_workflow_id: string | null;
  temporal_workflow_type: string | null;
  max_concurrent_executions: number;
  execution_timeout_seconds: number;
  created_at: string;
  updated_at: string;
  deployed_at: string | null;
}

interface WorkflowNode {
  id: string;
  workflow_id: string;
  node_id: string;
  node_type: string;
  component_id: string | null;
  config: Record<string, any>;
  position: { x: number; y: number };
  created_at: string;
}

interface WorkflowEdge {
  id: string;
  workflow_id: string;
  edge_id: string;
  source_node_id: string;
  target_node_id: string;
  label: string | null;
  config: Record<string, any>;
  created_at: string;
}
```

### Project Types

```typescript
interface Project {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  task_queue_name: string;
  is_active: boolean;
  total_workflow_executions: number;
  total_activity_executions: number;
  avg_execution_duration_ms: number;
  last_execution_at: string | null;
  created_at: string;
  updated_at: string;
}
```

## Workflow Types

Additional workflow-specific types in `src/types/workflow.ts`:

```typescript
interface WorkflowNode {
  id: string;
  type: 'activity' | 'agent' | 'signal' | 'trigger' | 'condition' | 'end';
  position: { x: number; y: number };
  data: {
    label: string;
    componentId?: string;
    componentName?: string;
    config?: Record<string, any>;
  };
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  type?: string;
}

interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  metadata?: {
    timeout?: string;
    retryPolicy?: Record<string, any>;
    description?: string;
  };
}
```

## Advanced Pattern Types

Types for advanced patterns in `src/types/advanced-patterns.ts`:

```typescript
interface TemporalWorkflow {
  id: string;
  name: string;
  kebab_name: string;
  display_name: string;
  stages: WorkflowStage[];
  // ... other fields
}

interface WorkflowStage {
  id: string;
  type: 'activity' | 'agent' | 'signal' | 'query' | 'scheduled-workflow' | 'child-workflow' | 'work-queue';
  // ... configuration
}
```

## Type Generation

Types are generated from Supabase schema:

```bash
yarn gen:types
```

This generates `src/types/database.ts` from the current database schema.

## Related Documentation

- [Database Schema](../architecture/database-schema.md) - Schema structure
- [Workflow Definition Format](workflow-definition-format.md) - JSON structure

