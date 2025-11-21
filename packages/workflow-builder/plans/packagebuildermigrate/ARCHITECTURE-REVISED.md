# Architecture Design (Revised - Pattern-First Approach)

## Philosophy: UI Shows Intent, Compiler Generates Implementation

The key insight: **Users configure behavior through simple UI, compiler generates complex Temporal code**.

```
User Sees:   [Retry] ☑ Use AI ━━━━━━━━━━━━━━━━━━━━┓
                                                    ▼
Compiler:    executeChild(CoordinatorWorkflow) ←─ Pattern
             + context builder                     Library
             + decision routing
             + state preservation
```

## Simplified System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Workflow Builder UI                          │
│                                                                   │
│  ┌──────────────────────────────────────────────────────┐       │
│  │              Canvas (ReactFlow)                       │       │
│  │  [Start] → [Activity] → [Retry] → [Activity] → [End] │       │
│  │                           ↓                            │       │
│  │                      Max: 3, AI: ✓                    │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                   │
│  ┌────────────┐  ┌────────────┐  ┌──────────────┐              │
│  │ Variables  │  │  Workflow  │  │   Property   │              │
│  │   Panel    │  │  Settings  │  │    Panel     │              │
│  └────────────┘  └────────────┘  └──────────────┘              │
│                                                                   │
│  Output: Simple JSON with configuration                          │
└───────────────────────────┬───────────────────────────────────┘
                            │
                   ┌────────▼────────┐
                   │  JSON Definition │
                   │   + Config       │
                   └────────┬────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │    Smart Compiler (Pattern-Based)     │
        │                                        │
        │  ┌──────────────────────────────┐    │
        │  │     Pattern Library          │    │
        │  │  • AI Remediation Pattern    │    │
        │  │  • Concurrency Pattern       │    │
        │  │  • State Management Pattern  │    │
        │  │  • Signal Handler Pattern    │    │
        │  │  • Retry Policy Pattern      │    │
        │  │  • Activity Proxy Pattern    │    │
        │  └──────────────────────────────┘    │
        │                                        │
        │  Pattern Detection → Code Generation  │
        └───────────────────┬────────────────────┘
                            │
                   ┌────────▼────────┐
                   │   TypeScript     │
                   │  Workflow Code   │
                   │  (Production)    │
                   └────────┬────────┘
                            │
        ┌───────────────────┴───────────────────┐
        │         Temporal Runtime              │
        │  (Standard worker, no customization)  │
        └───────────────────────────────────────┘
```

## Core Components

### 1. Simplified UI Layer

**5 Node Types (That's it!):**

```typescript
type NodeType =
  | 'trigger'      // Start/end points
  | 'activity'     // Call an activity
  | 'conditional'  // If/else branching
  | 'loop'         // Repeat with concurrency
  | 'child-workflow'; // Spawn child workflow

// No state-variable nodes
// No signal nodes
// No retry nodes (it's a property of activities/loops)
// No phase nodes (just visual grouping in UI)
```

**3 Configuration Panels:**

```typescript
// 1. Variables Panel (side panel like VS Code)
interface VariablesPanel {
  variables: Array<{
    name: string;
    type: 'string' | 'number' | 'object' | 'array';
    initialValue: any;
    scope: 'workflow' | 'loop';
  }>;
}

// 2. Workflow Settings (workflow-level config)
interface WorkflowSettings {
  name: string;
  taskQueue: string;

  // AI Configuration
  aiRemediation: {
    enabled: boolean;
    basePrompt: string;
    includeContext: {
      workflowState: boolean;
      errorDetails: boolean;
      previousAttempts: boolean;
    };
  };

  // Signal Handlers
  signals: Array<{
    name: string;
    action: 'queue' | 'update-state' | 'trigger';
    handler: string; // Expression
  }>;

  // Long-running config
  longRunning: {
    autoContinueAsNew: boolean;
    maxHistoryEvents: number;
    maxDuration: string;
  };
}

// 3. Node Property Panel (per-node config)
interface ActivityNodeConfig {
  activityName: string;
  timeout: string;
  retry: {
    enabled: boolean;
    maxAttempts: number;
    backoff: 'fixed' | 'exponential';
    useAI: boolean; // AI remediation for this activity
  };
  inputMapping: Record<string, string>;
}

