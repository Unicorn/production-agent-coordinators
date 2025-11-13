# Enhanced Discovery with Plan Generation

Comprehensive queue-based workflow coordination system for automated package plan generation.

## Overview

This system implements **signal-based coordination** between Build Workflows and a long-running Plans Workflow singleton. When a package is not found during discovery, the build workflow automatically requests plan generation instead of failing immediately.

### Key Features

✅ **Queue-Based Plan Generation** - Priority queue processes plan requests from multiple workflows
✅ **Signal Coordination** - Workflows communicate via Temporal signals for loose coupling
✅ **Exponential Backoff Polling** - Efficient waiting for plan generation completion
✅ **MCP Integration** - Centralized plan registry and package metadata management
✅ **Fire-and-Forget Pattern** - Build workflows don't block waiting for Plans Workflow
✅ **Auto-Discovery** - Plans Workflow discovers packages needing plans during idle time
✅ **Agent Integration Ready** - Architecture supports AI agent invocation for plan content generation

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        Build Workflow                                     │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Discovery Phase: Search for Package                               │ │
│  │                                                                      │ │
│  │  if (package not found):                                            │ │
│  │    1. Try discoverPlanFromDependencyGraph()                        │ │
│  │    2. Signal Plans Workflow (fire-and-forget)                      │ │
│  │    3. Poll MCP for plan with exponential backoff                   │ │
│  │       - 5s → 7.5s → 11.25s → ... (max 2min)                        │ │
│  │    4. If plan appears: Continue workflow                            │ │
│  │    5. If timeout: Fail with actionable error                        │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────┬──────────────────────────────────────────────┘
                            │ Signal: requestPlan
                            │ { packageName, requestedBy, priority: 'high' }
                            ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                   Plans Workflow (Singleton)                              │
│  ID: plans-workflow-singleton                                             │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Priority Queue:                                                    │ │
│  │  - High Priority: Workflow requests (from signals)                 │ │
│  │  - Low Priority: Auto-discovered packages                          │ │
│  │                                                                      │ │
│  │  Processing Loop (runs indefinitely):                              │ │
│  │    while (true):                                                    │ │
│  │      if queue.length > 0:                                           │ │
│  │        request = queue.shift()                                      │ │
│  │        await generatePlanForPackage(request)                        │ │
│  │      else:                                                           │ │
│  │        discovered = await discoverPackagesNeedingPlans()           │ │
│  │        queue.push(...discovered with priority='low')                │ │
│  │      sleep(10s)                                                     │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────┬──────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                  generatePlanForPackage Activity                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  1. Query MCP for package dependencies                             │ │
│  │  2. [TODO] Invoke package-planning-writer agent                    │ │
│  │     - Agent generates plan markdown file                            │ │
│  │     - Validates plan has required sections                          │ │
│  │  3. Register plan with MCP (packages_update)                        │ │
│  │     - Set plan_file_path                                            │ │
│  │     - Set branch_name                                               │ │
│  │     - Update status to 'planning'                                   │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────┬──────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                     MCP Server (packages-api)                             │
│  - Stores package metadata and plan references                           │
│  - Provides query API for discovery                                      │
│  - Tracks plan generation status                                         │
└──────────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Plans Workflow (`src/workflows/plans.workflow.ts`)

**Purpose:** Long-running singleton that processes plan generation requests

**Key Characteristics:**
- Workflow ID: `plans-workflow-singleton`
- Runs indefinitely (`workflowExecutionTimeout: '0s'`)
- Maintains priority queue (high for signals, low for discovery)
- Processes one request at a time
- Auto-discovers packages needing plans during idle time

**Signal Handler:**
```typescript
setHandler(requestPlanSignal, (request: PlanRequest) => {
  queue.unshift({ ...request, priority: 'high', source: 'workflow-request' });
});
```

**Processing Loop:**
```typescript
while (true) {
  if (queue.length > 0) {
    const request = queue.shift()!;
    await generatePlanForPackage({ packageName, requestedBy });
  } else {
    const discovered = await discoverPackagesNeedingPlans();
    queue.push(...discovered.map(pkg => ({
      packageName: pkg,
      priority: 'low',
      source: 'discovery'
    })));
  }
  await sleep('10s');
}
```

### 2. Signal Definition (`src/signals/plan-signals.ts`)

**Purpose:** Defines the signal contract for workflow coordination

```typescript
export interface PlanRequest {
  packageName: string;
  requestedBy: string;  // workflow ID of requester
  timestamp: number;
  priority: 'high' | 'low';
  source: 'workflow-request' | 'discovery';
}

export const requestPlanSignal = defineSignal<[PlanRequest]>('requestPlan');
```

### 3. Planning Activities (`src/activities/planning.activities.ts`)

**Key Functions:**

- `generatePlanForPackage()` - Generates plan for a specific package
  - Queries MCP for dependencies
  - [TODO] Invokes package-planning-writer agent
  - Registers plan with MCP

