# Temporal-Based Development Workflow Architecture

**Date:** 2025-11-21
**Status:** Design Approved
**Author:** Backend Architect Agent (Claude)
**Reviewers:** Matt Bernier

---

## Executive Summary

This document outlines the architecture for a fully autonomous, Temporal-based development workflow system that takes features from initial request through production deployment. The system uses a **decoupled planning + task pools** architecture with BrainGrid as the task queue, Temporal for orchestration, and Slack for human collaboration.

**Key Features:**
- Conversational requirement gathering via Slack threads
- AI-powered task breakdown with dependency management
- Parallel task execution with multiple worker pools
- Human approval gates at critical phases
- Graceful stop capability with state preservation
- Real-time progress updates and Q&A support

**Timeline Impact:** Reduces feature delivery time from weeks to hours/days through autonomous execution while maintaining human oversight at critical gates.

---

## Table of Contents

1. [High-Level Architecture](#high-level-architecture)
2. [Dependency Management System](#dependency-management-system)
3. [Workflow Types](#workflow-types)
4. [Slack Integration Patterns](#slack-integration-patterns)
5. [Activities & Agent Execution](#activities--agent-execution)
6. [Infrastructure Components](#infrastructure-components)
7. [End-to-End Flow Example](#end-to-end-flow-example)
8. [Implementation Plan](#implementation-plan)
9. [Success Criteria](#success-criteria)

---

## High-Level Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     PLANNING LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│  FeaturePlanningWorkflow (Long-Running)                        │
│    ├─ Requirement Intake (Human + AI via Slack)                │
│    ├─ BrainGrid REQ Creation                                   │
│    ├─ AI Task Breakdown                                        │
│    ├─ Dependency Tree Builder                                  │
│    └─ Task Distribution to BrainGrid                           │
│                                                                 │
│  Stores: DependencyTreeState in Workflow Memory/Supabase       │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                   BRAINGRID (Decoupling Layer)                  │
├─────────────────────────────────────────────────────────────────┤
│  REQ-123: "Add user authentication"                            │
│    ├─ Task-456: [DEV] Scaffold auth UI (tags: frontend, dev)   │
│    ├─ Task-457: [DEV] Create auth API (tags: backend, dev)     │
│    ├─ Task-458: [TEST] Write tests (tags: test, deps:456,457)  │
│    ├─ Task-459: [DEPLOY-STG] Stage deploy (tags: deploy)       │
│    └─ Task-460: [DEPLOY-PROD] Prod deploy (tags: deploy)       │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                   EXECUTION LAYER (Task Pools)                  │
├─────────────────────────────────────────────────────────────────┤
│  DevelopmentTaskWorkflow Pool (4 concurrent workers)           │
│    └─ Polls BrainGrid for tags: [DEV], checks dependencies     │
│                                                                 │
│  TestingTaskWorkflow Pool (2 concurrent workers)               │
│    └─ Polls BrainGrid for tags: [TEST], checks dependencies    │
│                                                                 │
│  DeploymentTaskWorkflow Pool (1 worker for safety)             │
│    └─ Polls BrainGrid for tags: [DEPLOY-STG, DEPLOY-PROD]      │
│                                                                 │
│  Each task workflow:                                           │
│    ├─ Claims task (atomic lock)                                │
│    ├─ Executes with CoordinatorWorkflow pattern               │
│    ├─ Updates progress → BrainGrid & Slack                     │
│    ├─ Requests human approval via Slack (if needed)            │
│    └─ Marks complete → BrainGrid                               │
└─────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Decoupled Architecture**: Planning and execution workflows communicate only through BrainGrid, enabling independent scaling and failure isolation.

2. **BrainGrid as Source of Truth**: Tasks live in BrainGrid, dependency tree lives in workflow state. Workflows validate against both before claiming tasks.

3. **Multiple Task Queues**: Separate Temporal task queues for dev, test, and deploy work allows independent worker scaling and resource allocation.

4. **Long-Running Planning Workflow**: Stays alive for the entire feature lifecycle (hours to days) to maintain dependency tree state and coordinate task completion.

5. **Continuous Polling Workers**: Task execution workflows run indefinitely, polling BrainGrid for work. Auto-restart on failure ensures no task is missed.

---

## Dependency Management System

### Data Structures

```typescript
// Stored in FeaturePlanningWorkflow state
interface DependencyTree {
  reqId: string;
  tasks: Map<string, TaskNode>;
  layers: TaskNode[][]; // Tasks grouped by dependency layer
  lastUpdated: string;
}

interface TaskNode {
  taskId: string;           // BrainGrid task ID
  name: string;
  description: string;
  tags: string[];           // [DEV], [TEST], [DEPLOY-STG], etc.
  dependencies: string[];   // taskIds this depends on
  dependents: string[];     // taskIds that depend on this
  status: TaskStatus;
  layer: number;            // 0 = no deps, 1 = depends on layer 0, etc.
  estimatedHours?: number;
  assignedTo?: string;      // Workflow ID that claimed it
  claimedAt?: string;
  completedAt?: string;
}

enum TaskStatus {
  BLOCKED = 'blocked',      // Has unfinished dependencies
  READY = 'ready',          // Dependencies done, available for work
  CLAIMED = 'claimed',      // Workflow picked it up
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PAUSED = 'paused'         // User stopped workflow
}
```

### Dependency Resolution Algorithm

```typescript
// Step 1: Build dependency graph from task breakdown
function buildDependencyTree(tasks: Task[]): DependencyTree {
  const tree: DependencyTree = {
    reqId: tasks[0].reqId,
    tasks: new Map(),
    layers: [],
    lastUpdated: new Date().toISOString()
  };

  // Create task nodes
  for (const task of tasks) {
    tree.tasks.set(task.id, {
      taskId: task.id,
      name: task.name,
      description: task.description,
      tags: task.tags,
      dependencies: task.dependencies || [],
      dependents: [],
      status: TaskStatus.BLOCKED,
      layer: -1 // Will be calculated
    });
  }

  // Build dependent relationships (reverse edges)
  for (const [taskId, node] of tree.tasks) {
    for (const depId of node.dependencies) {
      const depNode = tree.tasks.get(depId);
      if (depNode) {
        depNode.dependents.push(taskId);
      }
    }
  }

  // Step 2: Topological sort to create layers
  const layers: TaskNode[][] = [];
  const visited = new Set<string>();

  // Layer 0: Tasks with no dependencies
  const layer0 = Array.from(tree.tasks.values())
    .filter(node => node.dependencies.length === 0);

  for (const node of layer0) {
    node.layer = 0;
    node.status = TaskStatus.READY; // Can start immediately
    visited.add(node.taskId);
  }
  layers.push(layer0);

  // Subsequent layers
  let currentLayer = 0;
  while (visited.size < tree.tasks.size) {
    const nextLayer: TaskNode[] = [];

    for (const [taskId, node] of tree.tasks) {
      if (visited.has(taskId)) continue;

      // Check if all dependencies are in earlier layers
      const allDepsVisited = node.dependencies.every(depId => visited.has(depId));

      if (allDepsVisited) {
        node.layer = currentLayer + 1;
        node.status = TaskStatus.BLOCKED; // Not ready until deps complete
        nextLayer.push(node);
        visited.add(taskId);
      }
    }

    if (nextLayer.length === 0) {
      throw new Error('Circular dependency detected');
    }

    layers.push(nextLayer);
    currentLayer++;
  }

  tree.layers = layers;
  return tree;
}

// Step 3: Update task readiness when dependencies complete
function updateTaskReadiness(
  tree: DependencyTree,
  completedTaskId: string
): string[] {
  const completedNode = tree.tasks.get(completedTaskId);
  if (!completedNode) return [];

  completedNode.status = TaskStatus.COMPLETED;
  completedNode.completedAt = new Date().toISOString();

  const nowReady: string[] = [];

  // Check each dependent task
  for (const dependentId of completedNode.dependents) {
    const dependentNode = tree.tasks.get(dependentId);
    if (!dependentNode) continue;

    // Check if all dependencies are complete
    const allDepsComplete = dependentNode.dependencies.every(depId => {
      const dep = tree.tasks.get(depId);
      return dep?.status === TaskStatus.COMPLETED;
    });

    if (allDepsComplete && dependentNode.status === TaskStatus.BLOCKED) {
      dependentNode.status = TaskStatus.READY;
      nowReady.push(dependentId);
    }
  }

  tree.lastUpdated = new Date().toISOString();
  return nowReady;
}
```

### State Management Strategy

```typescript
// For small projects (< 50 tasks): Keep in workflow state
class FeaturePlanningWorkflow {
  private dependencyTree: DependencyTree; // In-memory, Temporal persists

  // Query for task discovery
  @Query()
  getReadyTasks(tags: string[]): TaskNode[] {
    return Array.from(this.dependencyTree.tasks.values())
      .filter(node =>
        node.status === TaskStatus.READY &&
        tags.some(tag => node.tags.includes(tag))
      );
  }

  @Query()
  getDependencyStatus(taskId: string): DependencyStatus {
    const node = this.dependencyTree.tasks.get(taskId);
    if (!node) throw new Error(`Task ${taskId} not found`);

    const depStatuses = node.dependencies.map(depId => ({
      taskId: depId,
      status: this.dependencyTree.tasks.get(depId)?.status
    }));

    return {
      taskId,
      status: node.status,
      dependencies: depStatuses,
      blockedBy: depStatuses
        .filter(d => d.status !== TaskStatus.COMPLETED)
        .map(d => d.taskId)
    };
  }

  @Signal()
  taskCompleted(taskId: string, result: any): void {
    const nowReady = updateTaskReadiness(this.dependencyTree, taskId);

    // Send progress update to Slack
    this.sendProgressUpdate({
      phase: 'Development',
      status: 'in_progress',
      details: `Task completed: ${taskId}\n${nowReady.length} new tasks now ready`
    });

    // Update BrainGrid
    this.updateBrainGridTaskStatus(taskId, 'COMPLETED');
  }
}

// For large projects (> 50 tasks): Use Supabase with workflow as cache
// Supabase schema:
CREATE TABLE workflow_dependency_trees (
  req_id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  tree JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_workflow_trees_req ON workflow_dependency_trees(req_id);
CREATE INDEX idx_workflow_trees_workflow ON workflow_dependency_trees(workflow_id);
```

### Task Claiming with Dependency Validation

```typescript
// Activity: claimTaskFromBrainGrid
async function claimTaskFromBrainGrid(
  taskId: string,
  workflowId: string,
  planningWorkflowId: string
): Promise<boolean> {
  // 1. Query planning workflow for dependency status
  const planningHandle = temporalClient.workflow.getHandle(planningWorkflowId);
  const depStatus = await planningHandle.query('getDependencyStatus', taskId);

  if (depStatus.blockedBy.length > 0) {
    console.log(`Task ${taskId} still blocked by: ${depStatus.blockedBy.join(', ')}`);
    return false; // Still has incomplete dependencies
  }

  // 2. Atomic claim in BrainGrid (optimistic locking)
  try {
    await braingridCli.updateTask(taskId, {
      status: 'IN_PROGRESS',
      assignedTo: workflowId,
      claimedAt: new Date().toISOString()
    });
  } catch (error) {
    // Task already claimed by another worker
    return false;
  }

  // 3. Signal planning workflow that task was claimed
  await planningHandle.signal('taskClaimed', {
    taskId,
    workflowId,
    claimedAt: new Date().toISOString()
  });

  return true;
}
```

---

## Workflow Types

### FeaturePlanningWorkflow (Long-Running Orchestrator)

**Purpose:** Coordinates entire feature lifecycle from requirement intake through completion.

**Lifecycle:** Hours to days (stays alive until all tasks complete).

**Responsibilities:**
- Conversational requirement gathering with humans via Slack
- Creating BrainGrid REQs and task breakdown
- Building and maintaining dependency tree
- Distributing tasks to BrainGrid
- Monitoring task completion and updating dependency states
- Sending progress updates to Slack
- Handling stop requests and graceful shutdown

```typescript
interface PlanningWorkflowInput {
  featureRequest: string;
  repoPath: string;
  targetBranch?: string;
  slackContext: {
    channel: string;
    threadTs: string;
    requestedBy: string;
  };
}

async function FeaturePlanningWorkflow(input: PlanningWorkflowInput): Promise<FeatureResult> {
  const { featureRequest, repoPath, slackContext } = input;

  // Initialize state
  let shouldStop = false;
  let currentPhase = 'requirement-gathering';
  let dependencyTree: DependencyTree;

  // Start heartbeat for periodic progress updates
  startProgressHeartbeat(slackContext);

  try {
    // PHASE 1: Requirement Gathering (conversational with human)
    await sendProgressUpdate({
      phase: 'Requirement Planning',
      status: 'started',
      details: 'Gathering requirements through conversation'
    }, slackContext);

    const requirement = await gatherRequirementsConversation(
      featureRequest,
      slackContext
    );

    if (shouldStop) return handleGracefulShutdown();

    await sendProgressUpdate({
      phase: 'Requirement Planning',
      status: 'completed',
      details: `Requirement defined and approved`
    }, slackContext);

    // PHASE 2: Create BrainGrid REQ
    await sendProgressUpdate({
      phase: 'BrainGrid Setup',
      status: 'started',
      details: 'Creating requirement in BrainGrid'
    }, slackContext);

    const reqId = await createBrainGridREQ(requirement);

    await sendProgressUpdate({
      phase: 'BrainGrid Setup',
      status: 'completed',
      details: `Created REQ-${reqId}`
    }, slackContext);

    // PHASE 3: AI Task Breakdown
    await sendProgressUpdate({
      phase: 'Task Breakdown',
      status: 'started',
      details: 'AI analyzing requirement and creating task breakdown'
    }, slackContext);

    const tasks = await executeChild(TaskBreakdownWorkflow, {
      taskQueue: 'engine',
      args: [{
        reqId,
        requirement,
        agentRegistry: await loadAgentRegistry()
      }]
    });

    if (shouldStop) return handleGracefulShutdown();

    // PHASE 4: Build Dependency Tree
    dependencyTree = buildDependencyTree(tasks);

    await sendProgressUpdate({
      phase: 'Task Breakdown',
      status: 'completed',
      details: `Created ${tasks.length} tasks across ${dependencyTree.layers.length} dependency layers`
    }, slackContext);

    // PHASE 5: Distribute Tasks to BrainGrid
    await sendProgressUpdate({
      phase: 'Task Distribution',
      status: 'started',
      details: 'Publishing tasks to BrainGrid'
    }, slackContext);

    await distributeTasks(reqId, dependencyTree);

    await sendProgressUpdate({
      phase: 'Task Distribution',
      status: 'completed',
      details: `${dependencyTree.layers[0].length} tasks ready to start`
    }, slackContext);

    // PHASE 6: Monitor Task Execution (long-running)
    currentPhase = 'task-execution';
    await sendProgressUpdate({
      phase: 'Development & Testing',
      status: 'started',
      details: 'Task execution workflows are now picking up work'
    }, slackContext);

    await monitorTasksUntilComplete(dependencyTree, slackContext);

    // PHASE 7: Completion
    await sendProgressUpdate({
      phase: 'Feature Complete',
      status: 'completed',
      details: `All ${tasks.length} tasks completed successfully!`
    }, slackContext);

    return {
      success: true,
      reqId,
      tasksCompleted: tasks.length,
      duration: Date.now() - startTime
    };

  } catch (error) {
    await sendProgressUpdate({
      phase: currentPhase,
      status: 'failed',
      details: `Error: ${error.message}`
    }, slackContext);
    throw error;
  }
}

// Signal Handlers
@Signal()
taskClaimed(data: { taskId: string; workflowId: string }): void {
  const node = dependencyTree.tasks.get(data.taskId);
  if (node) {
    node.status = TaskStatus.CLAIMED;
    node.assignedTo = data.workflowId;
    node.claimedAt = data.claimedAt;
  }
}

@Signal()
taskCompleted(data: { taskId: string; result: any }): void {
  const nowReady = updateTaskReadiness(dependencyTree, data.taskId);

  // Update BrainGrid
  updateBrainGridTaskStatus(data.taskId, 'COMPLETED');

  // Check if this completed a layer
  const completedLayer = checkIfLayerComplete(dependencyTree);
  if (completedLayer >= 0) {
    sendProgressUpdate({
      phase: 'Development & Testing',
      status: 'in_progress',
      details: `Layer ${completedLayer} complete! ${nowReady.length} new tasks now available`
    }, slackContext);
  }
}

@Signal()
taskFailed(data: { taskId: string; error: string }): void {
  const node = dependencyTree.tasks.get(data.taskId);
  if (node) {
    node.status = TaskStatus.FAILED;
  }

  // Escalate to Slack
  sendProgressUpdate({
    phase: 'Task Execution',
    status: 'failed',
    details: `Task ${data.taskId} failed: ${data.error}`
  }, slackContext);
}

@Signal()
stopRequested(data: { requestedBy: string; reason: string }): void {
  shouldStop = true;
  stopReason = data.reason;
}

// Query Handlers
@Query()
getReadyTasks(tags: string[]): TaskNode[] {
  return Array.from(dependencyTree.tasks.values())
    .filter(node =>
      node.status === TaskStatus.READY &&
      tags.some(tag => node.tags.includes(tag))
    );
}

@Query()
getDependencyStatus(taskId: string): DependencyStatus {
  // Implementation shown earlier
}

@Query()
getExecutionContext(): WorkflowContext {
  const completedTasks = Array.from(dependencyTree.tasks.values())
    .filter(t => t.status === TaskStatus.COMPLETED).length;
  const totalTasks = dependencyTree.tasks.size;
  const inProgress = Array.from(dependencyTree.tasks.values())
    .filter(t => t.status === TaskStatus.IN_PROGRESS || t.status === TaskStatus.CLAIMED);

  return {
    reqId: dependencyTree.reqId,
    currentPhase,
    completedTasks,
    totalTasks,
    currentTask: inProgress[0]?.name,
    elapsed: Date.now() - startTime
  };
}
```

### DevelopmentTaskWorkflow (Continuous Polling Worker)

**Purpose:** Polls BrainGrid for development tasks, executes them with coordinator pattern.

**Lifecycle:** Runs indefinitely, restarts on failure.

**Responsibilities:**
- Poll BrainGrid for [DEV] tagged tasks
- Validate dependencies before claiming
- Execute code generation with CoordinatorWorkflow
- Run build and tests to verify changes
- Create pull requests
- Update progress to BrainGrid and planning workflow

```typescript
async function DevelopmentTaskWorkflow(input: {
  workerId: string;
  taskTypes: string[]; // e.g., ['frontend', 'backend']
}): Promise<void> {
  const { workerId, taskTypes } = input;

  while (true) {
    try {
      // Poll BrainGrid for available tasks
      const task = await pollForTask({
        tags: ['DEV', ...taskTypes],
        status: ['TODO', 'READY']
      });

      if (!task) {
        await sleep('30s');
        continue;
      }

      // Get planning workflow ID from BrainGrid REQ
      const reqId = task.reqId;
      const planningWorkflowId = await getBrainGridREQMetadata(reqId, 'workflowId');

      // Attempt to claim task (validates dependencies)
      const claimed = await claimTaskFromBrainGrid(
        task.id,
        workerId,
        planningWorkflowId
      );

      if (!claimed) {
        console.log(`Failed to claim ${task.id}, moving on`);
        continue;
      }

      // Execute task
      await executeTask(task, planningWorkflowId);

    } catch (error) {
      console.error(`Worker ${workerId} error:`, error);
      await sleep('1m'); // Back off on error
    }
  }
}

async function executeTask(
  task: TaskNode,
  planningWorkflowId: string
): Promise<void> {
  const planningHandle = temporalClient.workflow.getHandle(planningWorkflowId);

  try {
    // Update progress: Starting
    await updateTaskProgress(task.id, 10, 'Creating feature branch');

    // Git setup
    const branch = await createFeatureBranch(
      task.repoPath,
      `feature/${task.reqId}-${task.id}`
    );

    await updateTaskProgress(task.id, 30, 'Generating code with AI');

    // Code generation with coordinator loop
    let attempt = 0;
    let success = false;

    while (!success && attempt < 3) {
      const problem: Problem = {
        type: 'FEATURE_IMPLEMENTATION',
        error: {
          message: task.description,
          context: task.name
        },
        context: {
          taskId: task.id,
          reqId: task.reqId,
          repoPath: task.repoPath,
          branch,
          attemptNumber: attempt + 1
        }
      };

      // Spawn coordinator child workflow
      const action = await executeChild(CoordinatorWorkflow, {
        taskQueue: 'engine',
        workflowId: `coordinator-${task.id}-${Date.now()}`,
        args: [{
          problem,
          agentRegistry: await loadAgentRegistry(),
          maxAttempts: 3,
          workspaceRoot: task.repoPath
        }]
      });

      if (action.decision === 'RESOLVED' || action.decision === 'RETRY') {
        // Verify the code works
        await updateTaskProgress(task.id, 60, 'Building and testing changes');

        const buildResult = await runBuild(task.repoPath);
        const testResult = await runUnitTests(task.repoPath);

        if (buildResult.success && testResult.success) {
          success = true;

          // Commit changes
          await commitChanges({
            workspaceRoot: task.repoPath,
            packagePath: '.',
            message: `feat: ${task.name}\n\n${task.description}\n\nTask-ID: ${task.id}`,
            gitUser: {
              name: 'Dev Workflow Agent',
              email: 'dev-workflow@bernier.llc'
            }
          });
        } else {
          attempt++;
        }
      } else if (action.decision === 'ESCALATE') {
        // Escalate to Slack
        await escalateToSlack(task.id, planningWorkflowId, {
          reason: action.escalation?.reason,
          diagnosticReport: action.escalation?.reportPath
        });
        throw new Error(`Task escalated: ${action.escalation?.reason}`);
      }
    }

    if (!success) {
      throw new Error(`Failed after ${attempt} attempts`);
    }

    await updateTaskProgress(task.id, 90, 'Creating pull request');

    // Create PR
    const pr = await createPullRequest({
      repoPath: task.repoPath,
      branch,
      title: `[${task.reqId}] ${task.name}`,
      description: `${task.description}\n\n**Task:** ${task.id}\n**REQ:** ${task.reqId}`,
      draft: false
    });

    // Mark complete
    await completeTask(task.id, {
      pr: pr.url,
      branch,
      testsRun: true,
      testCoverage: testResult.coverage
    });

    // Signal planning workflow
    await planningHandle.signal('taskCompleted', {
      taskId: task.id,
      result: { pr: pr.url, branch }
    });

    await updateTaskProgress(task.id, 100, `Complete! PR: ${pr.url}`);

  } catch (error) {
    // Signal planning workflow of failure
    await planningHandle.signal('taskFailed', {
      taskId: task.id,
      error: error.message
    });

    await updateTaskProgress(task.id, 0, `Failed: ${error.message}`);
    throw error;
  }
}
```

### TestingTaskWorkflow (Test Execution Worker)

**Purpose:** Runs various test suites for completed development tasks.

**Lifecycle:** Runs indefinitely, restarts on failure.

```typescript
async function TestingTaskWorkflow(input: { workerId: string }): Promise<void> {
  const { workerId } = input;

  while (true) {
    try {
      const task = await pollForTask({
        tags: ['TEST'],
        status: ['TODO', 'READY']
      });

      if (!task) {
        await sleep('30s');
        continue;
      }

      const planningWorkflowId = await getBrainGridREQMetadata(task.reqId, 'workflowId');
      const claimed = await claimTaskFromBrainGrid(task.id, workerId, planningWorkflowId);

      if (!claimed) continue;

      // Execute test suite
      await executeTestTask(task, planningWorkflowId);

    } catch (error) {
      console.error(`Test worker ${workerId} error:`, error);
      await sleep('1m');
    }
  }
}

async function executeTestTask(
  task: TaskNode,
  planningWorkflowId: string
): Promise<void> {
  const planningHandle = temporalClient.workflow.getHandle(planningWorkflowId);

  try {
    // Determine test types from task metadata
    const testTypes = parseTestTypes(task.description);

    const results: TestResult[] = [];
    let progress = 10;

    // Run tests in parallel
    const testPromises = [];

    if (testTypes.includes('unit')) {
      testPromises.push(runUnitTests(task.repoPath));
    }
    if (testTypes.includes('integration')) {
      testPromises.push(runIntegrationTests(task.repoPath));
    }
    if (testTypes.includes('e2e')) {
      testPromises.push(runE2ETests(task.repoPath, task.baseUrl));
    }
    if (testTypes.includes('security')) {
      testPromises.push(runSecurityScan(task.repoPath));
    }
    if (testTypes.includes('accessibility')) {
      testPromises.push(runAccessibilityTests(task.baseUrl));
    }

    await updateTaskProgress(task.id, progress, `Running ${testPromises.length} test suites`);

    const testResults = await Promise.all(testPromises);
    progress += 60;

    // Check for failures
    const failures = testResults.filter(r => !r.success);

    if (failures.length > 0) {
      // Attempt fixes with coordinator
      await updateTaskProgress(task.id, progress, `${failures.length} test suites failed, attempting fixes`);

      const problem: Problem = {
        type: 'TEST_FAILURE',
        error: {
          message: 'Test failures detected',
          stderr: failures.map(f => f.stderr).join('\n\n')
        },
        context: {
          taskId: task.id,
          repoPath: task.repoPath,
          testResults: failures
        }
      };

      const action = await executeChild(CoordinatorWorkflow, {
        taskQueue: 'engine',
        args: [{ problem, agentRegistry: await loadAgentRegistry(), maxAttempts: 3 }]
      });

      if (action.decision !== 'RESOLVED') {
        throw new Error(`Test failures could not be fixed: ${action.reasoning}`);
      }

      // Re-run tests
      const retryResults = await Promise.all(testPromises);
      const stillFailing = retryResults.filter(r => !r.success);

      if (stillFailing.length > 0) {
        throw new Error(`${stillFailing.length} test suites still failing after fixes`);
      }
    }

    // All tests passed
    await completeTask(task.id, {
      testResults,
      allPassed: true
    });

    await planningHandle.signal('taskCompleted', {
      taskId: task.id,
      result: { testResults }
    });

    await updateTaskProgress(task.id, 100, 'All tests passed!');

  } catch (error) {
    await planningHandle.signal('taskFailed', {
      taskId: task.id,
      error: error.message
    });
    throw error;
  }
}
```

### DeploymentTaskWorkflow (Single Deployment Worker)

**Purpose:** Handles staging and production deployments with safety checks.

**Lifecycle:** Runs indefinitely, ONLY 1 WORKER (no parallel deploys).

**Critical:** Includes rollback capability and extensive validation.

```typescript
async function DeploymentTaskWorkflow(input: { workerId: string }): Promise<void> {
  const { workerId } = input;

  // CRITICAL: Only 1 deployment workflow should run
  console.log(`Deployment worker ${workerId} starting (ensure only 1 instance)`);

  while (true) {
    try {
      const task = await pollForTask({
        tags: ['DEPLOY-STG', 'DEPLOY-PROD'],
        status: ['TODO', 'READY']
      });

      if (!task) {
        await sleep('30s');
        continue;
      }

      const planningWorkflowId = await getBrainGridREQMetadata(task.reqId, 'workflowId');
      const claimed = await claimTaskFromBrainGrid(task.id, workerId, planningWorkflowId);

      if (!claimed) continue;

      // Determine deployment environment
      const isProduction = task.tags.includes('DEPLOY-PROD');
      const environment = isProduction ? 'production' : 'staging';

      await executeDeploymentTask(task, environment, planningWorkflowId);

    } catch (error) {
      console.error(`Deployment worker error:`, error);
      await sleep('2m'); // Longer backoff for deploy errors
    }
  }
}

async function executeDeploymentTask(
  task: TaskNode,
  environment: 'staging' | 'production',
  planningWorkflowId: string
): Promise<void> {
  const planningHandle = temporalClient.workflow.getHandle(planningWorkflowId);
  const slackContext = await planningHandle.query('getSlackContext');

  let backupId: string | undefined;

  try {
    // PRODUCTION REQUIRES HUMAN APPROVAL
    if (environment === 'production') {
      await updateTaskProgress(task.id, 5, 'Requesting production deployment approval');

      const approval = await requestProductionApproval(task, slackContext);

      if (!approval.approved) {
        throw new Error(`Production deployment rejected: ${approval.reason}`);
      }
    }

    // Backup database
    await updateTaskProgress(task.id, 10, `Creating ${environment} database backup`);

    const backup = await backupDatabase(environment);
    backupId = backup.id;

    // Run migrations
    await updateTaskProgress(task.id, 30, 'Running database migrations');

    const migrationResult = await runMigrations(environment, 'up');

    if (!migrationResult.success) {
      throw new Error(`Migration failed: ${migrationResult.error}`);
    }

    // Deploy to Vercel
    await updateTaskProgress(task.id, 50, `Deploying to Vercel (${environment})`);

    const deployResult = await deployToVercel({
      environment,
      branch: task.branch,
      repoPath: task.repoPath
    });

    if (!deployResult.success) {
      throw new Error(`Deployment failed: ${deployResult.error}`);
    }

    const deploymentUrl = deployResult.url;

    // Health monitoring
    await updateTaskProgress(task.id, 70, 'Monitoring deployment health');

    const healthDuration = environment === 'production' ? '10m' : '5m';
    const healthResult = await healthCheck(deploymentUrl, healthDuration);

    if (!healthResult.healthy) {
      throw new Error(`Health check failed: ${healthResult.reason}`);
    }

    // UAT validation
    await updateTaskProgress(task.id, 85, 'Running UAT tests');

    const uatResult = await runUATTests(environment);

    if (!uatResult.success) {
      throw new Error(`UAT tests failed: ${uatResult.failures.length} failures`);
    }

    // Success!
    await completeTask(task.id, {
      environment,
      deploymentUrl,
      backupId,
      healthCheck: 'passed',
      uatTests: 'passed'
    });

    await planningHandle.signal('taskCompleted', {
      taskId: task.id,
      result: { environment, deploymentUrl }
    });

    await updateTaskProgress(task.id, 100, `✅ ${environment} deployment complete!`);

    // Send Slack notification
    await sendSlackMessage({
      channel: slackContext.channel,
      thread_ts: slackContext.threadTs,
      text: `🚀 Successfully deployed to ${environment}!\nURL: ${deploymentUrl}`
    });

  } catch (error) {
    // ROLLBACK ON FAILURE
    console.error(`Deployment failed, initiating rollback:`, error);

    await updateTaskProgress(task.id, 0, `❌ Deployment failed, rolling back`);

    if (backupId) {
      await rollbackDeployment({
        environment,
        backupId,
        error: error.message
      });
    }

    await planningHandle.signal('taskFailed', {
      taskId: task.id,
      error: error.message
    });

    // Send failure notification
    await sendSlackMessage({
      channel: slackContext.channel,
      thread_ts: slackContext.threadTs,
      text: `🚨 ${environment} deployment failed and was rolled back\nError: ${error.message}`
    });

    throw error;
  }
}

async function rollbackDeployment(params: {
  environment: string;
  backupId: string;
  error: string;
}): Promise<void> {
  console.log(`Rolling back ${params.environment} deployment...`);

  // 1. Rollback database migrations
  await runMigrations(params.environment, 'down');

  // 2. Restore database backup
  await restoreDatabase(params.environment, params.backupId);

  // 3. Redeploy previous version (get from git)
  const previousSha = await getPreviousDeploymentSha(params.environment);
  await deployToVercel({
    environment: params.environment,
    gitSha: previousSha
  });

  // 4. Verify rollback successful
  const healthResult = await healthCheck(
    getEnvironmentUrl(params.environment),
    '5m'
  );

  if (!healthResult.healthy) {
    throw new Error(`CRITICAL: Rollback health check failed!`);
  }

  console.log(`Rollback complete for ${params.environment}`);
}
```

---

## Slack Integration Patterns

### Conversational Requirement Gathering

**Flow:**
1. User sends `/braingrid request: <description>`
2. Slack posts initial message in channel (starts thread)
3. Workflow asks clarifying questions in thread
4. User responds with text or buttons
5. Workflow iterates until it has complete requirements
6. Presents summary for approval
7. User approves → workflow confirms and starts

**Implementation:**

```typescript
async function gatherRequirementsConversation(
  initialRequest: string,
  slackContext: SlackContext
): Promise<Requirement> {

  const { channel, threadTs } = slackContext;
  let conversation: ConversationTurn[] = [{
    role: 'user',
    content: initialRequest
  }];

  let requirementComplete = false;
  let requirementDraft: Partial<Requirement> = {};

  while (!requirementComplete) {
    // Agent analyzes conversation and decides what to ask next
    const analysis = await analyzeConversationForNextQuestion({
      conversation,
      currentDraft: requirementDraft
    });

    if (analysis.needsMoreInfo) {
      // Post question to thread
      await slackClient.chat.postMessage({
        channel,
        thread_ts: threadTs,
        text: analysis.question,
        blocks: analysis.suggestedAnswers ? [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: analysis.question }
          },
          {
            type: 'actions',
            elements: analysis.suggestedAnswers.map(answer => ({
              type: 'button',
              text: { type: 'plain_text', text: answer },
              value: answer,
              action_id: `answer_${slugify(answer)}`
            }))
          }
        ] : undefined
      });

      // Wait for response (button click or text reply)
      const response = await waitForThreadReply(channel, threadTs, '24h');

      conversation.push({
        role: 'assistant',
        content: analysis.question
      });
      conversation.push({
        role: 'user',
        content: response.text
      });

      // Update requirement draft
      requirementDraft = await updateRequirementDraft(conversation);

    } else {
      requirementComplete = true;
    }
  }

  // Present summary for approval
  const summary = formatRequirementSummary(requirementDraft);

  await slackClient.chat.postMessage({
    channel,
    thread_ts: threadTs,
    text: `📋 Here's what I understand:\n\n${summary}\n\nShall I proceed with this?`,
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: summary }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: '✅ Yes, proceed' },
            value: 'approve',
            action_id: 'approve_requirement',
            style: 'primary'
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '✏️ Revise' },
            value: 'revise',
            action_id: 'revise_requirement'
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '❌ Cancel' },
            value: 'cancel',
            action_id: 'cancel_requirement',
            style: 'danger'
          }
        ]
      }
    ]
  });

  const approval = await waitForApprovalResponse(channel, threadTs);

  if (approval.action === 'revise') {
    await slackClient.chat.postMessage({
      channel,
      thread_ts: threadTs,
      text: `Sure! What would you like to change?`
    });

    const revision = await waitForThreadReply(channel, threadTs, '24h');

    conversation.push({
      role: 'user',
      content: revision.text
    });

    // Restart conversation with revision
    return gatherRequirementsConversation(
      initialRequest,
      slackContext
    );
  } else if (approval.action === 'cancel') {
    throw new Error('Requirement gathering cancelled by user');
  }

  // Approved! Send confirmation
  await slackClient.chat.postMessage({
    channel,
    thread_ts: threadTs,
    text: `Great! I'll get started on this right away. I'll keep you posted on progress in this thread. 🚀`
  });

  return requirementDraft as Requirement;
}

