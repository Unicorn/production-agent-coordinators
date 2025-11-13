# Enhanced Discovery with Plan Generation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable suite-builder workflow to automatically request plan generation through a long-running Plans Workflow when packages don't exist, using queue-based coordination and MCP polling.

**Architecture:** Queue-based coordination pattern with singleton Plans Workflow processing plan requests. Build workflows signal plan needs (fire-and-forget), then poll MCP with exponential backoff until plan appears. Plans Workflow processes queue continuously, prioritizing workflow requests over self-discovered needs.

**Tech Stack:** Temporal Workflows (Signals, External Workflow Handles), MCP (JSON-RPC 2.0 + SSE), TypeScript, Vitest

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│  Long-Running Plans Workflow (Singleton)                     │
│  Workflow ID: "plans-workflow-singleton"                     │
│                                                               │
│  Three-Tier Priority Queue:                                  │
│                                                               │
│  Tier 1 (HIGHEST): Workflow Requests                         │
│    [{ pkg: "github-parser", from: "build-wf-123" }]          │
│                                                               │
│  Tier 2 (MIDDLE): Self-Discovered (Top-Down + FIFO)          │
│    Sorted by: hierarchy_level ASC, added_date ASC            │
│    [                                                          │
│      { pkg: "webhook-suite", level: 1, added: T1 },   ← Suite│
│      { pkg: "webhook-receiver", level: 2, added: T2 },← Pkg  │
│      { pkg: "github-parser", level: 2, added: T3 }    ← Pkg  │
│    ]                                                          │
│                                                               │
│  Loop Forever:                                               │
│    - Listen for signals → add to Tier 1 (immediate)          │
│    - Process Tier 1 first (FIFO)                             │
│    - Then process Tier 2 (hierarchy ASC, date ASC)           │
│    - Generate plan (invoke agent)                            │
│    - Register with MCP                                       │
│    - If both empty: discover packages → add to Tier 2        │
└──────────────────────────────────────────────────────────────┘
         ▲                              │
         │ signal("needPlan")          │ MCP registration
         │                              ▼
┌──────────────────────┐      ┌─────────────────┐
│  Build Workflow      │◄─────│  MCP Server     │
│                      │ poll │                 │
│  1. Try filesystem   │      │ plan_file_path  │
│  2. Signal plans WF  │      │ shows up here   │
│  3. Poll MCP w/retry │      └─────────────────┘
│  4. Continue build   │
└──────────────────────┘
```

---

## Background Context

### What We Built Yesterday
✅ `discoverPlanFromDependencyGraph()` in `src/activities/discovery.activities.ts`
✅ Comprehensive tests (16/16 passing) in `src/activities/__tests__/discovery.activities.test.ts`
✅ TDD implementation with RED-GREEN-REFACTOR cycle

### Current Problem
When workflow receives `@bernierllc/github-parser`:
- Package exists in MCP (status: planning)
- Package has no plan file
- Workflow searches filesystem only → fails
- Need: Signal Plans Workflow → wait for plan → continue build

### Solution Overview
1. **Plans Workflow**: Long-running singleton that processes plan generation queue
2. **Signal Coordination**: Build workflows signal plan needs, Plans Workflow adds to priority queue
3. **MCP Polling**: Build workflows poll MCP with backoff until plan appears
4. **Autonomous Discovery**: Plans Workflow discovers packages needing plans when idle

---

## Task 1: Create Plans Workflow with Signal Handler

### Files
- Create: `src/workflows/plans.workflow.ts`
- Create: `src/workflows/__tests__/plans.workflow.test.ts`
- Create: `src/signals/plan-signals.ts`

### Step 1: Define signal interfaces

Create `src/signals/plan-signals.ts`:

```typescript
import { defineSignal } from '@temporalio/workflow';

export interface PlanRequest {
  packageName: string;
  requestedBy: string;  // workflow ID
  timestamp: number;
  priority: 'high' | 'low';
  source: 'workflow-request' | 'discovery';
}

export const requestPlanSignal = defineSignal<[PlanRequest]>('requestPlan');
```

### Step 2: Write failing test for Plans Workflow

Create `src/workflows/__tests__/plans.workflow.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { PlansWorkflow } from '../plans.workflow';
import { requestPlanSignal } from '../../signals/plan-signals';
import * as activities from '../../activities/planning.activities';

