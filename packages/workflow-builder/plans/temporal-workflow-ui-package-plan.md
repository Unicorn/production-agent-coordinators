---
status: planned
priority: high
package: @bernierllc/temporal-workflow-ui
version: 1.0.0
created: 2025-11-16
---

# @bernierllc/temporal-workflow-ui

**Thin domain-specific wrapper around @bernierllc/generic-workflow-ui for Temporal workflows**

---

## 🎯 Package Purpose

A React UI package that provides Temporal-specific workflow components by wrapping and extending `@bernierllc/generic-workflow-ui`. This package adapts generic workflow concepts to Temporal's specific terminology and provides pre-configured components for building Temporal workflow UIs.

**Design Philosophy:** Thin wrapper that:
- Maps Temporal concepts to generic workflow concepts
- Provides type-safe Temporal-specific interfaces
- Offers convenience components with sensible Temporal defaults
- Maintains full access to underlying generic components

---

## 📦 Dependencies

### External Dependencies
```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@bernierllc/generic-workflow-ui": "^1.0.3",
    "tamagui": "^1.135.1",
    "@tamagui/config": "^1.135.1",
    "date-fns": "^3.6.0",
    "clsx": "^2.1.1"
  },
  "peerDependencies": {
    "react": "^18.3.0 || ^19.0.0",
    "react-dom": "^18.3.0 || ^19.0.0"
  }
}
```

### BernierLLC Dependencies
- **@bernierllc/generic-workflow-ui** (^1.0.3) - Core generic workflow components

---

## 🏗️ Core Architecture

### Type Mapping Strategy

```typescript
// Temporal concepts → Generic workflow concepts
Temporal Activity        → GenericStage (type: 'activity')
Temporal Agent           → GenericStage (type: 'agent')
Temporal Signal          → GenericStage (type: 'signal')
Temporal Query           → GenericStage (type: 'query')
Temporal Trigger         → GenericStage (type: 'trigger')
Temporal Child WF        → GenericStage (type: 'child-workflow')
Temporal Cron Child WF   → GenericStage (type: 'scheduled-workflow')
Temporal Work Queue      → Workflow Metadata (work_queues[])
Temporal Transition      → GenericTransition
Task Queue               → Stage/Transition Metadata
Retry Policy             → Stage Metadata
Timeout Config           → Stage Metadata
```

**User-Friendly Terminology:**
```typescript
// Domain-agnostic names for UI (non-Temporal users)
'activity'            → "Task" or "Action"
'agent'               → "AI Assistant" or "Decision Maker"
'signal'              → "Event" or "Message"
'query'               → "Status Check" or "Data Request"
'trigger'             → "Start Point" or "Initiator"
'child-workflow'      → "Sub-Workflow" or "Nested Process"
'scheduled-workflow'  → "Recurring Task" or "Scheduled Job"
'work-queue'          → "Work Backlog" or "Pending Tasks"
```

---

## 📋 Type Definitions

### Core Temporal Types

```typescript
/**
 * Temporal Node Types
 */
export type TemporalNodeType = 
  | 'activity'
  | 'agent'
  | 'signal'
  | 'query'
  | 'trigger'
  | 'child-workflow'
  | 'scheduled-workflow'  // Cron child workflow
  | 'parallel'
  | 'condition'
  | 'work-queue';  // Work queue declaration

/**
 * Temporal Retry Policy
 */
export interface TemporalRetryPolicy {
  maximumAttempts: number;
  backoffCoefficient?: number;
  initialInterval?: number;
  maximumInterval?: number;
  nonRetryableErrorTypes?: string[];
}

/**
 * Temporal Timeout Configuration
 */
export interface TemporalTimeout {
  scheduleToCloseTimeout?: number;
  scheduleToStartTimeout?: number;
  startToCloseTimeout?: number;
}

/**
 * Task Queue Configuration
 */
export interface TaskQueue {
  id: string;
  name: string;
  description?: string;
  workerCount?: number;
  isDefault?: boolean;
}

/**
 * Temporal Activity Metadata
 */
export interface TemporalActivityMetadata {
  nodeType: 'activity';
  activityName: string;
  taskQueue: string | TaskQueue;
  retryPolicy?: TemporalRetryPolicy;
  timeout?: TemporalTimeout;
  parameters?: Record<string, any>;
  heartbeatTimeout?: number;
  localActivity?: boolean;
}

/**
 * Temporal Agent Metadata
 */
export interface TemporalAgentMetadata {
  nodeType: 'agent';
  agentPromptId: string;
  agentName: string;
  taskQueue: string | TaskQueue;
  modelProvider?: string;
  modelName?: string;
  temperature?: number;
  maxTokens?: number;
  retryPolicy?: TemporalRetryPolicy;
  timeout?: TemporalTimeout;
}

/**
 * Temporal Signal Metadata
 */
export interface TemporalSignalMetadata {
  nodeType: 'signal';
  signalName: string;
  signalType?: 'send' | 'receive';
  targetWorkflowId?: string;
  timeout?: number;
}

/**
 * Temporal Trigger Metadata
 */
export interface TemporalTriggerMetadata {
  nodeType: 'trigger';
  triggerType: 'manual' | 'schedule' | 'signal' | 'api';
  scheduleSpec?: string;  // Cron expression
  parameters?: Record<string, any>;
}

/**
 * Temporal Query Metadata
 * (Non-Temporal name: "Status Check" or "Data Request")
 */
export interface TemporalQueryMetadata {
  nodeType: 'query';
  queryName: string;
  queryType?: 'send' | 'receive';  // send = query another workflow, receive = handle query from another
  targetWorkflowId?: string;  // For sending queries
  responseSchema?: Record<string, any>;  // Expected response shape
  timeout?: number;
}

/**
 * Temporal Scheduled Workflow Metadata (Cron Child Workflow)
 * (Non-Temporal name: "Recurring Task" or "Scheduled Job")
 * 
 * A child workflow that runs on a schedule and can signal back to parent
 */
export interface TemporalScheduledWorkflowMetadata {
  nodeType: 'scheduled-workflow';
  workflowName: string;
  scheduleSpec: string;  // Cron expression (e.g., "*/30 * * * *" for every 30 min)
  taskQueue: string | TaskQueue;
  parameters?: Record<string, any>;
  retryPolicy?: TemporalRetryPolicy;
  timeout?: TemporalTimeout;
  
  // Signal configuration - when scheduled workflow finds work to do
  signalToParent?: {
    signalName: string;  // Signal to send to parent workflow
    autoCreate?: boolean;  // Auto-create signal handler on parent
    queueName?: string;  // Which work queue to add to on parent
  };
  
  // Query configuration - scheduled workflow can query parent for work
  queryParent?: {
    queryName: string;  // Query to send to parent
    queueName?: string;  // Which work queue to check on parent
  };
  
  // Lifecycle
  startImmediately?: boolean;  // Start on parent workflow start
  endWithParent?: boolean;  // Terminate when parent completes
  maxRuns?: number;  // Max number of scheduled runs (undefined = infinite)
}

/**
 * Temporal Child Workflow Metadata
 * (Non-Temporal name: "Sub-Workflow" or "Nested Process")
 * 
 * Extended to support signaling back to parent and querying parent state
 */
export interface TemporalChildWorkflowMetadata {
  nodeType: 'child-workflow';
  workflowName: string;
  taskQueue: string | TaskQueue;
  parameters?: Record<string, any>;
  retryPolicy?: TemporalRetryPolicy;
  timeout?: TemporalTimeout;
  parentClosePolicy?: 'abandon' | 'request_cancel' | 'terminate';
  
  // Signal configuration - child can signal parent with results or requests
  signalToParent?: {
    signalName: string;
    autoCreate?: boolean;  // Auto-create signal handler on parent
    queueName?: string;  // Which work queue to add to on parent
  };
  
  // Query configuration - child can query parent for work or state
  queryParent?: {
    queryName: string;
    queueName?: string;  // Which work queue to check on parent
  };
  
  // Dependency blocking - wait for other work to complete
  blockUntil?: {
    workQueueName: string;  // Wait until this queue is empty
    workItemIds?: string[];  // Or wait for specific work items
  };
}

/**
 * Temporal Work Queue Metadata
 * (Non-Temporal name: "Work Backlog" or "Pending Tasks")
 * 
 * Represents a queue of work items on the coordinator workflow
 * that child workflows can add to (via signal) or query
 */
export interface TemporalWorkQueueMetadata {
  nodeType: 'work-queue';
  queueName: string;
  description?: string;
  
  // Signal handler - automatically created for adding work
  signalHandler: {
    signalName: string;  // e.g., "addToQueue"
    autoGenerate?: boolean;  // Auto-generate handler code
  };
  
  // Query handler - automatically created for checking work
  queryHandler: {
    queryName: string;  // e.g., "getQueueStatus"
    autoGenerate?: boolean;  // Auto-generate handler code
  };
  
  // Queue behavior
  maxSize?: number;  // Max queue size (undefined = unlimited)
  priority?: 'fifo' | 'lifo' | 'priority';  // Queue ordering
  deduplicate?: boolean;  // Prevent duplicate work items
  
  // Work item schema
  workItemSchema?: Record<string, any>;  // Shape of items in queue
}

/**
 * Union of all Temporal metadata types
 */
export type TemporalNodeMetadata = 
  | TemporalActivityMetadata
  | TemporalAgentMetadata
  | TemporalSignalMetadata
  | TemporalQueryMetadata
  | TemporalTriggerMetadata
  | TemporalScheduledWorkflowMetadata
  | TemporalChildWorkflowMetadata
  | TemporalWorkQueueMetadata;

/**
 * Temporal Workflow Stage (wraps GenericStage)
 */
export interface TemporalWorkflowStage extends Omit<GenericStage, 'metadata'> {
  type: TemporalNodeType;
  metadata: TemporalNodeMetadata;
  icon?: string;
  color?: string;
}

/**
 * Temporal Workflow Transition (wraps GenericTransition)
 */
export interface TemporalWorkflowTransition extends Omit<GenericTransition, 'metadata'> {
  condition?: string;  // JavaScript expression
  metadata?: {
    label?: string;
    errorHandler?: boolean;
    timeout?: number;
  };
}

/**
 * Temporal Workflow Definition (wraps GenericWorkflow)
 */
export interface TemporalWorkflow extends Omit<GenericWorkflow, 'stages' | 'transitions'> {
  stages: TemporalWorkflowStage[];
  transitions: TemporalWorkflowTransition[];
  defaultTaskQueue?: string | TaskQueue;
  workflowTimeout?: number;
  searchAttributes?: Record<string, any>;
  
  // Work queues - queues on the main workflow that children can interact with
  workQueues?: Array<{
    id: string;
    name: string;
    signalName: string;  // Signal name for adding work
    queryName: string;  // Query name for checking work
    maxSize?: number;
    priority?: 'fifo' | 'lifo' | 'priority';
  }>;
  
  // Signals - automatically generated signal handlers
  signals?: Array<{
    id: string;
    name: string;
    parameters?: Record<string, any>;
    autoGenerated?: boolean;  // Generated from work queue or scheduled workflow
  }>;
  
  // Queries - automatically generated query handlers
  queries?: Array<{
    id: string;
    name: string;
    returnType?: Record<string, any>;
    autoGenerated?: boolean;  // Generated from work queue
  }>;
}

/**
 * Component Palette Item for Temporal
 */
export interface TemporalComponentPaletteItem {
  id: string;
  name: string;
  displayName: string;
  type: TemporalNodeType;
  icon?: string;
  description?: string;
  capabilities?: string[];
  defaultMetadata: Partial<TemporalNodeMetadata>;
}

/**
 * Temporal Workflow Execution Status
 */
export interface TemporalWorkflowExecution {
  workflowId: string;
  runId: string;
  workflowType: string;
  currentStageId?: string;
  status: 'running' | 'completed' | 'failed' | 'canceled' | 'terminated' | 'timed_out';
  startTime: Date;
  endTime?: Date;
  error?: {
    message: string;
    type: string;
    stackTrace?: string;
  };
  stageStatuses: Record<string, {
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    startTime?: Date;
    endTime?: Date;
    attempts?: number;
    error?: string;
  }>;
}
```

