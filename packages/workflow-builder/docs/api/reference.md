# API Reference

Complete reference for all tRPC API endpoints in the Workflow Builder system.

## Table of Contents

- [Authentication](#authentication)
- [Workflows API](#workflows-api)
- [Compiler API](#compiler-api)
- [Execution API](#execution-api)
- [Projects API](#projects-api)
- [Components API](#components-api)
- [Activities API](#activities-api)
- [Work Queues API](#work-queues-api)
- [Signals & Queries API](#signals--queries-api)
- [Deployment API](#deployment-api)

---

## Authentication

All API endpoints require authentication via session cookie or API key. The system uses Supabase Auth for user management.

### Authentication Flow

1. User authenticates via Supabase Auth
2. Session cookie is set automatically
3. All tRPC procedures verify the session via middleware
4. User context is available in `ctx.user`

### Protected Procedures

All endpoints documented below use `protectedProcedure`, which ensures:
- Valid session exists
- User is authenticated
- User context is populated

---

## Workflows API

Endpoints for managing workflow definitions and lifecycle.

### `workflows.list`

List all workflows for the current user.

**Type:** Query

**Input:**
```typescript
{
  status?: string;          // Filter by status name
  page?: number;            // Default: 1
  pageSize?: number;        // Default: 20
}
```

**Output:**
```typescript
{
  workflows: Workflow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
```

**Example:**
```typescript
const { workflows, total } = await trpc.workflows.list.query({
  status: 'active',
  page: 1,
  pageSize: 20
});
```

**cURL Example:**
```bash
curl -X POST https://your-domain.com/api/trpc/workflows.list \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-access-token=YOUR_TOKEN" \
  -d '{"status":"active","page":1,"pageSize":20}'
```

---

### `workflows.get`

Get a single workflow by ID with full details.

**Type:** Query

**Input:**
```typescript
{
  id: string;  // UUID
}
```

**Output:**
```typescript
{
  workflow: {
    id: string;
    kebab_name: string;
    display_name: string;
    description: string | null;
    status: {
      id: string;
      name: string;
      color: string;
    };
    task_queue: {
      id: string;
      name: string;
    };
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    created_at: string;
    updated_at: string;
    // ... additional fields
  }
}
```

**Example:**
```typescript
const { workflow } = await trpc.workflows.get.query({
  id: 'workflow-uuid-here'
});
```

**cURL Example:**
```bash
curl -X POST https://your-domain.com/api/trpc/workflows.get \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-access-token=YOUR_TOKEN" \
  -d '{"id":"workflow-uuid-here"}'
```

---

### `workflows.create`

Create a new workflow.

**Type:** Mutation

**Input:**
```typescript
{
  kebabName: string;        // lowercase-with-hyphens, unique per user
  displayName: string;      // Human-readable name
  description?: string;
  visibility: 'public' | 'private' | 'organization';
  projectId: string;        // UUID
  taskQueueId?: string;     // Optional, will lookup from project if not provided
  definition?: {            // React Flow JSON
    nodes: any[];
    edges: any[];
  };
}
```

**Output:**
```typescript
{
  id: string;
  kebab_name: string;
  display_name: string;
  status_id: string;
  created_at: string;
  // ... full workflow object
}
```

**Example:**
```typescript
const workflow = await trpc.workflows.create.mutate({
  kebabName: 'email-processor',
  displayName: 'Email Processor',
  description: 'Processes incoming emails',
  visibility: 'private',
  projectId: 'project-uuid',
  definition: {
    nodes: [],
    edges: []
  }
});
```

**cURL Example:**
```bash
curl -X POST https://your-domain.com/api/trpc/workflows.create \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-access-token=YOUR_TOKEN" \
  -d '{
    "kebabName": "email-processor",
    "displayName": "Email Processor",
    "visibility": "private",
    "projectId": "project-uuid-here"
  }'
```

---

### `workflows.update`

Update an existing workflow.

**Type:** Mutation

**Input:**
```typescript
{
  id: string;               // UUID
  displayName?: string;
  description?: string;
  definition?: any;         // React Flow JSON
  taskQueueId?: string;
}
```

**Output:**
```typescript
Workflow  // Updated workflow object
```

**Example:**
```typescript
const updated = await trpc.workflows.update.mutate({
  id: 'workflow-uuid',
  displayName: 'Updated Name',
  definition: {
    nodes: [...],
    edges: [...]
  }
});
```

---

### `workflows.deploy`

Deploy a workflow (sets status to 'active' and registers API endpoints).

**Type:** Mutation

**Input:**
```typescript
{
  id: string;  // UUID
}
```

**Output:**
```typescript
{
  id: string;
  status_id: string;
  temporal_workflow_id: string;
  temporal_workflow_type: string;
  deployed_at: string;
  endpoints: Array<{
    id: string;
    endpoint_path: string;
    method: string;
    // ... endpoint details
  }>;
}
```

**Example:**
```typescript
const result = await trpc.workflows.deploy.mutate({
  id: 'workflow-uuid'
});

console.log(`Deployed with ${result.endpoints.length} API endpoints`);
```

**cURL Example:**
```bash
curl -X POST https://your-domain.com/api/trpc/workflows.deploy \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-access-token=YOUR_TOKEN" \
  -d '{"id":"workflow-uuid-here"}'
```

---

### `workflows.pause`

Pause a workflow (sets status to 'paused').

**Type:** Mutation

**Input:**
```typescript
{
  id: string;  // UUID
}
```

**Output:**
```typescript
Workflow  // Updated workflow with paused status
```

---

### `workflows.archive`

Archive a workflow (soft delete).

**Type:** Mutation

**Input:**
```typescript
{
  id: string;  // UUID
}
```

**Output:**
```typescript
{
  success: boolean;
}
```

**Example:**
```typescript
await trpc.workflows.archive.mutate({ id: 'workflow-uuid' });
```

---

### `workflows.unarchive`

Restore an archived workflow.

**Type:** Mutation

**Input:**
```typescript
{
  id: string;  // UUID
}
```

**Output:**
```typescript
{
  success: boolean;
}
```

---

### `workflows.getStatuses`

Get all available workflow statuses (for dropdowns).

**Type:** Query

**Input:** None

**Output:**
```typescript
Array<{
  id: string;
  name: string;
  color: string;
  description: string;
}>
```

**Example:**
```typescript
const statuses = await trpc.workflows.getStatuses.query();
// [{ name: 'draft', color: '#gray' }, { name: 'active', color: '#green' }, ...]
```

---

## Compiler API

Endpoints for compiling workflow definitions into TypeScript code.

### `compiler.compile`

Compile a workflow by ID and optionally save to database.

**Type:** Mutation

**Input:**
```typescript
{
  workflowId: string;
  includeComments?: boolean;      // Default: true
  strictMode?: boolean;           // Default: true
  optimizationLevel?: 'none' | 'basic' | 'aggressive';  // Default: 'basic'
  saveToDatabase?: boolean;       // Default: true
}
```

**Output:**
```typescript
{
  success: boolean;
  workflowCode?: string;          // Generated workflow TypeScript
  activitiesCode?: string;        // Generated activities file
  workerCode?: string;            // Generated worker file
  packageJson?: string;           // Generated package.json
  tsConfig?: string;              // Generated tsconfig.json
  errors: CompilerError[];
  warnings: CompilerWarning[];
  metadata: {
    nodeCount: number;
    edgeCount: number;
    patternsApplied: string[];
    compilationTime: number;
    version: string;
  };
}
```

**Example:**
```typescript
const result = await trpc.compiler.compile.mutate({
  workflowId: 'workflow-uuid',
  includeComments: true,
  strictMode: true,
  optimizationLevel: 'basic',
  saveToDatabase: true
});

if (result.success) {
  console.log('Compiled successfully!');
  console.log(result.workflowCode);
} else {
  console.error('Compilation failed:', result.errors);
}
```

**cURL Example:**
```bash
curl -X POST https://your-domain.com/api/trpc/compiler.compile \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-access-token=YOUR_TOKEN" \
  -d '{
    "workflowId": "workflow-uuid-here",
    "includeComments": true,
    "strictMode": true,
    "saveToDatabase": true
  }'
```

---

### `compiler.compileDefinition`

Compile a workflow definition directly without saving to database.

**Type:** Mutation

**Input:**
```typescript
{
  workflow: {
    id: string;
    name: string;
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    variables?: WorkflowVariable[];
    settings?: WorkflowSettings;
  };
  includeComments?: boolean;
  strictMode?: boolean;
  optimizationLevel?: 'none' | 'basic' | 'aggressive';
}
```

**Output:**
```typescript
{
  success: boolean;
  workflowCode?: string;
  activitiesCode?: string;
  workerCode?: string;
  packageJson?: string;
  tsConfig?: string;
  errors: CompilerError[];
  warnings: CompilerWarning[];
  metadata: CompilerMetadata;
}
```

**Example:**
```typescript
const result = await trpc.compiler.compileDefinition.mutate({
  workflow: {
    id: 'temp-id',
    name: 'test-workflow',
    nodes: [
      {
        id: 'start',
        type: 'trigger',
        data: { label: 'Start' },
        position: { x: 0, y: 0 }
      }
    ],
    edges: [],
    variables: []
  },
  includeComments: true
});
```

---

### `compiler.validate`

Validate a workflow without compiling.

**Type:** Mutation

**Input:**
```typescript
{
  workflowId?: string;      // Validate from database
  workflow?: WorkflowDefinition;  // Or validate definition directly
}
```

**Output:**
```typescript
{
  valid: boolean;
  errors: CompilerError[];
  warnings: CompilerWarning[];
  metadata: CompilerMetadata;
}
```

**Example:**
```typescript
const validation = await trpc.compiler.validate.mutate({
  workflowId: 'workflow-uuid'
});

if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
}
```

---

### `compiler.preview`

Preview compiled code without saving.

**Type:** Query

**Input:**
```typescript
{
  workflowId: string;
}
```

**Output:**
```typescript
{
  workflowCode: string;
  activitiesCode: string;
  workerCode: string;
  packageJson: string;
  tsConfig: string;
}
```

---

### `compiler.getCompiledCode`

Get previously compiled code for a workflow.

**Type:** Query

**Input:**
```typescript
{
  workflowId: string;
}
```

**Output:**
```typescript
{
  id: string;
  name: string;
  compiledCode: string;
  compiledAt: string;
}
```

---

### `compiler.getMetadata`

Get compiler metadata (version, supported features).

**Type:** Query

**Input:** None

**Output:**
```typescript
{
  version: string;
  supportedNodeTypes: string[];
  optimizationLevels: string[];
  features: string[];
}
```

**Example:**
```typescript
const metadata = await trpc.compiler.getMetadata.query();
console.log('Supported node types:', metadata.supportedNodeTypes);
// ['trigger', 'activity', 'agent', 'conditional', 'loop', ...]
```

---

## Execution API

Endpoints for executing workflows and monitoring execution status.

### `execution.build`

Build and execute a workflow (compiles, validates, and starts execution).

**Type:** Mutation

**Input:**
```typescript
{
  workflowId: string;
  input?: any;  // Workflow input parameters
}
```

**Output:**
```typescript
{
  success: boolean;
  executionId: string;
  workflowId?: string;      // Temporal workflow ID
  runId?: string;           // Temporal run ID
  message: string;
}
```

**Example:**
```typescript
const result = await trpc.execution.build.mutate({
  workflowId: 'workflow-uuid',
  input: {
    email: 'test@example.com',
    subject: 'Test Email'
  }
});

console.log('Execution started:', result.executionId);
```

**cURL Example:**
```bash
curl -X POST https://your-domain.com/api/trpc/execution.build \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-access-token=YOUR_TOKEN" \
  -d '{
    "workflowId": "workflow-uuid-here",
    "input": {"email": "test@example.com"}
  }'
```

---

### `execution.getStatus`

Get execution status by ID.

**Type:** Query

**Input:**
```typescript
{
  executionId: string;
}
```

**Output:**
```typescript
{
  id: string;
  status: 'building' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timed_out';
  startedAt: Date;
  completedAt: Date | null;
  result: any;
  error: string | null;
  input: any;
}
```

**Example:**
```typescript
const status = await trpc.execution.getStatus.query({
  executionId: 'execution-uuid'
});

if (status.status === 'completed') {
  console.log('Result:', status.result);
} else if (status.status === 'failed') {
  console.error('Error:', status.error);
}
```

---

### `execution.list`

List executions for a workflow.

**Type:** Query

**Input:**
```typescript
{
  workflowId: string;
  page?: number;        // Default: 1
  pageSize?: number;    // Default: 10
}
```

**Output:**
```typescript
{
  executions: Array<{
    id: string;
    status: string;
    startedAt: Date;
    completedAt: Date | null;
    result: any;
    error: string | null;
  }>;
  total: number;
  page: number;
  pageSize: number;
}
```

---

### `execution.getExecutionDetails`

Get detailed execution information including component-level details.

**Type:** Query

**Input:**
```typescript
{
  executionId: string;
}
```

**Output:**
```typescript
{
  id: string;
  workflowId: string;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
  input: any;
  output: any;
  error: string | null;
  temporalWorkflowId: string | null;
  temporalRunId: string | null;
  historySyncStatus: string | null;
  historySyncedAt: Date | null;
  componentExecutions: ComponentExecution[];
}
```

---

### `execution.getExecutionHistory`

Get execution history with filtering.

**Type:** Query

**Input:**
```typescript
{
  workflowId: string;
  page?: number;
  pageSize?: number;
  status?: 'all' | 'completed' | 'failed' | 'running';
}
```

**Output:**
```typescript
{
  executions: Execution[];
  total: number;
  page: number;
  pageSize: number;
}
```

---

### `execution.syncExecutionFromTemporal`

Manually trigger sync from Temporal (cache-aside pattern).

**Type:** Mutation

**Input:**
```typescript
{
  executionId: string;
  immediate?: boolean;  // Default: false
}
```

**Output:**
```typescript
{
  success: boolean;
  synced: boolean;
  componentExecutionsCount?: number;
  error?: string;
}
```

---

### `execution.getWorkflowStatistics`

Get aggregated statistics for a workflow.

**Type:** Query

**Input:**
```typescript
{
  workflowId: string;
}
```

**Output:**
```typescript
{
  total_runs: number;
  successful_runs: number;
  failed_runs: number;
  avg_duration_ms: number | null;
  min_duration_ms: number | null;
  max_duration_ms: number | null;
  most_used_component_id: string | null;
  most_used_component_count: number;
  total_errors: number;
  last_error_at: string | null;
  last_run_at: string | null;
}
```

---

### `execution.getProjectStatistics`

Get aggregated statistics for a project.

**Type:** Query

**Input:**
```typescript
{
  projectId: string;
}
```

**Output:**
```typescript
{
  most_used_workflow_id: string | null;
  most_used_workflow_count: number;
  most_used_component_id: string | null;
  most_used_component_count: number;
  total_executions: number;
  longest_run_duration_ms: number | null;
  total_failures: number;
  last_failure_at: string | null;
  last_execution_at: string | null;
}
```

---

### `execution.listUserExecutions`

List all executions for the current user across all workflows.

**Type:** Query

**Input:**
```typescript
{
  page?: number;
  pageSize?: number;
  status?: 'running' | 'completed' | 'failed' | 'cancelled' | 'timed_out' | 'building';
}
```

**Output:**
```typescript
{
  executions: Array<{
    id: string;
    workflowId: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    durationMs: number | null;
    errorMessage: string | null;
    workflow: {
      id: string;
      name: string;
      display_name: string;
    };
  }>;
  total: number;
  page: number;
  pageSize: number;
}
```

---

### `execution.getGlobalStats`

Get global execution statistics for the current user.

**Type:** Query

**Input:** None

**Output:**
```typescript
{
  total: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  timedOut: number;
  avgDuration: number;
  successRate: number;  // Percentage (0-100)
}
```

---

## Projects API

Endpoints for managing projects and their associated workers.

### `projects.list`

List all projects for the current user.

**Type:** Query

**Input:** None

**Output:**
```typescript
{
  projects: Array<{
    id: string;
    name: string;
    description: string;
    task_queue_name: string;
    is_active: boolean;
    workflow_count: number;
    active_workers: Worker[];
    created_at: string;
    updated_at: string;
  }>;
}
```

**Example:**
```typescript
const { projects } = await trpc.projects.list.query();
console.log(`You have ${projects.length} projects`);
```

---

### `projects.get`

Get a project by ID with full details.

**Type:** Query

**Input:**
```typescript
{
  id: string;  // UUID
}
```

**Output:**
```typescript
{
  project: {
    id: string;
    name: string;
    description: string;
    task_queue_name: string;
    workflows: Workflow[];
    workers: Worker[];
    // ... additional fields
  };
}
```

---

### `projects.create`

Create a new project.

**Type:** Mutation

**Input:**
```typescript
{
  name: string;         // Required, max 255 chars
  description?: string;
}
```

**Output:**
```typescript
{
  project: {
    id: string;
    name: string;
    task_queue_name: string;
    // ... full project object
  };
  taskQueue: {
    id: string;
    name: string;
    // ... task queue details
  };
}
```

**Example:**
```typescript
const { project, taskQueue } = await trpc.projects.create.mutate({
  name: 'Email Automation',
  description: 'Automated email processing workflows'
});

console.log('Task queue:', taskQueue.name);
```

**cURL Example:**
```bash
curl -X POST https://your-domain.com/api/trpc/projects.create \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-access-token=YOUR_TOKEN" \
  -d '{
    "name": "Email Automation",
    "description": "Automated email processing workflows"
  }'
```

---

### `projects.update`

Update a project.

**Type:** Mutation

**Input:**
```typescript
{
  id: string;
  name?: string;
  description?: string;
}
```

**Output:**
```typescript
{
  project: Project;  // Updated project object
}
```

---

### `projects.archive`

Archive a project and all its workflows.

**Type:** Mutation

**Input:**
```typescript
{
  id: string;
}
```

**Output:**
```typescript
{
  success: boolean;
}
```

**Notes:**
- Cannot archive default project
- Cannot archive if workers are running
- Archives all workflows in the project

---

### `projects.unarchive`

Restore an archived project.

**Type:** Mutation

**Input:**
```typescript
{
  id: string;
}
```

**Output:**
```typescript
{
  success: boolean;
}
```

---

### `projects.stats`

Get project statistics.

**Type:** Query

**Input:**
```typescript
{
  id: string;
}
```

**Output:**
```typescript
{
  project: {
    id: string;
    name: string;
    total_workflow_executions: number;
    total_activity_executions: number;
    avg_execution_duration_ms: number;
    last_execution_at: string;
  };
  topActivities: Activity[];
  recentExecutions: Execution[];
}
```

---

### `projects.workerHealth`

Get worker health status for a project.

**Type:** Query

**Input:**
```typescript
{
  id: string;
}
```

**Output:**
```typescript
{
  status: 'running' | 'stopped' | 'starting' | 'stopping' | 'failed';
  isHealthy: boolean;
  workerId: string | null;
  lastHeartbeat: string | null;
  taskQueueName: string;
  startedAt?: string;
  host?: string;
}
```

---

### `projects.startWorker`

Start a worker for a project.

**Type:** Mutation

**Input:**
```typescript
{
  id: string;  // Project ID
}
```

**Output:**
```typescript
{
  success: boolean;
  message: string;
  workerId?: string;
}
```

**Example:**
```typescript
const result = await trpc.projects.startWorker.mutate({
  id: 'project-uuid'
});

if (result.success) {
  console.log('Worker started:', result.workerId);
}
```

---

### `projects.stopWorker`

Stop a worker for a project.

**Type:** Mutation

**Input:**
```typescript
{
  id: string;  // Project ID
}
```

**Output:**
```typescript
{
  success: boolean;
  message: string;
}
```

---

## Components API

Endpoints for managing reusable workflow components (activities, agents, etc.).

### `components.list`

List all accessible components with filtering.

**Type:** Query

**Input:**
```typescript
{
  type?: string;                    // Filter by component type
  capability?: string;              // Filter by capability
  tags?: string[];                  // Filter by tags
  includeDeprecated?: boolean;      // Default: false
  page?: number;                    // Default: 1
  pageSize?: number;                // Default: 50
}
```

**Output:**
```typescript
{
  components: Component[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
```

---

### `components.get`

Get a single component by ID.

**Type:** Query (Public - no auth required)

**Input:**
```typescript
{
  id: string;  // UUID
}
```

**Output:**
```typescript
{
  id: string;
  name: string;
  display_name: string;
  description: string;
  component_type: {
    name: string;
    icon: string;
  };
  version: string;
  input_schema: any;
  output_schema: any;
  config_schema: any;
  tags: string[];
  capabilities: string[];
  deprecated: boolean;
  // ... additional fields
}
```

---

### `components.create`

Create a new component.

**Type:** Mutation

**Input:**
```typescript
{
  name: string;                     // Unique identifier
  displayName: string;              // Human-readable name
  description?: string;
  componentType: 'activity' | 'agent' | 'signal' | 'trigger';
  version: string;                  // Semver (e.g., "1.0.0")
  visibility: 'public' | 'private' | 'organization';
  configSchema?: any;               // JSON Schema
  inputSchema?: any;                // JSON Schema
  outputSchema?: any;               // JSON Schema
  tags?: string[];
  capabilities?: string[];
  // Agent-specific
  agentPromptId?: string;
  modelProvider?: string;
  modelName?: string;
  // Implementation
  implementationPath?: string;
  npmPackage?: string;
  implementationLanguage?: string;
  implementationCode?: string;      // Custom TypeScript code
}
```

**Output:**
```typescript
Component  // Created component object
```

**Example:**
```typescript
const component = await trpc.components.create.mutate({
  name: 'send-email',
  displayName: 'Send Email',
  description: 'Send an email via SMTP',
  componentType: 'activity',
  version: '1.0.0',
  visibility: 'private',
  inputSchema: {
    type: 'object',
    properties: {
      to: { type: 'string' },
      subject: { type: 'string' },
      body: { type: 'string' }
    },
    required: ['to', 'subject', 'body']
  },
  implementationCode: `
    export async function sendEmail(input: { to: string; subject: string; body: string }) {
      // Implementation here
      return { success: true };
    }
  `
});
```

---

### `components.update`

Update an existing component.

**Type:** Mutation

**Input:**
```typescript
{
  id: string;
  displayName?: string;
  description?: string;
  tags?: string[];
  capabilities?: string[];
  deprecated?: boolean;
  deprecatedMessage?: string;
  migrateToComponentId?: string;
}
```

**Output:**
```typescript
Component  // Updated component object
```

---

### `components.delete`

Delete a component (only if not used in any workflows).

**Type:** Mutation

**Input:**
```typescript
{
  id: string;
}
```

**Output:**
```typescript
{
  success: boolean;
}
```

---

### `components.getTypes`

Get all component types (for dropdowns).

**Type:** Query (Public)

**Input:** None

**Output:**
```typescript
Array<{
  id: string;
  name: string;
  icon: string;
  description: string;
}>
```

---

### `components.validateTypeScript`

Validate TypeScript code for a component.

**Type:** Mutation (Public)

**Input:**
```typescript
{
  code: string;
}
```

**Output:**
```typescript
{
  valid: boolean;
  errors: Array<{
    line: number;
    column: number;
    message: string;
    code: number;
  }>;
  warnings: Array<{
    line: number;
    column: number;
    message: string;
  }>;
  exportedFunctions: string[];
}
```

**Example:**
```typescript
const validation = await trpc.components.validateTypeScript.mutate({
  code: `
    export async function myActivity(input: any) {
      return { result: 'success' };
    }
  `
});

if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
}
```

---

## Activities API

Endpoints for managing activity definitions (low-level, system-registered activities).

### `activities.list`

List all activities.

**Type:** Query

**Input:**
```typescript
{
  packageName?: string;
  category?: string;
  includeDeprecated?: boolean;
  page?: number;
  pageSize?: number;
}
```

**Output:**
```typescript
{
  activities: Activity[];
  total: number;
  page: number;
  pageSize: number;
}
```

---

### `activities.get`

Get a single activity by ID.

**Type:** Query

**Input:**
```typescript
{
  id: string;
}
```

**Output:**
```typescript
{
  id: string;
  name: string;
  function_name: string;
  module_path: string;
  package_name: string;
  input_schema: any;
  output_schema: any;
  description: string;
  examples: any[];
  deprecated: boolean;
  // ... additional fields
}
```

---

## Work Queues API

Endpoints for managing workflow work queues (internal queuing within workflows).

### `workQueues.list`

List work queues for a workflow.

**Type:** Query

**Input:**
```typescript
{
  workflowId: string;
}
```

**Output:**
```typescript
Array<{
  id: string;
  queue_name: string;
  signal_name: string;
  query_name: string;
  max_size: number;
  priority: string;
  deduplicate: boolean;
  work_item_schema: any;
}>
```

---

### `workQueues.create`

Create a work queue.

**Type:** Mutation

**Input:**
```typescript
{
  workflowId: string;
  queueName: string;
  signalName: string;
  queryName: string;
  maxSize?: number;
  priority?: 'fifo' | 'lifo' | 'priority';
  deduplicate?: boolean;
  workItemSchema?: any;
  description?: string;
}
```

---

## Signals & Queries API

Endpoints for managing workflow signals and queries.

### `signalsQueries.listSignals`

List signals for a workflow.

**Type:** Query

**Input:**
```typescript
{
  workflowId: string;
}
```

**Output:**
```typescript
Array<{
  id: string;
  signal_name: string;
  description: string;
  parameters: any;
  auto_generated: boolean;
}>
```

---

### `signalsQueries.createSignal`

Create a signal.

**Type:** Mutation

**Input:**
```typescript
{
  workflowId: string;
  signalName: string;
  description?: string;
  parameters?: any;
}
```

---

### `signalsQueries.listQueries`

List queries for a workflow.

**Type:** Query

**Input:**
```typescript
{
  workflowId: string;
}
```

**Output:**
```typescript
Array<{
  id: string;
  query_name: string;
  description: string;
  return_type: any;
  auto_generated: boolean;
}>
```

---

### `signalsQueries.createQuery`

Create a query.

**Type:** Mutation

**Input:**
```typescript
{
  workflowId: string;
  queryName: string;
  description?: string;
  returnType?: any;
}
```

---

## Deployment API

Endpoints for deploying workflows to production.

### `deployment.deploy`

Deploy a workflow to production.

**Type:** Mutation

**Input:**
```typescript
{
  workflowId: string;
  environment?: 'staging' | 'production';  // Default: 'production'
}
```

**Output:**
```typescript
{
  success: boolean;
  deploymentId: string;
  message: string;
  endpoints: Endpoint[];
}
```

---

## Error Handling

All API endpoints follow consistent error handling:

### Error Codes

- `BAD_REQUEST` - Invalid input parameters
- `UNAUTHORIZED` - Not authenticated
- `FORBIDDEN` - Not authorized for this resource
- `NOT_FOUND` - Resource not found
- `CONFLICT` - Resource already exists
- `INTERNAL_SERVER_ERROR` - Server error
- `PRECONDITION_FAILED` - Precondition not met (e.g., workers running)

### Error Response Format

```typescript
{
  error: {
    code: string;
    message: string;
    data?: {
      code: string;
      httpStatus: number;
    };
  };
}
```

### Example Error Handling

```typescript
try {
  const workflow = await trpc.workflows.create.mutate({
    kebabName: 'my-workflow',
    displayName: 'My Workflow',
    visibility: 'private',
    projectId: 'project-uuid'
  });
} catch (error) {
  if (error.data?.code === 'CONFLICT') {
    console.error('Workflow already exists');
  } else if (error.data?.code === 'NOT_FOUND') {
    console.error('Project not found');
  } else {
    console.error('Unexpected error:', error.message);
  }
}
```

---

## Rate Limiting

API endpoints are rate-limited per user:

- Default: 100 requests per minute
- Burst: 200 requests
- Limits are enforced at the gateway level

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1634567890
```

---

## Programmatic Usage Examples

### Complete Workflow Creation Flow

```typescript
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from './server/api/root';

// Create tRPC client
const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'https://your-domain.com/api/trpc',
      headers: {
        'Cookie': `sb-access-token=${process.env.AUTH_TOKEN}`
      }
    })
  ]
});

async function createAndDeployWorkflow() {
  // 1. Create project
  const { project, taskQueue } = await trpc.projects.create.mutate({
    name: 'Email Processing',
    description: 'Automated email workflows'
  });

  console.log('Created project:', project.id);

  // 2. Create workflow
  const workflow = await trpc.workflows.create.mutate({
    kebabName: 'process-email',
    displayName: 'Process Email',
    description: 'Process incoming emails',
    visibility: 'private',
    projectId: project.id,
    definition: {
      nodes: [
        {
          id: 'start',
          type: 'trigger',
          data: { label: 'Email Received' },
          position: { x: 0, y: 0 }
        },
        {
          id: 'validate',
          type: 'activity',
          data: {
            label: 'Validate Email',
            activityName: 'validateEmail'
          },
          position: { x: 200, y: 0 }
        }
      ],
      edges: [
        {
          id: 'e1',
          source: 'start',
          target: 'validate'
        }
      ]
    }
  });

  console.log('Created workflow:', workflow.id);

  // 3. Compile workflow
  const compiled = await trpc.compiler.compile.mutate({
    workflowId: workflow.id,
    saveToDatabase: true
  });

  if (!compiled.success) {
    console.error('Compilation failed:', compiled.errors);
    return;
  }

  console.log('Compiled successfully');

  // 4. Start worker
  await trpc.projects.startWorker.mutate({
    id: project.id
  });

  console.log('Worker started');

  // 5. Deploy workflow
  const deployment = await trpc.workflows.deploy.mutate({
    id: workflow.id
  });

  console.log('Deployed with', deployment.endpoints.length, 'endpoints');

  // 6. Execute workflow
  const execution = await trpc.execution.build.mutate({
    workflowId: workflow.id,
    input: {
      from: 'sender@example.com',
      subject: 'Test Email',
      body: 'This is a test'
    }
  });

  console.log('Execution started:', execution.executionId);

  // 7. Monitor execution
  let status = await trpc.execution.getStatus.query({
    executionId: execution.executionId
  });

  while (status.status === 'running' || status.status === 'building') {
    await new Promise(resolve => setTimeout(resolve, 1000));
    status = await trpc.execution.getStatus.query({
      executionId: execution.executionId
    });
  }

  if (status.status === 'completed') {
    console.log('Execution completed:', status.result);
  } else {
    console.error('Execution failed:', status.error);
  }
}

createAndDeployWorkflow().catch(console.error);
```

---

## TypeScript Types

All TypeScript interfaces are available in the package:

```typescript
import type {
  Workflow,
  WorkflowNode,
  WorkflowEdge,
  Component,
  Execution,
  Project
} from '@/types/database';
```

See [Database Schema Documentation](../database/schema.md) for complete type definitions.

---

## Next Steps

- [Compiler Architecture](../architecture/compiler.md) - Understanding how compilation works
- [Worker Registration](../architecture/worker-registration.md) - Dynamic worker system
- [Extension Guide](../development/extension-guide.md) - Adding new node types
- [Database Schema](../database/schema.md) - Complete schema reference