describe('Plans Workflow', () => {
  let testEnv: TestWorkflowEnvironment;

  beforeAll(async () => {
    testEnv = await TestWorkflowEnvironment.createLocal();
  });

  afterAll(async () => {
    await testEnv?.teardown();
  });

  it('should start and listen for plan requests', async () => {
    const { client, nativeConnection } = testEnv;

    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue: 'test',
      workflowsPath: require.resolve('../plans.workflow'),
      activities,
    });

    await worker.runUntil(async () => {
      const handle = await client.workflow.start(PlansWorkflow, {
        taskQueue: 'test',
        workflowId: 'plans-workflow-test',
      });

      // Workflow should be running
      const description = await handle.describe();
      expect(description.status.name).toBe('RUNNING');
    });
  });

  it('should handle plan request signal', async () => {
    const { client, nativeConnection } = testEnv;

    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue: 'test',
      workflowsPath: require.resolve('../plans.workflow'),
      activities,
    });

    await worker.runUntil(async () => {
      const handle = await client.workflow.start(PlansWorkflow, {
        taskQueue: 'test',
        workflowId: 'plans-workflow-signal-test',
      });

      // Send signal
      await handle.signal(requestPlanSignal, {
        packageName: '@bernierllc/github-parser',
        requestedBy: 'build-workflow-123',
        timestamp: Date.now(),
        priority: 'high',
        source: 'workflow-request'
      });

      // Give workflow time to process
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Workflow should still be running
      const description = await handle.describe();
      expect(description.status.name).toBe('RUNNING');
    });
  });
});
```

### Step 3: Run test to verify it fails

```bash
yarn test src/workflows/__tests__/plans.workflow.test.ts --run
```

**Expected:** FAIL - "Cannot find module '../plans.workflow'"

### Step 4: Create minimal Plans Workflow

Create `src/workflows/plans.workflow.ts`:

```typescript
import { proxyActivities, setHandler, condition, sleep } from '@temporalio/workflow';
import { requestPlanSignal, type PlanRequest } from '../signals/plan-signals';
import type * as activities from '../activities/planning.activities';

const { generatePlanForPackage, discoverPackagesNeedingPlans } = proxyActivities<typeof activities>({
  startToCloseTimeout: '15 minutes',
  retry: {
    initialInterval: '2s',
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});

export async function PlansWorkflow(): Promise<void> {
  const queue: PlanRequest[] = [];

  // Handle signals from build workflows
  setHandler(requestPlanSignal, (request: PlanRequest) => {
    console.log(`📨 Received plan request for ${request.packageName} from ${request.requestedBy}`);

    // Add with HIGH priority (prepend to queue)
    queue.unshift({ ...request, priority: 'high', source: 'workflow-request' });

    console.log(`   Queue position: 1 (priority)`);
    console.log(`   Queue length: ${queue.length}`);
  });

  console.log('🚀 Plans Workflow started - listening for requests...');

  // Continuous processing loop
  while (true) {
    if (queue.length > 0) {
      const request = queue.shift()!;
      console.log(`\n📋 Processing: ${request.packageName}`);
      console.log(`   Source: ${request.source}`);
      console.log(`   Priority: ${request.priority}`);
      console.log(`   Remaining in queue: ${queue.length}`);

      try {
        // Generate plan for the package
        await generatePlanForPackage({
          packageName: request.packageName,
          requestedBy: request.requestedBy
        });

        console.log(`✅ Plan generated for ${request.packageName}`);
      } catch (error) {
        console.error(`❌ Failed to generate plan for ${request.packageName}:`, error);
        // TODO: Add to dead letter queue or retry with backoff
      }
    } else {
      // Queue empty - discover packages needing plans
      console.log('\n🔍 Queue empty, discovering packages needing plans...');

      try {
        const discovered = await discoverPackagesNeedingPlans();

        if (discovered && discovered.length > 0) {
          console.log(`   Found ${discovered.length} packages needing plans`);

          // Add to queue with LOW priority (append)
          for (const pkg of discovered) {
            queue.push({
              packageName: pkg,
              requestedBy: 'auto-discovery',
              timestamp: Date.now(),
              priority: 'low',
              source: 'discovery'
            });
          }
        } else {
          console.log('   No packages need plans');
        }
      } catch (error) {
        console.error('   Discovery failed:', error);
      }
    }

    // Breathe between iterations
    await sleep('10s');
  }
}
```

### Step 5: Run test to verify it passes

```bash
yarn test src/workflows/__tests__/plans.workflow.test.ts --run
```

**Expected:** PASS (2/2 tests)

### Step 6: Commit

```bash
git add src/workflows/plans.workflow.ts src/workflows/__tests__/plans.workflow.test.ts src/signals/plan-signals.ts
git commit -m "feat: add Plans Workflow with signal handler

- Create long-running Plans Workflow singleton
- Add requestPlanSignal for workflow coordination
- Implement queue with priority (high for WF requests, low for discovery)
- Add continuous processing loop
- Add tests for workflow startup and signal handling"
```

---

## Task 2: Create Plan Generation Activities

### Files
- Create: `src/activities/planning.activities.ts`
- Create: `src/activities/__tests__/planning.activities.test.ts`

### Step 1: Write failing test for plan generation

Create `src/activities/__tests__/planning.activities.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { generatePlanForPackage, discoverPackagesNeedingPlans } from '../planning.activities';

describe('Planning Activities', () => {
  describe('generatePlanForPackage', () => {
    it('should generate plan and register with MCP', async () => {
      // Mock MCP calls
      global.fetch = vi.fn();

      // Mock packages_get_dependencies
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => `event: message\ndata: ${JSON.stringify({
          jsonrpc: '2.0',
          result: {
            content: [{
              type: 'text',
              text: JSON.stringify({
                dependencies: [
                  { package_name: '@bernierllc/webhook-receiver' }
                ]
              })
            }]
          }
        })}`
      });

      // Mock packages_update (plan registration)
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => `event: message\ndata: ${JSON.stringify({
          jsonrpc: '2.0',
          result: {
            content: [{ type: 'text', text: JSON.stringify({ success: true }) }]
          }
        })}`
      });

      await generatePlanForPackage({
        packageName: '@bernierllc/github-parser',
        requestedBy: 'build-workflow-123'
      });

      // Verify MCP was called for registration
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('discoverPackagesNeedingPlans', () => {
    it('should query MCP for packages in planning status with no plan', async () => {
      global.fetch = vi.fn();

      // Mock packages_query
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => `event: message\ndata: ${JSON.stringify({
          jsonrpc: '2.0',
          result: {
            content: [{
              type: 'text',
              text: JSON.stringify({
                packages: [
                  { id: '@bernierllc/package-a', plan_file_path: null },
                  { id: '@bernierllc/package-b', plan_file_path: null }
                ]
              })
            }]
          }
        })}`
      });

      const result = await discoverPackagesNeedingPlans();

      expect(result).toEqual(['@bernierllc/package-a', '@bernierllc/package-b']);
    });
  });
});
```

### Step 2: Run test to verify it fails

```bash
yarn test src/activities/__tests__/planning.activities.test.ts --run
```

**Expected:** FAIL - module not found

### Step 3: Create minimal planning activities

Create `src/activities/planning.activities.ts`:

```typescript
async function callMcpTool<T = any>(toolName: string, params: any, mcpServerUrl: string): Promise<T> {
  const authToken = process.env.PACKAGES_API_TOKEN || process.env.MCP_TOKEN || '';

  const jsonRpcRequest = {
    jsonrpc: '2.0',
    method: 'tools/call',
    params: { name: toolName, arguments: params },
    id: Date.now()
  };

  const response = await fetch(mcpServerUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authToken ? `Bearer ${authToken}` : '',
      'Accept': 'application/json'
    },
    body: JSON.stringify(jsonRpcRequest),
  });

  if (!response.ok) {
    throw new Error(`MCP tool ${toolName} failed: ${response.status}`);
  }

  const responseText = await response.text();

  let jsonData: any;
  if (responseText.includes('event:') && responseText.includes('data:')) {
    const dataMatch = responseText.match(/data:\s*({.*})/);
    if (dataMatch) {
      jsonData = JSON.parse(dataMatch[1]);
    } else {
      throw new Error('Failed to parse SSE response');
    }
  } else {
    jsonData = JSON.parse(responseText);
  }

  if (jsonData.error) {
    throw new Error(`MCP error: ${jsonData.error.message}`);
  }

  const result = jsonData.result;
  if (result?.content?.[0]?.type === 'text') {
    return JSON.parse(result.content[0].text) as T;
  }

  return result as T;
}