// Activity: analyzeConversationForNextQuestion
async function analyzeConversationForNextQuestion(params: {
  conversation: ConversationTurn[];
  currentDraft: Partial<Requirement>;
}): Promise<ConversationAnalysis> {

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: `You are gathering requirements for a software feature.

Conversation so far:
${params.conversation.map(t => `${t.role}: ${t.content}`).join('\n')}

Current requirement draft:
${JSON.stringify(params.currentDraft, null, 2)}

Required fields for a complete requirement:
- title: Clear, concise feature name
- description: Detailed explanation of what and why
- acceptanceCriteria: List of specific, testable criteria
- technicalConstraints: Any technical limitations or requirements
- estimatedComplexity: low, medium, or high
- affectedSystems: Which parts of the codebase will change

Analyze the conversation and current draft:
1. If all required fields are filled, return { needsMoreInfo: false }
2. If missing information, ask ONE clarifying question
3. Provide 2-4 suggested answers if appropriate (for multiple choice)

Return JSON:
{
  "needsMoreInfo": boolean,
  "question": "string (if needsMoreInfo is true)",
  "suggestedAnswers": ["answer1", "answer2"] (optional),
  "updatedDraft": { /* fields extracted from conversation */ }
}`
      }
    ]
  });

  const analysis = JSON.parse(response.content[0].text);
  return analysis;
}
```

### Progress Updates

**Principles:**
- Update at phase boundaries (not every step)
- Timer-based heartbeat if no update for 15+ minutes
- Include meaningful context (what's happening, how many tasks complete)

```typescript
// Activity: sendProgressUpdate
interface ProgressUpdate {
  phase: string;
  status: 'started' | 'in_progress' | 'completed' | 'failed';
  details: string;
  metadata?: {
    tasksComplete?: number;
    tasksTotal?: number;
    currentTask?: string;
  };
}