---

## 🏗️ Advanced Workflow Patterns

### Overview

The workflow builder supports advanced patterns that enable dynamic, self-discovering, and hierarchical workflows. These patterns allow child workflows to communicate with parent workflows, schedule recurring tasks, manage work queues, and create dependency chains.

### Pattern 1: Scheduled Child Workflow (Cron Pattern)

**Use Case:** A child workflow that runs on a schedule to discover or generate work for the parent workflow.

**Example:** Plan Writer Coordinator - A cron workflow checks every 30 minutes for plans that need writing, then signals the parent coordinator to queue them.

```
┌─────────────────────────────────────────────────────────────┐
│                  Parent Coordinator Workflow                 │
│                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐             │
│  │ Trigger  │───▶│ Activity │───▶│ Complete │             │
│  └──────────┘    └──────────┘    └──────────┘             │
│                         ▲                                    │
│                         │ Signal: "addPlanToQueue"          │
│                         │                                    │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Work Queue: "plansToWrite"                         │    │
│  │ - Signal Handler: addPlanToQueue(planId)           │    │
│  │ - Query Handler: getPlansToWrite()                 │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Scheduled Child Workflow (Cron: */30 * * * *)     │◀───┐│
│  │                                                     │    ││
│  │  ┌──────────────┐    ┌─────────────┐             │    ││
│  │  │ Check for    │───▶│ If plans    │─────────────┼────┘│
│  │  │ plans needing│    │ found,      │ Signal       │     │
│  │  │ writing      │    │ signal      │ parent       │     │
│  │  └──────────────┘    │ parent      │              │     │
│  │                      └─────────────┘              │     │
│  │                                                     │     │
│  │  Runs every 30 minutes, "hangs off the side"      │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Configuration:**
```typescript
const cronWorkflow: TemporalScheduledWorkflowMetadata = {
  nodeType: 'scheduled-workflow',
  workflowName: 'checkForPlansWorkflow',
  scheduleSpec: '*/30 * * * *',  // Every 30 minutes
  taskQueue: 'cron-queue',
  signalToParent: {
    signalName: 'addPlanToQueue',
    autoCreate: true,  // Auto-create signal handler on parent
    queueName: 'plansToWrite',  // Add to this work queue
  },
  startImmediately: true,
  endWithParent: true,
};
```

**UI Representation:**
- Scheduled workflows appear as "side-attached" nodes
- Visual indicator shows cron schedule (e.g., "⏰ Every 30 min")
- Dashed line connects to parent's work queue
- Auto-generates signal handler on parent

---

### Pattern 2: Child Workflow with Parent Query

**Use Case:** A child workflow queries the parent for available work before starting.

**Example:** A processing child workflow checks the parent's work queue to see if there's work to do.

```
┌─────────────────────────────────────────────────────────────┐
│                  Parent Coordinator Workflow                 │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Work Queue: "tasksToProcess"                       │    │
│  │ - Signal Handler: addTask(task)                    │    │
│  │ - Query Handler: getNextTask()  ◀─────────────┐    │    │
│  └────────────────────────────────────────────────────┘    │
│                                                       │     │
│  ┌───────────────────────────────────────────────────┼────┐│
│  │ Child Workflow: "taskProcessor"                   │    ││
│  │                                                    │    ││
│  │  ┌──────────────┐    ┌─────────────┐            │    ││
│  │  │ Query parent │───▶│ If task     │            │    ││
│  │  │ for next     │    │ available,  │            │    ││
│  │  │ task         │────┘ process it  │            │    ││
│  │  └──────────────┘    └─────────────┘            │    ││
│  │         ▲                                         │    ││
│  │         └─────────────────────────────────────────┼────┘│
│  │                      Query                        │     │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Configuration:**
```typescript
const childWorkflow: TemporalChildWorkflowMetadata = {
  nodeType: 'child-workflow',
  workflowName: 'taskProcessorWorkflow',
  taskQueue: 'worker-queue',
  queryParent: {
    queryName: 'getNextTask',
    queueName: 'tasksToProcess',
  },
};
```