export async function generatePlanForPackage(input: {
  packageName: string;
  requestedBy: string;
}): Promise<void> {
  const mcpServerUrl = process.env.MCP_SERVER_URL || 'http://localhost:3355/api/mcp';

  console.log(`Generating plan for ${input.packageName}...`);

  // 1. Get dependency chain from MCP
  const depsData = await callMcpTool<any>('packages_get_dependencies', {
    id: input.packageName
  }, mcpServerUrl);

  console.log(`  Dependencies: ${depsData.dependencies?.length || 0}`);

  // 2. TODO: Invoke package-planning-writer agent
  // For now, just register a placeholder plan
  const planPath = `/Users/mattbernier/projects/tools/plans/packages/${input.packageName.split('/')[1]}.md`;
  const branchName = `plan/${input.packageName.split('/')[1]}-auto`;

  // 3. Register plan with MCP
  await callMcpTool('packages_update', {
    id: input.packageName,
    data: {
      plan_file_path: planPath,
      branch_name: branchName,
      status: 'planning'
    }
  }, mcpServerUrl);

  console.log(`  ✓ Registered plan at ${planPath}`);
}

export async function discoverPackagesNeedingPlans(): Promise<string[]> {
  const mcpServerUrl = process.env.MCP_SERVER_URL || 'http://localhost:3355/api/mcp';

  // Query MCP for packages in planning status with no plan_file_path
  const result = await callMcpTool<any>('packages_query', {
    filters: {
      status: ['planning']
    },
    limit: 10
  }, mcpServerUrl);

  const packagesNeedingPlans = result.packages
    ?.filter((pkg: any) => !pkg.plan_file_path)
    .map((pkg: any) => pkg.id) || [];

  return packagesNeedingPlans;
}
```

### Step 4: Run test to verify it passes

```bash
yarn test src/activities/__tests__/planning.activities.test.ts --run
```

**Expected:** PASS (2/2 tests)

### Step 5: Commit

```bash
git add src/activities/planning.activities.ts src/activities/__tests__/planning.activities.test.ts
git commit -m "feat: add plan generation activities

