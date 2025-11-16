# Continuous Package Queue Orchestrator Design

**Date:** 2025-11-16
**Status:** Approved
**Package:** `@bernierllc/package-queue-orchestrator`

## Overview

A long-running Temporal orchestration system that continuously processes packages from the MCP build queue, spawning build workflows and managing concurrency, retries, and lifecycle control.

## Architecture

The system uses a **Cron Poller + Long-Running Orchestrator** pattern:

- **MCPPollerWorkflow**: Cron-scheduled workflow that queries MCP every 30 minutes
- **ContinuousBuilderWorkflow**: Long-running orchestrator that manages build queue and spawns child workflows
- **PackageBuildWorkflow**: Existing single-package builder (unchanged)

This separates the polling concern from the execution concern, allowing independent scaling and simpler state management.

## Components

### 1. MCPPollerWorkflow

**Purpose:** Query MCP for available packages and signal the orchestrator.

**Characteristics:**
- Cron-scheduled execution (every 30 minutes)
- Stateless - each execution is independent
- Single activity: `queryMCPForPackages()`
- Signals orchestrator with results
- Supports manual trigger via `forcePoll` signal

**Workflow Structure:**
```typescript
export async function MCPPollerWorkflow(): Promise<void> {
  // Query MCP for packages ready to build
  const packages = await queryMCPForPackages();

  // Signal orchestrator with results
  if (packages.length > 0) {
    await signalOrchestrator('newPackages', packages);
  }
}
```

**Cron Schedule:** `0 */30 * * *` (every 30 minutes)

### 2. ContinuousBuilderWorkflow

**Purpose:** Long-running orchestrator that manages the build queue and spawns child build workflows.

**State Management:**
```typescript
interface OrchestratorState {
  internalQueue: Package[];              // Packages waiting to build
  activeBuilds: Map<string, ChildHandle>; // Currently building packages
  failedRetries: Map<string, number>;    // Retry attempt tracking
  isPaused: boolean;                     // Pause state
  isDraining: boolean;                   // Drain state
  maxConcurrent: number;                 // Concurrency limit
}
```

**Supported Signals:**
- `newPackages(packages: Package[])` - Add packages to internal queue
- `pause()` - Stop spawning new builds, let active builds complete
- `resume()` - Resume spawning from queue
- `drain()` - Finish active builds, then terminate gracefully
- `emergencyStop()` - Cancel all active builds and exit immediately
- `adjustConcurrency(limit: number)` - Change maxConcurrent dynamically

**Workflow Logic:**
1. Initialize state on startup
2. Wait for signals (newPackages, control signals)
3. When packages received, merge into internal queue (deduplicate)
4. Spawn child workflows up to maxConcurrent limit
5. Track child completions asynchronously
6. On completion: update MCP status, check for retries, spawn next from queue
7. Continue-as-new after 100 builds or 24 hours

### 3. Worker Bootstrap

**Purpose:** Ensure exactly one orchestrator instance is always running.

**Startup Logic:**
```typescript
async function ensureOrchestratorRunning(client: WorkflowClient) {
  const workflowId = 'continuous-builder-orchestrator';

  try {
    // Check if already running
    const handle = client.getHandle(workflowId);
    await handle.describe(); // Throws if not found
    console.log('Orchestrator already running');
  } catch (err) {
    // Not running, start it
    await client.start(ContinuousBuilderWorkflow, {
      workflowId,
      taskQueue: 'engine',
      workflowIdReusePolicy: WORKFLOW_ID_REUSE_POLICY_ALLOW_DUPLICATE_FAILED_ONLY,
      args: [{
        maxConcurrent: 4,
        workspaceRoot: process.env.WORKSPACE_ROOT,
        config: { /* ... */ }
      }]
    });
    console.log('Orchestrator started');
  }
}
```

## Data Flow

### 1. MCP Query Flow (Every 30 Minutes)