---

### Pattern 3: Child Workflow with Dependency Blocking

**Use Case:** A child workflow waits for other work to complete before starting (hierarchical dependencies).

**Example:** A "build" child workflow waits for all "test" work items to complete.

```
┌─────────────────────────────────────────────────────────────┐
│                  Parent Coordinator Workflow                 │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Work Queue: "tests"                                │    │
│  │ - Items: [test1: complete, test2: complete]       │    │
│  └────────────────────────────────────────────────────┘    │
│                         │                                    │
│                         │ Query: "areTestsComplete"          │
│                         ▼                                    │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Child Workflow: "buildWorkflow"                    │    │
│  │                                                     │    │
│  │  ┌──────────────┐    ┌─────────────┐             │    │
│  │  │ WAIT: Query  │───▶│ When tests  │             │    │
│  │  │ parent until │    │ complete,   │             │    │
│  │  │ tests queue  │    │ start build │             │    │
│  │  │ is empty     │    └─────────────┘             │    │
│  │  └──────────────┘                                 │    │
│  │                                                     │    │
│  │  blockUntil: { workQueueName: "tests" }           │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Configuration:**
```typescript
const buildWorkflow: TemporalChildWorkflowMetadata = {
  nodeType: 'child-workflow',
  workflowName: 'buildWorkflow',
  taskQueue: 'build-queue',
  blockUntil: {
    workQueueName: 'tests',  // Wait until tests queue is empty
  },
  queryParent: {
    queryName: 'getQueueStatus',
    queueName: 'tests',
  },
};
```

---

### Pattern 4: Child Workflow Discovering More Work

**Use Case:** A child workflow discovers additional work during execution and adds it back to the parent.

**Example:** A documentation generator discovers more docs to write and signals parent to queue them.

```
┌─────────────────────────────────────────────────────────────┐
│                  Parent Coordinator Workflow                 │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Work Queue: "docsToGenerate"                       │    │
│  │ - Items: [doc1, doc2, doc3]                        │    │
│  └────────────────────────────────────────────────────┘    │
│                         ▲                                    │
│                         │ Signal: "addDocsToQueue"           │
│                         │                                    │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Child Workflow: "docGenerator"                     │    │
│  │                                                     │    │
│  │  ┌──────────────┐    ┌─────────────┐             │    │
│  │  │ Generate doc │───▶│ Discover    │─────────────┼───┐│
│  │  │              │    │ related     │ Signal       │   ││
│  │  │              │    │ docs needed │ parent       │   ││
│  │  └──────────────┘    └─────────────┘              │   ││
│  │                                                     │   ││
│  └────────────────────────────────────────────────────┘   ││
│                                                             ││
└─────────────────────────────────────────────────────────────┘│
                                                               │
                                                               └─▶ Parent queues new work
```

**Configuration:**
```typescript
const docGenWorkflow: TemporalChildWorkflowMetadata = {
  nodeType: 'child-workflow',
  workflowName: 'docGeneratorWorkflow',
  taskQueue: 'doc-queue',
  signalToParent: {
    signalName: 'addDocsToQueue',
    autoCreate: true,
    queueName: 'docsToGenerate',
  },
};
```

---

### Pattern 5: Multiple Work Queues with Priority

**Use Case:** Parent workflow has multiple work queues with different priorities.

```
┌─────────────────────────────────────────────────────────────┐
│                  Parent Coordinator Workflow                 │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Work Queue: "highPriority" (FIFO, max: 10)        │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Work Queue: "normalPriority" (FIFO, unlimited)     │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Work Queue: "background" (LIFO, dedupe: true)      │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  Main workflow processes queues in priority order           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Configuration:**
```typescript
const workflow: TemporalWorkflow = {
  // ... other fields
  workQueues: [
    {
      id: 'wq-1',
      name: 'highPriority',
      signalName: 'addHighPriorityWork',
      queryName: 'getHighPriorityWork',
      maxSize: 10,
      priority: 'fifo',
    },
    {
      id: 'wq-2',
      name: 'normalPriority',
      signalName: 'addNormalWork',
      queryName: 'getNormalWork',
      priority: 'fifo',
    },
    {
      id: 'wq-3',
      name: 'background',
      signalName: 'addBackgroundWork',
      queryName: 'getBackgroundWork',
      priority: 'lifo',
      deduplicate: true,
    },
  ],
};
```

---

### UI Design Considerations

#### 1. Visual Representation

**Scheduled Workflows:**
- Appear as "floating" nodes attached to parent workflow
- Dashed connection line to parent
- Visual indicator: ⏰ icon + cron schedule
- Color: Distinct color (e.g., purple) to differentiate from regular child workflows

**Work Queues:**
- Appear as "containers" or "buckets" on the parent workflow
- Show queue status: count, capacity, priority
- Visual connections show which nodes add/query the queue
- Color: Different color per queue based on priority

**Signals/Queries:**
- Appear as connection points on workflow boundary
- Auto-generated signals have special icon (e.g., ⚡ with "AUTO")
- Show which child workflows connect to which signals/queries
- Hovering shows signal/query parameters

#### 2. Component Palette

**Scheduled Workflow Node:**
```typescript
{
  id: 'scheduled-workflow',
  name: 'scheduledWorkflow',
  displayName: 'Recurring Task',
  type: 'scheduled-workflow',
  icon: 'Clock',
  description: 'A child workflow that runs on a schedule',
  capabilities: ['cron', 'scheduled', 'parent-signal'],
}
```

**Work Queue Node:**
```typescript
{
  id: 'work-queue',
  name: 'workQueue',
  displayName: 'Work Backlog',
  type: 'work-queue',
  icon: 'Inbox',
  description: 'A queue of work items on the coordinator',
  capabilities: ['queue', 'signal-handler', 'query-handler'],
}
```

**Query Node:**
```typescript
{
  id: 'query-handler',
  name: 'queryHandler',
  displayName: 'Status Check',
  type: 'query',
  icon: 'Search',
  description: 'Handle queries from child workflows',
  capabilities: ['query', 'read-only'],
}
```

#### 3. Property Panel Extensions

**For Scheduled Workflows:**
- Cron expression builder (with presets: hourly, daily, weekly, etc.)
- Signal configuration section
- Query configuration section
- Lifecycle settings (start immediately, end with parent, max runs)

**For Work Queues:**
- Queue name and description
- Max size slider
- Priority selector (FIFO, LIFO, Priority)
- Deduplication toggle
- Work item schema editor (JSON schema)
- Auto-generate signal/query handlers toggle

**For Child Workflows:**
- Parent communication section
  - Signal to parent dropdown (with auto-create option)
  - Query from parent dropdown
- Dependency blocking section
  - Select work queue to wait for
  - Select specific work items to wait for

#### 4. Workflow Validation

**New Validation Rules:**
- Scheduled workflows must have valid cron expression
- Work queues must have unique names
- Signal names must be unique within workflow
- Query names must be unique within workflow
- Child workflows referencing work queues must have valid queue names
- BlockUntil dependencies must not create cycles

---

### Code Generation Implications

When compiling these patterns to Temporal TypeScript:

**Work Queue Example:**
```typescript
// Auto-generated from work queue node
interface WorkflowState {
  plansToWrite: Array<{ planId: string; priority: number }>;
}

// Auto-generated signal handler
export const addPlanToQueue = wf.defineSignal<[{ planId: string; priority: number }]>('addPlanToQueue');

// Auto-generated query handler
export const getPlansToWrite = wf.defineQuery<typeof WorkflowState['plansToWrite']>('getPlansToWrite');

// In workflow function
export async function coordinatorWorkflow() {
  const state: WorkflowState = {
    plansToWrite: [],
  };

  // Set up signal handler
  wf.setHandler(addPlanToQueue, (item) => {
    state.plansToWrite.push(item);
  });

  // Set up query handler
  wf.setHandler(getPlansToWrite, () => state.plansToWrite);

  // Rest of workflow...
}
```