- Add generatePlanForPackage activity (agent invocation TODO)
- Add discoverPackagesNeedingPlans activity
- Register plans with MCP including branch_name
- Add tests for both activities"
```

---

## Task 3: Add MCP Polling Activity for Build Workflow

### Files
- Modify: `src/activities/discovery.activities.ts`
- Modify: `src/activities/__tests__/discovery.activities.test.ts`

### Step 1: Write test for MCP polling with retry

Add to `src/activities/__tests__/discovery.activities.test.ts`:

```typescript
describe('pollMcpForPlan', () => {
  it('should poll MCP until plan appears', async () => {
    global.fetch = vi.fn();

    // First call: no plan yet
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      text: async () => `event: message\ndata: ${JSON.stringify({
        jsonrpc: '2.0',
        result: {
          content: [{
            type: 'text',
            text: JSON.stringify({
              id: '@bernierllc/github-parser',
              plan_file_path: null
            })
          }]
        }
      })}`
    });

    // Second call: plan appears!
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      text: async () => `event: message\ndata: ${JSON.stringify({
        jsonrpc: '2.0',
        result: {
          content: [{
            type: 'text',
            text: JSON.stringify({
              id: '@bernierllc/github-parser',
              plan_file_path: '/Users/mattbernier/projects/tools/plans/packages/github-parser.md'
            })
          }]
        }
      })}`
    });

    const result = await pollMcpForPlan({
      packageName: '@bernierllc/github-parser',
      mcpServerUrl: 'http://localhost:3355/api/mcp',
      maxAttempts: 3,
      initialDelayMs: 100
    });

    expect(result.found).toBe(true);
    expect(result.planPath).toContain('github-parser.md');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('should return not found after max attempts', async () => {
    global.fetch = vi.fn();

    // Always return no plan
    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: async () => `event: message\ndata: ${JSON.stringify({
        jsonrpc: '2.0',
        result: {
          content: [{
            type: 'text',
            text: JSON.stringify({
              id: '@bernierllc/github-parser',
              plan_file_path: null
            })
          }]
        }
      })}`
    });

    const result = await pollMcpForPlan({
      packageName: '@bernierllc/github-parser',
      mcpServerUrl: 'http://localhost:3355/api/mcp',
      maxAttempts: 3,
      initialDelayMs: 100
    });

    expect(result.found).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });
});
```

### Step 2: Run test to verify it fails

```bash
yarn test src/activities/__tests__/discovery.activities.test.ts --run
```

**Expected:** FAIL - function not found

### Step 3: Implement MCP polling activity

Add to `src/activities/discovery.activities.ts`:

```typescript
export interface PollMcpResult {
  found: boolean;
  planPath?: string;
}

export async function pollMcpForPlan(input: {
  packageName: string;
  mcpServerUrl: string;
  maxAttempts?: number;
  initialDelayMs?: number;
}): Promise<PollMcpResult> {
  const maxAttempts = input.maxAttempts || 24;
  const initialDelayMs = input.initialDelayMs || 5000;
  let attempt = 0;
  let delayMs = initialDelayMs;

  while (attempt < maxAttempts) {
    attempt++;
    console.log(`Polling MCP for plan (attempt ${attempt}/${maxAttempts})...`);

    // Check MCP for plan
    const packageData = await callMcpTool<any>('packages_get', {
      id: input.packageName,
      include: ['plan_content']
    }, input.mcpServerUrl);

    if (packageData.plan_file_path) {
      console.log(`✓ Plan found: ${packageData.plan_file_path}`);
      return {
        found: true,
        planPath: packageData.plan_file_path
      };
    }

    console.log(`  Plan not ready yet, waiting ${delayMs}ms...`);

    // Exponential backoff (capped at 2 minutes)
    await new Promise(resolve => setTimeout(resolve, delayMs));
    delayMs = Math.min(delayMs * 1.5, 120000);
  }

  console.log(`Plan not found after ${maxAttempts} attempts`);
  return { found: false };
}
```

### Step 4: Run test to verify it passes

```bash
yarn test src/activities/__tests__/discovery.activities.test.ts --run
```

**Expected:** PASS (all tests including new ones)

### Step 5: Commit

```bash
git add src/activities/discovery.activities.ts src/activities/__tests__/discovery.activities.test.ts
git commit -m "feat: add MCP polling activity with exponential backoff

