# Plan Writer Service Refactor - Implementation Plan

**Date:** 2025-11-14
**Status:** In Progress
**Branch:** `feature/refactor-plan-writer-service`

## Overview

Refactoring plan-writer-service from a simple long-running workflow to an intelligent parent-child workflow pattern that autonomously discovers package lineage, evaluates existing packages, and coordinates plan writing across package hierarchies.

## Architecture Pattern

### Long-Running Service (Parent)
```
PlanWriterServiceWorkflow
├─ Receives signals: package_plan_needed, discovered_child_package
├─ Queries MCP: Does package exist? Does it need updating?
├─ Spawns evaluator agent for existing packages
├─ Spawns child workflow (PlanWriterPackageWorkflow) per package
└─ Manages global queue and priority
```

### Short-Running Package Workflow (Child)
```
PlanWriterPackageWorkflow (per package)
├─ Query MCP: Get my parent lineage
├─ For each parent without plan:
│   ├─ Signal service: "I need parent X planned first"
│   └─ Wait for parent plan file to exist (condition polling)
├─ Read parent plan for context
├─ Spawn agent: Write my plan with parent context
├─ Commit plan to Git (--no-verify)
├─ Update MCP: plan_file_path, plan_git_branch, status
├─ Query MCP: Discover my children
├─ Signal service: "Found child Y, check if needs plan"
└─ Complete
```

## Implementation Checklist

### ✅ Phase 1: Types & Infrastructure (Completed)
- [x] Create PlanWriterPackageWorkflow metadata
- [x] Create PackageEvaluationInput/Result types
- [x] Create MCPPackageDetails and MCPPackageLineage types
- [x] Create DiscoveredChildPackagePayload signal type
- [x] Create WritePlanInputWithContext type
- [x] Implement MCP query activities (6 activities)
- [x] Document MCP vs REST API architecture decision

### 🔄 Phase 2: Agent Activities (In Progress)
- [ ] Implement spawnPackageEvaluatorAgent
  - Input: existing plan, parent plan, npm info, package details
  - Output: needsUpdate, reason, updateType, confidence
  - Agent decides: 'plan' | 'implementation' | 'none'
- [ ] Update spawnPlanWriterAgent to accept parent context
  - Add parentPlanContent parameter
  - Add parentPackageId parameter
  - Add lineage chain parameter
  - Update mock implementation to use context

### ⏳ Phase 3: Child Workflow
- [ ] Create PlanWriterPackageWorkflow
  - Implement lineage discovery
  - Implement parent waiting (condition + polling)
  - Implement plan reading from parent
  - Integrate spawnPlanWriterAgent with context
  - Integrate git commit activity
  - Integrate MCP update activity
  - Implement child discovery
  - Signal service for discovered children
- [ ] Add workflow metadata export
- [ ] Create signal definitions