**Scheduled Workflow Example:**
```typescript
// Parent workflow starts cron child workflow
export async function coordinatorWorkflow() {
  // Start scheduled child workflow
  const cronWorkflow = wf.startChild('checkForPlansWorkflow', {
    taskQueue: 'cron-queue',
    workflowId: `${wf.workflowInfo().workflowId}-cron-check-plans`,
  });

  // Cron workflow will signal back when it finds plans
  // Signal handler already set up above

  // Rest of workflow...
}
```

---

## 🎨 Component API

### 1. TemporalWorkflowBuilder

**Purpose:** Visual builder for Temporal workflows with React Flow integration

```typescript
export interface TemporalWorkflowBuilderProps {
  // Core props
  workflowId?: string;
  initialWorkflow?: TemporalWorkflow;
  
  // Component palette
  availableComponents?: TemporalComponentPaletteItem[];
  
  // Task queues
  availableTaskQueues?: TaskQueue[];
  defaultTaskQueue?: string | TaskQueue;
  
  // Configuration
  config?: {
    readOnly?: boolean;
    showMiniMap?: boolean;
    showControls?: boolean;
    autoSave?: boolean;
    autoSaveInterval?: number;
    enableUndoRedo?: boolean;
    showJSONView?: boolean;
    showTypeScriptPreview?: boolean;
  };
  
  // Callbacks
  onSave?: (workflow: TemporalWorkflow) => void | Promise<void>;
  onDeploy?: (workflow: TemporalWorkflow) => void | Promise<void>;
  onValidate?: (workflow: TemporalWorkflow) => Promise<ValidationResult>;
  onNodeSelect?: (nodeId: string | null) => void;
  onNodeUpdate?: (nodeId: string, updates: Partial<TemporalWorkflowStage>) => void;
  
  // Customization
  customNodeRenderers?: Partial<Record<TemporalNodeType, NodeRenderer>>;
  propertyPanelRenderer?: (node: TemporalWorkflowStage) => React.ReactNode;
}

export const TemporalWorkflowBuilder: React.FC<TemporalWorkflowBuilderProps>;
```

**Implementation Notes:**
- Wraps `GenericWorkflowBuilder` from generic-workflow-ui
- Uses React Flow for visual editing (once generic-workflow-ui supports it)
- Provides Temporal-specific node types and metadata
- Includes built-in validation for Temporal constraints

---

### 2. TemporalWorkflowStepper

**Purpose:** Progress visualization for Temporal workflow execution

```typescript
export interface TemporalWorkflowStepperProps {
  // Core props
  workflow: TemporalWorkflow;
  currentStageId?: string;
  executionStatus?: TemporalWorkflowExecution;
  
  // Configuration
  config?: {
    orientation?: 'horizontal' | 'vertical';
    showDescriptions?: boolean;
    showIcons?: boolean;
    showTaskQueues?: boolean;
    showTimestamps?: boolean;
    showRetryInfo?: boolean;
    compact?: boolean;
  };
  
  // Callbacks
  onStageClick?: (stageId: string) => void;
}

export const TemporalWorkflowStepper: React.FC<TemporalWorkflowStepperProps>;
```

**Implementation Notes:**
- Wraps `GenericWorkflowStepper`
- Maps Temporal stages to generic stages
- Shows execution status overlay
- Displays retry attempts and timeouts

---

### 3. TemporalActivityCard

**Purpose:** Display Temporal activity details

```typescript
export interface TemporalActivityCardProps {
  activity: TemporalWorkflowStage & { metadata: TemporalActivityMetadata };
  
  // Status
  status?: 'pending' | 'running' | 'completed' | 'failed';
  executionInfo?: {
    attempts: number;
    startTime?: Date;
    endTime?: Date;
    error?: string;
  };
  
  // Configuration
  config?: {
    showTaskQueue?: boolean;
    showRetryPolicy?: boolean;
    showTimeout?: boolean;
    showParameters?: boolean;
    compact?: boolean;
  };
  
  // Actions
  onEdit?: () => void;
  onDelete?: () => void;
  onRetry?: () => void;
}

export const TemporalActivityCard: React.FC<TemporalActivityCardProps>;
```

---

### 4. TemporalAgentCard

**Purpose:** Display Temporal agent details

```typescript
export interface TemporalAgentCardProps {
  agent: TemporalWorkflowStage & { metadata: TemporalAgentMetadata };
  
  // Status
  status?: 'pending' | 'running' | 'completed' | 'failed';
  executionInfo?: {
    attempts: number;
    tokensUsed?: number;
    cost?: number;
    startTime?: Date;
    endTime?: Date;
    error?: string;
  };
  
  // Configuration
  config?: {
    showPrompt?: boolean;
    showModel?: boolean;
    showTaskQueue?: boolean;
    showTokenUsage?: boolean;
    compact?: boolean;
  };
  
  // Actions
  onEdit?: () => void;
  onDelete?: () => void;
  onViewPrompt?: () => void;
}

export const TemporalAgentCard: React.FC<TemporalAgentCardProps>;
```

---

### 5. TemporalComponentPalette

**Purpose:** Drag-and-drop component palette for workflow builder

```typescript
export interface TemporalComponentPaletteProps {
  components: TemporalComponentPaletteItem[];
  
  // Filtering
  filterByType?: TemporalNodeType[];
  filterByCapability?: string[];
  searchQuery?: string;
  
  // Configuration
  config?: {
    groupBy?: 'type' | 'capability' | 'none';
    showIcons?: boolean;
    showDescriptions?: boolean;
    compact?: boolean;
  };
  
  // Callbacks
  onComponentDrag?: (component: TemporalComponentPaletteItem) => void;
  onComponentClick?: (component: TemporalComponentPaletteItem) => void;
}

export const TemporalComponentPalette: React.FC<TemporalComponentPaletteProps>;
```

---

### 6. TemporalPropertyPanel

**Purpose:** Edit properties of selected workflow node

```typescript
export interface TemporalPropertyPanelProps {
  node: TemporalWorkflowStage;
  workflow: TemporalWorkflow;
  
  // Available options
  taskQueues?: TaskQueue[];
  agentPrompts?: Array<{ id: string; name: string }>;
  
  // Configuration
  config?: {
    sections?: ('basic' | 'temporal' | 'advanced')[];
    readOnly?: boolean;
  };
  
  // Callbacks
  onUpdate: (updates: Partial<TemporalWorkflowStage>) => void;
  onDelete?: () => void;
  
  // Custom fields
  customFields?: React.ReactNode;
}

export const TemporalPropertyPanel: React.FC<TemporalPropertyPanelProps>;
```

**Sections:**
- **Basic**: Name, description, type
- **Temporal**: Task queue, retry policy, timeouts
- **Advanced**: Parameters, custom metadata

---

### 7. TemporalTaskQueueSelector

**Purpose:** Select and display task queue

```typescript
export interface TemporalTaskQueueSelectorProps {
  taskQueues: TaskQueue[];
  selected?: string;
  
  // Configuration
  config?: {
    showWorkerCount?: boolean;
    showDescription?: boolean;
    allowCreate?: boolean;
    variant?: 'dropdown' | 'radio' | 'card';
  };
  
  // Callbacks
  onChange: (taskQueueId: string) => void;
  onCreate?: (name: string) => void;
}

export const TemporalTaskQueueSelector: React.FC<TemporalTaskQueueSelectorProps>;
```

---

### 8. TemporalRetryPolicyEditor

**Purpose:** Edit retry policy configuration

```typescript
export interface TemporalRetryPolicyEditorProps {
  retryPolicy?: TemporalRetryPolicy;
  
  // Configuration
  config?: {
    showAdvanced?: boolean;
    presets?: Array<{ name: string; policy: TemporalRetryPolicy }>;
  };
  
  // Callbacks
  onChange: (policy: TemporalRetryPolicy) => void;
}

export const TemporalRetryPolicyEditor: React.FC<TemporalRetryPolicyEditorProps>;
```