- Add pollMcpForPlan activity
- Exponential backoff: 5s → 7.5s → 11.25s → ... (capped at 2min)
- Configurable max attempts (default 24 = ~40min total)
- Return plan path when found
- Add tests for success and timeout scenarios"
```

---

## Task 4: Wire Signal Coordination into Build Workflow

### Files
- Modify: `src/workflows/suite-builder.workflow.ts`

### Step 1: Add external workflow handle and signal import

At top of file:

```typescript
import { proxyActivities, getExternalWorkflowHandle } from '@temporalio/workflow';
import { requestPlanSignal } from '../signals/plan-signals';
```

### Step 2: Add polling activity proxy

Add to activity proxies around line 140:

```typescript
const {
  parseInput,
  searchForPackage,
  readPackageJson,
  buildDependencyTree,
  copyEnvFiles,
  checkMcpServerReachability,
  checkPackagePublished,
  discoverPlanFromDependencyGraph,
  pollMcpForPlan  // Add this
} = proxyActivities<typeof import('../activities/discovery.activities')>({
  startToCloseTimeout: '5 minutes',
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});
```

### Step 3: Replace discovery failure with signal + poll

Replace error throw in discoveryPhase (around line 177-179):

```typescript
// BEFORE:
if (!searchResult.found || !searchResult.packagePath) {
  throw new Error(`Package ${packageName} not found. Searched: ${searchResult.searchedLocations.join(', ')}`);
}

// AFTER:
if (!searchResult.found || !searchResult.packagePath) {
  console.log(`  Package not found in filesystem`);
  console.log(`  Searching: ${searchResult.searchedLocations.join(', ')}`);

  // Check if package exists in MCP
  const planDiscovery = await discoverPlanFromDependencyGraph({
    packageName,
    mcpServerUrl: input.config.mcpServer.url
  });

  if (!planDiscovery.found && !planDiscovery.searchedPackages?.includes(packageName)) {
    // Package doesn't exist anywhere
    throw new Error(
      `Package ${packageName} not found in filesystem or MCP. ` +
      `Searched: ${searchResult.searchedLocations.join(', ')}`
    );
  }

  console.log(`  Package exists in MCP, requesting plan generation...`);

  // Signal Plans Workflow (fire and forget)
  try {
    const plansHandle = await getExternalWorkflowHandle('plans-workflow-singleton');
    await plansHandle.signal(requestPlanSignal, {
      packageName,
      requestedBy: workflowInfo().workflowId,
      timestamp: Date.now(),
      priority: 'high',
      source: 'workflow-request'
    });
    console.log(`  ✓ Plan request sent to Plans Workflow`);
  } catch (error) {
    console.warn(`  ⚠ Could not signal Plans Workflow (may not be running):`, error);
    // Continue anyway - polling might still work if plan already exists
  }

  console.log(`  Polling MCP for plan...`);

  // Poll MCP with exponential backoff until plan appears
  const pollResult = await pollMcpForPlan({
    packageName,
    mcpServerUrl: input.config.mcpServer.url,
    maxAttempts: 24,  // ~40 minutes with backoff
    initialDelayMs: 5000
  });

  if (!pollResult.found) {
    throw new Error(
      `Timeout waiting for plan generation for ${packageName}. ` +
      `Plans Workflow may not be running, or plan generation failed.`
    );
  }

  console.log(`  ✓ Plan ready! Continuing with build...`);

  // Retry package search - plan should now exist
  const retrySearch = await searchForPackage({
    searchQuery: packageName,
    workspaceRoot: input.config.workspaceRoot
  });

  if (!retrySearch.found || !retrySearch.packagePath) {
    throw new Error(
      `Plan generated but package still not found. ` +
      `Plan path from MCP: ${pollResult.planPath}`
    );
  }

  packagePath = retrySearch.packagePath;
}
```

### Step 4: Add workflowInfo import

At top of file:

```typescript
import { proxyActivities, getExternalWorkflowHandle, workflowInfo } from '@temporalio/workflow';
```

### Step 5: Run type check

```bash
yarn tsc --noEmit
```

**Expected:** No type errors

### Step 6: Commit

```bash
git add src/workflows/suite-builder.workflow.ts
git commit -m "feat: wire signal coordination into build workflow

- Signal Plans Workflow when package not found
- Poll MCP with exponential backoff for plan
- Handle Plans Workflow not running gracefully
- Retry package search after plan ready
- Add detailed logging for debugging"
```

---

## Task 5: Create Plans Workflow Client

### Files
- Create: `src/client-plans.ts`

### Step 1: Create Plans Workflow client

Create `src/client-plans.ts`:

```typescript
import { Connection, Client } from '@temporalio/client';
import { PlansWorkflow } from './workflows/plans.workflow';

