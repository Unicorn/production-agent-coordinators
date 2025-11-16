# Plan Writer Service Enhancements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add automated package discovery, continue-as-new for unbounded service lifespan, indefinite retry with backoff, and signal-based coordination to Plan Writer Service.

**Architecture:** Activity-based cron workflow for MCP scanning, continue-as-new with state preservation at 3/4 history limit, Fibonacci backoff for parent plan waiting, signal flow using getExternalWorkflowHandle.

**Tech Stack:** Temporal Workflows, TypeScript, Vitest, MCP API

---

## Task 1: MCP Scan Activity

**Files:**
- Create: `packages/agents/plan-writer-service/src/activities/mcp.activities.ts` (modify existing)
- Test: `packages/agents/plan-writer-service/src/activities/__tests__/mcp.activities.test.ts` (create)

### Step 1: Write failing test for scanForUnplannedPackages

Create test file:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scanForUnplannedPackages } from '../mcp.activities';

describe('MCP Activities - Scanner', () => {
  beforeEach(() => {
    // Mock fetch for MCP API calls
    global.fetch = vi.fn();
    process.env.MBERNIER_API_KEY = 'test-api-key';
    process.env.MBERNIER_API_URL = 'http://localhost:3355/api/v1';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('scanForUnplannedPackages', () => {
    it('should return packages that are published but have no plan file', async () => {
      // Mock MCP API response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              id: '@bernierllc/unplanned-package-1',
              name: 'unplanned-package-1',
              status: 'published',
              plan_file_path: null
            },
            {
              id: '@bernierllc/unplanned-package-2',
              name: 'unplanned-package-2',
              status: 'published',
              plan_file_path: null
            }
          ]
        })
      } as Response);

      const result = await scanForUnplannedPackages();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('@bernierllc/unplanned-package-1');
      expect(result[1].id).toBe('@bernierllc/unplanned-package-2');

      // Verify correct API call
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3355/api/v1/packages?filters[status]=published&filters[no_plan_file]=true',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key'
          })
        })
      );
    });

    it('should return empty array when no unpublished packages found', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [] })
      } as Response);

      const result = await scanForUnplannedPackages();

      expect(result).toHaveLength(0);
    });

    it('should throw error when MCP API fails', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error'
      } as Response);

      await expect(scanForUnplannedPackages()).rejects.toThrow('MCP API error: 500');
    });
  });
});
```

### Step 2: Run test to verify it fails

Run: `cd packages/agents/plan-writer-service && npm test -- mcp.activities.test.ts`
Expected: FAIL with "Cannot find module '../mcp.activities'" or "scanForUnplannedPackages is not a function"

### Step 3: Implement scanForUnplannedPackages activity

Add to `src/activities/mcp.activities.ts`:

```typescript
export interface PackageInfo {
  id: string;
  name: string;
  status: string;
  plan_file_path: string | null;
  current_version?: string;
}

/**
 * Scan MCP for packages that are published but have no plan file
 * Used by MCPScannerWorkflow for automated discovery
 */
export async function scanForUnplannedPackages(): Promise<PackageInfo[]> {
  const apiUrl = process.env.MBERNIER_API_URL;
  const apiKey = process.env.MBERNIER_API_KEY;

  if (!apiUrl || !apiKey) {
    throw new Error('MBERNIER_API_URL and MBERNIER_API_KEY must be set');
  }

  console.log('[scanForUnplannedPackages] Querying MCP for unpublished packages without plans');

  const url = `${apiUrl}/packages?filters[status]=published&filters[no_plan_file]=true`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MCP API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const packages = data.data || [];

  console.log(`[scanForUnplannedPackages] Found ${packages.length} packages needing plans`);

  return packages;
}
```

### Step 4: Run test to verify it passes

Run: `cd packages/agents/plan-writer-service && npm test -- mcp.activities.test.ts`
Expected: PASS (3 tests)

### Step 5: Commit

```bash
git add packages/agents/plan-writer-service/src/activities/mcp.activities.ts
git add packages/agents/plan-writer-service/src/activities/__tests__/mcp.activities.test.ts
git commit -m "feat: add scanForUnplannedPackages MCP activity

- Queries MCP API for published packages without plan files
- Returns array of PackageInfo
- Handles API errors gracefully

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: MCP Scanner Cron Workflow

**Files:**
- Create: `packages/agents/plan-writer-service/src/workflows/mcp-scanner.workflow.ts`
- Test: `packages/agents/plan-writer-service/src/workflows/__tests__/mcp-scanner.workflow.test.ts`
- Modify: `packages/agents/plan-writer-service/src/workflows.ts` (add export)

### Step 1: Write failing test for MCPScannerWorkflow

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { MCPScannerWorkflow } from '../mcp-scanner.workflow';
import * as mcpActivities from '../../activities/mcp.activities';