**Presets:**
- Default (3 attempts, exponential backoff)
- Aggressive (10 attempts, fast backoff)
- Conservative (3 attempts, slow backoff)
- No Retry
- Custom

---

### 9. TemporalTimeoutEditor

**Purpose:** Edit timeout configuration

```typescript
export interface TemporalTimeoutEditorProps {
  timeout?: TemporalTimeout;
  
  // Configuration
  config?: {
    showAdvanced?: boolean;
    unit?: 'ms' | 's' | 'm' | 'h';
  };
  
  // Callbacks
  onChange: (timeout: TemporalTimeout) => void;
}

export const TemporalTimeoutEditor: React.FC<TemporalTimeoutEditorProps>;
```

---

### 10. TemporalWorkflowTimeline

**Purpose:** Execution history timeline

```typescript
export interface TemporalWorkflowTimelineProps {
  execution: TemporalWorkflowExecution;
  
  // Events
  events?: Array<{
    timestamp: Date;
    type: string;
    stageId?: string;
    message: string;
    details?: any;
  }>;
  
  // Configuration
  config?: {
    showTimestamps?: boolean;
    showDetails?: boolean;
    maxEvents?: number;
    groupByStage?: boolean;
  };
  
  // Callbacks
  onEventClick?: (event: any) => void;
}

export const TemporalWorkflowTimeline: React.FC<TemporalWorkflowTimelineProps>;
```

**Implementation Notes:**
- Wraps `GenericWorkflowTimeline`
- Shows Temporal-specific events (activity started, retried, etc.)
- Displays retry information
- Shows error details

---

### 11. TemporalWorkflowExecutionPanel

**Purpose:** Complete execution monitoring panel

```typescript
export interface TemporalWorkflowExecutionPanelProps {
  execution: TemporalWorkflowExecution;
  workflow: TemporalWorkflow;
  
  // Configuration
  config?: {
    showStepper?: boolean;
    showTimeline?: boolean;
    showMetrics?: boolean;
    autoRefresh?: boolean;
    refreshInterval?: number;
  };
  
  // Actions
  onCancel?: () => void;
  onRetry?: () => void;
  onTerminate?: () => void;
}

export const TemporalWorkflowExecutionPanel: React.FC<TemporalWorkflowExecutionPanelProps>;
```

---

### 12. TemporalWorkQueueCard

**Purpose:** Display and manage a work queue on the coordinator workflow

```typescript
export interface TemporalWorkQueueCardProps {
  workQueue: {
    id: string;
    name: string;
    signalName: string;
    queryName: string;
    maxSize?: number;
    priority?: 'fifo' | 'lifo' | 'priority';
    deduplicate?: boolean;
  };
  
  // Current state
  queueStatus?: {
    count: number;
    items?: Array<{
      id: string;
      data: any;
      addedAt: Date;
      status: 'pending' | 'processing' | 'completed';
    }>;
  };
  
  // Configuration
  config?: {
    showItems?: boolean;
    showCapacity?: boolean;
    showSignalQuery?: boolean;
    compact?: boolean;
    maxItemsToShow?: number;
  };
  
  // Actions
  onEdit?: () => void;
  onDelete?: () => void;
  onAddItem?: (item: any) => void;
  onClearQueue?: () => void;
}

export const TemporalWorkQueueCard: React.FC<TemporalWorkQueueCardProps>;
```

**Implementation Notes:**
- Shows queue name and description
- Displays current count vs max capacity
- Shows priority indicator (FIFO/LIFO/Priority)
- Lists queued items (collapsible)
- Auto-generated signal/query names shown
- Color-coded by priority level

---

### 13. TemporalScheduledWorkflowCard

**Purpose:** Display scheduled (cron) child workflow details

```typescript
export interface TemporalScheduledWorkflowCardProps {
  scheduledWorkflow: TemporalWorkflowStage & { 
    metadata: TemporalScheduledWorkflowMetadata 
  };
  
  // Status
  status?: 'pending' | 'running' | 'completed' | 'failed';
  executionInfo?: {
    lastRun?: Date;
    nextRun?: Date;
    runCount?: number;
    maxRuns?: number;
    errors?: Array<{
      timestamp: Date;
      message: string;
    }>;
  };
  
  // Configuration
  config?: {
    showSchedule?: boolean;
    showRunHistory?: boolean;
    showParentCommunication?: boolean;
    showCronExpression?: boolean;
    compact?: boolean;
  };
  
  // Actions
  onEdit?: () => void;
  onDelete?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onTriggerNow?: () => void;
}

export const TemporalScheduledWorkflowCard: React.FC<TemporalScheduledWorkflowCardProps>;
```

**Implementation Notes:**
- Shows cron schedule in human-readable format (e.g., "Every 30 minutes")
- Displays next run time and last run time
- Shows run count vs max runs (if limited)
- Indicates parent signal configuration
- Visual indicator for scheduled workflows (⏰ icon)
- Color: Purple/magenta to differentiate from regular child workflows

---

### 14. TemporalQueryCard

**Purpose:** Display query handler or query sender details

```typescript
export interface TemporalQueryCardProps {
  query: TemporalWorkflowStage & { metadata: TemporalQueryMetadata };
  
  // Status
  queryInfo?: {
    lastQueried?: Date;
    queryCount?: number;
    averageResponseTime?: number;
    recentResults?: Array<{
      timestamp: Date;
      result: any;
      duration: number;
    }>;
  };
  
  // Configuration
  config?: {
    showResponseSchema?: boolean;
    showTarget?: boolean;
    showHistory?: boolean;
    compact?: boolean;
  };
  
  // Actions
  onEdit?: () => void;
  onDelete?: () => void;
  onTestQuery?: () => void;
}

export const TemporalQueryCard: React.FC<TemporalQueryCardProps>;
```

**Implementation Notes:**
- Shows query name and type (send/receive)
- Displays target workflow (if sending query)
- Shows response schema
- Lists recent query results
- Visual indicator: 🔍 icon
- Different styling for send vs receive queries

---

### 15. CronExpressionBuilder

**Purpose:** Visual cron expression builder with presets

```typescript
export interface CronExpressionBuilderProps {
  value?: string;  // Current cron expression
  
  // Configuration
  config?: {
    showPresets?: boolean;
    showAdvanced?: boolean;
    validateExpression?: boolean;
    showNextRuns?: number;  // Show next N run times
  };
  
  // Callbacks
  onChange: (cronExpression: string) => void;
  onValidate?: (expression: string) => {
    valid: boolean;
    nextRuns?: Date[];
    humanReadable?: string;
    error?: string;
  };
}

export const CronExpressionBuilder: React.FC<CronExpressionBuilderProps>;
```

**Presets:**
- Every minute: `* * * * *`
- Every 5 minutes: `*/5 * * * *`
- Every 30 minutes: `*/30 * * * *`
- Hourly: `0 * * * *`
- Daily at midnight: `0 0 * * *`
- Daily at 9 AM: `0 9 * * *`
- Weekly on Monday: `0 0 * * 1`
- Monthly on 1st: `0 0 1 * *`
- Custom

**Implementation Notes:**
- Dropdown with common presets
- Advanced mode: visual builder (select minute, hour, day, month, day-of-week)
- Shows human-readable description (e.g., "Every 30 minutes")
- Validates cron expression
- Shows next 3-5 run times as preview
- Syntax highlighting for custom expressions

---

### 16. TemporalChildWorkflowCard (Enhanced)

**Purpose:** Display child workflow with enhanced parent communication features

```typescript
export interface TemporalChildWorkflowCardProps {
  childWorkflow: TemporalWorkflowStage & { 
    metadata: TemporalChildWorkflowMetadata 
  };
  
  // Status
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'blocked';
  executionInfo?: {
    startTime?: Date;
    endTime?: Date;
    attempts?: number;
    error?: string;
    blockedBy?: {
      workQueueName: string;
      remainingItems: number;
    };
  };
  
  // Configuration
  config?: {
    showTaskQueue?: boolean;
    showRetryPolicy?: boolean;
    showParentCommunication?: boolean;
    showBlockingInfo?: boolean;
    compact?: boolean;
  };
  
  // Actions
  onEdit?: () => void;
  onDelete?: () => void;
  onRetry?: () => void;
  onViewParentSignals?: () => void;
  onViewParentQueries?: () => void;
}

export const TemporalChildWorkflowCard: React.FC<TemporalChildWorkflowCardProps>;
```