```
MCPPollerWorkflow (cron wake)
  ↓
queryMCPForPackages() activity
  ↓
MCP packages_get_build_queue tool
  ↓ (returns packages with satisfied dependencies, sorted by priority)
signalOrchestrator('newPackages', packages)
  ↓
ContinuousBuilderWorkflow receives signal
```

### 2. Queue Management

```
newPackages signal received
  ↓
Merge into internalQueue (deduplicate by package name)
  ↓
Check available slots: maxConcurrent - activeBuilds.size
  ↓
┌─ If slots available: spawn builds
└─ If no slots: packages wait in queue
```

### 3. Build Execution

```
Spawn PackageBuildWorkflow child
  ↓
Store handle in activeBuilds map
  ↓
handle.result().then(async (result) => {
  // Async completion handler
  if (result.success) {
    await updateMCPPackageStatus(name, 'published');
    delete failedRetries[name];
  } else {
    await handleFailure(name, result);
  }
  activeBuilds.delete(name);
  spawnNextFromQueue();
})
```

### 4. Completion Handling

**On Success:**
1. Call `updateMCPPackageStatus(packageName, 'published')` activity
2. Remove from `activeBuilds`
3. Delete from `failedRetries` (if present)
4. Check queue for next package to build

**On Failure:**
1. Increment `failedRetries[packageName]`
2. If retries < maxRetries (3):
   - Wait with exponential backoff (1min, 2min, 4min)
   - Re-add to `internalQueue`
3. If retries >= maxRetries:
   - Call `updateMCPPackageStatus(packageName, 'failed', errorDetails)`
   - Remove from `failedRetries`
4. Remove from `activeBuilds`
5. Check queue for next package

### 5. Continue-as-New

**Triggers:**
- After 100 completed builds, OR
- After 24 hours of runtime

**Preserved State:**
- `internalQueue` (pending packages)
- `failedRetries` (retry tracking)
- `maxConcurrent` (concurrency limit)
- `isPaused` (pause state)
- `isDraining` (drain state)