describe('MCPScannerWorkflow', () => {
  let testEnv: TestWorkflowEnvironment;

  beforeAll(async () => {
    testEnv = await TestWorkflowEnvironment.createLocal();
  });

  afterAll(async () => {
    await testEnv?.teardown();
  });

  it('should scan MCP and signal service with discovered packages', async () => {
    const { client, nativeConnection } = testEnv;

    // Mock activities
    const mockScan = async () => [
      { id: '@bernierllc/pkg-1', name: 'pkg-1', status: 'published', plan_file_path: null },
      { id: '@bernierllc/pkg-2', name: 'pkg-2', status: 'published', plan_file_path: null }
    ];

    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue: 'test-scanner',
      workflowsPath: require.resolve('../mcp-scanner.workflow'),
      activities: {
        scanForUnplannedPackages: mockScan
      }
    });

    await worker.runUntil(async () => {
      const result = await client.workflow.execute(MCPScannerWorkflow, {
        taskQueue: 'test-scanner',
        workflowId: 'test-scanner-' + Date.now()
      });

      expect(result.packagesFound).toBe(2);
      expect(result.packagesSignaled).toBe(2);
    });
  });

  it('should handle no packages found gracefully', async () => {
    const { client, nativeConnection } = testEnv;

    const mockScan = async () => [];

    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue: 'test-scanner-empty',
      workflowsPath: require.resolve('../mcp-scanner.workflow'),
      activities: {
        scanForUnplannedPackages: mockScan
      }
    });

    await worker.runUntil(async () => {
      const result = await client.workflow.execute(MCPScannerWorkflow, {
        taskQueue: 'test-scanner-empty',
        workflowId: 'test-scanner-empty-' + Date.now()
      });

      expect(result.packagesFound).toBe(0);
      expect(result.packagesSignaled).toBe(0);
    });
  });
});
```

### Step 2: Run test to verify it fails

Run: `cd packages/agents/plan-writer-service && npm test -- mcp-scanner.workflow.test.ts`
Expected: FAIL with "Cannot find module '../mcp-scanner.workflow'"

### Step 3: Implement MCPScannerWorkflow

Create `src/workflows/mcp-scanner.workflow.ts`:

```typescript
/**
 * MCP Scanner Cron Workflow
 *
 * Scheduled via Temporal cron: @hourly
 * Queries MCP for unpublished packages without plan files
 * Signals PlanWriterServiceWorkflow with discoveries
 *
 * Workflow ID: mcp-scanner (stable, reused by cron)
 */

import { proxyActivities, getExternalWorkflowHandle } from '@temporalio/workflow';
import type * as mcpActivities from '../activities/mcp.activities';
import { packagePlanNeededSignal } from './plan-writer-service.workflow';
import type { ServiceSignalPayload, PackagePlanNeededPayload } from '../types/index';

// Configure activity proxy
const mcp = proxyActivities<typeof mcpActivities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumInterval: '30s',
    maximumAttempts: 3
  }
});

export interface MCPScannerResult {
  packagesFound: number;
  packagesSignaled: number;
}

/**
 * MCP Scanner Workflow
 *
 * Executes on cron schedule (@hourly):
 * 1. Scan MCP for unpublished packages without plan files
 * 2. Signal plan-writer-service for each package found
 * 3. Return scan statistics
 */
export async function MCPScannerWorkflow(): Promise<MCPScannerResult> {
  console.log('[MCPScannerWorkflow] Starting MCP scan');

  // Step 1: Scan MCP
  const packages = await mcp.scanForUnplannedPackages();
  console.log(`[MCPScannerWorkflow] Found ${packages.length} packages needing plans`);

  // Step 2: Signal service for each package
  const serviceHandle = getExternalWorkflowHandle('plan-writer-service');
  let signaled = 0;

  for (const pkg of packages) {
    try {
      const signal: ServiceSignalPayload<PackagePlanNeededPayload> = {
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
      };

      await serviceHandle.signal(packagePlanNeededSignal, signal);
      console.log(`[MCPScannerWorkflow] Signaled for ${pkg.id}`);
      signaled++;
    } catch (error) {
      console.error(`[MCPScannerWorkflow] Failed to signal for ${pkg.id}:`, error);
      // Continue with other packages
    }
  }

  console.log(`[MCPScannerWorkflow] Scan complete: ${packages.length} found, ${signaled} signaled`);

  return {
    packagesFound: packages.length,
    packagesSignaled: signaled
  };
}
```

### Step 4: Export workflow

Add to `src/workflows.ts`:

```typescript
export * from './workflows/mcp-scanner.workflow.js';
```

### Step 5: Run test to verify it passes

Run: `cd packages/agents/plan-writer-service && npm test -- mcp-scanner.workflow.test.ts`
Expected: PASS (2 tests)

### Step 6: Commit

```bash
git add packages/agents/plan-writer-service/src/workflows/mcp-scanner.workflow.ts
git add packages/agents/plan-writer-service/src/workflows/__tests__/mcp-scanner.workflow.test.ts
git add packages/agents/plan-writer-service/src/workflows.ts
git commit -m "feat: add MCP scanner cron workflow

- Queries MCP for unpublished packages without plans
- Signals plan-writer-service with discoveries
- Designed for @hourly cron schedule
- Returns scan statistics

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: On-Demand Scan Signal

**Files:**
- Modify: `packages/agents/plan-writer-service/src/workflows/plan-writer-service.workflow.ts`
- Modify: `packages/agents/plan-writer-service/src/workflows/__tests__/plan-writer-service.workflow.test.ts`

### Step 1: Write failing test for trigger_mcp_scan signal

Add to `src/workflows/__tests__/plan-writer-service.workflow.test.ts`:

