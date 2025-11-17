# Temporal Integration

How the Workflow Builder integrates with Temporal for workflow execution.

## Overview

The system uses Temporal for durable workflow orchestration. Workflows are designed visually, compiled to TypeScript, stored in the database, and executed via Temporal workers.

## Architecture

### Worker Strategy: One Per Project

Each user+project combination gets its own Temporal worker:
- **Task Queue**: `{user_id}-{project_id}` (e.g., `user-123-project-456`)
- **Worker**: One worker per project handles all workflows in that project
- **Isolation**: Projects don't interfere with each other

**Benefits**:
- Natural isolation boundary
- Easy to scale (add workers as users add projects)
- Simple to reason about and debug
- Aligns with user mental model

### Code Storage: Database

Compiled workflow code is stored in the database, not filesystem:
- **Table**: `workflow_compiled_code`
- **Storage**: All code as TEXT columns
- **Loading**: Workers load code from database at startup

**Benefits**:
- Better for distributed systems
- No file system sandboxing concerns
- Easy to version and rollback
- Works with serverless deployments

## Components

### Temporal Connection

**File**: `src/lib/temporal/connection.ts`

**Features**:
- Singleton connection manager
- `getTemporalClient()` - Get/create client
- `checkTemporalHealth()` - Health check
- `closeTemporalConnection()` - Graceful shutdown

**Configuration**:
- `TEMPORAL_ADDRESS` - Temporal server address (default: `localhost:7233`)
- `TEMPORAL_NAMESPACE` - Namespace (default: `default`)

### Worker Manager

**File**: `src/lib/temporal/worker-manager.ts`

**Class**: `ProjectWorkerManager`

**Features**:
- `startWorkerForProject(projectId)` - Start/reuse worker
- `stopWorkerForProject(projectId)` - Graceful shutdown
- `restartWorkerForProject(projectId)` - Reload workflows
- Dynamic code loading from database
- Heartbeat mechanism (30s interval)
- Worker status tracking

**Worker Lifecycle**:
1. Check if worker already running for project
2. Load project details and task queue name
3. Load all active compiled workflows for project
4. Bundle workflow code using Temporal's `bundleWorkflowCode`
5. Create worker with bundled code
6. Start worker and register with database
7. Start heartbeat to track worker health

### Workflow Compiler

**File**: `src/lib/workflow-compiler/compiler.ts`

**Function**: `compileWorkflow(workflow, options)`

**Output**:
- `workflowCode` - Main workflow TypeScript
- `activitiesCode` - Activities TypeScript
- `workerCode` - Worker setup code
- `packageJson` - Package.json
- `tsConfig` - TypeScript config

**Process**:
1. Parse workflow definition (JSON)
2. Generate imports based on workflow features
3. Generate workflow function with activities
4. Generate signal handlers (if any)
5. Generate query handlers (if any)
6. Generate activities interface
7. Generate worker setup code

### Code Storage

**File**: `src/lib/workflow-compiler/storage.ts`

**Functions**:
- `storeCompiledCode(workflowId, code, version)` - Store compiled code
- `getCompiledCode(workflowId, version?)` - Retrieve code
- `loadWorkflowsForProject(projectId)` - Load all workflows for worker
- `listCompiledVersions(workflowId)` - Version history
- `activateVersion(workflowId, version)` - Rollback support

## Workflow Execution Flow

### 1. Build Workflow

User clicks "Build Workflow" in UI:
1. Compiler generates TypeScript code
2. Code stored in `workflow_compiled_code` table
3. Worker manager ensures worker is running
4. Worker loads new code on next heartbeat

### 2. Start Execution

User triggers execution:
1. tRPC endpoint receives request
2. Verify worker is running for project
3. Start workflow execution via Temporal client
4. Temporal distributes work to worker
5. Worker executes workflow code
6. Results stored in `workflow_executions` table

### 3. Monitor Execution

Execution tracking:
1. Temporal tracks execution state
2. Worker updates `workflow_executions` table
3. Statistics updated in `activity_statistics` table
4. UI polls for updates

## Worker Management

### Starting a Worker

```typescript
const manager = new ProjectWorkerManager();
await manager.startWorkerForProject(projectId);
```

**Process**:
1. Load project and task queue name
2. Load all active compiled workflows
3. Bundle code using Temporal's bundler
4. Create worker with activities
5. Start worker and track in database

### Stopping a Worker

```typescript
await manager.stopWorkerForProject(projectId);
```

**Process**:
1. Find worker for project
2. Stop worker gracefully
3. Update database status
4. Clean up temporary files

### Worker Heartbeat

Workers send heartbeat every 30 seconds:
- Updates `workflow_workers.last_heartbeat_at`
- Detects dead workers (no heartbeat for 2 minutes)
- Allows automatic cleanup of stale workers

## Code Bundling

Temporal requires workflow code to be bundled:
1. Create temporary directory
2. Write all code files (workflow, activities, worker)
3. Bundle using `bundleWorkflowCode` from `@temporalio/worker`
4. Load bundle in worker
5. Clean up temporary files after worker starts

## Statistics Collection

**File**: `src/lib/temporal/statistics.ts`

**Functions**:
- `recordWorkflowExecution(workflowId, duration, status)`
- `recordActivityExecution(componentId, workflowId, duration, status)`
- `analyzeActivityPerformance(componentId)`

**Storage**:
- `workflow_executions` - Individual execution records
- `activity_statistics` - Aggregated activity metrics
- `projects` - Project-level statistics

## Error Handling

### Worker Errors

- Worker crashes: Status updated to "error" in database
- Code loading fails: Error logged, worker not started
- Temporal connection fails: Retry with exponential backoff

### Execution Errors

- Workflow failures: Stored in `workflow_executions.error`
- Activity failures: Tracked in `activity_statistics`
- Retry policies: Configured in workflow definition

## Configuration

### Environment Variables

```bash
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
```

### Worker Configuration

- **Task Queue**: Generated from project (`user_id-project_id`)
- **Activities**: Loaded from component registry
- **Workflows**: Loaded from compiled code storage
- **Connection**: Shared Temporal connection

## Monitoring

### Temporal Web UI

Access at `http://localhost:8233`:
- View running workflows
- Check task queues
- Inspect execution history
- Debug workflow issues

### Database Monitoring

- `workflow_workers` - Worker status and health
- `workflow_executions` - Execution history
- `activity_statistics` - Performance metrics

## Related Documentation

- [System Design](system-design.md) - Overall architecture
- [Database Schema](database-schema.md) - Database structure
- [Workflow Compiler](../development/adding-component-types.md) - Compiler details

