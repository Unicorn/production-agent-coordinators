# Worker Registration and Management

The Workflow Builder uses a dynamic worker registration system that automatically manages Temporal workers on a per-project basis, loading compiled workflows from the database at runtime.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Worker Lifecycle](#worker-lifecycle)
- [Dynamic Code Loading](#dynamic-code-loading)
- [Project-Based Workers](#project-based-workers)
- [Health Monitoring](#health-monitoring)
- [API Integration](#api-integration)

---

## Overview

### Key Concepts

**Dynamic Worker Registration**
- Workers are created on-demand per project
- Each project has its own dedicated worker
- Workers load compiled code from the database at startup
- No code deployment required - everything is database-driven

**Project Isolation**
- One worker per project
- Each worker listens to its project's task queue
- Workflows and activities are isolated by project
- Custom activities are loaded per-project

### Why Dynamic Workers?

Traditional Temporal setups require:
1. Compile code
2. Build Docker image
3. Deploy to infrastructure
4. Restart workers

With dynamic workers:
1. Save workflow to database
2. Compile (stores in database)
3. Worker automatically loads new code
4. No deployment needed

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────┐
│  Workflow Builder (Next.js App)                         │
│                                                          │
│  ┌──────────────┐     ┌────────────┐                   │
│  │ Compiler API │────>│  Supabase  │                   │
│  └──────────────┘     │  Database  │                   │
│                       └─────┬──────┘                   │
└─────────────────────────────┼────────────────────────────┘
                              │
                              │ HTTP API
                              ▼
┌─────────────────────────────────────────────────────────┐
│  Worker Service (Standalone Process)                    │
│                                                          │
│  ┌────────────────────────────────────────────┐        │
│  │  ProjectWorkerManager                      │        │
│  │                                             │        │
│  │  ┌───────────┐  ┌───────────┐  ┌─────────┐│        │
│  │  │ Project A │  │ Project B │  │ Project │││        │
│  │  │  Worker   │  │  Worker   │  │    C    │││        │
│  │  │           │  │           │  │  Worker │││        │
│  │  │ • Queue A │  │ • Queue B │  │ • Queue │││        │
│  │  │ • 3 WFs   │  │ • 1 WF    │  │    C    │││        │
│  │  └─────┬─────┘  └─────┬─────┘  └────┬────┘│        │
│  └────────┼──────────────┼──────────────┼─────┘        │
│           │              │              │               │
└───────────┼──────────────┼──────────────┼───────────────┘
            │              │              │
            └──────────────┴──────────────┘
                          │
                          ▼
                ┌──────────────────┐
                │  Temporal Server │
                └──────────────────┘
```

### Component Structure

```
packages/
├── workflow-builder/              # Main Next.js app
│   └── src/
│       └── server/api/routers/
│           ├── execution.ts       # Calls worker service
│           └── projects.ts        # Manages projects
│
└── workflow-worker-service/       # Standalone worker service
    ├── src/
    │   ├── worker-manager.ts     # Core worker management
    │   ├── storage.ts            # Database access
    │   └── server.ts             # HTTP API server
    └── package.json
```

---

## Worker Lifecycle

### 1. Worker Startup

When a project is created or first workflow is deployed:

```typescript
// 1. API call from Next.js app
POST /workers/start
{
  "projectId": "uuid"
}

// 2. Worker service receives request
async startWorkerForProject(projectId: string): Promise<Worker> {
  // Check if already running
  if (this.workers.has(projectId)) {
    return existing.worker;
  }

  // Load project details
  const project = await db.getProject(projectId);

  // Load compiled workflows
  const workflows = await loadWorkflowsForProject(projectId);

  // Load custom activities
  const customActivities = await loadCustomActivities(projectId);

  // Create temporary bundle directory
  const bundleDir = createTempDir(projectId);

  // Write code to files
  writeWorkflowCode(bundleDir, workflows);
  writeActivitiesCode(bundleDir, workflows);
  writeCustomActivities(bundleDir, customActivities);

  // Create Temporal worker
  const worker = await Worker.create({
    taskQueue: project.task_queue_name,
    workflowBundle: { codePath: bundlePath },
    activities: { ...standardActivities, ...customActivities }
  });

  // Register in database
  await registerWorker(projectId, workerId);

  // Start heartbeat
  startHeartbeat(projectId, workerId);

  // Run worker (non-blocking)
  worker.run().catch(handleError);

  return worker;
}
```

### 2. Worker Running

Worker continuously:
- Polls Temporal for tasks on its task queue
- Executes workflows and activities
- Sends heartbeat every 30 seconds
- Updates database status

### 3. Worker Shutdown

```typescript
async stopWorkerForProject(projectId: string): Promise<void> {
  const workerInfo = this.workers.get(projectId);

  // Stop heartbeat
  clearInterval(workerInfo.heartbeatInterval);

  // Graceful shutdown (waits for in-flight tasks)
  await workerInfo.worker.shutdown();

  // Cleanup temporary files
  fs.rmSync(workerInfo.workflowsDir, { recursive: true });

  // Update database
  await db.updateWorkerStatus(workerId, 'stopped');

  // Remove from memory
  this.workers.delete(projectId);
}
```

### 4. Worker Restart

When workflow code changes:

```typescript
async restartWorkerForProject(projectId: string): Promise<Worker> {
  // Stop existing worker
  await this.stopWorkerForProject(projectId);

  // Wait for cleanup
  await sleep(1000);

  // Start new worker (loads latest code)
  return await this.startWorkerForProject(projectId);
}
```

---

## Dynamic Code Loading

### Database Storage

Compiled workflows are stored in Supabase:

```sql
CREATE TABLE workflows (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  compiled_typescript TEXT,  -- Full TypeScript code
  -- ... other fields
);

CREATE TABLE compiled_workflows (
  id UUID PRIMARY KEY,
  workflow_id UUID REFERENCES workflows(id),
  version TEXT,
  workflow_code TEXT,     -- Main workflow code
  activities_code TEXT,   -- Activities code
  worker_code TEXT,       -- Worker config
  created_at TIMESTAMPTZ
);
```

### Loading Workflow Code

```typescript
async function loadWorkflowsForProject(projectId: string) {
  // Get all active workflows for project
  const { data: workflows } = await supabase
    .from('workflows')
    .select(`
      id,
      name,
      compiled_typescript,
      status:workflow_statuses(name)
    `)
    .eq('project_id', projectId)
    .eq('status.name', 'active')
    .not('compiled_typescript', 'is', null);

  return workflows.map(w => ({
    id: w.id,
    name: w.name,
    code: JSON.parse(w.compiled_typescript)
  }));
}
```

### Bundling Code

```typescript
// 1. Create temp directory
const bundleDir = path.join(os.tmpdir(), 'workflow-builder', projectId);
fs.mkdirSync(bundleDir, { recursive: true });

// 2. Combine all workflow code
const allWorkflowCode = workflows
  .map(w => w.code.workflow_code)
  .join('\n\n');

// 3. Write to file
const workflowsFile = path.join(bundleDir, 'workflows.ts');
fs.writeFileSync(workflowsFile, allWorkflowCode);

// 4. Create bundle with source map
const bundledCode = allWorkflowCode + generateSourceMap();
const bundlePath = path.join(bundleDir, 'workflow-bundle.js');
fs.writeFileSync(bundlePath, bundledCode);

// 5. Pass to Temporal worker
const worker = await Worker.create({
  workflowBundle: {
    codePath: bundlePath  // Temporal loads this file
  }
});
```

### Loading Custom Activities

```typescript
async function loadCustomActivities(projectId: string) {
  // Get all workflows in project
  const workflows = await db.getWorkflows(projectId);

  // Extract component IDs from workflow nodes
  const componentIds = workflows.flatMap(w =>
    w.definition.nodes
      .filter(n => n.data.componentId)
      .map(n => n.data.componentId)
  );

  // Load custom activity components
  const { data: components } = await supabase
    .from('components')
    .select('name, implementation_code, implementation_language')
    .in('id', componentIds)
    .not('implementation_code', 'is', null)
    .eq('is_active', true);

  // Write to file
  const customActivitiesCode = components
    .map(c => c.implementation_code)
    .join('\n\n');

  fs.writeFileSync(
    path.join(bundleDir, 'custom-activities.ts'),
    customActivitiesCode
  );

  // Dynamic import
  const activitiesModule = await import(customActivitiesPath);

  return activitiesModule;
}
```

---

## Project-Based Workers

### One Worker Per Project

Each project gets exactly one worker instance:

```typescript
class ProjectWorkerManager {
  private workers: Map<string, WorkerInfo> = new Map();
  //                   projectId -> worker

  async startWorkerForProject(projectId: string) {
    // Check if already running
    if (this.workers.has(projectId)) {
      return this.workers.get(projectId).worker;
    }

    // Create new worker
    const worker = await createWorker(projectId);

    // Store in map
    this.workers.set(projectId, {
      worker,
      projectId,
      workerId: generateId(),
      heartbeatInterval: startHeartbeat(),
      workflowsDir: tempDir
    });
  }
}
```

### Task Queue Naming

Each project has a unique task queue:

```typescript
// Project creation
const taskQueueName = `${userIdPrefix}-${projectKebab}-queue`;

// Example: "abc123-email-automation-queue"
```

Worker listens to this queue:

```typescript
const worker = await Worker.create({
  taskQueue: 'abc123-email-automation-queue',
  // ... other config
});
```

### Multi-Workflow Support

One worker can handle multiple workflows:

```typescript
// All workflows in project share the worker
const workflows = [
  { name: 'email-processor', code: '...' },
  { name: 'data-validator', code: '...' },
  { name: 'report-generator', code: '...' }
];

// Combine into single bundle
const bundle = combineWorkflows(workflows);

// Worker handles all three
const worker = await Worker.create({
  taskQueue: project.task_queue_name,
  workflowBundle: { codePath: bundlePath }
});
```

---

## Health Monitoring

### Heartbeat System

Workers send heartbeat every 30 seconds:

```typescript
function startHeartbeat(workerId: string): NodeJS.Timeout {
  return setInterval(async () => {
    await supabase
      .from('workflow_workers')
      .update({
        last_heartbeat: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('worker_id', workerId)
      .eq('status', 'running');
  }, 30000); // 30 seconds
}
```

### Health Check Query

Check if worker is healthy:

```typescript
async function checkWorkerHealth(projectId: string) {
  const { data: worker } = await supabase
    .from('workflow_workers')
    .select('*')
    .eq('project_id', projectId)
    .eq('status', 'running')
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  if (!worker) {
    return { status: 'stopped', isHealthy: false };
  }

  const lastHeartbeat = new Date(worker.last_heartbeat);
  const isHealthy = (Date.now() - lastHeartbeat.getTime()) < 60000; // 60s threshold

  return {
    status: worker.status,
    isHealthy,
    workerId: worker.worker_id,
    lastHeartbeat: worker.last_heartbeat
  };
}
```

### Worker Status States

```typescript
type WorkerStatus =
  | 'starting'   // Worker is being created
  | 'running'    // Worker is active and healthy
  | 'stopping'   // Worker is shutting down
  | 'stopped'    // Worker is stopped
  | 'failed';    // Worker crashed or failed to start
```

Database schema:

```sql
CREATE TABLE workflow_workers (
  id UUID PRIMARY KEY,
  worker_id TEXT UNIQUE NOT NULL,
  project_id UUID REFERENCES projects(id),
  task_queue_name TEXT NOT NULL,
  status TEXT NOT NULL,
  host TEXT,
  process_id TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  stopped_at TIMESTAMPTZ,
  last_heartbeat TIMESTAMPTZ,
  metadata JSONB
);
```

### Error Handling

When worker crashes:

```typescript
worker.run().catch(async (error) => {
  console.error('Worker crashed:', error);

  // Update database
  await supabase
    .from('workflow_workers')
    .update({
      status: 'failed',
      stopped_at: new Date().toISOString(),
      metadata: {
        error: error.message,
        stack: error.stack
      }
    })
    .eq('worker_id', workerId);

  // Cleanup
  clearInterval(heartbeatInterval);
  fs.rmSync(workflowsDir, { recursive: true });
  workers.delete(projectId);

  // Optional: Auto-restart
  // await restartWorkerForProject(projectId);
});
```

---

## API Integration

### Worker Service API

The worker service exposes HTTP endpoints:

```typescript
// packages/workflow-worker-service/src/server.ts

import express from 'express';
import { projectWorkerManager } from './worker-manager';

const app = express();
app.use(express.json());

// Start worker for project
app.post('/workers/start', async (req, res) => {
  const { projectId } = req.body;

  try {
    await projectWorkerManager.startWorkerForProject(projectId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

// Stop worker
app.post('/workers/stop', async (req, res) => {
  const { projectId } = req.body;

  try {
    await projectWorkerManager.stopWorkerForProject(projectId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

// Get worker status
app.get('/workers/:projectId/status', async (req, res) => {
  const { projectId } = req.params;
  const status = projectWorkerManager.getWorkerStatus(projectId);

  res.json({ status });
});

// List all running workers
app.get('/workers', async (req, res) => {
  const workers = projectWorkerManager.getRunningWorkers();
  res.json({ workers });
});

app.listen(3011, () => {
  console.log('Worker service listening on port 3011');
});
```

### Calling from Next.js App

```typescript
// packages/workflow-builder/src/server/api/routers/projects.ts

const WORKER_SERVICE_URL = process.env.WORKER_SERVICE_URL || 'http://localhost:3011';

export const projectsRouter = createTRPCRouter({
  startWorker: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Call worker service
      const response = await fetch(`${WORKER_SERVICE_URL}/workers/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: input.id })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: data.error || 'Failed to start worker'
        });
      }

      return { success: true };
    })
});
```

### Environment Variables

```bash
# Worker Service
WORKER_SERVICE_URL=http://localhost:3011
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default

# Database (Supabase)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## Deployment

### Development Setup

1. **Start Temporal Server**
```bash
temporal server start-dev
```

2. **Start Worker Service**
```bash
cd packages/workflow-worker-service
npm run dev
```

3. **Start Next.js App**
```bash
cd packages/workflow-builder
npm run dev
```

### Production Deployment

#### Option 1: Single Process

Bundle worker service with Next.js:

```typescript
// packages/workflow-builder/src/server.ts

import { projectWorkerManager } from '@/lib/worker-manager';

// Start worker manager when server starts
projectWorkerManager.startMonitoring();
```

#### Option 2: Separate Service

Deploy worker service as standalone:

```dockerfile
# Dockerfile for worker service
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

EXPOSE 3011

CMD ["node", "dist/server.js"]
```

Deploy to:
- Kubernetes (recommended)
- Docker Compose
- Cloud Run / ECS
- VM with systemd

### Scaling Considerations

**Horizontal Scaling:**
- Deploy multiple worker service instances
- Use sticky sessions or distributed locks for project assignment
- Coordinate via Redis or database

**Vertical Scaling:**
- Increase worker concurrency limits
```typescript
const worker = await Worker.create({
  maxConcurrentActivityTaskExecutions: 50,  // Increase from 10
  maxConcurrentWorkflowTaskExecutions: 50
});
```

**Auto-Scaling:**
- Monitor queue length via Temporal metrics
- Scale worker service based on load
- One worker instance can handle multiple projects

---

## Advanced Topics

### Hot Reloading

When workflow code changes, reload without downtime:

```typescript
async function reloadWorkflow(workflowId: string) {
  // 1. Get project for workflow
  const workflow = await db.getWorkflow(workflowId);
  const projectId = workflow.project_id;

  // 2. Restart worker (loads new code)
  await projectWorkerManager.restartWorkerForProject(projectId);
}
```

### Activity Versioning

Support multiple versions of activities:

```typescript
// Custom activity with version
export async function sendEmailV2(input: EmailInput): Promise<EmailOutput> {
  // New implementation
}

// Worker loads both versions
const activities = {
  sendEmail: sendEmailV1,    // Legacy
  sendEmailV2: sendEmailV2   // Current
};
```

### Monitoring and Observability

**Metrics to Track:**
- Worker uptime
- Heartbeat latency
- Code load time
- Number of workflows per worker
- Memory usage
- CPU usage

**Logging:**
```typescript
import pino from 'pino';

const logger = pino({
  level: 'info',
  formatters: {
    level: (label) => ({ level: label })
  }
});

logger.info({
  event: 'worker_started',
  projectId,
  workerId,
  workflows: workflows.length
});
```

**Health Endpoint:**
```typescript
app.get('/health', (req, res) => {
  const runningWorkers = projectWorkerManager.getRunningWorkers();

  res.json({
    status: 'ok',
    workers: runningWorkers.length,
    uptime: process.uptime()
  });
});
```

---

## Troubleshooting

### Worker Won't Start

**Check:**
1. Temporal server is running
2. Database connection is valid
3. Compiled code exists for project
4. Task queue name is correct
5. No syntax errors in compiled code

**Debug:**
```typescript
// Enable debug logging
const worker = await Worker.create({
  debugMode: true,
  // ... other config
});
```

### Worker Crashes Repeatedly

**Common Causes:**
1. Invalid TypeScript in compiled code
2. Missing activity implementations
3. Memory limit exceeded
4. Temporal connection lost

**Fix:**
- Validate compiled code before deployment
- Add error boundaries in activities
- Increase memory limits
- Add connection retry logic

### Heartbeat Not Updating

**Check:**
1. Database permissions
2. Network connectivity
3. Worker status in memory vs database

**Fix:**
```typescript
// Verify heartbeat is running
console.log('Heartbeat interval:', heartbeatInterval);

// Check database updates
const { data, error } = await supabase
  .from('workflow_workers')
  .select('last_heartbeat')
  .eq('worker_id', workerId)
  .single();

console.log('Last heartbeat in DB:', data?.last_heartbeat);
```

---

## Next Steps

- [Compiler Architecture](./compiler.md) - How code is generated
- [Extension Guide](../development/extension-guide.md) - Adding custom node types
- [API Reference](../api/reference.md) - Using worker management APIs
- [Database Schema](../database/schema.md) - Worker database tables