### ⏳ Phase 4: Service Refactor
- [ ] Refactor PlanWriterServiceWorkflow
  - Add discovered_child_package signal handler
  - Implement package evaluation logic
  - Add evaluator agent spawning for existing packages
  - Implement child workflow spawning
  - Update queue management
  - Handle skip logic (package doesn't need update)
- [ ] Update signal contracts
- [ ] Test signal flow between parent and children

### ⏳ Phase 5: Testing
- [ ] Add tests for MCP activities
- [ ] Add tests for evaluator agent activity
- [ ] Add tests for updated plan writer agent
- [ ] Add tests for child workflow
- [ ] Add tests for service workflow
- [ ] Update integration tests

### ⏳ Phase 6: Verification
- [ ] Build all packages
- [ ] Run all tests (verify 100% pass)
- [ ] Manual workflow testing (if possible)
- [ ] Code review checklist

## Detailed Implementation

### 1. spawnPackageEvaluatorAgent Activity

**File:** `packages/agents/plan-writer-service/src/activities/plan.activities.ts`

```typescript
export async function spawnPackageEvaluatorAgent(
  input: PackageEvaluationInput
): Promise<PackageEvaluationResult> {
  const startTime = Date.now();

  try {
    console.log(`[spawnPackageEvaluatorAgent] Evaluating ${input.packageId}`);

    // TODO: Spawn actual agent with Claude Code MCP
    // Agent will compare:
    // - Existing plan vs parent plan expectations
    // - Existing npm package vs requirements
    // - Make decision: update plan, update implementation, or sufficient

    // Mock decision for now
    const mockResult: PackageEvaluationResult = {
      success: true,
      needsUpdate: false,
      reason: "Existing package matches parent expectations",
      updateType: 'none',
      confidence: 'high'
    };

    console.log(`[spawnPackageEvaluatorAgent] Decision: ${mockResult.updateType}`);
    console.log(`[spawnPackageEvaluatorAgent] Reason: ${mockResult.reason}`);

    return mockResult;
  } catch (error) {
    // Handle errors...
  }
}
```

### 2. Updated spawnPlanWriterAgent

**File:** `packages/agents/plan-writer-service/src/activities/plan.activities.ts`

```typescript
export async function spawnPlanWriterAgent(
  input: WritePlanInputWithContext
): Promise<WritePlanResult> {
  const startTime = Date.now();

  try {
    console.log(`[spawnPlanWriterAgent] Writing plan for ${input.packageId}`);
    if (input.parentPlanContent) {
      console.log(`[spawnPlanWriterAgent] Using parent context from ${input.parentPackageId}`);
    }

    // Generate plan with parent context
    const planContent = generatePlanWithContext(input);

    // ... rest of implementation
  } catch (error) {
    // Handle errors...
  }
}

function generatePlanWithContext(input: WritePlanInputWithContext): string {
  let plan = `# ${input.packageId} Implementation Plan\n\n`;

  if (input.parentPlanContent) {
    plan += `## Parent Package Context\n\n`;
    plan += `Parent: ${input.parentPackageId}\n`;
    plan += `Lineage: ${input.lineage?.join(' → ') || 'None'}\n\n`;
    plan += `### Parent Architecture\n\n`;
    // Extract relevant sections from parent plan
  }

  plan += `## Overview\n\n**Reason**: ${input.reason}\n\n`;
  // ... rest of plan generation

  return plan;
}
```

### 3. PlanWriterPackageWorkflow

**File:** `packages/agents/plan-writer-service/src/workflows/plan-writer-package.workflow.ts`

```typescript
import { condition, proxyActivities } from '@temporalio/workflow';
import type * as mcpActivities from '../activities/mcp.activities';
import type * as planActivities from '../activities/plan.activities';

const mcp = proxyActivities<typeof mcpActivities>({
  startToCloseTimeout: '5 minutes'
});

const plan = proxyActivities<typeof planActivities>({
  startToCloseTimeout: '10 minutes'
});

