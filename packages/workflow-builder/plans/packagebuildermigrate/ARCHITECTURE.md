# Architecture Design

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Workflow Builder UI                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Canvas     │  │  Property    │  │   Node       │          │
│  │   Editor     │  │  Panels      │  │   Palette    │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                   │
│         └──────────────────┴──────────────────┘                   │
│                            │                                       │
│                   ┌────────▼────────┐                            │
│                   │  Workflow JSON  │                            │
│                   │   Definition    │                            │
│                   └────────┬────────┘                            │
└────────────────────────────┼──────────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   Validator &   │
                    │  Type Checker   │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │    Workflow     │
                    │    Compiler     │────► TypeScript Code
                    │  (JSON → TS)    │      (Temporal Workflow)
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Code Generator │
                    │  & Bundler      │
                    └────────┬────────┘
                             │
┌────────────────────────────┼──────────────────────────────────────┐
│                 Temporal Runtime                                   │
│                            │                                       │
│                   ┌────────▼────────┐                            │
│                   │  Dynamic Loader │                            │
│                   │  & Registration │                            │
│                   └────────┬────────┘                            │
│                            │                                       │
│         ┌──────────────────┼──────────────────┐                  │
│         │                  │                  │                   │
│    ┌────▼─────┐     ┌─────▼─────┐     ┌─────▼─────┐            │
│    │ Workflow │     │ Activity  │     │   Worker  │            │
│    │ Executor │     │ Registry  │     │  Manager  │            │
│    └──────────┘     └───────────┘     └───────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Workflow Compiler

**Purpose:** Transform UI JSON definitions into executable Temporal TypeScript workflows

**Key Responsibilities:**
- Parse workflow JSON from UI
- Generate TypeScript AST
- Handle all node types (activity, condition, loop, retry, etc.)
- Generate imports and activity proxies
- Output production-ready workflow code

**Technology Stack:**
- TypeScript Compiler API (`ts.createSourceFile`, `ts.factory`)
- Template-based code generation
- AST manipulation

**Example Input (JSON):**
```json
{
  "nodes": [
    {
      "id": "start",
      "type": "trigger",
      "position": { "x": 100, "y": 100 },
      "data": { "label": "Start" }
    },
    {
      "id": "build-activity",
      "type": "activity",
      "position": { "x": 300, "y": 100 },
      "data": {
        "label": "Run Build",
        "componentName": "runBuild",
        "config": {
          "activityName": "runBuild",
          "timeout": "10 minutes"
        }
      }
    }
  ],
  "edges": [
    { "id": "e1", "source": "start", "target": "build-activity" }
  ]
}
```

**Example Output (TypeScript):**
```typescript
import { proxyActivities } from '@temporalio/workflow';
import type * as buildActivities from '../activities/build.activities';

const { runBuild } = proxyActivities<typeof buildActivities>({
  startToCloseTimeout: '10 minutes'
});

export async function GeneratedWorkflow(input: WorkflowInput): Promise<void> {
  const buildResult = await runBuild({
    workspaceRoot: input.workspaceRoot,
    packagePath: input.packagePath
  });
}
```

### 2. Activity Registry

**Purpose:** Dynamically load and register activities from NPM packages

**Key Responsibilities:**
- Discover available activities
- Load activity modules dynamically
- Manage activity versions
- Provide activity metadata to UI

**Structure:**
```typescript
interface ActivityRegistry {
  // Activity discovery
  discoverActivities(packagePath: string): Promise<ActivityMetadata[]>;

  // Dynamic loading
  loadActivity(packageName: string, activityName: string): Promise<Activity>;

  // Metadata
  getActivityMetadata(activityName: string): ActivityMetadata;

  // Registration
  registerActivities(worker: Worker, activities: string[]): void;
}

interface ActivityMetadata {
  name: string;
  packageName: string;
  version: string;
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
  timeout: string;
  category: 'build' | 'test' | 'agent' | 'report';
}
```

### 3. Node Type System

**UI Node Types:**

