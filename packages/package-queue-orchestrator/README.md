# Package Queue Orchestrator

A long-running Temporal orchestration system that continuously processes packages from the MCP build queue, spawning build workflows and managing concurrency, retries, and lifecycle control.

## Overview

The Package Queue Orchestrator implements a **Cron Poller + Long-Running Orchestrator** pattern:

- **MCPPollerWorkflow**: Cron-scheduled workflow that queries MCP every 30 minutes for available packages
- **ContinuousBuilderWorkflow**: Long-running orchestrator that manages the build queue and spawns child workflows
- **PackageBuildWorkflow**: Existing single-package builder (integrated via child workflows)

This architecture separates the polling concern from the execution concern, allowing independent scaling and simpler state management.

## Key Features

- **Continuous Processing**: Long-running orchestrator maintains state across multiple builds
- **Dependency Awareness**: Respects package dependency constraints when queueing
- **Concurrency Control**: Configurable max concurrent builds with dynamic adjustment
- **Retry Logic**: Automatic exponential backoff retry strategy (up to 3 attempts)
- **State Recovery**: Temporal-backed durability with automatic recovery on worker crashes
- **Lifecycle Control**: Pause, resume, drain, and emergency stop signals for operational control
- **MCP Integration**: Queries MCP build queue with dependency satisfaction tracking
- **Continue-as-New**: Automatic state preservation after 100 builds or 24 hours of runtime

## Package Structure

```
src/
├── workflows/
│   ├── mcp-poller.workflow.ts          # Cron-scheduled poller
│   ├── continuous-builder.workflow.ts  # Main orchestrator
│   └── index.ts                        # Workflow exports
├── activities/
│   ├── mcp.activities.ts               # MCP interactions
│   └── index.ts                        # Activity exports
├── types/
│   └── index.ts                        # Type definitions
└── index.ts                            # Package exports
```

## Getting Started

### Installation

```bash
npm install @coordinator/package-queue-orchestrator
# or
yarn add @coordinator/package-queue-orchestrator
```

### Running the Worker

```typescript
import { Worker } from '@temporalio/worker';
import * as workflows from '@coordinator/package-queue-orchestrator/workflows';
import * as activities from '@coordinator/package-queue-orchestrator/activities';

const worker = await Worker.create({
  workflowsPath: require.resolve('@coordinator/package-queue-orchestrator/workflows'),
  activities,
  taskQueue: 'engine',
});

await worker.run();
```

The worker automatically ensures the orchestrator is running on startup.

## Workflows

### MCPPollerWorkflow

**Purpose**: Query MCP for available packages and signal the orchestrator.

**Schedule**: Every 30 minutes (cron: `0 */30 * * *`)

**Behavior**:
- Calls `queryMCPForPackages()` activity
- Filters packages with satisfied dependencies
- Signals `ContinuousBuilderWorkflow` with results
- Supports manual trigger via `forcePoll` signal

### ContinuousBuilderWorkflow

**Purpose**: Long-running orchestrator managing the build queue.

**State Management**:
- `internalQueue`: Packages waiting to build
- `activeBuilds`: Currently building packages
- `failedRetries`: Retry attempt tracking
- `isPaused`: Pause state flag
- `isDraining`: Graceful shutdown flag
- `maxConcurrent`: Concurrency limit

**Supported Signals**:
- `newPackages(packages)`: Add packages to internal queue
- `pause()`: Stop spawning new builds, let active builds complete
- `resume()`: Resume spawning from queue
- `drain()`: Finish active builds, then terminate gracefully
- `emergencyStop()`: Cancel all active builds and exit immediately
- `adjustConcurrency(limit)`: Change maxConcurrent dynamically

**Workflow Logic**:
1. Initialize state on startup
2. Wait for signals (newPackages, control signals)
3. Merge packages into internal queue (deduplicate)
4. Spawn child workflows up to maxConcurrent limit
5. Track child completions asynchronously
6. On completion: update MCP status, check for retries, spawn next from queue
7. Continue-as-new after 100 builds or 24 hours

## Data Flow

### MCP Query Flow (Every 30 Minutes)

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

### Queue Management

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

### Build Execution

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

## Error Handling

### Child Workflow Failures

**Retry Strategy**:
- Track retry count in `failedRetries` map
- Retry up to 3 times per package
- Exponential backoff between retries: 1min, 2min, 4min
- After max retries: mark failed in MCP and continue processing

**Failure Isolation**:
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