export async function PlanWriterPackageWorkflow(
  input: PlanWriterPackageInput
): Promise<PlanWriterPackageResult> {
  console.log(`[PlanWriterPackageWorkflow] Starting for ${input.packageId}`);

  try {
    // Step 1: Get package lineage
    const lineage = await mcp.queryPackageLineage(input.packageId);
    console.log(`[PlanWriterPackageWorkflow] Lineage depth: ${lineage.depth}`);

    // Step 2: Wait for parent plans (if any)
    for (const parentId of lineage.parents) {
      console.log(`[PlanWriterPackageWorkflow] Checking parent: ${parentId}`);

      const parentDetails = await mcp.queryPackageDetails(parentId);

      if (!parentDetails.plan_file_path) {
        // Parent doesn't have plan - signal service to create it
        console.log(`[PlanWriterPackageWorkflow] Signaling need for parent plan: ${parentId}`);
        // TODO: Signal service with discovered parent

        // Wait for parent plan to exist
        await condition(() => mcp.checkPlanExists(parentDetails.plan_file_path!), '30 minutes');
      }
    }

    // Step 3: Read parent plan for context
    let parentPlanContent: string | undefined;
    if (lineage.parents.length > 0) {
      const immediateParent = lineage.parents[0];
      const parentDetails = await mcp.queryPackageDetails(immediateParent);

      if (parentDetails.plan_file_path) {
        parentPlanContent = await mcp.readPlanFile(parentDetails.plan_file_path) || undefined;
      }
    }

    // Step 4: Write plan with context
    const planResult = await plan.spawnPlanWriterAgent({
      packageId: input.packageId,
      reason: input.reason,
      context: {},
      parentPlanContent,
      parentPackageId: lineage.parents[0],
      lineage: lineage.parents
    });

    if (!planResult.success) {
      throw new Error(planResult.error || 'Plan writing failed');
    }

    // Step 5: Commit to Git
    const gitBranch = `feature/${input.packageId.replace('@', '').replace('/', '-')}`;
    const commitResult = await plan.gitCommitPlan({
      packageId: input.packageId,
      planFilePath: planResult.planFilePath,
      gitBranch,
      commitMessage: `feat: Add implementation plan for ${input.packageId}`
    });

    // Step 6: Update MCP
    await plan.updateMCPStatus({
      packageId: input.packageId,
      planFilePath: planResult.planFilePath,
      gitBranch,
      status: 'plan_written'
    });

    // Step 7: Discover children
    const children = await mcp.queryChildPackages(input.packageId);

    // Step 8: Signal service for each child
    for (const childId of children) {
      console.log(`[PlanWriterPackageWorkflow] Discovered child: ${childId}`);
      // TODO: Signal service with discovered child
    }

    return {
      success: true,
      packageId: input.packageId,
      planFilePath: planResult.planFilePath,
      gitBranch,
      childrenDiscovered: children
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[PlanWriterPackageWorkflow] Failed:`, errorMessage);

    return {
      success: false,
      packageId: input.packageId,
      error: errorMessage
    };
  }
}
```

### 4. Refactored PlanWriterServiceWorkflow

**File:** `packages/agents/plan-writer-service/src/workflows/plan-writer-service.workflow.ts`

**Key Changes:**
1. Add `discoveredChildPackageSignal` handler
2. Before spawning child, query MCP for package details
3. If package exists, spawn evaluator agent
4. Based on evaluation, spawn child or skip
5. Track spawned children (Map<packageId, childHandle>)

## Testing Strategy

### Unit Tests
- Each MCP activity with mock MCP responses
- Evaluator agent activity with various scenarios
- Plan writer agent with/without parent context

### Integration Tests
- Full child workflow execution
- Parent-child signal flow
- Lineage discovery and waiting

### Manual Testing
1. Trigger service with package that has parent
2. Verify parent plan created first
3. Verify child waits for parent
4. Verify child uses parent context
5. Verify children discovered and queued

## Success Criteria

- [ ] All tests passing (100%)
- [ ] Build succeeds with no errors
- [ ] Child workflows spawn correctly
- [ ] Lineage discovery works
- [ ] Parent waiting works (condition polling)
- [ ] Plans include parent context
- [ ] Children discovered and signaled
- [ ] Evaluator agent makes correct decisions

## Notes

- Keep existing MCP calls for now (migrate to REST later)
- Agent prompts are mocked (implement actual agents in future phase)
- File operations are mocked (implement actual I/O in future phase)
- Git operations are mocked (implement actual git in future phase)

## Next Steps After This Refactor

1. Implement actual agent spawning (Claude Code MCP integration)
2. Implement actual file I/O operations
3. Implement actual git operations
4. Implement actual MCP/REST API calls
5. Create worker configuration to run the service
6. Deploy and test with real packages

---

**Status:** Phase 1 complete, Phase 2 in progress
**Last Updated:** 2025-11-14