interface LoopNodeConfig {
  condition: string; // "hasUnbuiltPackages(state)"
  maxConcurrent: number;
  maxIterations?: number;
  children: string[]; // Node IDs inside loop
}
```

**What Users See:**

```
Workflow Settings:
┌─────────────────────────────────────┐
│ ☑ Enable AI Self-Healing            │
│   Base Prompt:                       │
│   "Fix {{errorType}} in package     │
│    {{packageName}}"                  │
│                                      │
│   Include in Context:                │
│   ☑ Workflow State                   │
│   ☑ Error Stack Trace                │
│   ☑ Previous Attempts                │
│                                      │
│ Signals:                             │
│   + Add Signal Handler               │
│                                      │
│ ☑ Auto Continue-as-New               │
│   Max Events: 10000                  │
└─────────────────────────────────────┘

Variables Panel:
┌─────────────────────────────────────┐
│ buildResult    (object)              │
│ attemptCount   (number) = 0          │
│ failedPackages (array)  = []         │
│                                      │
│ + Add Variable                       │
└─────────────────────────────────────┘

Node: Run Build
┌─────────────────────────────────────┐
│ Activity: runBuild                   │
│ Timeout: 10 minutes                  │
│                                      │
│ Retry:                               │
│ ☑ Enable (max: 3)                    │
│ ☑ Use AI Remediation                 │
│   Backoff: Exponential               │
│                                      │
│ Input:                               │
│   packagePath: input.packagePath     │
│   workspaceRoot: input.workspaceRoot │
└─────────────────────────────────────┘
```

### 2. Pattern-First Compiler

**Core Concept:** Map configuration → code patterns

```typescript
// src/lib/compiler/patterns/index.ts

interface Pattern {
  name: string;
  detect: (node: WorkflowNode, config: any) => boolean;
  generate: (node: WorkflowNode, config: any, context: CompilerContext) => string;
}

class WorkflowCompiler {
  patterns: Pattern[] = [
    AIRemediationPattern,
    ConcurrencyPattern,
    StateManagementPattern,
    ActivityProxyPattern,
    SignalHandlerPattern,
    ContinueAsNewPattern
  ];