**Recovery**:
- Temporal automatically resumes workflow from last checkpoint
- Active child workflows continue running (they're durable)
- Queue state preserved in workflow history
- `activeBuilds` map reconstructed from Temporal child workflow queries

### MCP Unavailable

**Handling**:
- Poller workflow catches MCP errors
- Logs error and exits (will retry on next cron tick in 30 min)
- Orchestrator continues processing existing queue
- No cascading failures
- System degrades gracefully

## State Management

**Hybrid Approach**:
- **MCP is source of truth for**: Package queue, priorities, dependency satisfaction, publication status
- **Workflow tracks**: Active builds, internal queue, retry attempts, control state

**Why Hybrid**:
- MCP manages complex dependency resolution and prioritization
- Workflow manages real-time execution state
- Clear separation of concerns
- Can operate if MCP is temporarily unavailable (processes existing queue)

## Configuration

Configure the orchestrator via worker initialization parameters:

```typescript
await ensureOrchestratorRunning(client, {
  maxConcurrent: 4,
  workspaceRoot: process.env.WORKSPACE_ROOT,
  config: {
    /* ... */
  }
});
```

### Environment Variables

- `WORKSPACE_ROOT`: Root directory for workspace operations
- `TEMPORAL_ADDRESS`: Temporal server address (default: localhost:7233)
- `TEMPORAL_NAMESPACE`: Temporal namespace (default: default)
- `TEMPORAL_TASK_QUEUE`: Task queue name (default: engine)

## Testing

### Unit Tests

Test workflow logic in isolation using Temporal's testing framework:

```bash
yarn test
```

Tests cover:
- Queue management and deduplication
- Concurrency limit enforcement
- Signal handling (pause/resume/drain/stop)
- Retry logic with exponential backoff
- Continue-as-new state preservation

### Integration Tests

Cross-workflow communication and activity execution with real workflows and mocked external dependencies.

## Deployment

### Prerequisites

- Temporal server running
- Node.js 22+
- npm token for publishing (if using with build workflows)

### Running

1. **Start Temporal server**:
```bash
yarn infra:up
```

2. **Start the worker**:
```bash
yarn worker
```

3. **Monitor via Temporal UI**:
```
http://localhost:8233
```

### Production Checklist

- [ ] Temporal server is configured for production
- [ ] Worker restart policy is configured
- [ ] MCP API endpoint is verified
- [ ] Concurrency limits are tuned for your infrastructure
- [ ] Monitoring and alerting are in place
- [ ] Logging is configured to central sink
- [ ] Backup strategy for workflow state is in place

## API Reference

### Signals

**Send signals to orchestrator via Temporal client**:

```typescript
const handle = client.getHandle('continuous-builder-orchestrator');

// Add packages
await handle.signal('newPackages', [
  { name: '@bernierllc/core', priority: 1 },
  // ...
]);

// Pause processing
await handle.signal('pause');

// Resume processing
await handle.signal('resume');

// Graceful drain
await handle.signal('drain');

// Emergency stop
await handle.signal('emergencyStop');

// Adjust concurrency
await handle.signal('adjustConcurrency', 8);
```

### Queries

Query orchestrator state via Temporal client:

```typescript
const handle = client.getHandle('continuous-builder-orchestrator');

// Get current state (if exposed via query)
const state = await handle.query('getState');
```

## Examples

### Starting the Orchestrator

```typescript
import { Client } from '@temporalio/client';
import { ContinuousBuilderWorkflow } from '@coordinator/package-queue-orchestrator/workflows';
import { WORKFLOW_ID_REUSE_POLICY_ALLOW_DUPLICATE_FAILED_ONLY } from '@temporalio/client';

const client = new Client();

await client.workflow.start(ContinuousBuilderWorkflow, {
  workflowId: 'continuous-builder-orchestrator',
  taskQueue: 'engine',
  workflowIdReusePolicy: WORKFLOW_ID_REUSE_POLICY_ALLOW_DUPLICATE_FAILED_ONLY,
  args: [{
    maxConcurrent: 4,
    workspaceRoot: process.env.WORKSPACE_ROOT,
    config: { /* ... */ }
  }]
});
```

### Monitoring Build Progress

```typescript
const handle = client.getHandle('continuous-builder-orchestrator');

// Check if still running
const desc = await handle.describe();
console.log(`Status: ${desc.status}`);
console.log(`Execution time: ${desc.closeTime ? 'Complete' : 'Running'}`);
```

## Development

### Building

```bash
yarn build
```

### Running Tests

```bash
yarn test          # Run all tests once
yarn test:watch    # Run tests in watch mode
```

### Code Structure

- Workflows are pure functions with no side effects (use activities for I/O)
- Activities handle all external interactions (MCP API, package status updates)
- Types are defined in `src/types/index.ts` for consistency
- All signals and state are documented in type definitions

## Troubleshooting

### "Orchestrator already running" message

This is expected behavior - the worker ensures exactly one orchestrator instance runs at a time. If you need to restart, signal it to drain and exit first.

### "MCP query failed"

The poller logs errors but doesn't crash. The orchestrator continues processing the existing queue. Check MCP service availability and retry in 30 minutes (next cron tick).

### "Workflow appears stuck"

1. Check Temporal UI for active workflows: `http://localhost:8233`
2. Check worker logs for activity failures
3. Use `emergencyStop` signal if necessary to force exit
4. Restart worker to resume from last checkpoint

## References

- [Temporal Workflow Documentation](https://docs.temporal.io/workflows)
- [Temporal Cron Workflows](https://docs.temporal.io/workflows#cron-workflows)
- [Temporal Continue-As-New](https://docs.temporal.io/workflows#continue-as-new)
- [MCP Packages API](../../../docs/API.md)
- [Design Document](../../plans/2025-11-16-continuous-package-queue-orchestrator.md)

## License

MIT