async function sendProgressUpdate(
  update: ProgressUpdate,
  slackContext: SlackContext
): Promise<void> {
  const emoji = {
    started: '▶️',
    in_progress: '⏳',
    completed: '✅',
    failed: '❌'
  }[update.status];

  let message = `${emoji} **${update.phase}** - ${update.status}\n${update.details}`;

  if (update.metadata?.tasksComplete !== undefined) {
    message += `\n\nProgress: ${update.metadata.tasksComplete}/${update.metadata.tasksTotal} tasks complete`;
  }

  if (update.metadata?.currentTask) {
    message += `\nCurrent: ${update.metadata.currentTask}`;
  }

  await slackClient.chat.postMessage({
    channel: slackContext.channel,
    thread_ts: slackContext.threadTs,
    text: message
  });

  lastUpdateTimestamp = Date.now();
}

// Heartbeat: Periodic updates during long-running phases
let heartbeatInterval: NodeJS.Timeout;
let lastUpdateTimestamp: number;

function startProgressHeartbeat(slackContext: SlackContext): void {
  heartbeatInterval = setInterval(async () => {
    const timeSinceLastUpdate = Date.now() - lastUpdateTimestamp;

    // If > 15 minutes since last update, send heartbeat
    if (timeSinceLastUpdate > 15 * 60 * 1000) {
      const status = await getCurrentWorkflowStatus();

      await slackClient.chat.postMessage({
        channel: slackContext.channel,
        thread_ts: slackContext.threadTs,
        text: `⏳ Still working on: ${status.currentPhase}\n` +
              `Progress: ${status.completedTasks}/${status.totalTasks} tasks complete\n` +
              `Current task: ${status.currentTask || 'N/A'}`
      });

      lastUpdateTimestamp = Date.now();
    }
  }, 5 * 60 * 1000); // Check every 5 minutes
}

function stopProgressHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }
}
```

### Handling User Questions During Execution

**Pattern:** User replies to thread → Agent with context answers → Workflow continues

```typescript
// Slack event handler for thread replies
app.event('message', async ({ event, client }) => {
  // Only handle messages in workflow threads
  if (!event.thread_ts || event.subtype === 'bot_message') {
    return;
  }

  const workflowId = await getWorkflowIdFromThread(event.thread_ts);
  if (!workflowId) return; // Not a workflow thread

  const workflowHandle = temporalClient.workflow.getHandle(workflowId);

  // Check if this is a stop command
  if (event.text?.toLowerCase().match(/stop|halt|cancel|abort/)) {
    await handleStopRequest(workflowHandle, event, client);
    return;
  }

  // Otherwise, it's a question - spawn agent to answer
  try {
    const context = await workflowHandle.query('getExecutionContext');
    const conversationHistory = await getThreadHistory(event.thread_ts);

    const answer = await answerUserQuestion({
      question: event.text,
      context: context,
      conversationHistory: conversationHistory
    });

    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: event.thread_ts,
      text: answer
    });
  } catch (error) {
    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: event.thread_ts,
      text: `Sorry, I encountered an error answering your question: ${error.message}`
    });
  }
});

// Activity: answerUserQuestion
async function answerUserQuestion(params: {
  question: string;
  context: WorkflowContext;
  conversationHistory: SlackMessage[];
}): Promise<string> {
  const { question, context, conversationHistory } = params;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4',
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: `You are helping a user understand the progress of their feature development workflow.

Current workflow state:
- REQ ID: ${context.reqId}
- Current Phase: ${context.currentPhase}
- Progress: ${context.completedTasks}/${context.totalTasks} tasks complete
- Current Task: ${context.currentTask || 'None'}
- Time Elapsed: ${formatDuration(context.elapsed)}

Recent conversation (last 5 messages):
${conversationHistory.slice(-5).map(m => `${m.user}: ${m.text}`).join('\n')}

User's question: ${question}

Provide a helpful, concise answer (2-3 sentences) about:
- What the workflow is currently doing
- When they can expect it to complete (if asked)
- How to view more details (link to Temporal UI, BrainGrid, etc.)
- Or answer their specific question based on context

Be friendly and professional. Don't make up information you don't have.`
      }
    ]
  });

  return response.content[0].text;
}
```

### Stop Command with Graceful Shutdown

**Flow:**
1. User types "stop" in thread
2. Bot asks for confirmation (with warning)
3. User confirms → workflow signals stop
4. Workflow completes current step
5. Commits work in progress
6. Updates BrainGrid tasks to PAUSED
7. Reports final state to Slack

```typescript
async function handleStopRequest(
  workflowHandle: WorkflowHandle,
  event: SlackEvent,
  client: SlackClient
): Promise<void> {
  const { channel, thread_ts, user } = event;

  // Send confirmation request
  const confirmMsg = await client.chat.postMessage({
    channel,
    thread_ts: thread_ts,
    text: `⚠️ <@${user}> Are you sure you want to stop this workflow?`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `⚠️ *Confirm Stop Request*\n\n` +
                `This will halt all progress. We'll try to save the current state to a git branch if possible, ` +
                `but resuming may not be fully automated.\n\n` +
                `Current work may be lost if not committed.`
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: '🛑 Yes, stop it' },
            value: 'confirm_stop',
            action_id: 'confirm_stop',
            style: 'danger'
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '↩️ No, continue' },
            value: 'cancel_stop',
            action_id: 'cancel_stop'
          }
        ]
      }
    ]
  });

  // Wait for confirmation (30 second timeout)
  try {
    const confirmation = await waitForButtonClick(confirmMsg.ts, 30000);

    if (confirmation === 'confirm_stop') {
      // Signal workflow to stop gracefully
      await workflowHandle.signal('stopRequested', {
        requestedBy: user,
        reason: 'User requested stop via Slack',
        timestamp: new Date().toISOString()
      });

      await client.chat.postMessage({
        channel,
        thread_ts: thread_ts,
        text: `🛑 Stop request confirmed. Attempting graceful shutdown...\n\n` +
              `I'll finish the current step and save progress.`
      });
    } else {
      await client.chat.postMessage({
        channel,
        thread_ts: thread_ts,
        text: `✅ Cancelled stop request. Workflow will continue.`
      });
    }
  } catch (error) {
    // Timeout
    await client.chat.postMessage({
      channel,
      thread_ts: thread_ts,
      text: `⏱️ Confirmation timeout. Stop request cancelled.`
    });
  }
}