- `discoverPackagesNeedingPlans()` - Finds packages in 'planning' status with no plan_file_path
  - Queries MCP: `packages_query({ filters: { status: ['planning'] } })`
  - Returns list of package names

- `searchLocalPlans()` - Searches for plan files in local workspace
  - Searches `plans/packages/**/*.md`
  - Matches by package name (without scope)

- `readPlanFile()` - Reads plan file content from disk

- `validatePlan()` - Validates plan has required sections
  - Required: Overview, Requirements, Implementation, Testing

- `registerPlanWithMcp()` - Registers plan content with MCP
  - [TODO] Currently stub, needs MCP integration

### 4. Discovery Activities (`src/activities/discovery.activities.ts`)

**Key Functions:**

- `pollMcpForPlan()` - Polls MCP for plan to appear
  - Exponential backoff: 5s → 7.5s → 11.25s → ...
  - Max delay capped at 2 minutes
  - Returns `{ found: boolean, planPath?: string }`

- `discoverPlanFromDependencyGraph()` - Attempts to discover plan from dependencies
  - Uses MCP dependency graph to find related plans
  - Useful when package doesn't exist but dependencies are registered

### 5. Build Workflow Integration (`src/workflows/suite-builder.workflow.ts`)

**Package Not Found Handler:**

```typescript
if (!searchResult.found || !searchResult.packagePath) {
  // Step 1: Try dependency graph discovery
  const discoveryResult = await discoverPlanFromDependencyGraph({
    packageName,
    workspaceRoot,
    mcpServerUrl
  });

  // Step 2: Signal Plans Workflow (fire-and-forget)
  const plansWfHandle = getExternalWorkflowHandle('plans-workflow-singleton');
  await plansWfHandle.signal(requestPlanSignal, {
    packageName,
    requestedBy: workflowInfo().workflowId,
    timestamp: Date.now(),
    priority: 'high',
    source: 'workflow-request'
  });

  // Step 3: Poll MCP for plan
  const pollResult = await pollMcpForPlan({
    packageName,
    mcpServerUrl,
    maxAttempts: 10,
    initialDelayMs: 5000
  });

  if (!pollResult.found) {
    throw new Error(`Package not found and plan generation failed`);
  }
}
```

### 6. Plans Workflow Client (`production/scripts/plans-client.ts`)

**Purpose:** Starts the long-running Plans Workflow singleton

**Usage:**
```bash
npx tsx production/scripts/plans-client.ts
```

**Features:**
- Detects if workflow is already running
- Handles workflow lifecycle (starting, attaching, restarting)
- Sets infinite timeout (`workflowExecutionTimeout: '0s'`)
- Provides Temporal UI link for monitoring

## Usage

### Starting the System

1. **Start Temporal Server:**
   ```bash
   temporal server start-dev
   ```

2. **Start Worker:**
   ```bash
   yarn build:worker && yarn start:worker
   ```

3. **Start Plans Workflow Singleton:**
   ```bash
   npx tsx production/scripts/plans-client.ts
   ```

4. **Trigger Build Workflow:**
   ```bash
   npx tsx packages/agents/suite-builder-production/src/client.ts github-parser
   ```

### Monitoring

**Temporal UI:** http://localhost:8233

- View Plans Workflow: Search for `plans-workflow-singleton`
- View Build Workflows: Search for `suite-builder-{packageName}`
- Check signals: Look for `WorkflowSignalReceived` events
- Monitor queue: Check workflow logs for queue status

### Configuration

**Environment Variables:**

```bash
# MCP Server
MCP_SERVER_URL='http://localhost:3355/api/mcp'
PACKAGES_API_TOKEN='your-token-here'

# Temporal
TEMPORAL_ADDRESS='localhost:7233'
TEMPORAL_NAMESPACE='default'

# Workspace
WORKSPACE_ROOT='/path/to/workspace'

# Agent Configuration (for Task 7)
AGENT_TIMEOUT_MS=300000
AGENT_COMMAND='claude code agent'
PLAN_OUTPUT_DIR='/path/to/plans'
```

## Testing

### Unit Tests

```bash
# Planning activities
yarn test packages/agents/suite-builder-production/src/activities/__tests__/planning.activities.test.ts --run

# Discovery activities
yarn test packages/agents/suite-builder-production/src/activities/__tests__/discovery.activities.test.ts --run

# Workflows
yarn test packages/agents/suite-builder-production/src/workflows/__tests__/plans.workflow.test.ts --run
```

### Integration Test

See `src/workflows/__tests__/integration-test.md` for comprehensive manual integration test guide covering:
1. Plans Workflow startup
2. Build workflow triggering for non-existent package
3. Signal verification
4. Plan generation verification
5. MCP registration verification
6. Polling success verification

## Implementation Status

### ✅ Completed (Tasks 1-8)