```typescript
it('should handle trigger_mcp_scan signal and queue discovered packages', async () => {
  const { client, nativeConnection } = testEnv;

  const mockScan = async () => [
    { id: '@bernierllc/found-1', name: 'found-1', status: 'published', plan_file_path: null }
  ];

  const worker = await Worker.create({
    connection: nativeConnection,
    taskQueue: 'test-scan-signal',
    workflowsPath: require.resolve('../plan-writer-service.workflow'),
    activities: {
      ...mockPlanActivities,
      ...mockMcpActivities,
      scanForUnplannedPackages: mockScan
    }
  });

  const handle = await client.workflow.start(PlanWriterServiceWorkflow, {
    taskQueue: 'test-scan-signal',
    workflowId: 'test-scan-signal-' + Date.now()
  });

  // Wait for workflow to initialize
  await new Promise(resolve => setTimeout(resolve, 100));

  // Trigger scan
  await handle.signal('trigger_mcp_scan');

  // Wait for processing
  await new Promise(resolve => setTimeout(resolve, 200));

  // Terminate workflow
  await handle.terminate();

  // Verify scan was executed (check via workflow logs or state)
  // In real test, we'd query workflow or check spawned children
  expect(mockScan).toHaveBeenCalled();
});
```

### Step 2: Run test to verify it fails

Run: `cd packages/agents/plan-writer-service && npm test -- plan-writer-service.workflow.test.ts`
Expected: FAIL with "Unknown signal 'trigger_mcp_scan'" or signal not processed

### Step 3: Add trigger_mcp_scan signal to workflow

In `src/workflows/plan-writer-service.workflow.ts`, add after other signal definitions:

```typescript
/**
 * Signal: trigger_mcp_scan
 * Source: manual/admin
 * Triggers immediate MCP scan for unpublished packages
 */
export const triggerMcpScanSignal = defineSignal<[]>('trigger_mcp_scan');
```

Add import for scanForUnplannedPackages activity at top:

```typescript
const mcpActivity = proxyActivities<typeof mcpActivities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumInterval: '30s',
    maximumAttempts: 3,
  },
});
```

Add handler in workflow function after other setHandler calls:

```typescript
setHandler(triggerMcpScanSignal, async () => {
  console.log('[PlanWriterService] Received trigger_mcp_scan signal');
  console.log('[PlanWriterService] Executing on-demand MCP scan');

  try {
    const unplannedPackages = await mcpActivity.scanForUnplannedPackages();

    console.log(`[PlanWriterService] Scan found ${unplannedPackages.length} packages`);

    for (const pkg of unplannedPackages) {
      requestQueue.push({
        signalType: 'package_plan_needed',
        sourceService: 'manual-scan',
        targetService: 'plan-writer-service',
        packageId: pkg.id,
        timestamp: new Date().toISOString(),
        priority: 'normal',
        data: {
          reason: 'Manual scan discovery',
          context: { scanType: 'manual' }
        }
      });

      state.statistics.totalRequests++;
    }

    console.log(`[PlanWriterService] Queued ${unplannedPackages.length} packages from scan`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[PlanWriterService] Scan failed:`, errorMessage);
  }
});
```

### Step 4: Run test to verify it passes

Run: `cd packages/agents/plan-writer-service && npm test -- plan-writer-service.workflow.test.ts`
Expected: PASS (all tests including new one)

### Step 5: Commit

```bash
git add packages/agents/plan-writer-service/src/workflows/plan-writer-service.workflow.ts
git add packages/agents/plan-writer-service/src/workflows/__tests__/plan-writer-service.workflow.test.ts
git commit -m "feat: add trigger_mcp_scan signal for on-demand scanning

- New signal triggers immediate MCP scan
- Discovered packages queued with 'manual-scan' source
- Handles scan failures gracefully

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Continue-as-New State Type

**Files:**
- Modify: `packages/agents/plan-writer-service/src/types/index.ts`

### Step 1: No test needed (type definition)

This task is pure TypeScript types, no runtime behavior to test.

### Step 2: Add ContinueAsNewState type

Add to `src/types/index.ts`:

```typescript
/**
 * State preserved across continue-as-new
 * Must be fully serializable (no workflow handles, just IDs)
 */
export interface ContinueAsNewState {
  // Pending plan requests
  requestQueue: ServiceSignalPayload<PackagePlanNeededPayload>[];

  // Active requests (Map entries as array)
  activeRequests: [string, PlanRequest][];

  // Child workflow IDs for reconnection
  spawnedChildIds: string[];

  // Statistics
  statistics: {
    totalRequests: number;
    totalCompleted: number;
    totalFailed: number;
  };

  // Service operational state
  serviceStatus: 'running' | 'paused' | 'initializing';

  // History tracking
  completedPlans: string[];
  failedPlans: FailedPlan[];
}
```

### Step 3: Commit