  compile(definition: WorkflowDefinition): string {
    const context = this.buildContext(definition);

    // Generate imports
    const imports = this.generateImports(definition, context);

    // Generate patterns
    const patterns = this.applyPatterns(definition, context);

    // Generate main workflow function
    const workflowFunction = this.generateWorkflowFunction(
      definition,
      patterns,
      context
    );

    return [imports, patterns, workflowFunction].join('\n\n');
  }
}
```

### 3. Pattern Library

Each pattern is self-contained and generates code for a specific concern:

#### Pattern 1: AI Remediation

```typescript
// Detects: Any retry config with useAI: true
export const AIRemediationPattern: Pattern = {
  name: 'ai-remediation',

  detect: (node, config) => {
    return (
      (node.type === 'activity' && node.config.retry?.useAI) ||
      (node.type === 'loop' && config.aiRemediation.enabled)
    );
  },

  generate: (node, config, context) => {
    const promptTemplate = config.aiRemediation.basePrompt;
    const includeContext = config.aiRemediation.includeContext;

    return `
// AI Remediation for ${node.id}
async function handleFailureWithAI_${node.id}(
  error: Error,
  attemptNumber: number,
  state: any
): Promise<'RETRY' | 'FAIL'> {
  // Build context from config
  const context = {
    ${includeContext.errorDetails ? 'error: error.message,' : ''}
    ${includeContext.workflowState ? 'state: state,' : ''}
    ${includeContext.previousAttempts ? 'attemptNumber: attemptNumber,' : ''}
  };

  // Spawn coordinator workflow
  const action = await executeChild(CoordinatorWorkflow, {
    taskQueue: 'engine',
    workflowId: \`coordinator-\${workflowInfo().workflowId}-${node.id}-\${Date.now()}\`,
    args: [{
      problem: {
        type: '${node.type.toUpperCase()}_FAILURE',
        error: {
          message: error.message,
          stderr: error.stack || ''
        },
        context
      },
      agentRegistry: await loadAgentRegistry(),
      promptTemplate: \`${promptTemplate}\`,
      maxAttempts: 1
    }]
  });

  return action.decision === 'RETRY' ? 'RETRY' : 'FAIL';
}
`;
  }
};
```

#### Pattern 2: Concurrency Control

```typescript
// Detects: Loop with maxConcurrent > 1
export const ConcurrencyPattern: Pattern = {
  name: 'concurrency-control',

  detect: (node, config) => {
    return node.type === 'loop' && (node.config.maxConcurrent || 1) > 1;
  },

  generate: (node, config, context) => {
    const maxConcurrent = node.config.maxConcurrent;
    const condition = node.config.condition;
    const children = context.getLoopChildren(node.id);

    return `
// Concurrency control for ${node.id}
const activeBuilds_${node.id} = new Map<string, Promise<any>>();

while (${condition}) {
  // Find ready items (dependency-aware)
  const readyItems = findReadyItems(state);

  // Fill available slots
  const availableSlots = ${maxConcurrent} - activeBuilds_${node.id}.size;
  const batch = readyItems.slice(0, availableSlots);

  // Spawn children for batch
  for (const item of batch) {
    const childPromise = (async () => {
      ${children.map(child => context.generateNodeCode(child)).join('\n')}
      return item;
    })();

    activeBuilds_${node.id}.set(item.id, childPromise);
  }

  // Wait for any to complete
  if (activeBuilds_${node.id}.size > 0) {
    const completed = await Promise.race([...activeBuilds_${node.id}.values()]);
    activeBuilds_${node.id}.delete(completed.id);

    // Update state based on completion
    updateStateAfterCompletion(state, completed);
  }
}
`;
  }
};
```

#### Pattern 3: State Management

```typescript
// Detects: Variables panel has entries
export const StateManagementPattern: Pattern = {
  name: 'state-management',

  detect: (node, config) => {
    return config.variables && config.variables.length > 0;
  },

  generate: (node, config, context) => {
    const variables = config.variables;

    // Generate state type
    const stateType = `
interface WorkflowState {
  ${variables.map(v => `${v.name}: ${v.type};`).join('\n  ')}
}
`;

    // Generate initialization
    const initialization = `
const state: WorkflowState = {
  ${variables.map(v => `${v.name}: ${JSON.stringify(v.initialValue)},`).join('\n  ')}
};
`;

    return stateType + '\n' + initialization;
  }
};
```

#### Pattern 4: Activity Proxy

```typescript
// Detects: Activity nodes
export const ActivityProxyPattern: Pattern = {
  name: 'activity-proxy',

  detect: (node, config) => {
    return node.type === 'activity';
  },

  generate: (node, config, context) => {
    // Group activities by module
    const activities = context.getAllActivities();
    const byModule = groupByModule(activities);

    return Object.entries(byModule).map(([module, acts]) => `
// Activity proxies for ${module}
const { ${acts.map(a => a.activityName).join(', ')} } = proxyActivities<typeof ${module}>({
  startToCloseTimeout: '${acts[0].timeout || '10 minutes'}'
});
`).join('\n');
  }
};
```

#### Pattern 5: Signal Handlers

```typescript
// Detects: Workflow settings has signal handlers
export const SignalHandlerPattern: Pattern = {
  name: 'signal-handlers',

  detect: (node, config) => {
    return config.signals && config.signals.length > 0;
  },

  generate: (node, config, context) => {
    return config.signals.map(signal => `
// Signal handler: ${signal.name}
setHandler(defineSignal('${signal.name}'), (data: any) => {
  ${signal.action === 'update-state' ?
    `state.${signal.handler} = data;` :
    signal.action === 'queue' ?
    `signalQueue.push({ signal: '${signal.name}', data });` :
    `// Trigger action: ${signal.handler}`
  }
});
`).join('\n');
  }
};
```

#### Pattern 6: Continue-as-New

```typescript
// Detects: Auto continue-as-new enabled
export const ContinueAsNewPattern: Pattern = {
  name: 'continue-as-new',

  detect: (node, config) => {
    return config.longRunning?.autoContinueAsNew === true;
  },

  generate: (node, config, context) => {
    const maxEvents = config.longRunning.maxHistoryEvents || 10000;

    return `
// Continue-as-new check
if (workflowInfo().historyLength > ${maxEvents}) {
  await continueAsNew<typeof ${context.workflowName}>(state);
}
`;
  }
};
```

### 4. Compilation Flow