// In workflow: Handle stop signal
@Signal()
stopRequested(data: {
  requestedBy: string;
  reason: string;
  timestamp: string;
}): void {
  shouldStop = true;
  stopReason = data.reason;
  stopRequestedBy = data.requestedBy;
  stopRequestedAt = data.timestamp;
}

// Workflow checks shouldStop flag periodically
async function monitorTasksUntilComplete(
  dependencyTree: DependencyTree,
  slackContext: SlackContext
): Promise<void> {

  while (getTotalCompletedTasks(dependencyTree) < dependencyTree.tasks.size) {
    // Check stop flag
    if (shouldStop) {
      await handleGracefulShutdown(dependencyTree, slackContext);
      throw new Error(`Workflow stopped by user: ${stopReason}`);
    }

    // ... normal monitoring logic
    await sleep('30s');
  }
}

async function handleGracefulShutdown(
  dependencyTree: DependencyTree,
  slackContext: SlackContext
): Promise<void> {

  await sendProgressUpdate({
    phase: 'Shutdown',
    status: 'in_progress',
    details: 'Gracefully stopping workflow...'
  }, slackContext);

  // 1. Signal all running task workflows to complete current step
  const inProgressTasks = Array.from(dependencyTree.tasks.values())
    .filter(t => t.status === TaskStatus.IN_PROGRESS || t.status === TaskStatus.CLAIMED);

  for (const task of inProgressTasks) {
    if (task.assignedTo) {
      try {
        const taskHandle = temporalClient.workflow.getHandle(task.assignedTo);
        await taskHandle.signal('completeCurrentStep');
      } catch (error) {
        console.error(`Failed to signal task workflow ${task.assignedTo}:`, error);
      }
    }
  }

  // 2. Wait for current steps to finish (with 5 minute timeout)
  await sleep('5m');

  // 3. Commit any uncommitted work
  const uncommittedChanges = await checkForUncommittedWork(repoPath);
  if (uncommittedChanges.length > 0) {
    const branch = `wip-${reqId}-${Date.now()}`;
    await createBranch(repoPath, branch);
    await commitChanges({
      workspaceRoot: repoPath,
      packagePath: '.',
      message: `WIP: Workflow stopped by ${stopRequestedBy}\n\n${stopReason}\n\nStopped at: ${stopRequestedAt}`,
      gitUser: {
        name: 'Dev Workflow Agent',
        email: 'dev-workflow@bernier.llc'
      }
    });

    currentBranch = branch;
  }

  // 4. Update BrainGrid tasks to PAUSED
  for (const task of inProgressTasks) {
    await braingridCli.updateTask(task.taskId, {
      status: 'PAUSED',
      note: `Workflow stopped by user at ${stopRequestedAt}`
    });
  }

  // 5. Update REQ status
  await braingridCli.updateREQStatus(reqId, 'PAUSED');

  // 6. Report final state
  const completedCount = getTotalCompletedTasks(dependencyTree);
  const totalCount = dependencyTree.tasks.size;

  await sendProgressUpdate({
    phase: 'Workflow Stopped',
    status: 'failed',
    details: `Stopped by <@${stopRequestedBy}>: ${stopReason}\n\n` +
             `Progress: ${completedCount}/${totalCount} tasks complete\n` +
             `Current branch: ${currentBranch}\n` +
             `BrainGrid REQ: ${reqId} (status: PAUSED)`
  }, slackContext);
}
```

---

## Activities & Agent Execution

### Activity Categories

```typescript
// Development Activities
const devActivities = {
  // Git operations
  createFeatureBranch: async (repoPath: string, branchName: string) => { },
  commitChanges: async (params: CommitParams) => { },
  createPullRequest: async (params: PRParams) => { },
  pushChanges: async (repoPath: string, branch: string) => { },

  // Build & Test
  runBuild: async (repoPath: string) => { },
  runUnitTests: async (repoPath: string) => { },
  runIntegrationTests: async (repoPath: string) => { },
  runE2ETests: async (repoPath: string, baseUrl: string) => { },
  checkTestCoverage: async (repoPath: string) => { },

  // Code analysis
  analyzeCodeImpact: async (files: string[]) => { },
  detectBreakingChanges: async (diff: string) => { },
};

// Testing Activities
const testActivities = {
  runSecurityScan: async (repoPath: string) => { },
  runAccessibilityTests: async (baseUrl: string) => { },
  runPerformanceTests: async (baseUrl: string) => { },
  runRegressionTests: async (repoPath: string) => { },
};