**Implementation Notes:**
- Shows workflow name and task queue
- Displays parent communication indicators:
  - 📤 Arrow if signaling to parent (with signal name)
  - 🔍 Arrow if querying parent (with query name)
  - 🚫 Block icon if waiting for dependencies
- Shows blocking status (if blockUntil is configured)
- Visual connection lines to parent's work queues
- Color-coded by status (blocked = yellow/orange)

---

### 17. WorkQueueConnectionVisualizer

**Purpose:** Visualize connections between work queues, signals, queries, and workflows

```typescript
export interface WorkQueueConnectionVisualizerProps {
  workflow: TemporalWorkflow;
  selectedNodeId?: string;
  
  // Configuration
  config?: {
    showSignals?: boolean;
    showQueries?: boolean;
    showWorkQueues?: boolean;
    highlightConnections?: boolean;
    animateFlow?: boolean;
  };
  
  // Callbacks
  onNodeSelect?: (nodeId: string) => void;
  onConnectionClick?: (connection: {
    from: string;
    to: string;
    type: 'signal' | 'query';
  }) => void;
}

export const WorkQueueConnectionVisualizer: React.FC<WorkQueueConnectionVisualizerProps>;
```

**Implementation Notes:**
- Overlays connection paths on React Flow canvas
- Shows signal paths (child → parent signal → work queue)
- Shows query paths (child → parent query → work queue)
- Animates data flow for active workflows
- Highlights connections when hovering over nodes
- Different line styles: solid (signal), dashed (query), dotted (blocking)

---

## 🔧 Utility Functions & Hooks

### Adapters

```typescript
/**
 * Convert Temporal workflow to Generic workflow
 */
export function temporalToGeneric(
  temporal: TemporalWorkflow
): GenericWorkflow<TemporalNodeMetadata>;

/**
 * Convert Generic workflow to Temporal workflow
 */
export function genericToTemporal(
  generic: GenericWorkflow
): TemporalWorkflow;

/**
 * Convert Temporal workflow to JSON
 */
export function temporalWorkflowToJSON(
  workflow: TemporalWorkflow
): WorkflowJSONDefinition;

/**
 * Convert JSON to Temporal workflow
 */
export function jsonToTemporalWorkflow(
  json: WorkflowJSONDefinition
): TemporalWorkflow;
```

---

### Validation

```typescript
export interface ValidationResult {
  valid: boolean;
  errors: Array<{
    stageId?: string;
    transitionId?: string;
    field?: string;
    message: string;
    severity: 'error' | 'warning';
  }>;
}

/**
 * Validate Temporal workflow structure and configuration
 */
export function validateTemporalWorkflow(
  workflow: TemporalWorkflow
): ValidationResult;

/**
 * Validate task queue configuration
 */
export function validateTaskQueue(
  taskQueue: TaskQueue
): ValidationResult;

/**
 * Validate retry policy
 */
export function validateRetryPolicy(
  policy: TemporalRetryPolicy
): ValidationResult;
```

**Validation Rules:**
- At least one trigger node
- All activities have task queues
- All agents have prompt IDs
- No circular dependencies
- Valid timeout values
- Valid retry configurations
- Unique node IDs
- Valid transitions

---

### Hooks

```typescript
/**
 * Hook for managing Temporal workflow state
 */
export function useTemporalWorkflow(
  initialWorkflow?: TemporalWorkflow
) {
  return {
    workflow: TemporalWorkflow;
    setWorkflow: (workflow: TemporalWorkflow) => void;
    addStage: (stage: TemporalWorkflowStage, position?: [number, number]) => void;
    updateStage: (stageId: string, updates: Partial<TemporalWorkflowStage>) => void;
    deleteStage: (stageId: string) => void;
    addTransition: (transition: TemporalWorkflowTransition) => void;
    deleteTransition: (transitionId: string) => void;
    validate: () => ValidationResult;
    canUndo: boolean;
    canRedo: boolean;
    undo: () => void;
    redo: () => void;
  };
}

/**
 * Hook for Temporal execution monitoring
 */
export function useTemporalExecution(
  workflowId: string,
  runId?: string,
  options?: {
    autoRefresh?: boolean;
    refreshInterval?: number;
  }
) {
  return {
    execution: TemporalWorkflowExecution | null;
    loading: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
    cancel: () => Promise<void>;
    retry: () => Promise<void>;
    terminate: (reason?: string) => Promise<void>;
  };
}

/**
 * Hook for component palette management
 */
export function useTemporalComponents(
  filters?: {
    type?: TemporalNodeType[];
    capability?: string[];
    search?: string;
  }
) {
  return {
    components: TemporalComponentPaletteItem[];
    loading: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
    filteredComponents: TemporalComponentPaletteItem[];
  };
}

/**
 * Hook for task queue management
 */
export function useTaskQueues() {
  return {
    taskQueues: TaskQueue[];
    loading: boolean;
    error: Error | null;
    createTaskQueue: (name: string, description?: string) => Promise<TaskQueue>;
    updateTaskQueue: (id: string, updates: Partial<TaskQueue>) => Promise<TaskQueue>;
    deleteTaskQueue: (id: string) => Promise<void>;
  };
}
```

---

## 📁 Package Structure

```
packages/ui/temporal-workflow-ui/
├── src/
│   ├── index.ts                              # Main exports
│   │
│   ├── types/
│   │   ├── index.ts                          # Type exports
│   │   ├── workflow.ts                       # Temporal workflow types
│   │   ├── metadata.ts                       # Metadata types
│   │   ├── execution.ts                      # Execution types
│   │   └── validation.ts                     # Validation types
│   │
│   ├── components/
│   │   ├── TemporalWorkflowBuilder.tsx       # Main builder
│   │   ├── TemporalWorkflowStepper.tsx       # Progress stepper
│   │   ├── TemporalActivityCard.tsx          # Activity display
│   │   ├── TemporalAgentCard.tsx             # Agent display
│   │   ├── TemporalComponentPalette.tsx      # Component palette
│   │   ├── TemporalPropertyPanel.tsx         # Property editor
│   │   ├── TemporalTaskQueueSelector.tsx     # Task queue selector
│   │   ├── TemporalRetryPolicyEditor.tsx     # Retry policy editor
│   │   ├── TemporalTimeoutEditor.tsx         # Timeout editor
│   │   ├── TemporalWorkflowTimeline.tsx      # Execution timeline
│   │   ├── TemporalWorkflowExecutionPanel.tsx # Execution panel
│   │   ├── TemporalWorkQueueCard.tsx         # Work queue display
│   │   ├── TemporalScheduledWorkflowCard.tsx # Cron workflow display
│   │   ├── TemporalQueryCard.tsx             # Query handler display
│   │   ├── TemporalChildWorkflowCard.tsx     # Enhanced child workflow
│   │   ├── CronExpressionBuilder.tsx         # Cron expression builder
│   │   └── WorkQueueConnectionVisualizer.tsx # Connection visualizer
│   │
│   ├── adapters/
│   │   ├── temporal-to-generic.ts            # Temporal → Generic
│   │   ├── generic-to-temporal.ts            # Generic → Temporal
│   │   ├── temporal-to-json.ts               # Temporal → JSON
│   │   └── json-to-temporal.ts               # JSON → Temporal
│   │
│   ├── validation/
│   │   ├── workflow-validator.ts             # Workflow validation
│   │   ├── stage-validator.ts                # Stage validation
│   │   ├── transition-validator.ts           # Transition validation
│   │   └── validation-rules.ts               # Validation rules
│   │
│   ├── hooks/
│   │   ├── useTemporalWorkflow.ts            # Workflow state
│   │   ├── useTemporalExecution.ts           # Execution monitoring
│   │   ├── useTemporalComponents.ts          # Component management
│   │   └── useTaskQueues.ts                  # Task queue management
│   │
│   ├── utils/
│   │   ├── temporal-utils.ts                 # Utility functions
│   │   ├── node-icons.ts                     # Node icon mapping
│   │   ├── node-colors.ts                    # Node color mapping
│   │   ├── retry-policy-presets.ts           # Retry presets
│   │   ├── cron-utils.ts                     # Cron expression parsing/validation
│   │   ├── work-queue-utils.ts               # Work queue management utilities
│   │   └── connection-path-utils.ts          # Signal/query connection path calculation
│   │
│   └── styles/
│       └── temporal-theme.ts                 # Temporal-specific theme
│
├── tests/                                     # Component tests
│   ├── components/
│   ├── adapters/
│   ├── validation/
│   └── hooks/
│
├── examples/                                  # Usage examples
│   ├── basic-workflow.tsx
│   ├── activity-workflow.tsx
│   ├── agent-workflow.tsx
│   ├── complex-workflow.tsx
│   ├── scheduled-workflow.tsx                 # Cron workflow example
│   ├── work-queue-workflow.tsx                # Work queue example
│   ├── query-workflow.tsx                     # Query handler example
│   └── plan-writer-coordinator.tsx            # Full coordinator example
│
├── stories/                                   # Storybook stories
│
└── docs/                                      # Documentation
    ├── getting-started.md
    ├── components.md
    ├── adapters.md
    └── examples.md
```