```typescript
// Base node
interface WorkflowNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: NodeData;
}

// Node types
type NodeType =
  | 'trigger'
  | 'activity'
  | 'agent'
  | 'condition'
  | 'loop'
  | 'retry'
  | 'phase'
  | 'state-variable'
  | 'child-workflow'
  | 'signal';

// Activity node
interface ActivityNode extends WorkflowNode {
  type: 'activity';
  data: {
    label: string;
    componentName: string;
    config: {
      activityName: string;
      timeout?: string;
      retryPolicy?: RetryPolicy;
    };
  };
}

// Loop node (container)
interface LoopNode extends WorkflowNode {
  type: 'loop';
  data: {
    label: string;
    config: {
      condition: string; // e.g., "hasUnbuiltPackages(state)"
      maxIterations?: number;
      concurrency?: number;
      strategy?: 'sequential' | 'parallel' | 'race';
    };
  };
  children: string[]; // IDs of nodes inside loop
}

// Conditional node
interface ConditionNode extends WorkflowNode {
  type: 'condition';
  data: {
    label: string;
    config: {
      expression: string; // e.g., "result.success === true"
    };
  };
  // Has two output handles: 'true' and 'false'
}

// Retry node
interface RetryNode extends WorkflowNode {
  type: 'retry';
  data: {
    label: string;
    config: {
      maxAttempts: number;
      retryOn: 'failure' | 'timeout' | 'custom';
      backoff: {
        type: 'fixed' | 'exponential';
        initialInterval: string;
        maxInterval?: string;
        multiplier?: number;
      };
      coordinatorWorkflow?: string; // For AI-driven remediation
      problemType?: string;
    };
  };
}

// Child workflow node
interface ChildWorkflowNode extends WorkflowNode {
  type: 'child-workflow';
  data: {
    label: string;
    componentName: string;
    config: {
      workflowType: string;
      taskQueue: string;
      executionType: 'startChild' | 'executeChild';
      inputMapping: Record<string, string>; // Maps parent data to child input
    };
  };
}
```

### 4. State Management System

**Workflow-Scoped State:**

```typescript
// State variable node
interface StateVariableNode extends WorkflowNode {
  type: 'state-variable';
  data: {
    label: string;
    config: {
      name: string;
      operation: 'set' | 'update' | 'delete';
      value: string; // Expression or literal
      scope: 'workflow' | 'block';
    };
  };
}

// Runtime state tracking
interface WorkflowState {
  variables: Map<string, any>;
  history: StateChange[];
}

interface StateChange {
  timestamp: number;
  nodeId: string;
  variable: string;
  operation: 'set' | 'update';
  oldValue: any;
  newValue: any;
}
```

### 5. Compilation Strategy

**Three compilation modes:**

1. **Static Compilation (Phase 1-2)**
   - Pre-compile workflows to TypeScript at deployment time
   - Bundle with worker code
   - Fast execution, limited runtime flexibility

2. **Dynamic Compilation (Phase 3)**
   - Compile workflows on-demand
   - Cache compiled code
   - Allows workflow updates without redeployment

3. **Hybrid (Phase 4 - Production)**
   - Static compilation for stable workflows
   - Dynamic compilation for experimental workflows
   - Best of both worlds

### 6. Execution Architecture

**Worker Registration:**

```typescript
// Worker setup
import { Worker } from '@temporalio/worker';
import { WorkflowCompiler } from './compiler';
import { ActivityRegistry } from './registry';

async function startWorker() {
  const compiler = new WorkflowCompiler();
  const registry = new ActivityRegistry();

  // Load workflow definitions from database
  const definitions = await loadWorkflowDefinitions();

  // Compile workflows
  const compiledWorkflows = await compiler.compileAll(definitions);

  // Load activities
  const activities = await registry.loadActivities([
    '@bernier/build-activities',
    '@bernier/test-activities',
    '@bernier/agent-activities'
  ]);

  // Start worker
  const worker = await Worker.create({
    workflowsPath: compiledWorkflows.outputPath,
    activities,
    taskQueue: 'workflow-builder-queue'
  });

  await worker.run();
}
```

## Data Flow

### Workflow Creation Flow