**NOT Preserved:**
- `activeBuilds` (reconstructed from Temporal's child workflow queries)

## Error Handling

### Child Workflow Failures

**Retry Strategy:**
- Track retry count in `failedRetries` map
- Retry up to 3 times per package
- Exponential backoff between retries: 1min, 2min, 4min
- After max retries: mark failed in MCP and continue processing other packages

**Failure Isolation:**
- Failures don't block the queue
- Other packages continue building
- Failed package removed from active tracking

### Control Signal Handling

| Signal | Behavior |
|--------|----------|
| `pause()` | Set `isPaused = true`, stop spawning new builds, let active builds complete |
| `resume()` | Set `isPaused = false`, resume spawning from queue |
| `drain()` | Set `isDraining = true`, finish active builds, then exit gracefully (no continue-as-new) |
| `emergencyStop()` | Cancel all active builds (`Promise.all(activeBuilds.map(h => h.cancel()))`), exit immediately |
| `adjustConcurrency(n)` | Update `maxConcurrent`, immediately spawn or throttle builds accordingly |

### Worker Crashes

**Recovery:**
- Temporal automatically resumes workflow from last checkpoint
- Active child workflows continue running (they're durable)
- Queue state preserved in workflow history
- `activeBuilds` map reconstructed from Temporal child workflow queries

### MCP Unavailable

**Handling:**
- Poller workflow catches MCP errors
- Logs error and exits (will retry on next cron tick in 30 min)
- Orchestrator continues processing existing queue
- No cascading failures
- System degrades gracefully

## State Management Strategy

**Hybrid Approach:**
- **MCP is source of truth for:** Package queue, priorities, dependency satisfaction, publication status
- **Workflow tracks:** Active builds, internal queue, retry attempts, control state

**Why Hybrid:**
- MCP manages complex dependency resolution and prioritization
- Workflow manages real-time execution state
- Clear separation of concerns
- Can operate if MCP is temporarily unavailable (processes existing queue)

## Testing Strategy

### Unit Tests

**Target:** Workflow logic in isolation

```typescript
describe('ContinuousBuilderWorkflow', () => {
  it('should merge new packages into queue without duplicates');
  it('should respect maxConcurrent limit');
  it('should handle pause/resume signals correctly');
  it('should retry failed packages up to maxRetries');
  it('should preserve state in continue-as-new');
  it('should handle drain signal by finishing active builds');
  it('should cancel all builds on emergency stop');
});
```

**Approach:** Mock activities and child workflows using Temporal's testing framework.

### Integration Tests

**Target:** Cross-workflow communication and activity execution

```typescript
describe('Orchestrator Integration', () => {
  it('should receive packages from poller via signal');
  it('should spawn PackageBuildWorkflow children');
  it('should update MCP status after build completion');
  it('should retry failed builds with exponential backoff');
  it('should handle MCP unavailability gracefully');
});
```

**Approach:** Use Temporal test environment with real workflows, mock only external dependencies (MCP).

### E2E Tests

**Target:** Full system behavior

```typescript
describe('Package Queue E2E', () => {
  it('should build packages in dependency order');
  it('should handle concurrent builds up to maxConcurrent');
  it('should update MCP status correctly');
  it('should recover from worker crashes');
  it('should respect pause/resume/drain signals');
});
```

**Approach:**
1. Seed MCP with test packages (with dependencies)
2. Start worker with orchestrator
3. Trigger poller manually (don't wait 30 min)
4. Verify packages built in correct order
5. Verify MCP status updates
6. Test failure scenarios and retries

## Deployment

### Package Structure

```
packages/
└── package-queue-orchestrator/
    ├── src/
    │   ├── workflows/
    │   │   ├── mcp-poller.workflow.ts
    │   │   ├── continuous-builder.workflow.ts
    │   │   └── index.ts
    │   ├── activities/
    │   │   ├── mcp.activities.ts
    │   │   └── index.ts
    │   ├── worker.ts
    │   └── types/
    │       └── index.ts
    ├── package.json
    └── tsconfig.json
```

### Worker Configuration

```typescript
// worker.ts
import { Worker } from '@temporalio/worker';
import * as workflows from './workflows';
import * as activities from './activities';

async function run() {
  const worker = await Worker.create({
    workflowsPath: require.resolve('./workflows'),
    activities,
    taskQueue: 'engine',
  });

  // Ensure orchestrator is running
  await ensureOrchestratorRunning(worker.client);

  await worker.run();
}
```

### Cron Schedule Registration

```typescript
// Register MCPPollerWorkflow cron
await client.workflow.start(MCPPollerWorkflow, {
  workflowId: 'mcp-poller-cron',
  taskQueue: 'engine',
  cronSchedule: '0 */30 * * *', // Every 30 minutes
});
```

## Migration Path

1. **Phase 1: Create Package**
   - Create `@bernierllc/package-queue-orchestrator` package
   - Implement workflows and activities
   - Add unit tests

2. **Phase 2: Integration**
   - Add integration tests
   - Test with existing `PackageBuildWorkflow`
   - Verify MCP integration

3. **Phase 3: E2E Testing**
   - Seed test packages in MCP
   - Run full end-to-end tests
   - Validate concurrency and retry logic

4. **Phase 4: Deployment**
   - Deploy to dev environment
   - Monitor for 1 week
   - Deploy to production

## Open Questions

None - design is approved and ready for implementation.

## References

- Temporal Workflow Documentation: https://docs.temporal.io/workflows
- Temporal Cron Workflows: https://docs.temporal.io/workflows#cron-workflows
- Temporal Continue-As-New: https://docs.temporal.io/workflows#continue-as-new
- MCP Packages API: `packages_get_build_queue`, `packages_update`
- Existing PackageBuildWorkflow: `packages/agents/package-builder-production/src/workflows/package-build.workflow.ts`