---

## 🎨 Theme & Styling

### Temporal-Specific Theme Tokens

```typescript
export const temporalTheme = {
  // Node type colors
  colors: {
    activity: '$blue9',
    activityBg: '$blue3',
    agent: '$purple9',
    agentBg: '$purple3',
    signal: '$orange9',
    signalBg: '$orange3',
    query: '$teal9',
    queryBg: '$teal3',
    trigger: '$green9',
    triggerBg: '$green3',
    childWorkflow: '$cyan9',
    childWorkflowBg: '$cyan3',
    scheduledWorkflow: '$pink9',  // Distinct color for cron workflows
    scheduledWorkflowBg: '$pink3',
    workQueue: '$yellow9',  // Work queue containers
    workQueueBg: '$yellow3',
    
    // Status colors
    running: '$blue9',
    completed: '$green9',
    failed: '$red9',
    canceled: '$gray9',
    pending: '$gray7',
    blocked: '$orange7',  // For blocked child workflows
    paused: '$violet7',   // For paused scheduled workflows
  },
  
  // Node icons (using Tamagui lucide icons)
  icons: {
    activity: 'Zap',
    agent: 'Brain',
    signal: 'Radio',
    query: 'Search',  // Or 'MessageSquare' for query
    trigger: 'PlayCircle',
    childWorkflow: 'GitBranch',
    scheduledWorkflow: 'Clock',  // Or 'Calendar' or 'Timer'
    workQueue: 'Inbox',  // Or 'List' or 'LayersIcon'
    taskQueue: 'List',
    retryPolicy: 'RotateCw',
    timeout: 'Clock',
    
    // Additional icons for UI elements
    signalSend: 'SendHorizonal',
    signalReceive: 'Download',
    querySend: 'ArrowUpRight',
    queryReceive: 'ArrowDownLeft',
    blocked: 'Ban',
    dependency: 'Link',
  },
  
  // Connection line styles
  connections: {
    signal: {
      stroke: '$orange9',
      strokeWidth: 2,
      strokeDasharray: 'none',  // Solid line
    },
    query: {
      stroke: '$teal9',
      strokeWidth: 2,
      strokeDasharray: '5,5',  // Dashed line
    },
    blocking: {
      stroke: '$red7',
      strokeWidth: 2,
      strokeDasharray: '2,2',  // Dotted line
    },
    scheduled: {
      stroke: '$pink9',
      strokeWidth: 2,
      strokeDasharray: '10,5',  // Long dashes
    },
  },
};
```

---

## 🧪 Testing Strategy

### Unit Tests
- ✅ Adapter functions (temporal ↔ generic ↔ JSON)
- ✅ Validation functions
- ✅ Utility functions
- ✅ Hooks logic

### Component Tests
- ✅ All components render correctly
- ✅ Props are passed through to generic components
- ✅ Temporal-specific features work
- ✅ User interactions trigger callbacks

### Integration Tests
- ✅ Complete workflow creation flow
- ✅ Workflow execution monitoring
- ✅ Component palette drag-and-drop
- ✅ Property panel updates

**Target:** 85%+ test coverage

---

## 📊 Example Usage

### Basic Example

```tsx
import {
  TemporalWorkflowBuilder,
  TemporalWorkflow,
  TemporalComponentPaletteItem,
  TaskQueue,
} from '@bernierllc/temporal-workflow-ui';

const components: TemporalComponentPaletteItem[] = [
  {
    id: 'fetch-data',
    name: 'fetchData',
    displayName: 'Fetch Data',
    type: 'activity',
    icon: 'Database',
    capabilities: ['data', 'fetch'],
    defaultMetadata: {
      nodeType: 'activity',
      activityName: 'fetchDataActivity',
      taskQueue: 'default',
      retryPolicy: { maximumAttempts: 3 },
    },
  },
  {
    id: 'analyze-agent',
    name: 'analyzeAgent',
    displayName: 'AI Analyzer',
    type: 'agent',
    icon: 'Brain',
    capabilities: ['ai', 'analysis'],
    defaultMetadata: {
      nodeType: 'agent',
      agentName: 'Analyzer',
      agentPromptId: 'prompt-123',
      taskQueue: 'ai-queue',
    },
  },
];

const taskQueues: TaskQueue[] = [
  { id: 'q1', name: 'default', description: 'Default task queue' },
  { id: 'q2', name: 'ai-queue', description: 'AI processing queue' },
];

function MyWorkflowBuilder() {
  const [workflow, setWorkflow] = useState<TemporalWorkflow | undefined>();

  return (
    <TemporalWorkflowBuilder
      availableComponents={components}
      availableTaskQueues={taskQueues}
      defaultTaskQueue="default"
      config={{
        showMiniMap: true,
        showControls: true,
        autoSave: true,
        autoSaveInterval: 2000,
      }}
      onSave={async (wf) => {
        console.log('Saving workflow:', wf);
        await saveToDatabase(wf);
      }}
      onDeploy={async (wf) => {
        console.log('Deploying workflow:', wf);
        await deployToTemporal(wf);
      }}
    />
  );
}
```

---

### Execution Monitoring Example

```tsx
import {
  TemporalWorkflowExecutionPanel,
  useTemporalExecution,
} from '@bernierllc/temporal-workflow-ui';

function WorkflowMonitor({ workflowId, runId }) {
  const { execution, loading, error } = useTemporalExecution(
    workflowId,
    runId,
    {
      autoRefresh: true,
      refreshInterval: 1000,
    }
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!execution) return <div>No execution found</div>;

  return (
    <TemporalWorkflowExecutionPanel
      execution={execution}
      workflow={workflow}
      config={{
        showStepper: true,
        showTimeline: true,
        showMetrics: true,
      }}
      onCancel={async () => {
        await cancelExecution(workflowId, runId);
      }}
    />
  );
}
```

---

### Custom Property Panel Example

```tsx
import {
  TemporalPropertyPanel,
  TemporalTaskQueueSelector,
  TemporalRetryPolicyEditor,
} from '@bernierllc/temporal-workflow-ui';

function CustomPropertyPanel({ node, workflow, onUpdate }) {
  return (
    <TemporalPropertyPanel
      node={node}
      workflow={workflow}
      taskQueues={taskQueues}
      onUpdate={onUpdate}
      customFields={
        node.metadata.nodeType === 'activity' ? (
          <YStack gap="$3">
            <Separator />
            <Text fontWeight="bold">Custom Settings</Text>
            
            <TaskQueueSelector
              taskQueues={taskQueues}
              selected={node.metadata.taskQueue}
              onChange={(queueId) =>
                onUpdate({
                  metadata: { ...node.metadata, taskQueue: queueId },
                })
              }
            />
            
            <TemporalRetryPolicyEditor
              retryPolicy={node.metadata.retryPolicy}
              onChange={(policy) =>
                onUpdate({
                  metadata: { ...node.metadata, retryPolicy: policy },
                })
              }
            />
          </YStack>
        ) : null
      }
    />
  );
}
```

