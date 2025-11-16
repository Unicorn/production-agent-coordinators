# Plan Writer Service Enhancements Design

**Date:** 2025-11-16
**Status:** Approved
**Author:** Claude Code (with Matt Bernier)

## Overview

Enhancements to the Plan Writer Service to enable:
1. Automated discovery of unpublished packages without plan files
2. Indefinite retry with backoff when waiting for parent plans
3. Signal-based communication between child and parent workflows
4. Continue-as-new to prevent unbounded workflow history growth

## Goals

- **Automated Discovery:** Hourly MCP scans to find packages needing plans
- **On-Demand Scanning:** Signal to trigger immediate MCP scan
- **Resilient Child Workflows:** Never fail due to missing parent plans, retry indefinitely
- **Unbounded Service Lifespan:** Continue-as-new preserves all state while preventing history overflow
- **Signal-based Coordination:** Children signal parent when discovering packages needing plans

## Architecture

### Three Workflow Types

1. **PlanWriterServiceWorkflow** (enhanced)
   - Long-running coordinator (workflow ID: `plan-writer-service`)
   - Handles signals from multiple sources
   - Implements continue-as-new at 3/4 of Temporal's history limit
   - Reconnects to child workflows after continue-as-new

2. **MCPScannerWorkflow** (new)
   - Cron-scheduled workflow (`@hourly`)
   - Queries MCP for unpublished packages without plan files
   - Signals PlanWriterServiceWorkflow with findings
   - Short-lived, no state persistence

3. **PlanWriterPackageWorkflow** (enhanced)
   - Child workflow for writing individual package plans
   - Fibonacci backoff for waiting on parent plans (indefinite retry)
   - Signals parent service when discovering packages needing plans

### Design Decisions

- **Cron Workflow Separation:** Scanner runs independently, doesn't add to main workflow history
- **Stable Workflow IDs:** Children use `plan-writer-package-{packageId}` for reconnection
- **Serializable State Only:** Continue-as-new preserves workflow IDs, not handles
- **Post-Continue Reconnection:** Parent uses `getExternalWorkflowHandle` to reconnect to children

## Component Design

### 1. MCP Scanner Cron Workflow

**Schedule:** `@hourly` (Temporal cron syntax)
**Workflow ID:** `mcp-scanner` (stable, reused by cron)
**Task Queue:** `plan-writer-service`

**Execution Flow:**
```
1. Cron triggers new workflow instance
2. Execute scanForUnplannedPackages activity
3. Activity queries MCP: GET /packages?filters[status]=published&filters[no_plan_file]=true
4. For each package found:
   - Signal plan-writer-service with package_plan_needed
5. Log results
6. Complete (cron starts new instance next hour)
```

**Activity Signature:**
```typescript
async function scanForUnplannedPackages(): Promise<PackageInfo[]> {
  // Query MCP API for packages matching criteria
  // Return array of {id, name, status, ...}
}
```

**Why This Works:**
- Each cron run is a fresh workflow (no history accumulation)
- Activity does heavy lifting (MCP queries)
- Main service receives lightweight signals
- Independent scheduling from main service

### 2. On-Demand MCP Scan Signal

**New Signal:** `trigger_mcp_scan`
**Handler Location:** PlanWriterServiceWorkflow
**Use Case:** Manual or event-triggered package discovery

**Implementation:**
```typescript
export const triggerMcpScanSignal = defineSignal<[]>('trigger_mcp_scan');

setHandler(triggerMcpScanSignal, async () => {
  console.log('[PlanWriterService] Manual scan triggered');

  const unplannedPackages = await mcpActivity.scanForUnplannedPackages();

  for (const pkg of unplannedPackages) {
    requestQueue.push({
      signalType: 'package_plan_needed',
      sourceService: 'manual-scan',
      targetService: 'plan-writer-service',
      packageId: pkg.id,
      timestamp: new Date().toISOString(),
      priority: 'normal',
      data: { reason: 'Manual scan discovery' }
    });
  }

  state.statistics.totalRequests += unplannedPackages.length;
});
```

### 3. Continue-as-New Implementation