```typescript
// Example: Compiling a workflow with AI retry

// Input (from UI):
const definition = {
  settings: {
    aiRemediation: {
      enabled: true,
      basePrompt: "Fix {{errorType}} in {{packageName}}",
      includeContext: { workflowState: true, errorDetails: true }
    }
  },
  variables: [
    { name: 'buildResult', type: 'object', initialValue: {} },
    { name: 'attemptCount', type: 'number', initialValue: 0 }
  ],
  nodes: [
    { id: 'start', type: 'trigger' },
    {
      id: 'build',
      type: 'activity',
      data: {
        activityName: 'runBuild',
        timeout: '10 minutes',
        retry: { enabled: true, maxAttempts: 3, useAI: true }
      }
    },
    { id: 'end', type: 'trigger' }
  ],
  edges: [
    { source: 'start', target: 'build' },
    { source: 'build', target: 'end' }
  ]
};

// Output (generated TypeScript):
const generatedCode = `
import { proxyActivities, executeChild } from '@temporalio/workflow';
import type * as buildActivities from '../activities/build.activities';
import { CoordinatorWorkflow } from './coordinator.workflow';

const { runBuild } = proxyActivities<typeof buildActivities>({
  startToCloseTimeout: '10 minutes'
});

// State Management Pattern
interface WorkflowState {
  buildResult: object;
  attemptCount: number;
}

// AI Remediation Pattern
async function handleFailureWithAI_build(
  error: Error,
  attemptNumber: number,
  state: any
): Promise<'RETRY' | 'FAIL'> {
  const context = {
    error: error.message,
    state: state,
  };

  const action = await executeChild(CoordinatorWorkflow, {
    taskQueue: 'engine',
    args: [{
      problem: {
        type: 'ACTIVITY_FAILURE',
        error: { message: error.message },
        context
      },
      promptTemplate: 'Fix {{errorType}} in {{packageName}}'
    }]
  });

  return action.decision === 'RETRY' ? 'RETRY' : 'FAIL';
}

export async function GeneratedWorkflow(input: any): Promise<void> {
  const state: WorkflowState = {
    buildResult: {},
    attemptCount: 0
  };

  // Activity: runBuild with AI retry
  let buildSuccess = false;
  while (!buildSuccess && state.attemptCount < 3) {
    try {
      state.buildResult = await runBuild({
        packagePath: input.packagePath
      });
      buildSuccess = true;
    } catch (error) {
      const decision = await handleFailureWithAI_build(
        error as Error,
        state.attemptCount,
        state
      );

      if (decision === 'RETRY') {
        state.attemptCount++;
        continue;
      } else {
        throw error;
      }
    }
  }
}
`;
```

## Key Architectural Decisions (Revised)

### Decision 1: Pattern Library over Explicit Nodes

**Decision:** Use configuration panels + pattern library instead of specialized node types

**Rationale:**
- ✅ Simpler UI (5 nodes vs 10+ nodes)
- ✅ More maintainable (patterns are isolated)
- ✅ Easier to extend (add patterns, not UI components)
- ✅ Better UX (familiar configuration panels)

### Decision 2: Smart Defaults

**Decision:** Enable AI remediation by default, auto-configure based on context

**Rationale:**
- ✅ Reduces cognitive load
- ✅ "Pit of success" - good practices by default
- ✅ Advanced users can override

### Decision 3: Configuration over Code

**Decision:** Everything configurable through panels, no code editing in UI

**Rationale:**
- ✅ Accessible to non-developers
- ✅ Validates input automatically
- ✅ Type-safe by default
- ✅ Can still export/view generated code

## Complexity Comparison

| Feature | Original Plan | Revised | Savings |
|---------|--------------|---------|---------|
| Node Types | 10+ | 5 | **50%** |
| UI Components | 20+ | 8 | **60%** |
| Backend Complexity | 9/10 | 5/10 | **44%** |
| Frontend Complexity | 8/10 | 4/10 | **50%** |
| Timeline | 10-12 months | 6-8 months | **40%** |
| Team Size | 6.5 FTEs | 4 FTEs | **38%** |

## Implementation Priorities

### Phase 1: Core Patterns (6-8 weeks)
1. Activity proxy pattern
2. State management pattern
3. Basic retry pattern
4. **Deliverable:** Simple workflow with retry

### Phase 2: Advanced Patterns (6-8 weeks)
5. AI remediation pattern
6. Concurrency control pattern
7. Conditional branching
8. **Deliverable:** PackageBuild workflow works

### Phase 3: Production (8-10 weeks)
9. Signal handler pattern
10. Continue-as-new pattern
11. Child workflow pattern
12. **Deliverable:** Full PackageBuilder system

## Next Steps

See revised implementation guides:
- SIMPLIFIED-PHASE-1.md - Core patterns implementation
- PATTERN-LIBRARY.md - Detailed pattern specifications
- QUICK-START-REVISED.md - Get started with pattern approach