---

## 🔗 Integration Points

### With @bernierllc/generic-workflow-ui
- **Wraps:** All generic components
- **Extends:** Adds Temporal-specific metadata and types
- **Adapters:** Bi-directional conversion (temporal ↔ generic)

### With Temporal
- **Workflow Types:** Maps to Temporal workflow definitions
- **Execution:** Monitors Temporal workflow executions
- **Task Queues:** Manages Temporal task queue assignments
- **Activities:** Represents Temporal activities as nodes

### With Our Workflow Builder
- **Data Layer:** Supabase for persistence
- **API Layer:** tRPC for backend communication
- **Components:** Uses temporal-workflow-ui for all UI

---

## 📋 Success Criteria

### Core Functionality
- [ ] All components wrap generic-workflow-ui correctly
- [ ] Type conversions are bidirectional and lossless
- [ ] Validation catches all Temporal constraint violations
- [ ] Theme matches Temporal branding
- [ ] 85%+ test coverage
- [ ] Full TypeScript support with strict mode
- [ ] Works with React 18.3+ and 19+
- [ ] Integrates seamlessly with our workflow-builder

### Advanced Patterns
- [ ] Scheduled workflows (cron) render correctly on canvas
- [ ] Work queues display as containers with visual connections
- [ ] Signal/query connections animate and highlight on hover
- [ ] Child workflows can configure parent communication
- [ ] Blocking dependencies visualize correctly
- [ ] Auto-generated signals/queries are marked as such
- [ ] Cron expression builder validates and shows next runs
- [ ] Work queue properties (FIFO/LIFO/priority) display correctly
- [ ] Connection visualizer shows all signal/query paths
- [ ] Validation prevents circular dependencies in blockUntil

---

## 🚀 Implementation Priority

### Phase 1: Core Types & Adapters (Week 1)
- [ ] Define all Temporal types
- [ ] Implement temporal ↔ generic adapters
- [ ] Implement JSON converters
- [ ] Add validation functions
- [ ] Write adapter tests

### Phase 2: Basic Components (Week 2)
- [ ] TemporalWorkflowStepper
- [ ] TemporalActivityCard
- [ ] TemporalAgentCard
- [ ] TemporalComponentPalette
- [ ] Component tests

### Phase 3: Builder & Editors (Week 3)
- [ ] TemporalWorkflowBuilder
- [ ] TemporalPropertyPanel
- [ ] TemporalTaskQueueSelector
- [ ] TemporalRetryPolicyEditor
- [ ] TemporalTimeoutEditor
- [ ] Builder integration tests

### Phase 4: Execution Monitoring (Week 4)
- [ ] TemporalWorkflowTimeline
- [ ] TemporalWorkflowExecutionPanel
- [ ] useTemporalExecution hook
- [ ] Real-time updates
- [ ] Monitoring tests

### Phase 5: Advanced Workflow Patterns (Week 5-6)
- [ ] TemporalWorkQueueCard
- [ ] TemporalScheduledWorkflowCard
- [ ] TemporalQueryCard
- [ ] TemporalChildWorkflowCard (enhanced)
- [ ] CronExpressionBuilder
- [ ] WorkQueueConnectionVisualizer
- [ ] Cron utilities (parsing, validation, next runs)
- [ ] Work queue utilities
- [ ] Connection path utilities
- [ ] Validation for signals, queries, cron expressions
- [ ] Tests for advanced patterns

### Phase 6: Polish & Documentation (Week 7)
- [ ] Examples (basic + advanced patterns)
- [ ] Plan Writer Coordinator example
- [ ] Storybook stories for all new components
- [ ] Documentation updates
  - [ ] Advanced patterns guide
  - [ ] Cron workflow guide
  - [ ] Work queue guide
  - [ ] Signal/query guide
- [ ] Final testing
- [ ] Performance optimization
- [ ] Accessibility audit

---

## 📝 Notes for Package Team

### Critical Requirements
1. **React 18 Support:** Must work with React 18.3+ (not just 19)
2. **React Flow:** Depends on generic-workflow-ui having React Flow support
3. **Type Safety:** All types must be strict-mode compatible
4. **Performance:** Should handle workflows with 50+ nodes smoothly
5. **Advanced Patterns:** Must support cron workflows, work queues, signals, queries
6. **Cron Validation:** Include robust cron expression parsing and validation
7. **Connection Visualization:** Clear visual representation of signal/query paths

### Design Decisions
- **Thin Wrapper:** Minimal abstraction over generic-workflow-ui
- **Type Safety First:** TypeScript-first design
- **Flexible Metadata:** Use metadata field for extensibility
- **No Business Logic:** UI only, no Temporal client logic
- **Visual Hierarchy:** Scheduled workflows "hang off the side" of main workflow
- **Work Queues as Containers:** Work queues appear as buckets/containers, not nodes
- **Auto-Generation:** Signals and queries can be auto-generated from work queues
- **Connection Animations:** Animate signal/query flow for running workflows

### Questions to Resolve
1. Should we include Temporal client integration or keep it pure UI?
2. How to handle workflow compilation (JSON → TypeScript)?
3. Should we provide code generation utilities?
4. How to handle versioning with generic-workflow-ui?
5. **NEW:** How to handle cron expression timezone configuration?
6. **NEW:** Should work queues support custom priority functions?
7. **NEW:** How to visualize deeply nested child workflow hierarchies?
8. **NEW:** Should we support visual debugging of signal/query flows?

### Advanced Pattern Implementation Notes

**Scheduled Workflows:**
- Render as separate nodes with visual attachment to parent
- Use distinct color (pink/magenta) and ⏰ icon
- Cron expression builder with presets and validation
- Show next N run times as preview
- Support pause/resume/trigger actions

**Work Queues:**
- NOT rendered as regular nodes
- Appear as "containers" or "buckets" on workflow canvas
- Show live count and capacity
- Visual connections to signals/queries that interact with them
- Support inline item preview (collapsible list)

**Signals & Queries:**
- Appear as connection points on workflow boundary
- Solid lines for signals, dashed for queries
- Auto-generated ones marked with special icon
- Hover shows parameters and connected workflows
- Click to edit handler code (if applicable)

**Child Workflow Enhancements:**
- Show parent communication indicators (📤 signal, 🔍 query)
- Display blocking status (🚫 icon + remaining work)
- Visual connection lines to parent work queues
- Support for dependency chains

**Connection Visualizer:**
- Overlay on React Flow canvas
- Animate flow for running workflows
- Different line styles per connection type
- Highlight on hover
- Click to inspect connection details

---

## 🔄 Version History

- **1.0.0** (Planned) - Initial release
  - Core types and adapters
  - All basic components
  - Workflow builder
  - Execution monitoring
  - 85%+ test coverage

- **1.1.0** (Planned) - Advanced workflow patterns
  - Scheduled workflows (cron child workflows)
  - Work queues with signals/queries
  - Enhanced child workflows with parent communication
  - Dependency blocking
  - Connection visualizer
  - Cron expression builder
  - Code generation for signals/queries/work queues

---

## 📚 Related Packages

- **@bernierllc/generic-workflow-ui** - Generic workflow UI components (dependency)
- **@coordinator/workflow-builder** - Our Temporal workflow builder app (consumer)

---

**Package Type:** UI Package (Domain-Specific Wrapper)  
**Category:** Temporal Workflow UI  
**Status:** Planned - Ready for Implementation  
**Est. Completion:** 
- **v1.0.0:** 5 weeks from start (basic functionality)
- **v1.1.0:** 7 weeks from start (with advanced patterns)

**Timeline Updated:** 2025-11-16 - Added advanced workflow patterns support