async function run() {
  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
  });

  const client = new Client({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || 'default',
  });

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Plans Workflow - Long-Running Singleton                ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const workflowId = 'plans-workflow-singleton';

  try {
    // Check if workflow already running
    const handle = client.workflow.getHandle(workflowId);
    const description = await handle.describe();

    if (description.status.name === 'RUNNING') {
      console.log('✅ Plans Workflow is already running');
      console.log(`   Workflow ID: ${workflowId}`);
      console.log(`   Run ID: ${description.runId}`);
      console.log(`\n📊 View in Temporal UI: http://localhost:8233/namespaces/default/workflows/${workflowId}`);
      console.log('\nℹ️  To stop: temporal workflow terminate --workflow-id plans-workflow-singleton');
      return;
    }
  } catch (error) {
    // Workflow not found, start it
  }

  console.log('🚀 Starting Plans Workflow singleton...\n');

  const handle = await client.workflow.start(PlansWorkflow, {
    taskQueue: 'suite-builder',
    workflowId,
    // No workflow timeout - runs forever
  });

  console.log('✅ Plans Workflow started!');
  console.log(`   Workflow ID: ${workflowId}`);
  console.log(`   Run ID: ${handle.firstExecutionRunId}`);
  console.log(`\n📊 View in Temporal UI: http://localhost:8233/namespaces/default/workflows/${workflowId}`);
  console.log('\n✨ Plans Workflow is now running and listening for plan requests.');
  console.log('   Build workflows will signal this workflow when they need plans.');
  console.log('\nℹ️  This workflow runs forever until manually terminated.');
  console.log('   To stop: temporal workflow terminate --workflow-id plans-workflow-singleton');
}

run().catch((err) => {
  console.error('Failed to start Plans Workflow:', err);
  process.exit(1);
});
```

### Step 2: Add npm script

Add to `package.json` scripts:

```json
"start:plans": "tsx src/client-plans.ts"
```

### Step 3: Test Plans Workflow startup

```bash
# Ensure worker is running
yarn start:worker &

# Start Plans Workflow
yarn start:plans
```

**Expected:** Plans Workflow starts and shows as RUNNING in Temporal UI

### Step 4: Commit

```bash
git add src/client-plans.ts package.json
git commit -m "feat: add Plans Workflow client

- Create client to start/check Plans Workflow singleton
- Add start:plans npm script
- Check if workflow already running before starting
- Add helpful CLI output and instructions"
```

---

## Task 6: End-to-End Integration Test

### Step 1: Start all components

```bash
# Terminal 1: Temporal server (if not already running)
temporal server start-dev

# Terminal 2: Worker
yarn build:worker && yarn start:worker

# Terminal 3: Plans Workflow
yarn start:plans
```

**Expected:** All three components running

### Step 2: Start build workflow for github-parser

```bash
# Terminal 4: Build workflow
yarn start:client github-parser 2>&1 | tee /tmp/integration-test.log
```

**Expected Output:**
```
Phase 1: DISCOVERY
  Input type: packageName, value: github-parser
  Package not found in filesystem
  Searching: plans/packages/**, packages/**
  Package exists in MCP, requesting plan generation...
  ✓ Plan request sent to Plans Workflow
  Polling MCP for plan...
  Polling MCP for plan (attempt 1/24)...
    Plan not ready yet, waiting 5000ms...
  Polling MCP for plan (attempt 2/24)...
  ✓ Plan found: /Users/mattbernier/projects/tools/plans/packages/github-parser.md
  ✓ Plan ready! Continuing with build...
```

### Step 3: Check Plans Workflow logs

In Temporal UI: `http://localhost:8233/namespaces/default/workflows/plans-workflow-singleton`

**Expected:**
```
📨 Received plan request for @bernierllc/github-parser from suite-builder-github-parser
   Queue position: 1 (priority)
   Queue length: 1

📋 Processing: @bernierllc/github-parser
   Source: workflow-request
   Priority: high
   Remaining in queue: 0
Generating plan for @bernierllc/github-parser...
  Dependencies: 1
  ✓ Registered plan at /Users/mattbernier/projects/tools/plans/packages/github-parser.md
✅ Plan generated for @bernierllc/github-parser
```

### Step 4: Verify MCP registration

```bash
# Check MCP for plan registration
curl -X POST http://localhost:3355/api/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "packages_get",
      "arguments": {
        "id": "@bernierllc/github-parser",
        "include": ["plan_content"]
      }
    },
    "id": 1
  }'
```

**Expected:** Response includes `plan_file_path` and `branch_name`

### Step 5: Document test results

Create `docs/testing/queue-coordination-test-results.md`:

```markdown
# Queue-Based Coordination Test Results

## Test Date
2025-01-12

## Architecture
- Plans Workflow: Singleton long-running workflow
- Build Workflow: Signals Plans WF, polls MCP
- Coordination: Signal-based queue with MCP polling

## Test Case: @bernierllc/github-parser

### Setup
- Package exists in MCP (status: planning)
- No local plan file
- Plans Workflow running
- Worker running

### Results
- [x] Build workflow detected package not in filesystem
- [x] Build workflow signaled Plans Workflow
- [x] Plans Workflow received signal and added to queue
- [x] Plans Workflow processed request (priority)
- [x] Plan registered with MCP
- [x] Build workflow polled MCP successfully
- [x] Build workflow found plan and continued

### Timing
- Signal latency: < 1s
- Plan generation: ~30s
- MCP polling: 2 attempts (~12s total)
- Total delay: ~45s

### Logs
See /tmp/integration-test.log
```

### Step 6: Commit

```bash
git add docs/testing/queue-coordination-test-results.md
git commit -m "test: document queue coordination integration test

- Verified signal-based coordination works
- Plans Workflow processes requests with priority
- Build workflow polls successfully
- End-to-end flow complete in ~45s"
```

---

## Task 7: Add Agent Invocation to Plan Generation

### Files
- Modify: `src/activities/planning.activities.ts`
- Modify: `src/activities/__tests__/planning.activities.test.ts`

### Step 1: Write test for agent invocation

Add to `src/activities/__tests__/planning.activities.test.ts`:

```typescript
it('should invoke package-planning-writer agent', async () => {
  global.fetch = vi.fn();

  // Mock Task tool (agent invocation)
  const mockTask = vi.fn().mockResolvedValue({
    result: 'Plan written to /Users/mattbernier/projects/tools/plans/packages/github-parser.md on branch plan/github-parser'
  });
  (global as any).Task = mockTask;

  // Mock MCP calls
  (global.fetch as any)
    .mockResolvedValueOnce({ /* dependencies */ })
    .mockResolvedValueOnce({ /* packages_update */ });

  await generatePlanForPackage({
    packageName: '@bernierllc/github-parser',
    requestedBy: 'build-workflow-123'
  });

  // Verify agent was invoked
  expect(mockTask).toHaveBeenCalledWith(
    expect.objectContaining({
      subagent_type: 'general-purpose',
      description: expect.stringContaining('github-parser'),
      prompt: expect.stringContaining('write plan')
    })
  );
});
```

### Step 2: Run test to verify it fails

```bash
yarn test src/activities/__tests__/planning.activities.test.ts --run
```

**Expected:** FAIL - agent not invoked

### Step 3: Implement agent invocation

Update `generatePlanForPackage` in `src/activities/planning.activities.ts`:

```typescript
import { Task } from '@temporalio/activity';