**Trigger Threshold:** 37,500 events (3/4 of Temporal's ~50,000 event limit)
**Monitoring:** Check `workflowInfo().historyLength` in main loop

**State to Preserve:**
```typescript
interface ContinueAsNewState {
  // Pending requests
  requestQueue: ServiceSignalPayload<PackagePlanNeededPayload>[];

  // Active processing
  activeRequests: [string, PlanRequest][]; // Map entries

  // Child workflow IDs for reconnection
  spawnedChildIds: string[]; // e.g., 'plan-writer-package-bernierllc-my-package'

  // Statistics
  statistics: {
    totalRequests: number;
    totalCompleted: number;
    totalFailed: number;
  };

  // Service state
  serviceStatus: 'running' | 'paused' | 'initializing';

  // History
  completedPlans: string[];
  failedPlans: FailedPlan[];
}
```

**Continue-as-New Execution:**
```typescript
import { continueAsNew, workflowInfo } from '@temporalio/workflow';

// In main loop, check history length
const info = workflowInfo();
if (info.historyLength >= 37500) {
  console.log(`[PlanWriterService] History at ${info.historyLength}, continuing-as-new`);

  const stateSnapshot: ContinueAsNewState = {
    requestQueue: Array.from(requestQueue),
    activeRequests: Array.from(state.activeRequests.entries()),
    spawnedChildIds: Array.from(spawnedChildren.keys()).map(packageId =>
      `plan-writer-package-${packageId.replace('@', '').replace('/', '-')}`
    ),
    statistics: { ...state.statistics },
    serviceStatus: state.serviceStatus,
    completedPlans: [...state.completedPlans],
    failedPlans: [...state.failedPlans]
  };

  await continueAsNew<typeof PlanWriterServiceWorkflow>(stateSnapshot);
  return;
}
```

**State Restoration:**
```typescript
export async function PlanWriterServiceWorkflow(
  restoredState?: ContinueAsNewState
): Promise<void> {

  if (restoredState) {
    console.log('[PlanWriterService] Restoring from continue-as-new');

    // Restore all state
    state.statistics = restoredState.statistics;
    state.serviceStatus = restoredState.serviceStatus;
    state.completedPlans = restoredState.completedPlans;
    state.failedPlans = restoredState.failedPlans;

    requestQueue.push(...restoredState.requestQueue);

    for (const [packageId, request] of restoredState.activeRequests) {
      state.activeRequests.set(packageId, request);
    }

    // Reconnect to child workflows
    for (const childId of restoredState.spawnedChildIds) {
      const packageId = extractPackageIdFromWorkflowId(childId);
      const handle = getExternalWorkflowHandle(childId);
      spawnedChildren.set(packageId, handle);
    }
  }

  // Continue normal execution...
}
```

### 4. Fibonacci Backoff for Parent Plan Waiting

**Current Problem:** 30-minute timeout, child fails if parent not ready
**Solution:** Indefinite retry with Fibonacci backoff

**Sequence:** `1m → 2m → 3m → 5m → 8m → 13m → 21m → 30m (cap)`

**Implementation:**
```typescript
function* fibonacciBackoff(capMs: number) {
  let prev = 60000;  // 1 minute
  let curr = 60000;  // 1 minute

  while (true) {
    yield Math.min(curr, capMs);
    [prev, curr] = [curr, prev + curr];
  }
}

// In PlanWriterPackageWorkflow
const backoff = fibonacciBackoff(30 * 60 * 1000); // 30min cap

while (true) {
  const parentDetails = await mcp.queryPackageDetails(parentId);

  if (parentDetails.plan_file_path) {
    const planExists = await mcp.checkPlanExists(parentDetails.plan_file_path);
    if (planExists) {
      console.log(`[PlanWriterPackageWorkflow] Parent plan exists!`);
      break;
    }
  }

  const waitMs = backoff.next().value;
  console.log(`[PlanWriterPackageWorkflow] Parent not ready, waiting ${waitMs / 60000}m...`);
  await sleep(waitMs);
}
```

**Characteristics:**
- Never times out (retries forever)
- Responsive initially (1-minute checks)
- Backs off gracefully
- Caps at 30 minutes for reasonable polling
- Child stays alive until parent ready

### 5. Signal Flow Between Workflows

**Flow 1: Child Discovers Package Needing Plan**

When child workflow discovers a parent or sibling package needs a plan:

```typescript
import { getExternalWorkflowHandle } from '@temporalio/workflow';

const serviceHandle = getExternalWorkflowHandle('plan-writer-service');

await serviceHandle.signal(discoveredChildPackageSignal, {
  signalType: 'discovered_child_package',
  sourceService: 'plan-writer-service',
  targetService: 'plan-writer-service',
  packageId: discoveredPackageId,
  timestamp: new Date().toISOString(),
  priority: 'normal',
  data: {
    parentPackageId: input.packageId,
    reason: 'Missing parent plan - queuing parent',
    discoveryContext: 'parent-dependency'
  }
});
```

**Trigger Points:**
- Line 71 of plan-writer-package.workflow.ts: When parent has no plan
- Line 204 of plan-writer-package.workflow.ts: When children discovered

**Flow 2: Scanner Signals Service**

```typescript
const serviceHandle = getExternalWorkflowHandle('plan-writer-service');

for (const pkg of unplannedPackages) {
  await serviceHandle.signal(packagePlanNeededSignal, {
    signalType: 'package_plan_needed',
    sourceService: 'mcp-scanner',
    targetService: 'plan-writer-service',
    packageId: pkg.id,
    timestamp: new Date().toISOString(),
    priority: 'low', // Scanner discoveries are lower priority
    data: {
      reason: 'Published package without plan file',
      context: { scanType: 'scheduled' }
    }
  });
}
```

## Implementation Phases

### Phase 1: New MCP Activity
- Create `scanForUnplannedPackages` activity
- Query MCP for packages matching criteria
- Return package info array

### Phase 2: MCP Scanner Cron Workflow
- Create MCPScannerWorkflow
- Configure cron schedule (`@hourly`)
- Integrate scan activity
- Signal main service with findings

### Phase 3: On-Demand Scan Signal
- Add `trigger_mcp_scan` signal to PlanWriterServiceWorkflow
- Implement handler to execute scan activity
- Queue discovered packages

### Phase 4: Continue-as-New
- Define `ContinueAsNewState` type
- Add state parameter to PlanWriterServiceWorkflow
- Implement state restoration logic
- Add history length monitoring in main loop
- Implement continue-as-new with state snapshot
- Add child workflow reconnection logic

### Phase 5: Fibonacci Backoff
- Create Fibonacci backoff generator
- Replace timeout-based parent waiting in PlanWriterPackageWorkflow
- Implement indefinite retry loop
- Add logging for wait intervals

### Phase 6: Child-to-Parent Signaling
- Implement signaling when parent plan missing
- Implement signaling when children discovered
- Use `getExternalWorkflowHandle` to find parent service
- Update TODO comments with actual implementation

### Phase 7: Testing
- Unit tests for Fibonacci backoff generator
- Integration tests for continue-as-new state preservation
- Integration tests for scanner workflow
- End-to-end tests for signal flow

## Testing Strategy

### Unit Tests
- Fibonacci backoff sequence generation
- State serialization/deserialization
- Workflow ID extraction utilities

### Integration Tests
- Scanner discovers packages and signals service
- Service receives scanner signals and queues packages
- Child signals parent when discovering packages
- Continue-as-new preserves all state correctly
- Child workflows reconnect after continue-as-new

### End-to-End Tests
- Full flow: scanner → service → child → parent plan wait → completion
- Trigger continue-as-new and verify seamless transition
- Verify child workflows continue running across parent continue-as-new

## Acceptance Criteria

- [ ] Scanner workflow runs hourly and discovers unpublished packages
- [ ] On-demand scan signal triggers immediate MCP query
- [ ] Child workflows retry indefinitely with Fibonacci backoff (no timeouts)
- [ ] Service workflow continues-as-new at 3/4 history limit
- [ ] All state preserved across continue-as-new
- [ ] Child workflows reconnect successfully after parent continue-as-new
- [ ] Child workflows signal parent when discovering packages needing plans
- [ ] All tests pass

## Open Questions

None - all design questions resolved during brainstorming.

## Future Enhancements

- Priority-based queue processing (high priority packages first)
- Metrics/observability for scanner and continue-as-new events
- Admin API for triggering scans, pausing service, viewing state
- Graceful shutdown (drain queue before continuing-as-new)