```
1. User drags nodes onto canvas
2. Connects nodes with edges
3. Configures node properties
   │
   ▼
4. UI validates workflow structure
5. Checks for loops, unreachable nodes
   │
   ▼
6. Save to database (JSON)
   │
   ▼
7. Trigger compilation on "Deploy"
   │
   ▼
8. Compiler generates TypeScript
9. Bundler creates worker code
   │
   ▼
10. Worker loads and registers workflows
11. Ready to execute
```

### Workflow Execution Flow

```
1. Client starts workflow via API
   │
   ▼
2. Temporal server routes to worker
   │
   ▼
3. Worker loads compiled workflow code
   │
   ▼
4. Workflow executes node-by-node
   - Activities via proxyActivities()
   - Child workflows via startChild/executeChild
   - Conditionals via if/else
   - Loops via while/for
   │
   ▼
5. State changes tracked in Temporal
   │
   ▼
6. UI polls for execution status
7. Displays real-time progress
```

## Key Architectural Decisions

### Decision 1: TypeScript Compilation vs Interpretation

**Decision:** Compile to TypeScript rather than interpret JSON at runtime

**Rationale:**
- ✅ Native Temporal performance (no interpretation overhead)
- ✅ Type safety from TypeScript compiler
- ✅ Can leverage existing Temporal worker infrastructure
- ✅ Easier debugging (can inspect generated code)
- ❌ Requires compilation step (acceptable tradeoff)

### Decision 2: Code Generation Approach

**Decision:** Use TypeScript Compiler API for AST generation

**Rationale:**
- ✅ Generates valid, idiomatic TypeScript
- ✅ Type-checked at compile time
- ✅ Can import and validate activity types
- ❌ More complex than template strings
- ✅ But much more robust and maintainable

### Decision 3: Activity Loading

**Decision:** NPM packages with dynamic imports

**Rationale:**
- ✅ Standard packaging and versioning
- ✅ Can share activities across workflows
- ✅ Easy to publish and consume
- ✅ TypeScript types included

### Decision 4: State Management

**Decision:** Workflow-scoped variables with explicit state nodes

**Rationale:**
- ✅ Makes state mutations visible in UI
- ✅ Easier to understand workflow logic
- ✅ Can track state changes in execution history
- ❌ More verbose than implicit state

### Decision 5: Validation Strategy

**Decision:** Multi-layer validation (UI, API, Compiler)

**Rationale:**
- ✅ Catch errors early in UI
- ✅ Validate before compilation in API
- ✅ Final check during compilation
- ✅ Prevents invalid workflows from running

## Security Considerations

1. **Code Injection Prevention**
   - Sanitize all user input
   - Use parameterized expressions
   - Whitelist allowed functions

2. **Activity Sandboxing**
   - Activities run in isolated workers
   - Resource limits enforced
   - Network policies applied

3. **Workflow Isolation**
   - Each workflow runs in own execution context
   - No shared mutable state
   - Temporal handles isolation

## Performance Considerations

1. **Compilation Caching**
   - Cache compiled workflows by hash
   - Invalidate on definition change
   - Reduce compilation overhead

2. **Worker Scaling**
   - Horizontal scaling of workers
   - Workflow distribution across workers
   - Activity task queues

3. **Database Optimization**
   - Index workflow definitions by user/project
   - Cache frequently accessed workflows
   - Use connection pooling

## Technology Stack

**Frontend:**
- React 18
- ReactFlow
- Tamagui UI
- TanStack Query
- Supabase client

**Backend:**
- Next.js 14 (API routes)
- Supabase (PostgreSQL)
- Temporal TypeScript SDK
- TypeScript Compiler API
- esbuild (bundling)

**Infrastructure:**
- Temporal Server
- Supabase Database
- Vercel (UI deployment)
- Docker (worker containers)

## Next Steps

Proceed to phase-specific documents for detailed implementation plans:
- PHASE-1-FOUNDATION.md - Basic compilation and execution
- PHASE-2-STATE-CONTROL.md - State management and control flow
- PHASE-3-CONCURRENCY.md - Parallel workflows and concurrency
- PHASE-4-ADVANCED.md - Advanced patterns and production features