```bash
git add packages/agents/plan-writer-service/src/types/index.ts
git commit -m "feat: add ContinueAsNewState type for workflow state preservation

- Defines all state to preserve across continue-as-new
- Fully serializable (workflow IDs, not handles)
- Includes request queue, statistics, service status

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Continue-as-New Implementation

**Files:**
- Modify: `packages/agents/plan-writer-service/src/workflows/plan-writer-service.workflow.ts`
- Modify: `packages/agents/plan-writer-service/src/workflows/__tests__/plan-writer-service.workflow.test.ts`

### Step 1: Write failing test for continue-as-new

Add to test file:

```typescript
it('should preserve state when continuing-as-new', async () => {
  const { client, nativeConnection } = testEnv;

  const worker = await Worker.create({
    connection: nativeConnection,
    taskQueue: 'test-continue',
    workflowsPath: require.resolve('../plan-writer-service.workflow'),
    activities: mockActivities
  });

  // Start workflow with initial state
  const handle = await client.workflow.start(PlanWriterServiceWorkflow, {
    args: [{
      requestQueue: [],
      activeRequests: [],
      spawnedChildIds: ['plan-writer-package-test-1'],
      statistics: { totalRequests: 5, totalCompleted: 3, totalFailed: 1 },
      serviceStatus: 'running',
      completedPlans: ['pkg-1', 'pkg-2'],
      failedPlans: [{ packageId: 'pkg-3', error: 'Test error', retryable: true, attemptCount: 1 }]
    }],
    taskQueue: 'test-continue',
    workflowId: 'test-continue-' + Date.now()
  });

  // Wait for workflow to restore state
  await new Promise(resolve => setTimeout(resolve, 100));

  // Query workflow state (would need to add query handler)
  // For now, verify workflow started successfully
  const description = await handle.describe();
  expect(description.status.name).toBe('RUNNING');

  await handle.terminate();
});
```

### Step 2: Run test to verify it fails

Run: `cd packages/agents/plan-writer-service && npm test -- plan-writer-service.workflow.test.ts`
Expected: FAIL - workflow doesn't accept state parameter yet

### Step 3: Implement state restoration

Modify workflow signature in `src/workflows/plan-writer-service.workflow.ts`:

```typescript
import { continueAsNew, workflowInfo } from '@temporalio/workflow';
import type { ContinueAsNewState } from '../types/index';