- [x] Plans Workflow with signal handler
- [x] Plan generation activities (MCP integration)
- [x] MCP polling activity with exponential backoff
- [x] Build workflow signal coordination
- [x] Plans Workflow client
- [x] End-to-end integration test documentation
- [x] Agent invocation architecture documentation
- [x] Final documentation and README

### 📋 Future Enhancements (Post-MVP)

- [ ] Implement agent invocation (Task 7 TODO)
  - Create `package-planning-writer` agent
  - Integrate subprocess invocation
  - Add plan quality validation
- [ ] Add metrics and observability
  - Track plan generation duration
  - Monitor queue depth
  - Success/failure rates
- [ ] Implement caching
  - Cache similar plan requests
  - Deduplicate in-flight requests
- [ ] Add human-in-the-loop review
  - Optional review before plan registration
  - Plan quality scoring
- [ ] Multi-agent support
  - Different agents for different package types
  - Agent selection based on metadata

## Troubleshooting

### Plans Workflow Not Receiving Signals

**Symptoms:** Build workflow hangs waiting for plan

**Solutions:**
1. Verify workflow ID is exactly `plans-workflow-singleton`
2. Check both workflows are on same task queue (`suite-builder`)
3. View Temporal UI for `WorkflowSignalReceived` events
4. Restart Plans Workflow if needed

### Polling Timeout

**Symptoms:** `pollMcpForPlan` reaches max attempts without finding plan

**Solutions:**
1. Check MCP server is reachable
2. Verify Plans Workflow is processing requests (check logs)
3. Check MCP registration succeeded (curl packages_get)
4. Increase `maxAttempts` in polling configuration

### MCP Connection Errors

**Symptoms:** Activities fail with MCP errors

**Solutions:**
1. Verify `MCP_SERVER_URL` environment variable
2. Check MCP server is running
3. Test MCP connectivity: `curl $MCP_SERVER_URL/health`
4. Verify `PACKAGES_API_TOKEN` if using authentication

### Plans Workflow Stopped

**Symptoms:** Workflows hang, plans not being generated

**Solutions:**
1. Check Temporal UI for workflow status
2. Restart using `npx tsx production/scripts/plans-client.ts`
3. Check worker logs for errors
4. Verify workflow timeout is '0s' (infinite)

## Architecture Decisions

### Why Signals Over Child Workflows?

**Signals chosen because:**
- ✅ Loose coupling between workflows
- ✅ Build workflows don't block on plan generation
- ✅ Single Plans Workflow processes all requests efficiently
- ✅ Easy to add priority and queuing logic
- ✅ Workflow can run indefinitely without timing out

**Alternative (Child Workflows) rejected because:**
- ❌ Tight coupling between workflows
- ❌ Each build workflow spawns separate plan generation workflow
- ❌ Resource inefficiency (N workflows for N packages)
- ❌ Harder to implement priority queuing
- ❌ More complex lifecycle management

### Why Polling Over Callbacks?

**Polling chosen because:**
- ✅ Simple and predictable
- ✅ Works with existing MCP API
- ✅ Exponential backoff prevents resource waste
- ✅ Self-healing (recovers from temporary failures)

**Alternative (Callbacks) rejected because:**
- ❌ Requires bidirectional communication
- ❌ More complex error handling
- ❌ Harder to test and debug
- ❌ Workflow would need to expose HTTP endpoint

### Why Singleton Over Multiple Workers?

**Singleton chosen because:**
- ✅ Centralizes queue management
- ✅ Prevents duplicate plan generation
- ✅ Easy to monitor and observe
- ✅ Simplified priority logic

**Alternative (Multiple Workers) rejected because:**
- ❌ Race conditions for same package
- ❌ Complex coordination needed
- ❌ Harder to implement priority
- ❌ Duplicate work possible

## Related Documentation

- [Agent Invocation Architecture](./agent-invocation-architecture.md)
- [Integration Test Guide](../src/workflows/__tests__/integration-test.md)
- [Implementation Plan](../../docs/plans/2025-01-12-enhanced-discovery-plan-generation.md)

## Commit History

- `085b051` - Task 1: Plans Workflow with signal handler
- `6045906` - Task 2: Plan generation activities
- `d8bb942` - Task 3: MCP polling activity
- `4608263` - Task 4: Build workflow signal coordination
- `d6bfde3` - Task 5: Plans Workflow client
- `86c658c` - Task 6: Integration test documentation
- `f818aa5` - Task 7: Agent invocation architecture
- `c1b5e01` - Task 8: Final documentation

## Contributing

When extending this system:

1. **Maintain signal contract** - Don't break `PlanRequest` interface
2. **Test end-to-end** - Use integration test guide
3. **Document in code** - Update JSDoc comments
4. **Follow TDD** - Write tests first
5. **Update this README** - Keep documentation current

## License

Internal use only - Bernier LLC