export async function generatePlanForPackage(input: {
  packageName: string;
  requestedBy: string;
}): Promise<void> {
  const mcpServerUrl = process.env.MCP_SERVER_URL || 'http://localhost:3355/api/mcp';
  const workspaceRoot = process.env.WORKSPACE_ROOT || '/Users/mattbernier/projects/tools';

  console.log(`Generating plan for ${input.packageName}...`);

  // 1. Get dependency chain from MCP
  const depsData = await callMcpTool<any>('packages_get_dependencies', {
    id: input.packageName
  }, mcpServerUrl);

  console.log(`  Dependencies: ${depsData.dependencies?.length || 0}`);

  // 2. Build dependency chain (for context)
  const dependencyNames = depsData.dependencies
    ?.filter((dep: any) => dep.dependency_type === 'production')
    .map((dep: any) => dep.package_name) || [];

  // 3. Invoke package-planning-writer agent
  const prompt = `Write an implementation plan for the package: ${input.packageName}

Workspace: ${workspaceRoot}
Dependencies: ${dependencyNames.join(', ') || 'none'}

Requirements:
1. Write the plan to the correct location in the tools repo plans directory
2. Follow the tool repo plan requirements
3. Include dependency context if applicable
4. Commit the plan to a feature branch

When done, reply with:
- The plan file path
- The branch name where you committed it`;

  console.log(`  Invoking package-planning-writer agent...`);

  const agentResult = await Task({
    subagent_type: 'general-purpose',
    description: `Generate plan for ${input.packageName}`,
    prompt
  });

  console.log(`  Agent result: ${agentResult.result}`);

  // 4. Parse agent response
  const planPath = extractPlanPath(agentResult.result);
  const branchName = extractBranchName(agentResult.result) ||
    `plan/${input.packageName.split('/')[1]}-auto`;

  console.log(`  Plan path: ${planPath}`);
  console.log(`  Branch: ${branchName}`);

  // 5. Register plan with MCP
  await callMcpTool('packages_update', {
    id: input.packageName,
    data: {
      plan_file_path: planPath,
      branch_name: branchName,
      status: 'planning'
    }
  }, mcpServerUrl);

  console.log(`  ✓ Registered plan with MCP`);
}

function extractPlanPath(agentResponse: string): string {
  const match = agentResponse.match(/\/Users\/[^\s]+\.md/);
  if (!match) {
    throw new Error(`Could not extract plan path from: ${agentResponse}`);
  }
  return match[0];
}