// Deployment Activities
const deploymentActivities = {
  backupDatabase: async (env: 'staging' | 'production') => { },
  restoreDatabase: async (env: string, backupId: string) => { },
  runMigrations: async (env: string, direction: 'up' | 'down') => { },
  deployToVercel: async (params: DeployParams) => { },
  healthCheck: async (url: string, duration: string) => { },
  runUATTests: async (env: string) => { },
  getPreviousDeploymentSha: async (env: string) => { },
};

// BrainGrid Activities
const braingridActivities = {
  createBrainGridREQ: async (requirement: Requirement) => { },
  updateREQStatus: async (reqId: string, status: string) => { },
  createBrainGridTasks: async (reqId: string, tasks: TaskInput[]) => { },
  claimTaskFromBrainGrid: async (taskId: string, workerId: string, planningWorkflowId: string) => { },
  updateTaskProgress: async (taskId: string, progress: number, message: string) => { },
  completeTask: async (taskId: string, result: any) => { },
  pollForTask: async (params: PollParams) => { },
  getBrainGridREQMetadata: async (reqId: string, key: string) => { },
};

// Slack Activities
const slackActivities = {
  sendSlackMessage: async (params: SlackMessageParams) => { },
  sendProgressUpdate: async (update: ProgressUpdate, slackContext: SlackContext) => { },
  waitForThreadReply: async (channel: string, threadTs: string, timeout: string) => { },
  waitForButtonClick: async (messageTs: string, timeout: number) => { },
  getThreadHistory: async (threadTs: string) => { },
  answerUserQuestion: async (params: QuestionParams) => { },
};

// Coordinator Activities (from package-builder)
const coordinatorActivities = {
  analyzeProblem: async (problem: Problem, agentRegistry: AgentRegistry) => { },
  writeDiagnosticReport: async (problem: Problem, analysis: Analysis) => { },
  loadAgentRegistry: async (path: string) => { },
  executeAgentTask: async (params: AgentExecutionParams) => { },
};
```

### CoordinatorWorkflow Pattern (Reused from package-builder)

```typescript
/**
 * CoordinatorWorkflow - AI-powered error recovery orchestration
 *
 * Reuses the proven pattern from package-builder-production:
 * 1. Analyzes problem with LLM
 * 2. Selects appropriate agent
 * 3. Delegates task execution
 * 4. Returns action to parent (RETRY, ESCALATE, RESOLVED)
 */
async function CoordinatorWorkflow(
  input: CoordinatorInput
): Promise<CoordinatorAction> {
  const { problem, agentRegistry, maxAttempts, workspaceRoot } = input;

  console.log(`[Coordinator] Analyzing ${problem.type} (attempt ${problem.context.attemptNumber}/${maxAttempts})`);

  // Step 1: Analyze problem with LLM
  const analysis = await analyzeProblem(problem, agentRegistry);

  console.log(`[Coordinator] Decision: ${analysis.decision}`);
  console.log(`[Coordinator] Reasoning: ${analysis.reasoning}`);

  // Step 2: Execute based on decision
  if (analysis.decision === 'DELEGATE' && analysis.agent && analysis.task) {
    console.log(`[Coordinator] Delegating to agent: ${analysis.agent}`);

    // Execute agent via child workflow
    const result = await executeChild(AgentExecutorWorkflow, {
      taskQueue: 'engine',
      workflowId: `agent-${analysis.agent}-${Date.now()}`,
      args: [{
        agent: analysis.agent,
        task: analysis.task,
        context: {
          packagePath: problem.context.packagePath,
          workspaceRoot
        }
      }]
    });

    if (result.success) {
      console.log(`[Coordinator] Agent succeeded, returning RETRY`);
      return {
        decision: 'RETRY',
        modifications: result.changes,
        reasoning: `Agent ${analysis.agent} made changes: ${result.changes.join(', ')}`
      };
    }

    console.log(`[Coordinator] Agent failed, escalating`);
    return {
      decision: 'ESCALATE',
      escalation: {
        reason: `Agent ${analysis.agent} could not fix the issue`,
        waitForSignal: true,
        reportPath: '/tmp/coordinator-report.json'
      },
      reasoning: analysis.reasoning
    };
  }

  if (analysis.decision === 'ESCALATE' && analysis.escalation) {
    console.log(`[Coordinator] Escalating: ${analysis.escalation.reason}`);

    await writeDiagnosticReport(problem, analysis);

    // Wait for human signal if requested
    if (analysis.escalation.waitForSignal) {
      console.log(`[Coordinator] Waiting for human signal...`);

      try {
        await condition(
          () => hasReceivedSignal('continue') || hasReceivedSignal('abort'),
          '24h'
        );

        if (hasReceivedSignal('abort')) {
          return {
            decision: 'FAIL',
            reasoning: 'Human chose to abort workflow'
          };
        }
      } catch (error) {
        return {
          decision: 'FAIL',
          reasoning: 'Escalation timeout - no human response after 24h'
        };
      }
    }
  }

  return analysis;
}
```

**Key Benefits of Coordinator Pattern:**
- Proven in package-builder (70% orchestration implemented)
- AI-powered agent selection based on problem type
- Automatic retry with modifications
- Escalation to humans when needed
- Diagnostic report generation

---

## Infrastructure Components

### Temporal Setup

```yaml
# docker-compose.yml
version: '3.8'

services:
  temporal:
    image: temporalio/auto-setup:latest
    ports:
      - "7233:7233"
    environment:
      - DB=postgresql
      - DB_PORT=5432
      - POSTGRES_USER=temporal
      - POSTGRES_PWD=temporal
      - POSTGRES_SEEDS=postgres
    depends_on:
      - postgres

  temporal-ui:
    image: temporalio/ui:latest
    ports:
      - "8080:8080"
    environment:
      - TEMPORAL_ADDRESS=temporal:7233

  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: temporal
      POSTGRES_PASSWORD: temporal
    ports:
      - "5432:5432"
    volumes:
      - temporal_postgres_data:/var/lib/postgresql/data

  # Worker pools
  dev-workflow-worker:
    build: ./packages/dev-workflow
    environment:
      - TEMPORAL_ADDRESS=temporal:7233
      - TASK_QUEUE=dev-workflow
      - WORKER_TYPE=development
      - MAX_CONCURRENT_TASKS=4
      - BRAINGRID_CLI_PATH=/usr/local/bin/braingrid
      - SLACK_BOT_TOKEN=${SLACK_BOT_TOKEN}
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_KEY=${SUPABASE_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    depends_on:
      - temporal
    deploy:
      replicas: 4  # 4 dev workers

  test-workflow-worker:
    build: ./packages/dev-workflow
    environment:
      - TEMPORAL_ADDRESS=temporal:7233
      - TASK_QUEUE=test-workflow
      - WORKER_TYPE=testing
      - MAX_CONCURRENT_TASKS=2
    depends_on:
      - temporal
    deploy:
      replicas: 2  # 2 test workers

  deploy-workflow-worker:
    build: ./packages/dev-workflow
    environment:
      - TEMPORAL_ADDRESS=temporal:7233
      - TASK_QUEUE=deploy-workflow
      - WORKER_TYPE=deployment
      - MAX_CONCURRENT_TASKS=1
      - VERCEL_TOKEN=${VERCEL_TOKEN}
    depends_on:
      - temporal
    deploy:
      replicas: 1  # ONLY 1 deploy worker

  engine-worker:
    build: ./packages/dev-workflow
    environment:
      - TEMPORAL_ADDRESS=temporal:7233
      - TASK_QUEUE=engine
      - WORKER_TYPE=agent-execution
      - MAX_CONCURRENT_TASKS=8
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - AGENT_REGISTRY_PATH=/app/agents
    depends_on:
      - temporal
    deploy:
      replicas: 2  # 2 engine workers for agent execution
    volumes:
      - ${HOME}/projects/tools/.claude/agents:/app/agents:ro

  slack-webhook-api:
    build: ./packages/slack-webhook
    ports:
      - "3001:3001"
    environment:
      - TEMPORAL_ADDRESS=temporal:7233
      - SLACK_SIGNING_SECRET=${SLACK_SIGNING_SECRET}
      - SLACK_BOT_TOKEN=${SLACK_BOT_TOKEN}
    depends_on:
      - temporal

volumes:
  temporal_postgres_data:
```

### Supabase Schema

```sql
-- Workflow dependency trees (for large projects)
CREATE TABLE workflow_dependency_trees (
  req_id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  tree JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_dependency_trees_workflow ON workflow_dependency_trees(workflow_id);

-- Task execution history
CREATE TABLE task_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id TEXT NOT NULL,
  req_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  status TEXT NOT NULL,
  claimed_at TIMESTAMP,
  completed_at TIMESTAMP,
  result JSONB,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_task_executions_task ON task_executions(task_id);
CREATE INDEX idx_task_executions_workflow ON task_executions(workflow_id);
CREATE INDEX idx_task_executions_req ON task_executions(req_id);

-- Approval history
CREATE TABLE approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id TEXT NOT NULL,
  gate TEXT NOT NULL,
  context JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'timeout')),
  requested_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  resolved_by TEXT,
  comment TEXT
);

CREATE INDEX idx_approvals_workflow ON approval_requests(workflow_id);
CREATE INDEX idx_approvals_status ON approval_requests(status);

-- Workflow state snapshots (for observability)
CREATE TABLE workflow_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id TEXT NOT NULL,
  workflow_type TEXT NOT NULL,
  state JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_snapshots_workflow ON workflow_snapshots(workflow_id);
CREATE INDEX idx_snapshots_type ON workflow_snapshots(workflow_type);

