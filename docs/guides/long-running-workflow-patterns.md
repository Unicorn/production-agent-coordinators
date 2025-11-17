# Long-Running Workflow Design Patterns and Best Practices

**Date:** 2025-11-13
**Status:** Internal Guide
**Audience:** Engineers building Temporal workflows
**Related:** [Temporal Workflow Standardization](../plans/2025-11-13-temporal-workflow-standardization-and-service-architecture.md)

---

## Table of Contents

1. [When to Use Long-Running Workflows](#when-to-use-long-running-workflows)
2. [Workflow Lifecycle Management](#workflow-lifecycle-management)
3. [Signal Handling Patterns](#signal-handling-patterns)
4. [State Management](#state-management)
5. [Error Handling](#error-handling)
6. [Performance Considerations](#performance-considerations)
7. [Testing Strategies](#testing-strategies)
8. [Monitoring & Observability](#monitoring--observability)
9. [Common Pitfalls](#common-pitfalls)
10. [Code Examples](#code-examples)

---

## When to Use Long-Running Workflows

### Decision Criteria

**Use long-running workflows when:**

- ✅ The workflow represents a **service** or **daemon** that continuously processes work
- ✅ Work items arrive **asynchronously** via signals or external queries
- ✅ The workflow needs to maintain **minimal coordination state** across work items
- ✅ You want **exactly-one instance** of a service (singleton pattern)
- ✅ The workflow has **no natural termination point** (e.g., monitoring, queue processing)

**Use short-running workflows when:**

- ❌ The workflow represents a **specific task** tied to an entity (e.g., build package X)
- ❌ The workflow has a **clear completion state** (success or failure)
- ❌ You need **multiple concurrent instances** processing different entities
- ❌ The workflow accumulates **significant state** that would bloat history
- ❌ You want **isolation** between work items (failure of one shouldn't affect others)

### Use Case Examples

| Pattern | Example | Workflow Type |
|---------|---------|---------------|
| **Service** | Plan Writer Service - continuously listens for plan requests | Long-running |
| **Task** | Build Package `@bernierllc/foo` - builds one package then exits | Short-running |
| **Monitor** | Health Check Service - periodic scans of all packages | Long-running |
| **Job** | Publish Package `@bernierllc/foo` v1.2.3 - publishes then exits | Short-running |
| **Queue Processor** | Builder Service - polls MCP for work, processes, repeats | Long-running |
| **Batch Operation** | Build Suite - builds 10 packages then exits | Short-running |

### Decision Tree

```
Does the workflow represent a service/daemon?
├─ YES → Long-running
└─ NO → Does it process multiple unrelated entities?
    ├─ YES → Is there a natural completion point (e.g., batch size)?
    │   ├─ YES → Short-running
    │   └─ NO → Long-running (queue processor)
    └─ NO → Does it have a clear success/failure outcome?
        ├─ YES → Short-running
        └─ NO → Re-evaluate; most workflows have outcomes
```

---

## Workflow Lifecycle Management

### Service Workflow Lifecycle

```
START → INITIALIZE → LISTEN → PROCESS → UPDATE → SIGNAL → LISTEN → ...
                       ↑                                            │
                       └────────────── (never terminates) ─────────┘
```

### Startup Pattern

**Goal:** Initialize workflow state and begin listening for work.

```typescript
export async function LongRunningServiceWorkflow(): Promise<void> {
  // 1. Initialize workflow-level state (minimal!)
  const workQueue: WorkItem[] = [];
  let isProcessing = false;

  // 2. Set up signal handlers BEFORE entering loop
  setHandler(workAvailableSignal, (item: WorkItem) => {
    workQueue.push(item);
  });

  setHandler(shutdownSignal, () => {
    // Graceful shutdown: process queue, then exit
    isShuttingDown = true;
  });

  // 3. Enter processing loop
  while (!isShuttingDown) {
    if (workQueue.length > 0) {
      const item = workQueue.shift();
      await processWorkItem(item);
    } else {
      // Wait for signal (non-blocking)
      await condition(() => workQueue.length > 0 || isShuttingDown);
    }
  }

  // 4. Cleanup before exit
  console.log('Service shutting down gracefully');
}
```

### Shutdown Strategies

#### 1. Graceful Shutdown (Recommended)

Allow in-flight work to complete before terminating.

```typescript
let isShuttingDown = false;

setHandler(shutdownSignal, () => {
  isShuttingDown = true;
  console.log('Graceful shutdown requested');
});

while (!isShuttingDown) {
  // Process work
}

// Drain queue before exit
while (workQueue.length > 0) {
  await processWorkItem(workQueue.shift());
}
```

#### 2. Immediate Shutdown (Use with Caution)

Terminate immediately; in-flight work may be lost.

```typescript
setHandler(shutdownSignal, () => {
  throw ApplicationFailure.create({
    message: 'Service terminated by shutdown signal',
    type: 'SHUTDOWN_REQUESTED',
    nonRetryable: true
  });
});
```

#### 3. Workflow Continuation (Version Upgrade)

Use `continueAsNew` to reset history and upgrade workflow version.

```typescript
const WORKFLOW_VERSION = '2.0.0';
let processedItems = 0;

while (true) {
  await processWorkItem();
  processedItems++;

  // Reset history every 1000 items or on version upgrade signal
  if (processedItems >= 1000) {
    continueAsNew<typeof LongRunningServiceWorkflow>({
      version: WORKFLOW_VERSION,
      processedCount: processedItems
    });
  }
}
```

### Restart Strategies

**Idempotent Workflow IDs:**

Use deterministic workflow IDs so restarting creates/resumes the same workflow.

```typescript
// Good: Deterministic service name
const workflowId = 'plan-writer-service';

// Bad: Timestamp makes it unique each time
const workflowId = `plan-writer-service-${Date.now()}`;
```

**Handle Duplicate Starts:**

```typescript
// Starter code
await client.start(PlanWriterServiceWorkflow, {
  workflowId: 'plan-writer-service',
  taskQueue: 'services',
  // If workflow already running, ignore error
  workflowIdReusePolicy: WorkflowIdReusePolicy.WORKFLOW_ID_REUSE_POLICY_ALLOW_DUPLICATE
});
```

---

## Signal Handling Patterns

### Basic Signal Pattern

```typescript
import { defineSignal, setHandler, condition } from '@temporalio/workflow';

const workAvailableSignal = defineSignal<[WorkItem]>('work_available');

export async function ServiceWorkflow(): Promise<void> {
  const workQueue: WorkItem[] = [];

  // Set handler before loop
  setHandler(workAvailableSignal, (item: WorkItem) => {
    workQueue.push(item);
  });

  while (true) {
    // Wait for work
    await condition(() => workQueue.length > 0);

    // Process item
    const item = workQueue.shift()!;
    await processWorkItem(item);
  }
}
```

### Priority Queue Pattern

Handle high-priority signals first.

```typescript
interface PrioritizedWorkItem {
  item: WorkItem;
  priority: number; // 1=high, 2=normal, 3=low
}

const workQueue: PrioritizedWorkItem[] = [];

setHandler(workAvailableSignal, (item: WorkItem, priority: number = 2) => {
  workQueue.push({ item, priority });
  // Sort by priority (ascending)
  workQueue.sort((a, b) => a.priority - b.priority);
});

while (true) {
  await condition(() => workQueue.length > 0);
  const { item } = workQueue.shift()!;
  await processWorkItem(item);
}
```

### Multiple Signal Types Pattern

```typescript
const buildRequestSignal = defineSignal<[BuildRequest]>('build_request');
const qaFailedSignal = defineSignal<[QAFailure]>('qa_failed');
const priorityBuildSignal = defineSignal<[BuildRequest]>('priority_build');

type WorkItem =
  | { type: 'build'; data: BuildRequest; priority: number }
  | { type: 'qa_rework'; data: QAFailure; priority: number };

const workQueue: WorkItem[] = [];

setHandler(buildRequestSignal, (req: BuildRequest) => {
  workQueue.push({ type: 'build', data: req, priority: 2 });
  sortQueue();
});

setHandler(qaFailedSignal, (failure: QAFailure) => {
  // QA rework gets high priority
  workQueue.push({ type: 'qa_rework', data: failure, priority: 1 });
  sortQueue();
});

setHandler(priorityBuildSignal, (req: BuildRequest) => {
  workQueue.push({ type: 'build', data: req, priority: 0 });
  sortQueue();
});

function sortQueue() {
  workQueue.sort((a, b) => a.priority - b.priority);
}

while (true) {
  await condition(() => workQueue.length > 0);
  const item = workQueue.shift()!;

  if (item.type === 'build') {
    await processBuildRequest(item.data);
  } else if (item.type === 'qa_rework') {
    await processQARework(item.data);
  }
}
```

### Batching Pattern

Process multiple signals in batches for efficiency.

```typescript
const workQueue: WorkItem[] = [];
const BATCH_SIZE = 10;
const BATCH_TIMEOUT_MS = 5000;

setHandler(workAvailableSignal, (item: WorkItem) => {
  workQueue.push(item);
});

while (true) {
  // Wait for batch size OR timeout
  const batchStart = Date.now();
  await condition(
    () => workQueue.length >= BATCH_SIZE ||
          (workQueue.length > 0 && Date.now() - batchStart > BATCH_TIMEOUT_MS)
  );

  // Process batch
  const batch = workQueue.splice(0, BATCH_SIZE);
  await processBatch(batch);
}
```

### Signal Validation Pattern

Validate signal payloads to prevent bad data.

```typescript
import { ApplicationFailure } from '@temporalio/workflow';

function validateWorkItem(item: unknown): WorkItem {
  if (!item || typeof item !== 'object') {
    throw ApplicationFailure.create({
      message: 'Invalid work item: not an object',
      type: 'VALIDATION_ERROR',
      nonRetryable: true
    });
  }

  const workItem = item as Record<string, unknown>;

  if (!workItem.packageId || typeof workItem.packageId !== 'string') {
    throw ApplicationFailure.create({
      message: 'Invalid work item: missing packageId',
      type: 'VALIDATION_ERROR',
      nonRetryable: true
    });
  }

  // ... more validation

  return workItem as WorkItem;
}

setHandler(workAvailableSignal, (item: unknown) => {
  try {
    const validated = validateWorkItem(item);
    workQueue.push(validated);
  } catch (error) {
    console.error('Signal validation failed', { error, item });
    // Optionally send to dead letter queue
  }
});
```

---

## State Management

### Minimize Workflow State

**Rule:** Keep workflow state minimal. Workflow history grows with state changes.

**Good:**

```typescript
// Minimal state: just queue of work item IDs
const workQueue: string[] = []; // Just package IDs

while (true) {
  await condition(() => workQueue.length > 0);
  const packageId = workQueue.shift()!;

  // Fetch full data from external store
  const packageData = await fetchPackageFromMCP(packageId);
  await processPackage(packageData);
}
```

**Bad:**

```typescript
// Heavy state: entire package objects in workflow state
const workQueue: PackageData[] = []; // Full objects with plans, metadata, etc.

setHandler(workAvailableSignal, (packageData: PackageData) => {
  // This adds LOTS of data to workflow history
  workQueue.push(packageData);
});
```

### Use External Stores

Store data in external systems (MCP, databases, Git) and reference by ID.

```typescript
// Store only IDs
const pendingBuilds: string[] = [];

setHandler(buildRequestSignal, async (packageId: string) => {
  pendingBuilds.push(packageId);
});

while (true) {
  await condition(() => pendingBuilds.length > 0);
  const packageId = pendingBuilds.shift()!;

  // Fetch plan from MCP
  const plan = await proxyActivities<MCPActivities>({
    startToCloseTimeout: '1 minute'
  }).getPackagePlan(packageId);

  // Fetch code from Git
  const codeSnapshot = await proxyActivities<GitActivities>({
    startToCloseTimeout: '5 minutes'
  }).cloneFeatureBranch(packageId);

  await buildPackage(plan, codeSnapshot);
}
```

### State Reset with `continueAsNew`

Reset workflow history to prevent bloat.

```typescript
const MAX_ITEMS_BEFORE_RESET = 1000;
let processedCount = 0;

while (true) {
  await processWorkItem();
  processedCount++;

  if (processedCount >= MAX_ITEMS_BEFORE_RESET) {
    // Reset history by continuing as new
    continueAsNew<typeof ServiceWorkflow>({
      initialProcessedCount: processedCount
    });
  }
}
```

### Queries for State Visibility

Expose workflow state via queries (read-only).

```typescript
import { defineQuery, setHandler } from '@temporalio/workflow';

const getQueueDepthQuery = defineQuery<number>('queue_depth');
const getProcessedCountQuery = defineQuery<number>('processed_count');

let processedCount = 0;
const workQueue: WorkItem[] = [];

setHandler(getQueueDepthQuery, () => workQueue.length);
setHandler(getProcessedCountQuery, () => processedCount);

// Query from client:
// const depth = await handle.query(getQueueDepthQuery);
```

---

## Error Handling

### Activity Retry Strategies

Configure retries per activity type.

```typescript
// Standard activities: retry on transient failures
const { buildPackage } = proxyActivities<BuildActivities>({
  startToCloseTimeout: '10 minutes',
  retry: {
    initialInterval: '1 second',
    maximumInterval: '1 minute',
    backoffCoefficient: 2,
    maximumAttempts: 3
  }
});

// External API calls: aggressive retries
const { publishToNpm } = proxyActivities<PublishActivities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    initialInterval: '5 seconds',
    maximumInterval: '5 minutes',
    backoffCoefficient: 2,
    maximumAttempts: 10
  }
});

// AI agent calls: no retries (expensive)
const { spawnFixAgent } = proxyActivities<AgentActivities>({
  startToCloseTimeout: '30 minutes',
  retry: {
    maximumAttempts: 1 // No retries
  }
});
```

### Dead Letter Queue Pattern

Send failed work items to a DLQ for manual intervention.

```typescript
async function processWorkItem(item: WorkItem): Promise<void> {
  try {
    await buildPackage(item.packageId);
  } catch (error) {
    console.error('Build failed', { packageId: item.packageId, error });

    // Send to dead letter queue
    await proxyActivities<MCPActivities>({
      startToCloseTimeout: '1 minute'
    }).sendToDeadLetterQueue({
      packageId: item.packageId,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      retryable: isRetryableError(error)
    });

    // Update MCP status
    await proxyActivities<MCPActivities>({
      startToCloseTimeout: '1 minute'
    }).updatePackageStatus(item.packageId, 'failed');
  }
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    // Network errors are retryable
    if (error.message.includes('ECONNREFUSED') ||
        error.message.includes('timeout')) {
      return true;
    }
    // Build errors are not retryable (require code changes)
    if (error.message.includes('Build failed') ||
        error.message.includes('Tests failed')) {
      return false;
    }
  }
  return false;
}
```

### Compensation Pattern

Undo changes on failure.

```typescript
async function processPackageBuild(packageId: string): Promise<void> {
  let gitBranch: string | null = null;
  let mcpStatusUpdated = false;

  try {
    // Step 1: Create git branch
    gitBranch = await createFeatureBranch(packageId);

    // Step 2: Update MCP
    await updateMCPStatus(packageId, 'building');
    mcpStatusUpdated = true;

    // Step 3: Build
    await buildPackage(packageId);

  } catch (error) {
    // Compensate: undo what we did
    if (mcpStatusUpdated) {
      await updateMCPStatus(packageId, 'build_failed');
    }

    if (gitBranch) {
      await deleteFeatureBranch(gitBranch);
    }

    throw error; // Re-throw after compensation
  }
}
```

### Circuit Breaker Pattern

Stop processing if external service is down.

```typescript
let consecutiveFailures = 0;
const CIRCUIT_BREAKER_THRESHOLD = 5;
let circuitOpen = false;

while (true) {
  await condition(() => workQueue.length > 0);
  const item = workQueue.shift()!;

  if (circuitOpen) {
    // Circuit is open; wait before retrying
    await sleep('30 seconds');
    circuitOpen = false;
    consecutiveFailures = 0;
  }

  try {
    await processWorkItem(item);
    consecutiveFailures = 0; // Reset on success
  } catch (error) {
    consecutiveFailures++;

    if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
      console.warn('Circuit breaker opened due to consecutive failures');
      circuitOpen = true;
    }

    // Send to DLQ
    await sendToDeadLetterQueue(item, error);
  }
}
```

---

## Performance Considerations

### Worker Scaling

**Horizontal Scaling:**

Add more workers to increase throughput.

```bash
# Worker 1
npm run worker -- --task-queue services

# Worker 2
npm run worker -- --task-queue services

# Worker 3
npm run worker -- --task-queue services
```

**Vertical Scaling:**

Increase worker concurrency.

```typescript
// worker.ts
const worker = await Worker.create({
  taskQueue: 'services',
  workflowsPath: './workflows',
  activitiesPath: './activities',
  maxConcurrentActivityTaskExecutions: 10, // Increase concurrency
  maxConcurrentWorkflowTaskExecutions: 100
});
```

### Activity Timeouts

Set realistic timeouts to avoid blocking.

```typescript
// Fast activities: short timeout
const { verifyDependencies } = proxyActivities<Activities>({
  startToCloseTimeout: '30 seconds'
});

// Slow activities: long timeout
const { buildPackage } = proxyActivities<Activities>({
  startToCloseTimeout: '10 minutes',
  scheduleToCloseTimeout: '15 minutes', // Includes queue time
  heartbeatTimeout: '1 minute' // Activity must heartbeat
});

// Long-running activities with heartbeats
async function buildPackageActivity(input: BuildInput): Promise<BuildResult> {
  const heartbeat = Context.current().heartbeat;

  for (let i = 0; i < 100; i++) {
    await buildStep(i);
    heartbeat(); // Signal activity is alive
  }

  return { success: true };
}
```

### History Size Management

Keep workflow history small to avoid performance degradation.

**Problem:** Large history slows down workflow execution.

**Solutions:**

1. **Use `continueAsNew` regularly:**

```typescript
const MAX_EVENTS = 10000;

if (await getWorkflowHistoryLength() > MAX_EVENTS) {
  continueAsNew<typeof ServiceWorkflow>();
}
```

2. **Minimize state mutations:**

```typescript
// Bad: Mutates state on every signal (10k signals = 10k history events)
setHandler(workSignal, (item) => {
  workQueue.push(item); // Mutates state
});

// Good: Use local variables (not persisted to history)
const workQueue: WorkItem[] = []; // Local variable, not state
```

3. **Offload state to external stores:**

```typescript
// Store work queue in external DB, not workflow state
setHandler(workSignal, async (item) => {
  await proxyActivities<DBActivities>({
    startToCloseTimeout: '10 seconds'
  }).enqueueWork(item); // Stored externally
});
```

### Concurrency Control

Limit concurrent child workflows to avoid resource exhaustion.

```typescript
const MAX_CONCURRENT_BUILDS = 4;
const activeBuilds = new Map<string, ChildWorkflowHandle>();

while (hasUnbuiltPackages()) {
  // Find ready packages
  const ready = getReadyPackages();

  // Fill slots
  const available = MAX_CONCURRENT_BUILDS - activeBuilds.size;
  const batch = ready.slice(0, available);

  // Start children
  for (const pkg of batch) {
    const child = await startChild(BuildWorkflow, {
      workflowId: `build-${pkg.name}`,
      args: [{ packageName: pkg.name }]
    });
    activeBuilds.set(pkg.name, child);
  }

  // Wait for any to complete
  if (activeBuilds.size > 0) {
    const result = await Promise.race(
      Array.from(activeBuilds.entries()).map(async ([name, handle]) => {
        await handle.result();
        return name;
      })
    );
    activeBuilds.delete(result);
  }
}
```

---

## Testing Strategies

### Unit Testing Workflows

Use `@temporalio/testing` for deterministic tests.

```typescript
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { ServiceWorkflow } from './workflows';

describe('ServiceWorkflow', () => {
  let testEnv: TestWorkflowEnvironment;

  beforeAll(async () => {
    testEnv = await TestWorkflowEnvironment.createLocal();
  });

  afterAll(async () => {
    await testEnv.teardown();
  });

  it('should process work items from signals', async () => {
    const { client, nativeConnection } = testEnv;

    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue: 'test',
      workflowsPath: require.resolve('./workflows'),
      activitiesPath: require.resolve('./activities')
    });

    await worker.runUntil(async () => {
      const handle = await client.start(ServiceWorkflow, {
        workflowId: 'test-service',
        taskQueue: 'test'
      });

      // Send signal
      await handle.signal(workAvailableSignal, {
        packageId: '@bernierllc/test',
        priority: 1
      });

      // Wait for processing
      await testEnv.sleep('1 second');

      // Query state
      const depth = await handle.query(getQueueDepthQuery);
      expect(depth).toBe(0); // Queue drained

      // Shutdown
      await handle.signal(shutdownSignal);
      await handle.result();
    });
  });
});
```

### Mocking Activities

Mock activities to test workflow logic in isolation.

```typescript
import { MockActivityEnvironment } from '@temporalio/testing';

describe('Activities', () => {
  let activityEnv: MockActivityEnvironment;

  beforeEach(() => {
    activityEnv = new MockActivityEnvironment();
  });

  it('should build package successfully', async () => {
    const result = await activityEnv.run(buildPackage, {
      packageName: '@bernierllc/test',
      packagePath: 'packages/test'
    });

    expect(result.success).toBe(true);
  });
});
```

### Testing Signal Handling

Verify signals are processed correctly.

```typescript
it('should prioritize high-priority signals', async () => {
  const handle = await client.start(ServiceWorkflow, {
    workflowId: 'priority-test',
    taskQueue: 'test'
  });

  // Send signals in order: low, normal, high
  await handle.signal(workAvailableSignal, {
    packageId: '@bernierllc/low',
    priority: 3
  });
  await handle.signal(workAvailableSignal, {
    packageId: '@bernierllc/normal',
    priority: 2
  });
  await handle.signal(workAvailableSignal, {
    packageId: '@bernierllc/high',
    priority: 1
  });

  // Wait for processing
  await testEnv.sleep('3 seconds');

  // Query processed order
  const processed = await handle.query(getProcessedOrderQuery);
  expect(processed).toEqual([
    '@bernierllc/high',
    '@bernierllc/normal',
    '@bernierllc/low'
  ]);
});
```

### Testing Long-Running Behavior

Use time skipping to test long-running workflows.

```typescript
it('should reset history with continueAsNew', async () => {
  const handle = await client.start(ServiceWorkflow, {
    workflowId: 'continue-as-new-test',
    taskQueue: 'test'
  });

  // Send 1000 signals
  for (let i = 0; i < 1000; i++) {
    await handle.signal(workAvailableSignal, {
      packageId: `@bernierllc/pkg-${i}`,
      priority: 1
    });
  }

  // Fast-forward time
  await testEnv.sleep('1 hour');

  // Verify workflow continued as new (history reset)
  const history = await handle.fetchHistory();
  expect(history.events.length).toBeLessThan(10000); // Not bloated
});
```

---

## Monitoring & Observability

### Structured Logging

Use structured logs for searchability.

```typescript
import { log } from '@temporalio/workflow';

async function processWorkItem(item: WorkItem): Promise<void> {
  log.info('Processing work item', {
    packageId: item.packageId,
    priority: item.priority,
    queueDepth: workQueue.length
  });

  const startTime = Date.now();

  try {
    await buildPackage(item.packageId);

    log.info('Work item completed', {
      packageId: item.packageId,
      duration: Date.now() - startTime,
      queueDepth: workQueue.length
    });
  } catch (error) {
    log.error('Work item failed', {
      packageId: item.packageId,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime
    });
    throw error;
  }
}
```

### Metrics Emission

Emit custom metrics for monitoring.

```typescript
import { Metrics } from '@temporalio/workflow';

async function processWorkItem(item: WorkItem): Promise<void> {
  // Increment counter
  Metrics.counter('work_items_processed').inc();

  // Record gauge
  Metrics.gauge('queue_depth').set(workQueue.length);

  // Record histogram
  const startTime = Date.now();
  await buildPackage(item.packageId);
  const duration = Date.now() - startTime;
  Metrics.histogram('work_item_duration_ms').record(duration);
}
```

### Health Check Queries

Expose health status via queries.

```typescript
const getHealthQuery = defineQuery<HealthStatus>('health');

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  queueDepth: number;
  consecutiveFailures: number;
  lastProcessedAt: string;
  uptime: number;
}

const startTime = Date.now();
let lastProcessedAt = new Date().toISOString();
let consecutiveFailures = 0;

setHandler(getHealthQuery, (): HealthStatus => {
  const queueDepth = workQueue.length;
  const uptime = Date.now() - startTime;

  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (consecutiveFailures > 5) {
    status = 'unhealthy';
  } else if (queueDepth > 100 || consecutiveFailures > 0) {
    status = 'degraded';
  }

  return {
    status,
    queueDepth,
    consecutiveFailures,
    lastProcessedAt,
    uptime
  };
});

// Query from monitoring system:
// const health = await handle.query(getHealthQuery);
// if (health.status === 'unhealthy') { alert(); }
```

### Alerting Hooks

Integrate with alerting systems.

```typescript
async function processWorkItem(item: WorkItem): Promise<void> {
  try {
    await buildPackage(item.packageId);
    consecutiveFailures = 0;
  } catch (error) {
    consecutiveFailures++;

    if (consecutiveFailures >= 10) {
      // Send alert
      await proxyActivities<AlertActivities>({
        startToCloseTimeout: '30 seconds'
      }).sendAlert({
        severity: 'critical',
        message: `Service unhealthy: ${consecutiveFailures} consecutive failures`,
        service: 'package-builder-service',
        metadata: { lastError: error instanceof Error ? error.message : String(error) }
      });
    }
  }
}
```

---

## Common Pitfalls

### 1. Bloating Workflow State

**Problem:** Storing large objects in workflow state.

**Symptoms:**
- Workflow execution slows down over time
- History size grows to megabytes
- Temporal UI becomes unresponsive

**Fix:**

```typescript
// BAD
const workQueue: FullPackageData[] = []; // Large objects

// GOOD
const workQueue: string[] = []; // Just IDs
```

### 2. Non-Deterministic Code

**Problem:** Using `Date.now()`, `Math.random()`, or other non-deterministic operations directly.

**Symptoms:**
- Workflow replays fail
- Non-determinism errors in logs

**Fix:**

```typescript
// BAD
const timestamp = Date.now();

// GOOD
import { currentTimeMs } from '@temporalio/workflow';
const timestamp = currentTimeMs();
```

### 3. Blocking on Signals

**Problem:** Waiting synchronously for signals.

**Symptoms:**
- Workflow appears hung
- Signals are received but not processed

**Fix:**

```typescript
// BAD
while (true) {
  // Blocks workflow task
  const item = await receiveSignal(workAvailableSignal);
  await processWorkItem(item);
}

// GOOD
setHandler(workAvailableSignal, (item) => {
  workQueue.push(item); // Non-blocking
});

while (true) {
  await condition(() => workQueue.length > 0);
  const item = workQueue.shift()!;
  await processWorkItem(item);
}
```

### 4. Not Using `continueAsNew`

**Problem:** Never resetting workflow history.

**Symptoms:**
- Workflow history grows unbounded
- Performance degrades over weeks/months

**Fix:**

```typescript
let processedCount = 0;

while (true) {
  await processWorkItem();
  processedCount++;

  if (processedCount >= 1000) {
    continueAsNew<typeof ServiceWorkflow>();
  }
}
```

### 5. Expensive Activities Without Heartbeats

**Problem:** Long-running activities don't heartbeat.

**Symptoms:**
- Activities time out even when progressing
- Temporal can't detect activity crashes

**Fix:**

```typescript
// Activity code
async function buildPackage(input: BuildInput): Promise<BuildResult> {
  const heartbeat = Context.current().heartbeat;

  for (let i = 0; i < 100; i++) {
    await buildStep(i);
    heartbeat(); // Heartbeat every step
  }

  return { success: true };
}

// Workflow code
const { buildPackage } = proxyActivities<Activities>({
  startToCloseTimeout: '10 minutes',
  heartbeatTimeout: '1 minute' // Must heartbeat every minute
});
```

### 6. Not Validating Signal Payloads

**Problem:** Accepting malformed signals.

**Symptoms:**
- Workflow crashes on bad data
- Hard to debug failures

**Fix:**

```typescript
setHandler(workAvailableSignal, (item: unknown) => {
  try {
    const validated = validateWorkItem(item);
    workQueue.push(validated);
  } catch (error) {
    log.error('Invalid signal payload', { error, item });
    // Don't crash; just ignore bad signal
  }
});
```

### 7. Forgetting Graceful Shutdown

**Problem:** No shutdown signal; workflow must be force-terminated.

**Symptoms:**
- Can't upgrade workflow versions cleanly
- In-flight work is lost on restarts

**Fix:**

```typescript
let isShuttingDown = false;

setHandler(shutdownSignal, () => {
  isShuttingDown = true;
});

while (!isShuttingDown) {
  // Process work
}

// Drain queue before exit
while (workQueue.length > 0) {
  await processWorkItem(workQueue.shift()!);
}

console.log('Service shut down gracefully');
```

### 8. Coupling Workflows Too Tightly

**Problem:** Service workflows directly call other service workflows.

**Symptoms:**
- Circular dependencies
- Can't deploy services independently
- Hard to reason about data flow

**Fix:**

Use signals and external state (MCP) for decoupling.

```typescript
// BAD: Direct workflow coupling
const qaHandle = await getExternalWorkflowHandle('qa-service');
await qaHandle.signal(qaNeededSignal, { packageId });

// GOOD: Decouple via external state
await proxyActivities<MCPActivities>({
  startToCloseTimeout: '1 minute'
}).updatePackageStatus(packageId, 'ready_for_qa');

// QA service polls MCP for work:
const qaReady = await fetchPackagesWithStatus('ready_for_qa');
```

---

## Code Examples

### Complete Service Workflow Example

```typescript
import {
  defineSignal,
  defineQuery,
  setHandler,
  condition,
  proxyActivities,
  continueAsNew,
  log
} from '@temporalio/workflow';
import type { MCPActivities } from '../activities/mcp.activities';
import type { BuildActivities } from '../activities/build.activities';

// Signals
const workAvailableSignal = defineSignal<[string, number]>('work_available');
const shutdownSignal = defineSignal('shutdown');

// Queries
const getQueueDepthQuery = defineQuery<number>('queue_depth');
const getHealthQuery = defineQuery<HealthStatus>('health');

// Types
interface WorkItem {
  packageId: string;
  priority: number;
}

interface HealthStatus {
  queueDepth: number;
  processedCount: number;
  consecutiveFailures: number;
}

// Activity proxies
const mcpActivities = proxyActivities<MCPActivities>({
  startToCloseTimeout: '1 minute'
});

const buildActivities = proxyActivities<BuildActivities>({
  startToCloseTimeout: '10 minutes',
  retry: { maximumAttempts: 3 }
});

export async function PackageBuilderServiceWorkflow(): Promise<void> {
  // State
  const workQueue: WorkItem[] = [];
  let processedCount = 0;
  let consecutiveFailures = 0;
  let isShuttingDown = false;

  // Signal handlers
  setHandler(workAvailableSignal, (packageId: string, priority: number = 2) => {
    workQueue.push({ packageId, priority });
    workQueue.sort((a, b) => a.priority - b.priority);
    log.info('Work item queued', { packageId, priority, queueDepth: workQueue.length });
  });

  setHandler(shutdownSignal, () => {
    isShuttingDown = true;
    log.info('Graceful shutdown requested', { queueDepth: workQueue.length });
  });

  // Query handlers
  setHandler(getQueueDepthQuery, () => workQueue.length);
  setHandler(getHealthQuery, (): HealthStatus => ({
    queueDepth: workQueue.length,
    processedCount,
    consecutiveFailures
  }));

  // Main loop
  while (!isShuttingDown) {
    // Wait for work
    await condition(() => workQueue.length > 0 || isShuttingDown);

    if (workQueue.length === 0) continue;

    const item = workQueue.shift()!;

    try {
      log.info('Processing work item', { packageId: item.packageId });

      // Fetch package data from MCP
      const packageData = await mcpActivities.getPackage(item.packageId);

      // Build package
      await buildActivities.buildPackage({
        packageName: item.packageId,
        planPath: packageData.planFilePath
      });

      // Update MCP
      await mcpActivities.updatePackageStatus(item.packageId, 'built');

      processedCount++;
      consecutiveFailures = 0;

      log.info('Work item completed', {
        packageId: item.packageId,
        processedCount,
        queueDepth: workQueue.length
      });

      // Reset history every 1000 items
      if (processedCount >= 1000) {
        continueAsNew<typeof PackageBuilderServiceWorkflow>();
      }

    } catch (error) {
      consecutiveFailures++;

      log.error('Work item failed', {
        packageId: item.packageId,
        error: error instanceof Error ? error.message : String(error),
        consecutiveFailures
      });

      // Send to dead letter queue
      await mcpActivities.sendToDeadLetterQueue({
        packageId: item.packageId,
        error: error instanceof Error ? error.message : String(error)
      });

      // Update status
      await mcpActivities.updatePackageStatus(item.packageId, 'build_failed');
    }
  }

  // Graceful shutdown: drain queue
  while (workQueue.length > 0) {
    const item = workQueue.shift()!;
    try {
      await processWorkItem(item);
    } catch (error) {
      log.error('Failed during shutdown', { packageId: item.packageId, error });
    }
  }

  log.info('Service shut down gracefully', { finalProcessedCount: processedCount });
}

async function processWorkItem(item: WorkItem): Promise<void> {
  // Implementation as above
}
```

### Complete Test Example

```typescript
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { PackageBuilderServiceWorkflow } from './workflows';
import { workAvailableSignal, getQueueDepthQuery, shutdownSignal } from './workflows';

describe('PackageBuilderServiceWorkflow', () => {
  let testEnv: TestWorkflowEnvironment;

  beforeAll(async () => {
    testEnv = await TestWorkflowEnvironment.createLocal();
  });

  afterAll(async () => {
    await testEnv.teardown();
  });

  it('should process work items in priority order', async () => {
    const { client, nativeConnection } = testEnv;

    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue: 'test',
      workflowsPath: require.resolve('./workflows'),
      activitiesPath: require.resolve('./activities')
    });

    await worker.runUntil(async () => {
      const handle = await client.start(PackageBuilderServiceWorkflow, {
        workflowId: 'test-builder-service',
        taskQueue: 'test'
      });

      // Send signals with different priorities
      await handle.signal(workAvailableSignal, '@bernierllc/low', 3);
      await handle.signal(workAvailableSignal, '@bernierllc/high', 1);
      await handle.signal(workAvailableSignal, '@bernierllc/normal', 2);

      // Wait for processing
      await testEnv.sleep('5 seconds');

      // Verify queue drained
      const depth = await handle.query(getQueueDepthQuery);
      expect(depth).toBe(0);

      // Shutdown
      await handle.signal(shutdownSignal);
      await handle.result();
    });
  });
});
```

---

## Summary

**Key Takeaways:**

1. **Use long-running workflows for services, short-running for tasks**
2. **Minimize workflow state; use external stores (MCP, Git)**
3. **Handle signals with validation and priority queues**
4. **Use `continueAsNew` to reset history regularly**
5. **Configure activity retries per operation type**
6. **Implement graceful shutdown for clean upgrades**
7. **Emit metrics and structured logs for observability**
8. **Test with `@temporalio/testing` and time skipping**
9. **Avoid non-deterministic code (use Temporal APIs)**
10. **Decouple services via signals and external state**

**When in Doubt:**

- Ask: "Does this represent a service or a task?"
- Ask: "Can I store this in MCP/Git instead of workflow state?"
- Ask: "What happens if this workflow runs for 6 months?"
- Ask: "How do I upgrade this workflow without downtime?"

**Further Reading:**

- [Temporal Workflow Standardization](../plans/2025-11-13-temporal-workflow-standardization-and-service-architecture.md)
- [Temporal Best Practices](https://docs.temporal.io/dev-guide)
- [Temporal TypeScript SDK](https://typescript.temporal.io/)

---

**Document Control**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-13 | Internal Docs Writer Agent | Initial guide |

