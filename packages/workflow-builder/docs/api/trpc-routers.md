# tRPC Routers

Complete reference for all tRPC API endpoints.

## Overview

All API endpoints are organized into routers. Access via `trpc.routerName.procedureName`.

## Routers

### Users Router (`users`)

User management and authentication.

#### `users.me`
Get current user information.

**Input**: None  
**Returns**: User object with role

#### `users.updateMe`
Update current user profile.

**Input**:
```typescript
{
  displayName?: string;
  email?: string;
}
```

**Returns**: Updated user object

#### `users.listRoles`
List available user roles.

**Input**: None  
**Returns**: Array of role objects

### Components Router (`components`)

Component CRUD operations.

#### `components.list`
List components with filters.

**Input**:
```typescript
{
  type?: string;
  capability?: string;
  tags?: string[];
  includeDeprecated?: boolean;
  page?: number;
  pageSize?: number;
}
```

**Returns**: Paginated component list

#### `components.get`
Get component by ID.

**Input**:
```typescript
{
  id: string;
}
```

**Returns**: Component object with relations

#### `components.create`
Create new component.

**Input**:
```typescript
{
  name: string;
  displayName: string;
  description?: string;
  componentTypeId: string;
  version: string;
  visibilityId: string;
  configSchema?: JSONB;
  inputSchema?: JSONB;
  outputSchema?: JSONB;
  tags?: string[];
  capabilities?: string[];
  agentPromptId?: string;
}
```

**Returns**: Created component

#### `components.update`
Update existing component.

**Input**:
```typescript
{
  id: string;
  displayName?: string;
  description?: string;
  // ... other fields
}
```

**Returns**: Updated component

#### `components.delete`
Delete component (with validation).

**Input**:
```typescript
{
  id: string;
}
```

**Returns**: Success confirmation

#### `components.getTypes`
List component types.

**Input**: None  
**Returns**: Array of component type objects

### Workflows Router (`workflows`)

Workflow CRUD and deployment.

#### `workflows.list`
List workflows with filters.

**Input**:
```typescript
{
  status?: string;
  page?: number;
  pageSize?: number;
}
```

**Returns**: Paginated workflow list

#### `workflows.get`
Get workflow by ID with nodes/edges.

**Input**:
```typescript
{
  id: string;
}
```

**Returns**: Workflow object with nodes and edges

#### `workflows.create`
Create new workflow.

**Input**:
```typescript
{
  name: string;
  displayName: string;
  description?: string;
  taskQueueId: string;
  visibilityId: string;
  projectId?: string;
  definition: JSONB;
}
```

**Returns**: Created workflow

#### `workflows.update`
Update workflow definition.

**Input**:
```typescript
{
  id: string;
  displayName?: string;
  description?: string;
  definition?: JSONB;
}
```

**Returns**: Updated workflow

#### `workflows.deploy`
Deploy workflow (change to active).

**Input**:
```typescript
{
  id: string;
}
```

**Returns**: Updated workflow

#### `workflows.pause`
Pause active workflow.

**Input**:
```typescript
{
  id: string;
}
```

**Returns**: Updated workflow

#### `workflows.delete`
Delete workflow (with validation).

**Input**:
```typescript
{
  id: string;
}
```

**Returns**: Success confirmation

#### `workflows.getStatuses`
List workflow statuses.

**Input**: None  
**Returns**: Array of status objects

### Projects Router (`projects`)

Project management.

#### `projects.list`
List user's projects.

**Input**: None  
**Returns**: Array of project objects with workflow counts

#### `projects.get`
Get project details with workers.

**Input**:
```typescript
{
  id: string;
}
```

**Returns**: Project object with worker status

#### `projects.create`
Create new project.

**Input**:
```typescript
{
  name: string;
  description?: string;
}
```

**Returns**: Created project with auto-generated task queue

#### `projects.update`
Update project metadata.

**Input**:
```typescript
{
  id: string;
  name?: string;
  description?: string;
}
```

**Returns**: Updated project

#### `projects.delete`
Delete project (checks for running workers).

**Input**:
```typescript
{
  id: string;
}
```

**Returns**: Success confirmation

#### `projects.stats`
Get project performance metrics.

**Input**:
```typescript
{
  id: string;
}
```

**Returns**: Statistics object

### Compiler Router (`compiler`)

Workflow compilation.

#### `compiler.compile`
Compile workflow to TypeScript.

**Input**:
```typescript
{
  workflowId: string;
}
```

**Returns**: Compilation result with code

### Execution Router (`execution`)

Workflow execution.

#### `execution.start`
Start workflow execution.

**Input**:
```typescript
{
  workflowId: string;
  inputs?: JSONB;
}
```

**Returns**: Execution object with Temporal IDs

#### `execution.getStatus`
Get execution status.

**Input**:
```typescript
{
  executionId: string;
}
```

**Returns**: Execution status object

### Agent Prompts Router (`agentPrompts`)

Agent prompt management.

#### `agentPrompts.list`
List agent prompts with filters.

**Input**:
```typescript
{
  capability?: string;
  tags?: string[];
  page?: number;
  pageSize?: number;
}
```

**Returns**: Paginated prompt list

#### `agentPrompts.get`
Get prompt by ID.

**Input**:
```typescript
{
  id: string;
}
```

**Returns**: Prompt object

#### `agentPrompts.create`
Create new prompt.

**Input**:
```typescript
{
  name: string;
  displayName: string;
  description?: string;
  version: string;
  promptContent: string;
  visibilityId: string;
  capabilities?: string[];
  tags?: string[];
}
```

**Returns**: Created prompt

#### `agentPrompts.update`
Update existing prompt.

**Input**:
```typescript
{
  id: string;
  displayName?: string;
  description?: string;
  promptContent?: string;
  // ... other fields
}
```

**Returns**: Updated prompt

#### `agentPrompts.delete`
Delete prompt (with validation).

**Input**:
```typescript
{
  id: string;
}
```

**Returns**: Success confirmation

### Task Queues Router (`taskQueues`)

Task queue management.

#### `taskQueues.list`
List all task queues.

**Input**: None  
**Returns**: Array of task queue objects

#### `taskQueues.get`
Get task queue by ID.

**Input**:
```typescript
{
  id: string;
}
```

**Returns**: Task queue object

#### `taskQueues.create`
Create new task queue.

**Input**:
```typescript
{
  name: string;
  description?: string;
  displayName?: string;
  maxConcurrentWorkflows?: number;
  maxConcurrentActivities?: number;
}
```

**Returns**: Created task queue

## Error Codes

- `UNAUTHORIZED` - Not authenticated
- `FORBIDDEN` - Not authorized
- `NOT_FOUND` - Resource not found
- `BAD_REQUEST` - Invalid input
- `INTERNAL_SERVER_ERROR` - Server error

## Related Documentation

- [Database Types](database-types.md) - Type definitions
- [Workflow Definition Format](workflow-definition-format.md) - JSON structure