-- Deployment history
CREATE TABLE deployment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  req_id TEXT NOT NULL,
  task_id TEXT,
  environment TEXT NOT NULL CHECK (environment IN ('staging', 'production')),
  status TEXT NOT NULL CHECK (status IN ('started', 'success', 'failed', 'rolled_back')),
  deployment_url TEXT,
  backup_id TEXT,
  git_sha TEXT,
  deployed_at TIMESTAMP DEFAULT NOW(),
  deployed_by TEXT,
  rollback_reason TEXT,
  metadata JSONB
);

CREATE INDEX idx_deployments_req ON deployment_history(req_id);
CREATE INDEX idx_deployments_env ON deployment_history(environment);
CREATE INDEX idx_deployments_status ON deployment_history(status);
```

### Package Structure

```
production-agent-coordinators/
├── packages/
│   ├── dev-workflow/                    # Main dev workflow package
│   │   ├── src/
│   │   │   ├── workflows/
│   │   │   │   ├── feature-planning.workflow.ts
│   │   │   │   ├── task-breakdown.workflow.ts
│   │   │   │   ├── development-task.workflow.ts
│   │   │   │   ├── testing-task.workflow.ts
│   │   │   │   ├── deployment-task.workflow.ts
│   │   │   │   ├── coordinator.workflow.ts (from package-builder)
│   │   │   │   └── agent-executor.workflow.ts (from package-builder)
│   │   │   ├── activities/
│   │   │   │   ├── braingrid.activities.ts
│   │   │   │   ├── development.activities.ts
│   │   │   │   ├── testing.activities.ts
│   │   │   │   ├── deployment.activities.ts
│   │   │   │   ├── slack.activities.ts
│   │   │   │   ├── conversation.activities.ts
│   │   │   │   ├── coordinator.activities.ts (from package-builder)
│   │   │   │   └── agent-execution.activities.ts
│   │   │   ├── types/
│   │   │   │   ├── dependency-tree.types.ts
│   │   │   │   ├── task.types.ts
│   │   │   │   ├── slack.types.ts
│   │   │   │   └── coordinator.types.ts (from package-builder)
│   │   │   ├── workers/
│   │   │   │   ├── dev-worker.ts
│   │   │   │   ├── test-worker.ts
│   │   │   │   ├── deploy-worker.ts
│   │   │   │   └── engine-worker.ts
│   │   │   └── index.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── braingrid-cli-wrapper/          # Build from existing plan
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── cli.ts
│   │   │   ├── models.ts
│   │   │   └── commands/
│   │   │       ├── createIdea.ts
│   │   │       ├── listProjects.ts
│   │   │       ├── createTask.ts
│   │   │       └── updateTaskStatus.ts
│   │   └── package.json
│   │
│   ├── slack-webhook/                   # Slack approval webhook
│   │   ├── src/
│   │   │   ├── server.ts
│   │   │   ├── handlers/
│   │   │   │   ├── slash-command.handler.ts
│   │   │   │   ├── approval.handler.ts
│   │   │   │   ├── thread-reply.handler.ts
│   │   │   │   └── stop-request.handler.ts
│   │   │   └── temporal-client.ts
│   │   └── package.json
│   │
│   └── agents/
│       └── package-builder-production/  # Existing, reuse patterns
│
├── docs/
│   └── plans/
│       └── 2025-11-21-dev-workflow-temporal-architecture.md (this file)
│
├── docker-compose.yml
└── README.md
```

---

## End-to-End Flow Example

**Scenario:** "Add OAuth2 authentication to workflow-builder"

### Timeline: ~14 hours (mostly automated)

```
T+0:00 - User initiates via Slack
─────────────────────────────────────────────────────────────
User: /braingrid request: Add OAuth2 authentication to workflow-builder

Bot: 🤖 Starting feature planning for: "Add OAuth2 authentication..."
     Let me understand your requirements better.

     What OAuth2 providers do you want to support?
     [Google] [GitHub] [Both] [Other]

User: Both

Bot: Great! For Google and GitHub auth:
     • Should users be able to sign in with either provider?
     • Or should they link both to a single account?

User: Users can sign in with either provider

Bot: Perfect. A few more questions:
     • Should we migrate existing users to OAuth?
     • Or is this only for new users?

User: Only new users for now

Bot: Understood. Last question:
     • Do you need role-based access control?
     • Or simple authenticated/unauthenticated?

User: Simple authenticated for now

Bot: 📋 Here's what I understand:

     **Feature:** OAuth2 Authentication (Google + GitHub)

     **Requirements:**
     - Support Google and GitHub OAuth2
     - Users can sign in with either provider
     - New users only (existing users keep current auth)
     - Simple authenticated/unauthenticated (no RBAC yet)

     **Acceptance Criteria:**
     - User can sign in with Google
     - User can sign in with GitHub
     - User session persists across page reloads
     - Existing users unaffected

     **Technical Constraints:**
     - Next.js app with tRPC
     - Supabase database
     - Existing session management

     **Estimated Complexity:** Medium (2-3 days)

     Shall I proceed with this?
     [✅ Yes, proceed] [✏️ Revise] [❌ Cancel]

User: [clicks ✅ Yes, proceed]

Bot: Great! I'll get started on this right away. I'll keep you posted
     on progress in this thread. 🚀

─────────────────────────────────────────────────────────────
T+0:15 - Planning Complete
─────────────────────────────────────────────────────────────
Bot: ✅ **Requirement Planning** - completed
     Created REQ-789 in BrainGrid

Bot: ▶️ **Task Breakdown** - started
     AI analyzing requirement and creating task breakdown

Bot: ✅ **Task Breakdown** - completed
     Created 12 tasks across 5 dependency layers

Bot: ✅ **Task Distribution** - completed
     4 tasks ready to start immediately

─────────────────────────────────────────────────────────────
T+0:16 - Development Starts (4 workers in parallel)
─────────────────────────────────────────────────────────────
Bot: ▶️ **Development & Testing** - started
     Task execution workflows are now picking up work

# Layer 0 tasks start (no dependencies)
# - Task-1: Setup OAuth config (backend)
# - Task-2: Install NextAuth.js package
# - Task-3: Create OAuth provider configs (Google)
# - Task-4: Create OAuth provider configs (GitHub)

─────────────────────────────────────────────────────────────
T+1:30 - Layer 0 Complete
─────────────────────────────────────────────────────────────
Bot: ⏳ **Development & Testing** - in_progress
     Layer 0 complete! 4 new tasks now available

     Progress: 4/12 tasks complete

# Layer 1 tasks start (depend on Layer 0)
# - Task-5: Build login UI component (frontend)
# - Task-6: Implement auth callback routes (backend)
# - Task-7: Add session management (backend)

─────────────────────────────────────────────────────────────
T+3:00 - User asks question
─────────────────────────────────────────────────────────────
User: How much longer until this is ready?

Bot: Based on current progress, we're about 60% complete. We have:
     - ✅ 7/12 tasks complete
     - 🔨 3 tasks in progress (UI components, session management)
     - ⏳ 2 tasks waiting (tests, deployment)

     Estimated completion: ~2-3 hours for development and testing,
     then 30 minutes for staging deployment. I'll notify you when
     it's ready for staging review!

─────────────────────────────────────────────────────────────
T+4:00 - Layer 1 & 2 Complete, Tests Running
─────────────────────────────────────────────────────────────
Bot: ⏳ **Development & Testing** - in_progress
     Development tasks complete! Running test suite

     Progress: 9/12 tasks complete

# Layer 3 tasks start (tests)
# - Task-10: Integration tests for auth flow
# - Task-11: E2E tests for login/logout

─────────────────────────────────────────────────────────────
T+5:00 - Tests Complete
─────────────────────────────────────────────────────────────
Bot: ⏳ **Development & Testing** - in_progress
     All tests passed! ✅

     Progress: 11/12 tasks complete
     Current: Preparing staging deployment

─────────────────────────────────────────────────────────────
T+5:30 - Staging Deployment
─────────────────────────────────────────────────────────────
Bot: 🚀 Successfully deployed to staging!
     URL: https://staging.workflow-builder.com

     Please test the OAuth2 login flow:
     1. Click "Sign in with Google"
     2. Click "Sign in with GitHub"
     3. Verify session persists after refresh

     When ready for production, just let me know!

─────────────────────────────────────────────────────────────
T+9:30 - User approves for production (after testing)
─────────────────────────────────────────────────────────────
User: Staging looks great! Let's deploy to production

Bot: 🚨 PRODUCTION DEPLOYMENT APPROVAL NEEDED

     Feature: Add OAuth2 Authentication (REQ-789)
     Staging: ✅ All tests passed
     UAT: ✅ Validated manually
     Rollback: ✅ Ready

     Impact: All users (100%)
     Downtime: Zero

     [✅ Approve] [❌ Reject] [💬 Comment]

User: [clicks ✅ Approve]

─────────────────────────────────────────────────────────────
T+10:00 - Production Deployment
─────────────────────────────────────────────────────────────
Bot: ▶️ Production deployment started
     Creating backup...

Bot: ⏳ Running database migrations...

Bot: ⏳ Deploying to Vercel...

Bot: ⏳ Monitoring deployment health (10 minutes)...

Bot: ⏳ Running production UAT tests...

─────────────────────────────────────────────────────────────
T+10:30 - Production Complete
─────────────────────────────────────────────────────────────
Bot: 🎉 Production deployment complete!
     URL: https://workflow-builder.com

     All health checks passed ✅
     All UAT tests passed ✅

Bot: ✅ **Feature Complete** - completed
     All 12 tasks completed successfully!

     REQ-789: Add OAuth2 Authentication
     Duration: 10.5 hours
     Status: ✅ LIVE IN PRODUCTION