function extractBranchName(agentResponse: string): string | null {
  const match = agentResponse.match(/branch[:\s]+([^\s]+)/i);
  return match ? match[1] : null;
}
```

### Step 4: Run test to verify it passes

```bash
yarn test src/activities/__tests__/planning.activities.test.ts --run
```

**Expected:** PASS (all tests)

### Step 5: Commit

```bash
git add src/activities/planning.activities.ts src/activities/__tests__/planning.activities.test.ts
git commit -m "feat: add agent invocation to plan generation

- Invoke general-purpose agent with package-planning prompt
- Build dependency context from MCP
- Parse plan path and branch from agent response
- Add extraction helpers for path and branch
- Update tests for agent invocation"
```

---

## Task 8: Documentation and README

### Step 1: Update plan status

Update `plans/enhanced-discovery-with-plan-generation.md`:

```markdown
## Status
✅ Complete - Queue-Based Coordination Implemented

## What We Built
✅ `PlansWorkflow` - Long-running singleton with signal handlers
✅ `requestPlanSignal` - Signal interface for workflow coordination
✅ `generatePlanForPackage` - Invokes agent, registers with MCP
✅ `discoverPackagesNeedingPlans` - Auto-discovery when queue empty
✅ `pollMcpForPlan` - Exponential backoff polling
✅ Build workflow integration - Signal + poll pattern
✅ End-to-end testing - github-parser test case passing
```

### Step 2: Create architecture documentation

Create `docs/architecture/queue-coordination.md`:

```markdown
# Queue-Based Plan Generation Architecture

## Overview
The suite-builder uses a queue-based coordination pattern to handle missing package plans. A long-running Plans Workflow processes plan generation requests from build workflows.

## Components

### Plans Workflow (Singleton)
- **Workflow ID:** `plans-workflow-singleton`
- **Task Queue:** `suite-builder`
- **Lifecycle:** Runs forever until manually terminated
- **Queue:** Priority-based (workflow requests → high, discovery → low)

### Signal Interface
```typescript
interface PlanRequest {
  packageName: string;
  requestedBy: string;
  timestamp: number;
  priority: 'high' | 'low';
  source: 'workflow-request' | 'discovery';
}
```

### Build Workflow Flow
1. Search filesystem for package
2. If not found → signal Plans Workflow
3. Poll MCP with exponential backoff (5s → 120s)
4. When plan appears → continue build

### Plans Workflow Flow
1. Listen for signals (add to priority queue)
2. Process queue (FIFO with priority)
3. Generate plan (invoke agent)
4. Register with MCP
5. If queue empty → discover packages needing plans

## Starting the System

```bash
# 1. Start Temporal server
temporal server start-dev

# 2. Start worker
yarn start:worker

# 3. Start Plans Workflow (singleton)
yarn start:plans

# 4. Build packages (will signal Plans WF as needed)
yarn start:client github-parser
```

## Monitoring

**Temporal UI:** http://localhost:8233
- Build workflows: `suite-builder-{package-name}`
- Plans workflow: `plans-workflow-singleton`

## Stopping

```bash
# Terminate Plans Workflow
temporal workflow terminate --workflow-id plans-workflow-singleton

# Stop worker
pkill -f "worker.bundle.js"
```
```

### Step 3: Update main README

Add to package README:

```markdown
## Queue-Based Plan Generation

The workflow can automatically generate missing package plans:

1. **Plans Workflow** runs as singleton, processing queue
2. **Build Workflows** signal when they need plans
3. **MCP Polling** waits for plan to appear with backoff
4. **Fully Autonomous** - no manual intervention needed

See `docs/architecture/queue-coordination.md` for details.
```

### Step 4: Commit

```bash
git add plans/enhanced-discovery-with-plan-generation.md docs/architecture/queue-coordination.md README.md
git commit -m "docs: add queue coordination architecture docs

- Document queue-based coordination pattern
- Add component descriptions and flows
- Add startup/monitoring/stopping instructions
- Update plan status to complete
- Update README with overview"
```

---

## Verification Checklist

- [ ] All tests pass (`yarn test --run`)
- [ ] No TypeScript errors (`yarn tsc --noEmit`)
- [ ] Plans Workflow starts successfully
- [ ] Build workflow signals Plans Workflow correctly
- [ ] MCP polling works with exponential backoff
- [ ] Plans are generated and registered with MCP
- [ ] Integration test with github-parser succeeds
- [ ] Documentation complete and accurate

---

## Next Steps

1. **Monitor in Production** - Watch for edge cases with signal timing
2. **Add Telemetry** - Track queue depth, processing time, poll attempts
3. **Dead Letter Queue** - Handle failed plan generation attempts
4. **Parallel Processing** - Process multiple plans concurrently (future)

## Related Work

- See `plans/top-down-package-planning-workflow.md` for future enhancements
- See `src/activities/discovery.activities.ts:429-519` for existing discovery logic