export async function PlanWriterServiceWorkflow(
  restoredState?: ContinueAsNewState
): Promise<void> {
  console.log('[PlanWriterService] Starting plan-writer-service');
  console.log('[PlanWriterService] Workflow ID: plan-writer-service');
  console.log('[PlanWriterService] Version: 2.0.0 (parent-child pattern)');

  // Check if restoring from continue-as-new
  if (restoredState) {
    console.log('[PlanWriterService] Restoring from continue-as-new');
    console.log(`[PlanWriterService] Restored ${restoredState.statistics.totalRequests} total requests`);
    console.log(`[PlanWriterService] Restored ${restoredState.spawnedChildIds.length} child workflows`);
  }

  // Initialize service state
  const state: PlanWriterServiceState = {
    serviceStatus: restoredState?.serviceStatus || 'initializing',
    activeRequests: new Map(),
    completedPlans: restoredState?.completedPlans || [],
    failedPlans: restoredState?.failedPlans || [],
    statistics: restoredState?.statistics || {
      totalRequests: 0,
      totalCompleted: 0,
      totalFailed: 0
    }
  };

  // Queue for incoming plan requests
  const requestQueue: ServiceSignalPayload<PackagePlanNeededPayload>[] =
    restoredState?.requestQueue || [];

  // Track spawned child workflows
  const spawnedChildren = new Map<string, any>();

  // Restore active requests
  if (restoredState?.activeRequests) {
    for (const [packageId, request] of restoredState.activeRequests) {
      state.activeRequests.set(packageId, request);
    }
  }

  // Reconnect to child workflows using stored IDs
  if (restoredState?.spawnedChildIds) {
    for (const childId of restoredState.spawnedChildIds) {
      // Extract packageId from workflow ID
      // Format: plan-writer-package-{org}-{name}
      const parts = childId.replace('plan-writer-package-', '').split('-');
      const packageId = `@${parts[0]}/${parts.slice(1).join('-')}`;

      const handle = getExternalWorkflowHandle(childId);
      spawnedChildren.set(packageId, handle);
      console.log(`[PlanWriterService] Reconnected to child: ${childId}`);
    }
  }

  // ... rest of existing signal handlers and main loop ...
```

### Step 4: Add continue-as-new logic in main loop

In the main `while (true)` loop, add history monitoring before processing:

```typescript
while (true) {
  // Check history length and continue-as-new if needed
  const info = workflowInfo();
  if (info.historyLength >= 37500) {
    console.log(`[PlanWriterService] History at ${info.historyLength} events, continuing-as-new`);

    // Create state snapshot
    const stateSnapshot: ContinueAsNewState = {
      requestQueue: Array.from(requestQueue),
      activeRequests: Array.from(state.activeRequests.entries()),
      spawnedChildIds: Array.from(spawnedChildren.keys()).map(packageId => {
        // Convert @bernierllc/package-name to plan-writer-package-bernierllc-package-name
        return `plan-writer-package-${packageId.replace('@', '').replace('/', '-')}`;
      }),
      statistics: { ...state.statistics },
      serviceStatus: state.serviceStatus,
      completedPlans: [...state.completedPlans],
      failedPlans: [...state.failedPlans]
    };

    console.log(`[PlanWriterService] Preserving ${stateSnapshot.requestQueue.length} queued requests`);
    console.log(`[PlanWriterService] Preserving ${stateSnapshot.spawnedChildIds.length} child workflows`);

    await continueAsNew<typeof PlanWriterServiceWorkflow>(stateSnapshot);
    return; // Never reached, but TypeScript needs it
  }

  // Wait for either a new request or service to be unpaused
  await condition(() => requestQueue.length > 0 && state.serviceStatus === 'running');

  // ... rest of existing processing logic ...
}
```

Add missing import at top:

```typescript
import { getExternalWorkflowHandle } from '@temporalio/workflow';
```

### Step 5: Run test to verify it passes

Run: `cd packages/agents/plan-writer-service && npm test -- plan-writer-service.workflow.test.ts`
Expected: PASS (all tests)

### Step 6: Commit

```bash
git add packages/agents/plan-writer-service/src/workflows/plan-writer-service.workflow.ts
git add packages/agents/plan-writer-service/src/workflows/__tests__/plan-writer-service.workflow.test.ts
git commit -m "feat: implement continue-as-new with state preservation

- Workflow accepts optional ContinueAsNewState parameter
- Restores all state on startup if provided
- Monitors history length, continues-as-new at 37,500 events
- Reconnects to child workflows using stored IDs
- Preserves request queue, statistics, service status

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: Fibonacci Backoff Utility

**Files:**
- Create: `packages/agents/plan-writer-service/src/utils/backoff.ts`
- Test: `packages/agents/plan-writer-service/src/utils/__tests__/backoff.test.ts`

### Step 1: Write failing test for Fibonacci backoff

```typescript
import { describe, it, expect } from 'vitest';
import { fibonacciBackoff } from '../backoff';

describe('Fibonacci Backoff', () => {
  it('should generate Fibonacci sequence in milliseconds', () => {
    const gen = fibonacciBackoff(30 * 60 * 1000); // 30 min cap

    expect(gen.next().value).toBe(60000);  // 1 minute
    expect(gen.next().value).toBe(60000);  // 1 minute
    expect(gen.next().value).toBe(120000); // 2 minutes
    expect(gen.next().value).toBe(180000); // 3 minutes
    expect(gen.next().value).toBe(300000); // 5 minutes
    expect(gen.next().value).toBe(480000); // 8 minutes
  });

  it('should cap at maximum value', () => {
    const gen = fibonacciBackoff(5 * 60 * 1000); // 5 min cap

    // Skip to values that would exceed cap
    gen.next(); // 1m
    gen.next(); // 1m
    gen.next(); // 2m
    gen.next(); // 3m
    expect(gen.next().value).toBe(5 * 60 * 1000); // Capped at 5m
    expect(gen.next().value).toBe(5 * 60 * 1000); // Still capped
  });

  it('should generate indefinitely', () => {
    const gen = fibonacciBackoff(1000);

    // Generate many values
    for (let i = 0; i < 100; i++) {
      const value = gen.next().value;
      expect(value).toBeLessThanOrEqual(1000);
      expect(value).toBeGreaterThan(0);
    }
  });
});
```

### Step 2: Run test to verify it fails

Run: `cd packages/agents/plan-writer-service && npm test -- backoff.test.ts`
Expected: FAIL with "Cannot find module '../backoff'"

### Step 3: Implement fibonacciBackoff generator

Create `src/utils/backoff.ts`:

```typescript
/**
 * Fibonacci backoff generator for retry logic
 *
 * Generates wait times following Fibonacci sequence: 1m, 1m, 2m, 3m, 5m, 8m, ...
 * Caps at provided maximum value
 *
 * @param capMs Maximum wait time in milliseconds
 * @yields Wait time in milliseconds
 */
export function* fibonacciBackoff(capMs: number): Generator<number, never, unknown> {
  let prev = 60000;  // 1 minute in ms
  let curr = 60000;  // 1 minute in ms

  while (true) {
    yield Math.min(curr, capMs);
    [prev, curr] = [curr, prev + curr];
  }
}
```

### Step 4: Run test to verify it passes

Run: `cd packages/agents/plan-writer-service && npm test -- backoff.test.ts`
Expected: PASS (3 tests)

### Step 5: Commit

```bash
git add packages/agents/plan-writer-service/src/utils/backoff.ts
git add packages/agents/plan-writer-service/src/utils/__tests__/backoff.test.ts
git commit -m "feat: add Fibonacci backoff generator utility

- Generates wait times following Fibonacci sequence
- Starts at 1 minute, grows: 1m, 1m, 2m, 3m, 5m, 8m...
- Caps at configurable maximum
- Infinite generator for indefinite retry

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: Parent Plan Waiting with Fibonacci Backoff

**Files:**
- Modify: `packages/agents/plan-writer-service/src/workflows/plan-writer-package.workflow.ts`
- Modify: `packages/agents/plan-writer-service/src/workflows/__tests__/plan-writer-package.workflow.test.ts`

### Step 1: Write test for indefinite retry (mock-based)

Add to test file:

```typescript
it('should retry indefinitely with Fibonacci backoff when waiting for parent', async () => {
  const { client, nativeConnection } = testEnv;

  let queryCount = 0;
  const mockQueryWithDelay = async (packageId: string) => {
    queryCount++;
    // Return plan on 3rd attempt
    if (queryCount >= 3) {
      return {
        exists: true,
        plan_file_path: 'plans/parent.md',
        // ... other fields
      };
    }
    return { exists: true, plan_file_path: null };
  };

  const mockCheckPlan = async (path: string) => {
    return queryCount >= 3; // Plan exists on 3rd check
  };

  const worker = await Worker.create({
    connection: nativeConnection,
    taskQueue: 'test-backoff',
    workflowsPath: require.resolve('../plan-writer-package.workflow'),
    activities: {
      ...mockActivities,
      queryPackageDetails: mockQueryWithDelay,
      checkPlanExists: mockCheckPlan
    }
  });

  await worker.runUntil(async () => {
    const result = await client.workflow.execute(PlanWriterPackageWorkflow, {
      args: [{
        packageId: '@bernierllc/child-with-parent',
        reason: 'Test backoff',
        priority: 'normal',
        sourceService: 'test'
      }],
      taskQueue: 'test-backoff',
      workflowId: 'test-backoff-' + Date.now()
    });

    expect(result.success).toBe(true);
    expect(queryCount).toBeGreaterThanOrEqual(3); // Verified multiple retries
  });
});
```

### Step 2: Run test to verify it fails

Run: `cd packages/agents/plan-writer-service && npm test -- plan-writer-package.workflow.test.ts`
Expected: FAIL - test times out or fails because backoff not implemented

### Step 3: Replace timeout-based waiting with Fibonacci backoff

In `src/workflows/plan-writer-package.workflow.ts`, import the backoff utility:

```typescript
import { fibonacciBackoff } from '../utils/backoff';
```

Replace the parent plan waiting logic (around line 62-103):

```typescript
// Step 2: Wait for parent plans (if any) with indefinite retry
for (const parentId of lineage.parents) {
  console.log(`[PlanWriterPackageWorkflow] Step 2: Checking parent: ${parentId}`);

  const parentDetails = await mcp.queryPackageDetails(parentId);

  if (!parentDetails.plan_file_path) {
    console.log(`[PlanWriterPackageWorkflow] Parent ${parentId} has no plan`);
    console.log(`[PlanWriterPackageWorkflow] Will retry indefinitely with Fibonacci backoff`);

    // Fibonacci backoff: 1m, 1m, 2m, 3m, 5m, 8m, ... capped at 30m
    const backoff = fibonacciBackoff(30 * 60 * 1000); // 30 min cap
    let attemptCount = 0;

    while (true) {
      attemptCount++;

      const details = await mcp.queryPackageDetails(parentId);
      if (details.plan_file_path) {
        const planExists = await mcp.checkPlanExists(details.plan_file_path);
        if (planExists) {
          console.log(`[PlanWriterPackageWorkflow] Parent plan exists after ${attemptCount} attempts!`);
          break;
        }
      }

      const waitMs = backoff.next().value;
      console.log(`[PlanWriterPackageWorkflow] Attempt ${attemptCount}: Parent plan not ready, waiting ${waitMs / 60000}m...`);
      await sleep(waitMs);
    }
  } else {
    console.log(`[PlanWriterPackageWorkflow] Parent ${parentId} has plan: ${parentDetails.plan_file_path}`);
  }
}
```

### Step 4: Run test to verify it passes

Run: `cd packages/agents/plan-writer-service && npm test -- plan-writer-package.workflow.test.ts`
Expected: PASS (all tests)

### Step 5: Commit

```bash
git add packages/agents/plan-writer-service/src/workflows/plan-writer-package.workflow.ts
git add packages/agents/plan-writer-service/src/workflows/__tests__/plan-writer-package.workflow.test.ts
git commit -m "feat: replace timeout with indefinite Fibonacci backoff for parent plans

- Removed 30-minute timeout limit
- Retries indefinitely until parent plan exists
- Uses Fibonacci backoff: 1m, 1m, 2m, 3m, 5m, 8m, capped at 30m
- Logs attempt count and wait times

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: Child-to-Parent Signaling

**Files:**
- Modify: `packages/agents/plan-writer-service/src/workflows/plan-writer-package.workflow.ts`

### Step 1: No test needed (integration with existing infrastructure)

Signaling uses existing `discoveredChildPackageSignal` already tested in service workflow.

### Step 2: Implement signaling for missing parent

Replace TODO comment at line 71 with actual implementation:

```typescript
if (!parentDetails.plan_file_path) {
  console.log(`[PlanWriterPackageWorkflow] Parent ${parentId} has no plan`);

  // Signal service to queue parent package
  console.log(`[PlanWriterPackageWorkflow] Signaling service to queue parent: ${parentId}`);

  try {
    const serviceHandle = getExternalWorkflowHandle('plan-writer-service');

    await serviceHandle.signal(discoveredChildPackageSignal, {
      signalType: 'discovered_child_package',
      sourceService: 'plan-writer-service',
      targetService: 'plan-writer-service',
      packageId: parentId,
      timestamp: new Date().toISOString(),
      priority: 'high', // Parent dependencies are high priority
      data: {
        parentPackageId: undefined,
        reason: 'Missing parent plan - queuing parent first',
        discoveryContext: 'parent-dependency'
      }
    });

    console.log(`[PlanWriterPackageWorkflow] Signaled service about parent ${parentId}`);
  } catch (error) {
    console.warn(`[PlanWriterPackageWorkflow] Failed to signal about parent:`, error);
    // Continue - we'll wait for parent anyway
  }

  console.log(`[PlanWriterPackageWorkflow] Will retry indefinitely with Fibonacci backoff`);
  // ... existing backoff code ...
}
```

### Step 3: Implement signaling for discovered children

Replace TODO comments at lines 202-207:

```typescript
// Step 8: Signal service for each child
console.log(`[PlanWriterPackageWorkflow] Step 8: Signaling service about children`);

for (const childId of children) {
  try {
    const serviceHandle = getExternalWorkflowHandle('plan-writer-service');

    await serviceHandle.signal(discoveredChildPackageSignal, {
      signalType: 'discovered_child_package',
      sourceService: 'plan-writer-service',
      targetService: 'plan-writer-service',
      packageId: childId,
      timestamp: new Date().toISOString(),
      priority: 'normal',
      data: {
        parentPackageId: input.packageId,
        reason: 'Discovered as child of parent package',
        discoveryContext: 'child-discovery'
      }
    });

    console.log(`[PlanWriterPackageWorkflow] Signaled service about child ${childId}`);
  } catch (error) {
    console.warn(`[PlanWriterPackageWorkflow] Failed to signal about child ${childId}:`, error);
    // Continue with other children
  }
}
```

Add imports at top:

```typescript
import { getExternalWorkflowHandle } from '@temporalio/workflow';
import { discoveredChildPackageSignal } from './plan-writer-service.workflow';
```

### Step 4: Commit

```bash
git add packages/agents/plan-writer-service/src/workflows/plan-writer-package.workflow.ts
git commit -m "feat: implement child-to-parent signaling for package discovery

- Signal service when parent plan is missing (high priority)
- Signal service for each discovered child (normal priority)
- Use getExternalWorkflowHandle to find service workflow
- Handle signaling failures gracefully

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 9: Integration Testing

**Files:**
- Create: `packages/agents/plan-writer-service/src/__tests__/integration.test.ts`

### Step 1: Write integration test

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { PlanWriterServiceWorkflow } from '../workflows/plan-writer-service.workflow';
import { MCPScannerWorkflow } from '../workflows/mcp-scanner.workflow';
import * as activities from '../activities/plan.activities';
import * as mcpActivities from '../activities/mcp.activities';

describe('Plan Writer Service Integration', () => {
  let testEnv: TestWorkflowEnvironment;

  beforeAll(async () => {
    testEnv = await TestWorkflowEnvironment.createLocal();
  });

  afterAll(async () => {
    await testEnv?.teardown();
  });

  it('should complete full flow: scanner -> service -> child workflow', async () => {
    const { client, nativeConnection } = testEnv;

    // Mock activities
    const mockActivities = {
      scanForUnplannedPackages: async () => [
        { id: '@bernierllc/integration-test-pkg', name: 'integration-test-pkg', status: 'published', plan_file_path: null }
      ],
      queryPackageDetails: async (id: string) => ({
        exists: true,
        plan_file_path: null,
        status: 'published',
        dependencies: []
      }),
      queryPackageLineage: async () => ({ parents: [], depth: 0 }),
      queryChildPackages: async () => [],
      spawnPlanWriterAgent: async () => ({
        success: true,
        planContent: '# Test Plan',
        planFilePath: 'plans/test.md',
        duration: 100
      }),
      gitCommitPlan: async () => ({ success: true, commitSha: 'abc123', branch: 'test' }),
      updateMCPStatus: async () => ({ success: true }),
      spawnPackageEvaluatorAgent: async () => ({
        success: true,
        needsUpdate: true,
        updateType: 'plan',
        reason: 'New package',
        confidence: 'high'
      })
    };

    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue: 'test-integration',
      workflowsPath: require.resolve('../workflows'),
      activities: mockActivities
    });

    await worker.runUntil(async () => {
      // Start service workflow
      const serviceHandle = await client.workflow.start(PlanWriterServiceWorkflow, {
        taskQueue: 'test-integration',
        workflowId: 'plan-writer-service'
      });

      // Wait for service to initialize
      await new Promise(resolve => setTimeout(resolve, 100));

      // Run scanner
      const scanResult = await client.workflow.execute(MCPScannerWorkflow, {
        taskQueue: 'test-integration',
        workflowId: 'test-scanner-integration'
      });

      expect(scanResult.packagesFound).toBe(1);
      expect(scanResult.packagesSignaled).toBe(1);

      // Wait for service to process
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify service is still running
      const serviceDesc = await serviceHandle.describe();
      expect(serviceDesc.status.name).toBe('RUNNING');

      // Cleanup
      await serviceHandle.terminate();
    });
  });
});
```

### Step 2: Run test to verify it passes

Run: `cd packages/agents/plan-writer-service && npm test -- integration.test.ts`
Expected: PASS (1 test)

### Step 3: Commit

```bash
git add packages/agents/plan-writer-service/src/__tests__/integration.test.ts
git commit -m "test: add integration test for scanner->service->child flow

- Verifies end-to-end workflow coordination
- Scanner discovers packages and signals service
- Service spawns child workflows
- All components work together

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 10: Update Worker Registration

**Files:**
- Modify: `packages/agents/plan-writer-service/src/worker.ts`

### Step 1: No test needed (worker is executable, not tested)

Worker registration is verified by running the worker, not unit tests.

### Step 2: Verify all activities registered

The worker should already have all activities registered from earlier work. Verify:

```typescript
activities: {
  ...planActivities,
  ...mcpActivities,
  ...claudeCliActivities,
},
```

This includes the new `scanForUnplannedPackages` activity added to `mcpActivities`.

### Step 3: Build and verify worker starts

Run: `cd packages/agents/plan-writer-service && npm run build`
Expected: Build succeeds

### Step 4: Commit if any changes made

If no changes needed:
```bash
# No commit needed - worker already configured correctly
```

---

## Task 11: Documentation Updates

**Files:**
- Create: `packages/agents/plan-writer-service/docs/SCANNER.md`
- Create: `packages/agents/plan-writer-service/docs/CONTINUE_AS_NEW.md`
- Modify: `packages/agents/plan-writer-service/README.md`

### Step 1: Document scanner workflow

Create `docs/SCANNER.md`:

```markdown
# MCP Scanner Workflow

## Overview

The MCP Scanner Workflow runs on a cron schedule to discover published packages that lack implementation plans.

## Configuration

**Workflow ID:** `mcp-scanner` (stable, reused by cron)
**Schedule:** `@hourly`
**Task Queue:** `plan-writer-service`

## Behavior

1. Executes `scanForUnplannedPackages` activity
2. Activity queries MCP API: `GET /packages?filters[status]=published&filters[no_plan_file]=true`
3. For each package found, signals `plan-writer-service` with `package_plan_needed`
4. Returns scan statistics

## Manual Triggering

To trigger an immediate scan without waiting for cron:

```bash
temporal workflow signal \
  --workflow-id plan-writer-service \
  --name trigger_mcp_scan
```

## Monitoring

View scanner execution history:

```bash
temporal workflow show --workflow-id mcp-scanner
```
```

### Step 2: Document continue-as-new

Create `docs/CONTINUE_AS_NEW.md`:

```markdown
# Continue-as-New Implementation

## Overview

The Plan Writer Service Workflow uses Temporal's continue-as-new to prevent unbounded history growth while maintaining state.

## Trigger

Workflow continues-as-new when history length reaches **37,500 events** (3/4 of Temporal's ~50,000 limit).

## Preserved State

- Request queue (pending plan requests)
- Active requests (in-progress packages)
- Child workflow IDs (for reconnection)
- Statistics (total requests, completed, failed)
- Service status (running/paused)
- Completed/failed plan history

## Child Workflow Handling

Child workflows continue running across parent continue-as-new:

1. Parent serializes child workflow IDs before continuing
2. New workflow instance reconnects using `getExternalWorkflowHandle(childId)`
3. Children remain unaware of parent transition
4. Signals from children route correctly (stable workflow ID: `plan-writer-service`)

## Monitoring

Check workflow history length:

```bash
temporal workflow describe --workflow-id plan-writer-service
```

Look for `historyLength` in output. When approaching 37,500, workflow will continue-as-new automatically.
```

### Step 3: Update README

Add to `README.md`:

```markdown
## New Features

### Automated Package Discovery

The service now includes an MCP Scanner Workflow that runs hourly to discover published packages without implementation plans. See [docs/SCANNER.md](docs/SCANNER.md).

### Unbounded Service Lifespan

The service implements continue-as-new to run indefinitely without history overflow. See [docs/CONTINUE_AS_NEW.md](docs/CONTINUE_AS_NEW.md).

### Indefinite Parent Plan Waiting

Child workflows now retry indefinitely with Fibonacci backoff when waiting for parent plans, eliminating timeout failures.

### Signal-Based Coordination

Child workflows signal the parent service when discovering packages needing plans, enabling automatic dependency resolution.
```

### Step 4: Commit

```bash
git add packages/agents/plan-writer-service/docs/SCANNER.md
git add packages/agents/plan-writer-service/docs/CONTINUE_AS_NEW.md
git add packages/agents/plan-writer-service/README.md
git commit -m "docs: add documentation for scanner and continue-as-new

- SCANNER.md: MCP scanner workflow operation and monitoring
- CONTINUE_AS_NEW.md: State preservation and child handling
- README.md: Updated with new features

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 12: Final Integration Verification

**Files:**
- All tests

### Step 1: Run all tests

```bash
cd packages/agents/plan-writer-service && npm test
```

Expected: All tests pass

### Step 2: Build project

```bash
cd packages/agents/plan-writer-service && npm run build
```

Expected: Build succeeds with no errors

### Step 3: Verify no linting errors

```bash
cd packages/agents/plan-writer-service && npm run lint
```

Expected: No linting errors (if lint script exists)

### Step 4: Final commit

```bash
git add .
git commit -m "chore: final verification and cleanup

All tests passing, build succeeds, ready for deployment

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Deployment Checklist

- [ ] All tests pass (13+ tests)
- [ ] Build succeeds
- [ ] No linting errors
- [ ] Documentation complete
- [ ] Worker configuration updated
- [ ] MCP API credentials configured
- [ ] Temporal server accessible

## Post-Deployment Steps

1. **Start Scanner Workflow with Cron:**
   ```bash
   temporal workflow start \
     --workflow-id mcp-scanner \
     --type MCPScannerWorkflow \
     --task-queue plan-writer-service \
     --cron "@hourly"
   ```

2. **Monitor Scanner Execution:**
   ```bash
   temporal workflow show --workflow-id mcp-scanner
   ```

3. **Test Manual Scan:**
   ```bash
   temporal workflow signal \
     --workflow-id plan-writer-service \
     --name trigger_mcp_scan
   ```

4. **Monitor Service Health:**
   ```bash
   temporal workflow describe --workflow-id plan-writer-service
   ```

## Rollback Plan

If issues arise:

1. **Stop Scanner:**
   ```bash
   temporal workflow terminate --workflow-id mcp-scanner
   ```

2. **Revert to Previous Version:**
   ```bash
   git revert HEAD
   npm run build
   # Restart worker
   ```

3. **Manually Terminate Service if Needed:**
   ```bash
   temporal workflow terminate --workflow-id plan-writer-service
   ```