```

**Key Observations:**
- **2 hours**: Human conversation + approval time
- **8.5 hours**: Automated execution (dev + test + deploy)
- **4 human interactions**: Initial request, question, staging approval, prod approval
- **Zero manual coding**: All code generated by AI agents
- **Continuous visibility**: Progress updates throughout

---

## Implementation Plan

### Phase 1: Foundation (Week 1-2)

**Goal:** Get basic infrastructure running

**Tasks:**
1. Build BrainGrid CLI wrapper package (from existing plan)
   - Implement core commands: createIdea, createTask, updateTask, listTasks
   - Add zod schemas for validation
   - Write unit tests

2. Set up Temporal infrastructure
   - Docker compose with Temporal server
   - Basic worker setup
   - Test with simple workflow

3. Implement FeaturePlanningWorkflow (minimal)
   - Basic requirement gathering (no Slack yet)
   - Manual task creation
   - Simple dependency tree builder

4. Implement DevelopmentTaskWorkflow (polling only)
   - Poll BrainGrid for tasks
   - Claim task logic
   - No execution yet (just logging)

**Success Criteria:**
- BrainGrid CLI wrapper published to npm
- Temporal running locally
- Can create REQ in BrainGrid
- Can poll for tasks from BrainGrid

### Phase 2: Slack Integration (Week 3-4)

**Goal:** Interactive requirement gathering via Slack

**Tasks:**
1. Build slack-webhook package
   - Slash command handler
   - Thread reply handler
   - Button interaction handler

2. Implement conversational flow
   - analyzeConversationForNextQuestion activity
   - waitForThreadReply activity
   - Requirement approval pattern

3. Progress updates
   - sendProgressUpdate activity
   - Heartbeat timer
   - Phase boundary updates

4. Stop command
   - Confirmation flow
   - Graceful shutdown logic
   - State preservation

**Success Criteria:**
- User can start workflow via `/braingrid request`
- Bot asks questions and gathers requirements
- User can approve/reject requirements
- Progress updates appear in thread
- User can stop workflow safely

### Phase 3: Agent Execution (Week 5-6)

**Goal:** Actually generate and modify code

**Tasks:**
1. Port CoordinatorWorkflow from package-builder
   - Copy coordinator.workflow.ts
   - Copy coordinator.activities.ts
   - Adapt for dev-workflow use case

2. Implement real agent execution
   - Build executeAgentTask activity (not simulated!)
   - Use Claude API to generate code
   - Parse file operations from responses
   - Write files to disk

3. Development task execution
   - Git branch creation
   - Code generation with retries
   - Build and test verification
   - PR creation

**Success Criteria:**
- Agent actually generates code (not simulated)
- Build/test passes on generated code
- PR created with changes
- Coordinator retries on failures

### Phase 4: Testing Workflows (Week 7-8)

**Goal:** Automated test execution and validation

**Tasks:**
1. Implement TestingTaskWorkflow
   - Poll for [TEST] tasks
   - Run test suites in parallel
   - Handle test failures with coordinator

2. Test activities
   - runUnitTests, runIntegrationTests, runE2ETests
   - runSecurityScan, runAccessibilityTests
   - Test result parsing and reporting

3. Test failure recovery
   - Coordinator fixes for test failures
   - Re-run after fixes
   - Escalation if can't fix

**Success Criteria:**
- Tests run automatically after dev complete
- Test failures trigger fixes
- All tests must pass before proceeding

### Phase 5: Deployment Workflows (Week 9-10)

**Goal:** Safe deployment to staging and production

**Tasks:**
1. Implement DeploymentTaskWorkflow
   - Database backup/restore
   - Migration execution
   - Vercel deployment
   - Health monitoring
   - UAT validation
   - Rollback on failure

2. Production approval gate
   - Slack approval for production
   - Evidence presentation
   - Timeout handling

3. Deployment activities
   - All deployment-related activities
   - Integration with Vercel API
   - Database backup scripts

**Success Criteria:**
- Can deploy to staging automatically
- Production requires human approval
- Rollback works on failure
- Zero-downtime deployments

### Phase 6: Polish & Optimization (Week 11-12)

**Goal:** Production-ready system

**Tasks:**
1. Monitoring and observability
   - Workflow metrics to Supabase
   - Deployment history tracking
   - Error reporting and alerts

2. Performance optimization
   - Worker pool tuning
   - Activity timeout optimization
   - Dependency tree caching

3. Documentation
   - User guide for Slack commands
   - Developer guide for adding agents
   - Runbook for operations

4. End-to-end testing
   - Test complete flow with real feature
   - Load testing with multiple concurrent features
   - Failure scenario testing

**Success Criteria:**
- Complete feature deployed end-to-end
- System handles 5+ concurrent features
- All failure scenarios tested
- Documentation complete

---

## Success Criteria

### MVP (Phase 1-3)

**Functional:**
- [ ] User can start workflow via Slack
- [ ] Bot gathers requirements through conversation
- [ ] Creates REQ and tasks in BrainGrid
- [ ] Development workflows claim and execute tasks
- [ ] Code is actually generated (not simulated)
- [ ] Changes are committed and PRs created
- [ ] Progress updates posted to Slack thread

**Quality:**
- [ ] BrainGrid CLI wrapper has 80%+ test coverage
- [ ] Workflows have basic error handling
- [ ] Can recover from task worker failures
- [ ] Coordinator pattern works for retries

### Production (Phase 4-6)

**Functional:**
- [ ] Complete end-to-end flow from request to production
- [ ] Automated testing (unit, integration, E2E, security)
- [ ] Staging deployment with validation
- [ ] Production deployment with human approval
- [ ] Rollback capability on failures
- [ ] User can ask questions during execution
- [ ] User can stop workflow safely

**Quality:**
- [ ] 95%+ test coverage on critical paths
- [ ] Zero-downtime deployments
- [ ] < 5 minute rollback time
- [ ] Handles 10+ concurrent features
- [ ] All agents tested in production

**Observability:**
- [ ] Workflow metrics in Supabase
- [ ] Deployment history tracked
- [ ] Error alerts to Slack
- [ ] Temporal UI shows all workflows

**Documentation:**
- [ ] User guide complete
- [ ] Developer guide complete
- [ ] Runbook complete
- [ ] Architecture docs (this file) up to date

---

## Risks & Mitigations

### Risk 1: BrainGrid CLI limitations

**Impact:** High - entire system depends on it
**Mitigation:**
- Build robust CLI wrapper with retries
- Cache BrainGrid data in Supabase as backup
- Implement polling backoff on API errors
- Have manual override path for critical operations

### Risk 2: Agent execution quality

**Impact:** High - bad code breaks everything
**Mitigation:**
- Always run build/test after code generation
- Coordinator retry loop (up to 3 attempts)
- Escalate to human when can't fix
- Reality checker pattern for validation

### Risk 3: Dependency tree complexity

**Impact:** Medium - large features may have complex dependencies
**Mitigation:**
- Use Supabase for trees > 50 tasks
- Topological sort for layer calculation
- Visual representation in Slack for approval
- Human can override dependencies if needed

### Risk 4: Deployment rollback failures

**Impact:** Critical - could leave production broken
**Mitigation:**
- ALWAYS create backup before deployment
- Test rollback on staging first
- Human escalation if rollback fails
- Keep previous deployment SHA in metadata

### Risk 5: Temporal worker failures

**Impact:** Medium - tasks may be missed
**Mitigation:**
- Workers auto-restart on failure
- BrainGrid tasks remain unclaimed (can be picked up)
- Heartbeat timeout alerts
- Multiple workers for redundancy

---

## Future Enhancements

### Post-MVP Features

1. **Multi-Repo Support**
   - Currently targets single repo
   - Add support for changes across multiple repos
   - Coordinate PRs and deployments

2. **Advanced Dependency Management**
   - Cross-REQ dependencies
   - Shared resource locking
   - Parallel execution optimization

3. **Custom Agent Registry**
   - UI for managing agents
   - Agent versioning
   - Agent performance metrics

4. **Approval Workflows**
   - Custom approval chains (PM → Eng → Security)
   - Conditional approvals based on risk
   - Automated approvals for low-risk changes

5. **Rollout Strategies**
   - Canary deployments
   - Blue-green deployments
   - Feature flags integration

6. **Analytics Dashboard**
   - Feature delivery metrics
   - Agent performance analytics
   - Deployment success rates
   - Time to production charts

---

## Appendix A: Key Differences from Package Builder

| Aspect | Package Builder | Dev Workflow |
|--------|----------------|--------------|
| **Use Case** | Building npm packages | Feature development in existing repos |
| **Orchestration** | Single parent workflow → child per package | Planning workflow → task pool workers |
| **Task Source** | Plan files in repo | BrainGrid (external queue) |
| **Dependencies** | Internal package deps | Arbitrary task dependencies |
| **Parallelism** | 4 concurrent packages | 4 dev + 2 test + 1 deploy workers |
| **Human Interaction** | None (fully automated) | Slack conversation + approval gates |
| **Deployment** | npm publish | Vercel staging + production |
| **Monitoring** | Build reports | Slack updates + Supabase metrics |

---

## Appendix B: BrainGrid CLI Commands Used

```bash
# Create REQ
braingrid specify "Add OAuth2 authentication" --project workflow-builder

# Create task
braingrid task create REQ-789 \
  --title "Build login UI component" \
  --tags "DEV,frontend" \
  --dependencies "TASK-456,TASK-457"

# Update task status
braingrid task update TASK-789 --status IN_PROGRESS

# List tasks
braingrid task list --req REQ-789 --status TODO,READY

# Query tasks by tag
braingrid task list --tags DEV --status READY
```

---

**End of Design Document**

This architecture provides a complete, production-ready system for autonomous feature development with human oversight at critical gates. The decoupled design with BrainGrid as the task queue enables independent scaling of planning and execution, while Temporal provides the reliability and durability needed for long-running workflows.
