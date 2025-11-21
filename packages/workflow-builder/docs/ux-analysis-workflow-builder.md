# UI/UX Gap Analysis: Production Workflows vs Workflow Builder

**Date:** 2025-11-19
**Analyst:** ArchitectUX
**Purpose:** Identify missing UI components, visual patterns, and interaction models needed to represent and edit complex production Temporal workflows

---

## Executive Summary

The workflow builder UI has **foundational node types** (Phase, Condition, Retry, StateVariable, ChildWorkflow, Signal) but lacks the **visual representation patterns**, **interaction models**, and **property configuration interfaces** needed to make complex workflows **understandable and editable**.

**Critical Gap:** Current UI can display nodes but cannot represent:
- While loops with dynamic concurrency
- Retry coordination with agent spawning
- Conditional pre-flight logic with early exits
- State flow and mutation tracking
- Complex child workflow orchestration patterns

**User Impact:** Technical users can read the workflow visually but cannot confidently edit or extend complex patterns. Non-technical users cannot understand workflow logic at all.

---

## 1. Missing Node Types and Visual Patterns

### 1.1 Loop/Iteration Nodes ⚠️ CRITICAL GAP

**Current State:** No loop node type exists
**Required Pattern:** `while hasUnbuiltPackages()` loops in PackageBuilderWorkflow

**Why Critical:**
- Production workflows use dynamic loops with Promise.race() for concurrency
- Loop termination conditions are non-trivial (dependency satisfaction)
- Loop body spawns child workflows and updates state

**Visual Requirements:**

```
┌─────────────────────────────────────────┐
│  🔁 While Loop                          │
│  ────────────────────────────────────  │
│  Condition: hasUnbuiltPackages()       │
│  ────────────────────────────────────  │
│  ⚡ Concurrent (max 4)                  │
│  📊 Promise.race() completion          │
│                                         │
│  [Loop Body] ──────────────────────────┤
│    ├─ Find ready packages              │
│    ├─ Spawn child workflows            │
│    └─ Wait for any completion          │
└─────────────────────────────────────────┘
     │ (continue)     │ (exit)
     ↓                ↓
```

**Interaction Challenges:**
- How to visually group loop body nodes?
- How to show iteration vs exit paths?
- How to represent state mutations within loop?
- How to show max concurrency limits visually?

**Recommended Solution:**
- Loop node acts as **container/grouping node** with visual boundary
- Collapse/expand to show/hide loop body
- Visual indicator of concurrent execution (parallel bars icon)
- Exit condition shown prominently with preview

**Property Panel Needs:**
```typescript
{
  loopType: 'while' | 'for' | 'forEach',
  condition: {
    expression: string,
    variables: string[], // Which state variables to check
  },
  concurrency: {
    enabled: boolean,
    max: number,
    strategy: 'race' | 'all' | 'allSettled',
  },
  iterationConfig: {
    batchSize?: number,
    breakOn?: 'error' | 'condition',
  }
}
```

---

### 1.2 Multi-Path Conditional Flow ⚠️ HIGH PRIORITY

**Current State:** ConditionNode exists but only handles single true/false branch
**Required Pattern:** Nested conditionals in PackageBuildWorkflow pre-flight logic

**Why Critical:**
- Pre-flight validation has 3+ conditional paths:
  - Code exists → Published → Upgrade plan → Audit upgrade
  - Code exists → Not published → Audit state
  - Code doesn't exist → Fresh scaffold
- Early exit paths need clear visual distinction

**Visual Requirements:**

```
        ┌─────────────────────┐
        │  Code Exists?       │
        └────┬──────────┬─────┘
           TRUE      FALSE
             ↓          ↓
    ┌────────────┐   [Fresh Scaffold]
    │ Published? │
    └─┬────────┬─┘
    TRUE    FALSE
      ↓        ↓
  [Check   [Audit
  Upgrade]  State]
```

**Current Limitation:**
- Diamond-shaped ConditionNode works for binary decisions
- Nested conditionals create visual spaghetti
- Hard to trace "what happens if X AND Y"

**Recommended Solution:**
- **Decision Tree View Mode**: Collapse nested conditionals into single decision tree visualization
- **Path Highlighting**: Hover over output to highlight entire conditional path
- **Scenario Testing**: Click through "what if" scenarios to see path lighting up

**Property Panel Enhancement:**
```typescript
{
  decisionType: 'binary' | 'multi-way' | 'switch',
  conditions: Array<{
    expression: string,
    label: string,
    color: string, // For path highlighting
  }>,
  defaultPath?: string,
  visualization: 'diamond' | 'decision-tree' | 'flowchart',
}
```

---

### 1.3 Coordinator Retry Pattern ⚠️ CRITICAL GAP

**Current State:** RetryNode exists but is generic
**Required Pattern:** Coordinator-driven retry with agent spawning

**Why Critical:**
- Production workflow spawns CoordinatorWorkflow child on failures
- Coordinator analyzes error, selects agent, applies fix
- Parent workflow retries activity after coordinator completes
- This is a **compound pattern** not a simple retry

**Visual Requirements:**

```
┌─────────────────────────────────────────────────────┐
│  🔄 Coordinator Retry Loop                          │
│  ─────────────────────────────────────────────────  │
│  Max Attempts: 3                                    │
│  Retry On: Build Failure                           │
│  ─────────────────────────────────────────────────  │
│  On Failure:                                        │
│    1. Spawn CoordinatorWorkflow (executeChild)      │
│    2. Coordinator analyzes error                    │
│    3. Coordinator selects fix agent                 │
│    4. Agent applies fix                             │
│    5. Return RETRY decision                         │
│    6. Parent retries activity                       │
│  ─────────────────────────────────────────────────  │
│  Decision Handling:                                 │
│    - RETRY → Loop continues                         │
│    - ESCALATE → Throw error                         │
│    - RESOLVED → Continue                            │
└─────────────────────────────────────────────────────┘
```

**Current Limitation:**
- RetryNode shows max attempts and backoff
- Doesn't show **what happens during retry**
- No way to represent coordinator workflow spawning
- No visualization of agent selection logic

**Recommended Solution:**
- **Compound Retry Node** with expandable "On Failure" section
- Shows mini-workflow of coordinator spawning
- Visual indicator that this is executeChild not startChild
- Decision tree for coordinator action handling

**Property Panel Critical Fields:**
```typescript
{
  retryType: 'simple' | 'coordinator-driven' | 'agent-driven',
  maxAttempts: number,
  retryOn: 'failure' | 'error' | 'condition',

  // Coordinator-specific
  coordinatorConfig?: {
    workflowType: 'CoordinatorWorkflow',
    taskQueue: string,
    executionType: 'executeChild', // vs startChild
    problemMapping: {
      type: string, // 'BUILD_FAILURE', 'TEST_FAILURE', etc.
      contextFields: string[], // Which variables to pass
    },
    decisionHandling: {
      RETRY: 'continue-loop',
      ESCALATE: 'throw-error',
      RESOLVED: 'break-loop',
    },
  },

  // Simple retry
  backoff?: {
    type: 'none' | 'linear' | 'exponential',
    initialInterval?: string,
    maxInterval?: string,
  }
}
```

---

### 1.4 State Variable Mutation Tracking ⚠️ HIGH PRIORITY

**Current State:** StateVariableNode exists but is standalone
**Required Pattern:** State flows through workflow with mutations

**Why Critical:**
- `state` object is initialized, then mutated across phases
- `state.phase` changes: PLAN → BUILD → VERIFY → COMPLETE
- `state.completedPackages` grows as child workflows complete
- Visual tracking of state flow is essential for debugging

**Visual Requirements:**

```
[Initialize State]
    state = {
      phase: 'PLAN',
      packages: [...],
      completedPackages: [],
      failedPackages: []
    }
    ↓
[Phase: PLAN]
    state.phase = 'BUILD'
    ↓
[Build Loop]
    state.completedPackages.push(...)
    state.failedPackages.push(...)
    ↓
[Phase: VERIFY]
    state.phase = 'VERIFY'
```

**Current Limitation:**
- No way to visualize which nodes READ vs WRITE state
- No tracking of state variable lifecycle
- No visual flow of state mutations

**Recommended Solution:**
- **State Flow Overlay**: Toggle to highlight state variable paths
- **Read/Write Badges**: Visual indicator on nodes that read or mutate state
- **State Inspector**: Side panel showing current state shape at any workflow point
- **Mutation Timeline**: Show state mutations in execution order

**Visual Indicators:**
```
┌──────────────────────┐
│  Initialize State    │
│  ─────────────────  │
│  📝 WRITE: state     │
└──────────────────────┘
         ↓
┌──────────────────────┐
│  Build Loop          │
│  ─────────────────  │
│  📖 READ: state      │
│  📝 WRITE: state     │
└──────────────────────┘
```

**Property Panel Enhancement:**
```typescript
{
  variableName: string,
  operation: 'declare' | 'set' | 'push' | 'increment' | 'custom',
  scope: 'workflow' | 'phase' | 'block',

  // For tracking
  mutations: Array<{
    nodeId: string,
    operation: string,
    line: number, // In generated code
  }>,

  // For visualization
  dataType: 'object' | 'array' | 'primitive',
  schema?: object, // JSON Schema for validation
}
```

---

### 1.5 Child Workflow Spawn Patterns ⚠️ CRITICAL GAP

**Current State:** ChildWorkflowNode exists
**Required Pattern:** Differentiate startChild vs executeChild

**Why Critical:**
- `startChild` (fire-and-forget): Build loop spawns packages, waits with Promise.race()
- `executeChild` (blocking): Coordinator workflow blocks parent until decision

**Visual Requirements:**

**StartChild Pattern (Non-blocking):**
```
┌─────────────────────────────────────┐
│  🚀 Start Child Workflow            │
│  ───────────────────────────────   │
│  Type: PackageBuildWorkflow         │
│  Execution: startChild (async)      │
│  ───────────────────────────────   │
│  Returns: WorkflowHandle            │
│  Parent: Continues immediately      │
│                                     │
│  Completion tracked in loop        │
└─────────────────────────────────────┘
```

**ExecuteChild Pattern (Blocking):**
```
┌─────────────────────────────────────┐
│  ⏸️ Execute Child Workflow          │
│  ───────────────────────────────   │
│  Type: CoordinatorWorkflow          │
│  Execution: executeChild (blocking) │
│  ───────────────────────────────   │
│  Returns: Action decision           │
│  Parent: Waits for completion       │
│                                     │
│  ⚠️ Blocks until child finishes    │
└─────────────────────────────────────┘
```

**Current Limitation:**
- Single ChildWorkflowNode doesn't distinguish execution semantics
- Critical difference for understanding concurrency
- Input mapping complexity not visualized

**Recommended Solution:**
- **Visual Distinction**: Different icons/colors for start vs execute
- **Blocking Indicator**: Visual clock/wait indicator for executeChild
- **Input Mapping Editor**: Visual mapper for complex input transformations
- **Expected Output Indicator**: Show what parent expects from child

**Property Panel Critical Fields:**
```typescript
{
  workflowType: string,
  taskQueue: string,
  executionType: 'startChild' | 'executeChild',

  // Visual indicators
  blocking: boolean, // Derived from executionType
  concurrencyImpact: 'none' | 'blocks-slot' | 'blocks-parent',

  // Input mapping
  inputMapping: {
    [param: string]: {
      source: 'input' | 'state' | 'activity-result' | 'literal',
      path: string,
      transform?: string, // JavaScript expression
    },
  },

  // Output handling
  outputMapping?: {
    [resultField: string]: {
      target: 'state' | 'variable',
      path: string,
    },
  },

  // Completion tracking (for startChild)
  completionTracking?: {
    strategy: 'race' | 'all' | 'allSettled',
    resultHandling: string,
  },
}
```

---

## 2. Visual Representation Challenges

### 2.1 Phase Grouping and Visual Hierarchy ⚠️ HIGH PRIORITY

**Current State:** PhaseNode exists but acts as single node
**Required Pattern:** Phases contain multiple nodes (PLAN phase has verify-plans activity)

**Why Critical:**
- Phases are logical containers, not single steps
- Visual grouping shows scope and isolation
- Sequential vs concurrent phases have different execution semantics

**Visual Requirements:**

```
╔═══════════════════════════════════════════════════════╗
║  Phase: BUILD                                         ║
║  ─────────────────────────────────────────────────   ║
║  Execution: Concurrent (max 4)                        ║
╠═══════════════════════════════════════════════════════╣
║                                                       ║
║   ┌─────────────┐                                    ║
║   │ Build Loop  │──────┬───────────────────┐         ║
║   └─────────────┘      │                   │         ║
║         │              ↓                   ↓         ║
║         │      ┌───────────────┐   ┌───────────────┐║
║         │      │ Spawn Child 1 │   │ Spawn Child 2 │║
║         │      └───────────────┘   └───────────────┘║
║         │              │                   │         ║
║         └──────────────┴───────────────────┘         ║
║                        ↓                             ║
║              ┌──────────────────┐                    ║
║              │ Handle Completion│                    ║
║              └──────────────────┘                    ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
```

**Current Limitation:**
- PhaseNode is just a labeled node, not a container
- No visual grouping of phase contents
- Can't expand/collapse phases
- No scope isolation visualization

**Recommended Solution:**
- **Container Node Type**: Phase acts as expandable container
- **Dashed Border**: Visual boundary for phase scope
- **Collapse/Expand**: Hide internal nodes when collapsed
- **Phase Toolbar**: Mini-toolbar for phase-level operations
- **Sequential/Concurrent Visual**: Different border styles

**Interaction Patterns:**
- Double-click phase to expand/collapse
- Drag nodes into phase to add to group
- Phase header shows summary (N nodes, execution mode)
- Nodes inherit phase styling (color accent)

---

### 2.2 Conditional Path Visualization ⚠️ HIGH PRIORITY

**Current State:** True/false handles exist on ConditionNode
**Required Pattern:** Multi-level nested conditionals with early exits

**Why Critical:**
- PackageBuildWorkflow has 3-level deep conditional nesting
- True path leads to more conditions
- False path leads to different flow
- Early exit paths (already published) need visual distinction

**Visual Requirements:**

**Path Highlighting on Hover:**
```
[Check Exists] ──TRUE──> [Check Published] ──TRUE──> [Check Upgrade]
                                           └─FALSE─> [Audit State]
               └─FALSE─> [Fresh Scaffold]
```

**Scenario Testing Mode:**
```
┌────────────────────────────────────────┐
│  Scenario Simulator                    │
│  ────────────────────────────────────  │
│  Conditions:                           │
│  ☑ Code exists                         │
│  ☑ Published                           │
│  ☐ Upgrade plan                        │
│  ────────────────────────────────────  │
│  Path Taken:                           │
│  1. Check Exists → TRUE                │
│  2. Check Published → TRUE             │
│  3. Check Upgrade → FALSE              │
│  4. Update MCP Status                  │
│  5. Early Exit                         │
│  ────────────────────────────────────  │
│  [Run Simulation]                      │
└────────────────────────────────────────┘
```

**Recommended Solution:**
- **Path Highlighting**: Hover over condition output → entire downstream path lights up
- **Scenario Mode**: Set condition values, see which path executes
- **Path Annotations**: Label paths with condition summary
- **Early Exit Badges**: Visual badge on nodes that end workflow early
- **Path Statistics**: Show which paths are most common (from execution history)

---

### 2.3 Loop Structure with Concurrency ⚠️ CRITICAL GAP

**Current State:** No loop visualization
**Required Pattern:** While loop with dynamic concurrent child spawning

**Why Critical:**
- Build loop is the core orchestration pattern
- Concurrency is limited by maxConcurrent
- Promise.race() completion is complex pattern
- State mutations happen inside loop

**Visual Requirements:**

```
╔═══════════════════════════════════════════════════╗
║  🔁 While hasUnbuiltPackages()                    ║
║  ───────────────────────────────────────────────  ║
║  Concurrency: 4 slots (Promise.race)              ║
╠═══════════════════════════════════════════════════╣
║  Loop Body:                                       ║
║                                                   ║
║  1. Find ready packages (deps satisfied)          ║
║  2. Fill available slots (max 4 concurrent)       ║
║  3. Spawn child workflows (startChild)            ║
║  4. Wait for ANY completion (Promise.race)        ║
║  5. Update state (completed/failed)               ║
║  6. Check condition → continue or exit            ║
║                                                   ║
║  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐             ║
║  │Slot1│  │Slot2│  │Slot3│  │Slot4│  ← Active   ║
║  └─────┘  └─────┘  └─────┘  └─────┘             ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
     │ Continue                  │ Exit
     ↓ (loop)                    ↓
```

**Recommended Solution:**
- **Concurrency Visualizer**: Show slots as boxes (filled/empty)
- **Loop Iteration Counter**: Show current iteration count
- **State Mutation Preview**: Show state changes per iteration
- **Animated Execution**: During runtime, show active slots
- **Performance Metrics**: Show avg iteration time, throughput

**Interaction Patterns:**
- Click "Simulate Loop" to step through iterations
- Show which packages are in which slots
- Visualize dependency graph satisfaction

---

### 2.4 Retry Loop with Backoff Visualization ⚠️ MEDIUM PRIORITY

**Current State:** RetryNode shows config
**Required Pattern:** Show retry attempts, backoff timing, coordinator spawning

**Visual Requirements:**

```
┌──────────────────────────────────────────────┐
│  🔄 Retry with Coordinator                   │
│  ──────────────────────────────────────────  │
│  Attempt 1: FAIL → Coordinator → Fix         │
│    Backoff: 0s                               │
│                                              │
│  Attempt 2: FAIL → Coordinator → Fix         │
│    Backoff: 1s (exponential)                 │
│                                              │
│  Attempt 3: FAIL → Coordinator → Escalate    │
│    Backoff: 2s (exponential)                 │
│  ──────────────────────────────────────────  │
│  Final Result: ESCALATE → Throw Error        │
└──────────────────────────────────────────────┘
```

**Recommended Solution:**
- **Timeline View**: Show attempts on timeline with backoff intervals
- **Attempt Details**: Expand to see coordinator actions per attempt
- **Backoff Visualization**: Visual timer/countdown
- **Success/Failure Indicators**: Color-coded attempt results

---

### 2.5 Signal Handler Representation ⚠️ MEDIUM PRIORITY

**Current State:** SignalNode exists
**Required Pattern:** Signal handlers in ContinuousBuilderWorkflow (newPackages, pause, resume, drain, emergencyStop)

**Why Critical:**
- Multiple signal types affect workflow behavior
- Signals can arrive at any time
- Need to show signal handling logic

**Visual Requirements:**

```
┌─────────────────────────────────────────┐
│  📡 Signal Handlers                     │
│  ─────────────────────────────────────  │
│  • newPackages → Enqueue packages       │
│  • pause → Set paused=true              │
│  • resume → Set paused=false            │
│  • drain → Stop accepting new packages  │
│  • emergencyStop → Terminate workflow   │
│  ─────────────────────────────────────  │
│  Active Listeners: 5                    │
└─────────────────────────────────────────┘
```

**Recommended Solution:**
- **Signal Handler List**: Show all registered signals
- **Handler Logic Preview**: Click to see signal handler code
- **Signal Flow**: Show where signals affect workflow state
- **Test Signal**: Send test signals to see workflow response

---

## 3. Property Panel Enhancements

### 3.1 Activity Configuration ⚠️ HIGH PRIORITY

**Current State:** Generic JSON config editor
**Required Pattern:** Activity proxy with timeouts, retry policies

**Why Critical:**
- Activities have complex timeout configurations
- Retry policies are activity-specific
- Error handling varies by activity type

**Required Property Panel:**

```
┌─────────────────────────────────────────────┐
│  Activity Configuration                     │
│  ─────────────────────────────────────────  │
│  Activity Name:                             │
│  [buildDependencyGraph        ▼]            │
│  ─────────────────────────────────────────  │
│  Timeouts:                                  │
│  ☑ Start to Close: [5 minutes ▼]            │
│  ☐ Schedule to Close:                       │
│  ☐ Schedule to Start:                       │
│  ☐ Heartbeat:                               │
│  ─────────────────────────────────────────  │
│  Retry Policy:                              │
│  Max Attempts: [3       ]                   │
│  Initial Interval: [1s       ]              │
│  Backoff: [2.0     ] (multiplier)           │
│  Max Interval: [100s     ]                  │
│  ☑ Non-retryable errors:                    │
│    - ValidationError                        │
│    - PermissionDenied                       │
│  ─────────────────────────────────────────  │
│  Input Mapping:                             │
│  auditReportPath: [input.auditReportPath]   │
│  ─────────────────────────────────────────  │
│  [Advanced Options...]                      │
└─────────────────────────────────────────────┘
```

**Key Features:**
- **Activity Selector**: Dropdown of available activities from registry
- **Timeout Presets**: Common timeout patterns (30s, 5min, 30min)
- **Retry Configurator**: Visual retry policy builder
- **Input Mapper**: Visual variable mapping
- **Schema Validation**: Validate inputs against activity signature

---

### 3.2 Child Workflow Configuration ⚠️ CRITICAL GAP

**Current State:** Generic config
**Required Pattern:** Complex input mapping, execution type selection

**Required Property Panel:**

```
┌─────────────────────────────────────────────┐
│  Child Workflow Configuration               │
│  ─────────────────────────────────────────  │
│  Workflow Type:                             │
│  [PackageBuildWorkflow  ▼]                  │
│  ─────────────────────────────────────────  │
│  Execution Type:                            │
│  ○ startChild (async, non-blocking)         │
│  ● executeChild (blocking, waits)           │
│  ─────────────────────────────────────────  │
│  Workflow ID Pattern:                       │
│  [build-${buildId}-${pkg.name}]             │
│  ─────────────────────────────────────────  │
│  Task Queue:                                │
│  [engine              ▼]                    │
│  ─────────────────────────────────────────  │
│  Input Mapping:                             │
│  packageName    ← pkg.name                  │
│  packagePath    ← pkg.path                  │
│  planPath       ← pkg.planPath              │
│  category       ← pkg.category              │
│  dependencies   ← pkg.dependencies          │
│  workspaceRoot  ← input.workspaceRoot       │
│  config         ← input.config              │
│  ─────────────────────────────────────────  │
│  [+ Add Input Mapping]                      │
│  ─────────────────────────────────────────  │
│  Output Handling:                           │
│  ☑ Store result in: [childResult]           │
│  ☑ Update state on completion               │
│  ─────────────────────────────────────────  │
│  [Advanced Options...]                      │
└─────────────────────────────────────────────┘
```

**Key Features:**
- **Execution Type Toggle**: Clear explanation of start vs execute
- **Input Mapping Editor**: Drag-drop variable mapping
- **Workflow ID Generator**: Template with variable interpolation
- **Output Mapping**: Configure result storage

---

### 3.3 Condition Configuration ⚠️ HIGH PRIORITY

**Current State:** Raw JavaScript expression
**Required Pattern:** Visual condition builder for complex logic

**Required Property Panel:**

```
┌─────────────────────────────────────────────┐
│  Condition Configuration                    │
│  ─────────────────────────────────────────  │
│  Condition Type:                            │
│  ● Expression (JavaScript)                  │
│  ○ Visual Builder                           │
│  ○ Multi-way Switch                         │
│  ─────────────────────────────────────────  │
│  Expression:                                │
│  ┌───────────────────────────────────────┐ │
│  │ result.codeExists === true            │ │
│  └───────────────────────────────────────┘ │
│  ─────────────────────────────────────────  │
│  Available Variables:                       │
│  • result (object)                          │
│  • state (object)                           │
│  • input (object)                           │
│  ─────────────────────────────────────────  │
│  True Path Label: [Code Exists]             │
│  False Path Label: [No Code]                │
│  ─────────────────────────────────────────  │
│  [Test Expression...]                       │
└─────────────────────────────────────────────┘
```

**Visual Builder Mode:**
```
┌─────────────────────────────────────────────┐
│  Visual Condition Builder                   │
│  ─────────────────────────────────────────  │
│  [result.codeExists ▼] [equals ▼] [true ▼] │
│  ─────────────────────────────────────────  │
│  [+ Add AND Condition]                      │
│  [+ Add OR Condition]                       │
└─────────────────────────────────────────────┘
```

**Key Features:**
- **Expression Editor**: Syntax highlighting, autocomplete
- **Visual Builder**: Drag-drop condition builder for non-technical users
- **Path Labeling**: Custom labels for condition outputs
- **Expression Tester**: Test with sample data

---

### 3.4 State Variable Configuration ⚠️ HIGH PRIORITY

**Current State:** Generic JSON config
**Required Pattern:** Scope management, mutation tracking, schema validation

**Required Property Panel:**

```
┌─────────────────────────────────────────────┐
│  State Variable Configuration               │
│  ─────────────────────────────────────────  │
│  Variable Name:                             │
│  [state                ]                    │
│  ─────────────────────────────────────────  │
│  Operation:                                 │
│  ● Declare (initialize)                     │
│  ○ Set (assign value)                       │
│  ○ Push (array append)                      │
│  ○ Increment (numeric)                      │
│  ○ Custom (JavaScript)                      │
│  ─────────────────────────────────────────  │
│  Scope:                                     │
│  ● Workflow (entire workflow)               │
│  ○ Phase (current phase only)               │
│  ○ Block (loop/retry block)                 │
│  ─────────────────────────────────────────  │
│  Initial Value:                             │
│  ┌───────────────────────────────────────┐ │
│  │ {                                     │ │
│  │   phase: 'PLAN',                      │ │
│  │   packages: [],                       │ │
│  │   completedPackages: [],              │ │
│  │   failedPackages: []                  │ │
│  │ }                                     │ │
│  └───────────────────────────────────────┘ │
│  ─────────────────────────────────────────  │
│  Schema Validation:                         │
│  ☑ Enable type checking                     │
│  [Load JSON Schema...]                      │
│  ─────────────────────────────────────────  │
│  Mutation Tracking:                         │
│  Read by: 3 nodes                           │
│  Written by: 5 nodes                        │
│  [Show Usage Map]                           │
└─────────────────────────────────────────────┘
```

**Key Features:**
- **Operation Selector**: Common mutation patterns
- **Scope Management**: Visual scope hierarchy
- **Schema Validation**: JSON Schema support
- **Usage Tracking**: Show all nodes that read/write variable

---

### 3.5 Retry Configuration ⚠️ CRITICAL GAP

**Current State:** Basic retry fields
**Required Pattern:** Coordinator-driven retry with agent spawning

**Required Property Panel:**

```
┌─────────────────────────────────────────────┐
│  Retry Configuration                        │
│  ─────────────────────────────────────────  │
│  Retry Type:                                │
│  ○ Simple (automatic retry)                 │
│  ● Coordinator-Driven (agent fix)           │
│  ○ Agent-Driven (direct spawn)              │
│  ─────────────────────────────────────────  │
│  Max Attempts: [3       ]                   │
│  Retry On: [failure ▼]                      │
│  ─────────────────────────────────────────  │
│  Coordinator Configuration:                 │
│  Workflow: [CoordinatorWorkflow  ▼]         │
│  Task Queue: [engine              ▼]        │
│  Execution: [executeChild (blocking) ▼]     │
│  ─────────────────────────────────────────  │
│  Problem Mapping:                           │
│  Type: [BUILD_FAILURE    ▼]                 │
│  Context Fields:                            │
│  ☑ packageName ← input.packageName          │
│  ☑ packagePath ← input.packagePath          │
│  ☑ planPath ← input.planPath                │
│  ☑ phase ← 'build'                          │
│  ☑ attemptNumber ← (auto)                   │
│  ─────────────────────────────────────────  │
│  Decision Handling:                         │
│  RETRY → Continue loop                      │
│  ESCALATE → Throw error                     │
│  RESOLVED → Break loop                      │
│  ─────────────────────────────────────────  │
│  Backoff Strategy:                          │
│  Type: [exponential ▼]                      │
│  Initial: [1s       ]                       │
│  Multiplier: [2.0     ]                     │
│  Max: [100s     ]                           │
└─────────────────────────────────────────────┘
```

**Key Features:**
- **Retry Type Selector**: Clear distinction between simple/coordinator/agent
- **Coordinator Config**: Full coordinator workflow configuration
- **Problem Mapper**: Map error context to coordinator input
- **Decision Handler**: Configure what happens for each coordinator decision
- **Backoff Visualizer**: Timeline preview of retry attempts

---

## 4. Canvas Interaction Patterns

### 4.1 Node Grouping and Container Management ⚠️ HIGH PRIORITY

**Current State:** Nodes are independent
**Required Pattern:** Phases contain nodes, loops contain nodes

**Why Critical:**
- Phases and loops are containers, not single operations
- Visual grouping provides scope understanding
- Collapsed containers reduce visual clutter

**Recommended Interactions:**

**Creating Containers:**
- Drag phase/loop node from palette
- Click "Convert to Container" on existing node
- Select multiple nodes → Right-click → "Group in Phase"

**Managing Container Contents:**
- Drag nodes into container boundary to add
- Drag nodes out of container to remove
- Double-click container header to expand/collapse
- Container resize handles for manual sizing

**Visual Indicators:**
```
┌─────────────────────────────────────┐
│  Phase: BUILD [▼ Collapse]          │  ← Container Header
├─────────────────────────────────────┤
│  ┌───────────┐    ┌───────────┐    │
│  │  Node 1   │    │  Node 2   │    │  ← Container Contents
│  └───────────┘    └───────────┘    │
│                                     │
└─────────────────────────────────────┘
```

**Collapsed State:**
```
┌─────────────────────────────────────┐
│  Phase: BUILD [▶ Expand]            │
│  Contains: 5 nodes                  │
└─────────────────────────────────────┘
```

---

### 4.2 Edge Connection Rules ⚠️ HIGH PRIORITY

**Current State:** Free-form edge connections
**Required Pattern:** Type-safe connections with validation

**Why Critical:**
- Condition outputs must connect to different paths
- Retry loops must connect back to retried node
- Child workflow handles must connect to completion handler

**Recommended Validation:**

**Condition Node:**
- True/false handles must connect to different targets
- Warning if only one path is connected
- Error if no paths are connected

**Retry Node:**
- Must wrap target activity/agent/child-workflow
- Connections flow into retry wrapper, out to continuation
- Visual indicator of wrapped node

**Loop Node:**
- Loop body must have exit condition path
- Warning if loop has no exit mechanism
- Validation of state mutations within loop

**Visual Feedback:**
```
Valid Connection:
[Condition] ──TRUE──> [Activity]
           └─FALSE─> [Other Path]
           ✓ Both paths connected

Invalid Connection:
[Condition] ──TRUE──> [Activity]
           └─FALSE─> (disconnected)
           ⚠️ False path not connected
```

---

### 4.3 Path Highlighting and Navigation ⚠️ MEDIUM PRIORITY

**Current State:** Static canvas view
**Required Pattern:** Interactive path exploration

**Why Critical:**
- Complex workflows have many paths
- Hard to trace execution flow visually
- Conditional logic creates branching complexity

**Recommended Interactions:**

**Hover Highlighting:**
- Hover over node → Highlight upstream and downstream connected nodes
- Hover over edge → Highlight entire path
- Hover over condition output → Highlight path taken for that condition

**Path Tracing:**
- Click node → "Trace to Start" button → Highlight path from start
- Click node → "Trace to End" button → Highlight path to completion
- Multi-path highlight for nodes reachable via different conditions

**Scenario Mode:**
- Toolbar button "Scenario Tester"
- Set condition values in side panel
- Canvas highlights path that would execute
- Shows state mutations along path

**Visual Style:**
```
Normal State:
[Node A] ──> [Node B] ──> [Node C]
  (gray)      (gray)       (gray)

Hover Node B:
[Node A] ──> [Node B] ──> [Node C]
 (blue)     (bright blue)  (blue)
            ↑ Hovered

Scenario Highlight:
[Node A] ──> [Node B] ──> [Node C]
 (green)     (green)      (gray)
← Path taken              ← Not reached
```

---

### 4.4 Multi-Level Zoom and Detail ⚠️ MEDIUM PRIORITY

**Current State:** Single zoom level
**Required Pattern:** Zoom for overview vs detail editing

**Why Critical:**
- Complex workflows are large
- Need overview to understand structure
- Need detail to edit configurations

**Recommended Zoom Levels:**

**Level 1: Overview (10-25%)**
- Show only phase containers (collapsed)
- Hide node labels, show only icons
- Focus on overall workflow structure
- Good for understanding phases

**Level 2: Structure (25-75%)**
- Show phase containers and major nodes
- Show abbreviated labels
- Good for understanding flow logic
- Default zoom level

**Level 3: Detail (75-100%)**
- Show all nodes with full labels
- Show configuration previews
- Good for editing
- Current implementation level

**Level 4: Configuration (100%+)**
- Show node internals
- Show input/output details
- Show state variable schemas
- Best for detailed configuration

**Visual Transition:**
```
Overview: [P1] → [P2] → [P3]

Structure:
┌────────┐   ┌────────┐   ┌────────┐
│ Phase1 │──>│ Phase2 │──>│ Phase3 │
│  (5)   │   │  (8)   │   │  (3)   │
└────────┘   └────────┘   └────────┘

Detail:
┌───────────────────┐
│  Phase: BUILD     │
│  ──────────────  │
│  [Activity 1]     │
│  [Activity 2]     │
│  [Condition]      │
│  ...              │
└───────────────────┘
```

---

### 4.5 Execution State Visualization ⚠️ CRITICAL GAP

**Current State:** Static workflow definition
**Required Pattern:** Show runtime execution state

**Why Critical:**
- Developers need to debug workflow executions
- Understanding where failure occurred is critical
- State evolution needs visualization

**Recommended Visualization:**

**Execution Overlay Mode:**
- Toggle "Show Execution" in toolbar
- Select execution from list (by workflow ID)
- Canvas shows execution state overlaid on definition

**Node State Indicators:**
```
[Activity] ← Pending (gray)
[Activity] ← Running (blue, pulsing)
[Activity] ← Completed (green, checkmark)
[Activity] ← Failed (red, X)
[Activity] ← Retrying (orange, spinner)
```

**Path Highlighting:**
- Show path actually taken in execution
- Gray out nodes not reached
- Highlight loops with iteration count

**State Inspector:**
- Click node in execution mode → Show state at that point
- Show input values, output values, duration
- Show error details for failed nodes

**Timeline View:**
```
┌─────────────────────────────────────────────┐
│  Execution Timeline                         │
│  ─────────────────────────────────────────  │
│  [Start] ──5s──> [Activity1] ──2s──> [...]  │
│                     ↓                        │
│                  Duration: 2s                │
│                  Status: Completed           │
│                  Output: {...}               │
└─────────────────────────────────────────────┘
```

---

## 5. Developer Experience Considerations

### 5.1 Technical vs Non-Technical User Modes ⚠️ STRATEGIC

**Current State:** Single UI for all users
**Required Pattern:** Mode switching for different skill levels

**Why Critical:**
- Technical users want code control
- Non-technical users want visual simplicity
- Workflow complexity requires different abstractions

**Recommended Modes:**

**🎨 Visual Mode (Non-Technical):**
- Pre-built workflow templates
- Visual condition builder (no code)
- Activity selector from registry
- Simple input mapping UI
- Hide Temporal internals (task queues, timeouts)
- Focus on business logic

**⚙️ Advanced Mode (Technical):**
- Full node palette access
- Raw JavaScript expressions
- Temporal configuration exposure
- Code preview panel (generated TypeScript)
- Import/export workflow code
- Debug execution history

**🔧 Hybrid Mode (Recommended Default):**
- Visual builder with code preview
- Simple UI with "Advanced" expandable sections
- Inline code editor for expressions
- Template library with customization
- Tooltip explanations of Temporal concepts

**Mode Switcher:**
```
┌─────────────────────────────────────────┐
│  Workflow Mode: [Hybrid ▼]              │
│  ○ Visual (Simplified)                  │
│  ● Hybrid (Recommended)                 │
│  ○ Advanced (Full Control)              │
└─────────────────────────────────────────┘
```

---

### 5.2 Code Generation vs Visual Programming ⚠️ STRATEGIC

**Current State:** Visual definition stored as JSON
**Required Pattern:** Bidirectional visual ↔ code sync

**Why Critical:**
- Visual builder should generate production TypeScript
- Developers may want to edit code directly
- Code and visual should stay in sync

**Recommended Approach:**

**Visual → Code Generation:**
- Canvas definition generates TypeScript workflow
- Template engine fills in boilerplate
- Developer can export and customize code
- Version control friendly (readable diffs)

**Code → Visual Import:**
- Parse TypeScript workflow into nodes
- Extract activity calls, conditions, loops
- Show visual representation of code
- Mark unsupported patterns as "custom code blocks"

**Bidirectional Sync:**
- Warning when visual and code diverge
- Merge UI for syncing changes
- Git-like diff view for conflicts

**Code Preview Panel:**
```
┌─────────────────────────────────────────┐
│  Generated TypeScript                   │
│  ─────────────────────────────────────  │
│  export async function                  │
│  PackageBuilderWorkflow(input) {        │
│    const state = await                  │
│      initializePhase(input);            │
│                                         │
│    await planPhase(state);              │
│    await buildPhase(state, ...);        │
│    ...                                  │
│  }                                      │
│  ─────────────────────────────────────  │
│  [Copy Code] [Export File]              │
└─────────────────────────────────────────┘
```

---

### 5.3 Validation and Error Prevention ⚠️ HIGH PRIORITY

**Current State:** Minimal validation
**Required Pattern:** Proactive error prevention

**Why Critical:**
- Invalid workflows waste developer time
- Temporal errors are hard to debug
- Type safety prevents runtime failures

**Recommended Validation Layers:**

**Canvas-Level Validation:**
- Every workflow must have start trigger
- Warning if no end/completion node
- Error if condition has unconnected paths
- Warning if loop has no exit condition

**Node-Level Validation:**
- Activity inputs must match signature
- Child workflow inputs must be valid
- Condition expressions must be valid JavaScript
- State variable mutations must match schema

**Type Safety:**
- Input/output type checking
- Variable type tracking through workflow
- Type errors highlighted in red
- IntelliSense-style autocomplete

**Validation Panel:**
```
┌─────────────────────────────────────────┐
│  Workflow Validation                    │
│  ─────────────────────────────────────  │
│  ✓ Valid workflow structure             │
│  ✓ All paths connected                  │
│  ⚠️ Warning: Loop may run indefinitely  │
│     (no max iteration limit)            │
│  ❌ Error: Activity "runBuild" input    │
│     mismatch                            │
│     Expected: { packagePath: string }   │
│     Got: { path: string }               │
│  ─────────────────────────────────────  │
│  [Fix Errors] [View Details]            │
└─────────────────────────────────────────┘
```

---

## 6. Critical UX Gaps Summary

### 6.1 Missing Components (Priority Order)

1. **Loop/Iteration Container Node** ⚠️ CRITICAL
   - Visual grouping of loop body
   - Concurrency slot visualization
   - Exit condition preview
   - State mutation tracking within loop

2. **Coordinator Retry Pattern Node** ⚠️ CRITICAL
   - Shows coordinator workflow spawning
   - Decision handling visualization
   - Agent selection logic
   - Attempt timeline with backoff

3. **Enhanced Child Workflow Configuration** ⚠️ CRITICAL
   - startChild vs executeChild distinction
   - Input mapping visual editor
   - Completion tracking for async spawns
   - Blocking indicator for sync spawns

4. **Phase Container Enhancement** ⚠️ HIGH
   - Actually contains nodes (not just labeled)
   - Expand/collapse functionality
   - Sequential vs concurrent visual distinction
   - Scope isolation indicator

5. **State Flow Visualization** ⚠️ HIGH
   - State variable lifecycle tracking
   - Read/write badges on nodes
   - State mutation timeline
   - State inspector at any workflow point

6. **Multi-Path Condition Visualization** ⚠️ HIGH
   - Nested condition path highlighting
   - Scenario testing mode
   - Path labeling and annotation
   - Early exit visual distinction

---

### 6.2 Missing Interaction Patterns (Priority Order)

1. **Container Node Management** ⚠️ HIGH
   - Drag nodes into/out of containers
   - Expand/collapse containers
   - Container resize handles
   - Nested container support

2. **Path Tracing and Highlighting** ⚠️ HIGH
   - Hover-based path highlighting
   - Scenario testing with condition values
   - Trace to start/end navigation
   - Execution path overlay

3. **Type-Safe Edge Connections** ⚠️ HIGH
   - Validate connection compatibility
   - Show connection errors inline
   - Prevent invalid connections
   - Suggest valid connection targets

4. **Multi-Level Zoom** ⚠️ MEDIUM
   - Overview, structure, detail, config levels
   - Smooth zoom transitions
   - Minimap shows current zoom region
   - Zoom-dependent label detail

5. **Execution State Overlay** ⚠️ CRITICAL
   - Show runtime execution state on canvas
   - Node status indicators (running, completed, failed)
   - State inspector per node
   - Timeline view of execution

---

### 6.3 Missing Property Panels (Priority Order)

1. **Coordinator Retry Configuration** ⚠️ CRITICAL
   - Retry type selector (simple/coordinator/agent)
   - Coordinator workflow configuration
   - Problem type mapping
   - Decision handling rules
   - Backoff strategy visualizer

2. **Child Workflow Configuration** ⚠️ CRITICAL
   - Execution type toggle (start vs execute)
   - Visual input mapper
   - Workflow ID pattern builder
   - Output handling configuration
   - Blocking/non-blocking indicator

3. **Loop Configuration** ⚠️ CRITICAL
   - Loop type (while, for, forEach)
   - Condition expression builder
   - Concurrency configuration
   - Max iteration limits
   - Break conditions

4. **State Variable Configuration** ⚠️ HIGH
   - Operation selector (declare, set, push, etc.)
   - Scope management (workflow, phase, block)
   - Schema validation
   - Usage tracking (read/write locations)
   - Type checking

5. **Enhanced Condition Configuration** ⚠️ HIGH
   - Visual condition builder
   - Expression editor with autocomplete
   - Path labeling
   - Expression testing
   - Multi-way switch support

---

## 7. Wireframes and Visual Concepts

### 7.1 Loop Container Node (Expanded)

```
╔═══════════════════════════════════════════════════════════╗
║  🔁 While Loop: hasUnbuiltPackages()         [▼ Collapse] ║
╠═══════════════════════════════════════════════════════════╣
║  Concurrency: ████ (4 slots) | Promise.race()            ║
║  State: Mutates `state.completedPackages`                ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║   ┌────────────────────────┐                             ║
║   │  Find Ready Packages   │                             ║
║   │  (deps satisfied)      │                             ║
║   └──────────┬─────────────┘                             ║
║              ↓                                            ║
║   ┌────────────────────────┐                             ║
║   │  Fill Available Slots  │                             ║
║   │  (max 4 concurrent)    │                             ║
║   └──────────┬─────────────┘                             ║
║              ↓                                            ║
║   ┌────────────────────────────────────────────┐         ║
║   │  🚀 Spawn Child: PackageBuildWorkflow      │         ║
║   │  Execution: startChild (non-blocking)      │         ║
║   └──────────┬─────────────────────────────────┘         ║
║              ↓                                            ║
║   ┌────────────────────────┐                             ║
║   │  Wait for ANY          │                             ║
║   │  completion (race)     │                             ║
║   └──────────┬─────────────┘                             ║
║              ↓                                            ║
║   ┌────────────────────────┐                             ║
║   │  Update State          │                             ║
║   │  📝 WRITE: state       │                             ║
║   └──────────┬─────────────┘                             ║
║              ↓                                            ║
║   ┌────────────────────────┐                             ║
║   │  Check Condition       │                             ║
║   └──────────┬─────────────┘                             ║
║              │                                            ║
╚══════════════╪════════════════════════════════════════════╝
               ├──► Continue (loop back)
               └──► Exit (to next phase)
```

---

### 7.2 Coordinator Retry Pattern (Expanded)

```
╔═══════════════════════════════════════════════════════════╗
║  🔄 Coordinator Retry Loop                [▼ Show Config] ║
╠═══════════════════════════════════════════════════════════╣
║  Target: Run Build Activity                               ║
║  Max Attempts: 3 | Backoff: Exponential (1s, 2s, 4s)      ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║   ┌────────────────────────┐                             ║
║   │  Run Build             │                             ║
║   │  (attempt N)           │                             ║
║   └──────────┬─────────────┘                             ║
║              │                                            ║
║              ├──► SUCCESS → Continue                      ║
║              │                                            ║
║              └──► FAILURE ↓                               ║
║                            │                              ║
║   ┌────────────────────────────────────────────┐         ║
║   │  ⏸️ Execute CoordinatorWorkflow (blocking) │         ║
║   │  ─────────────────────────────────────────│         ║
║   │  Problem Type: BUILD_FAILURE              │         ║
║   │  Context:                                 │         ║
║   │    • packageName                          │         ║
║   │    • error details                        │         ║
║   │    • attemptNumber                        │         ║
║   └──────────┬─────────────────────────────────┘         ║
║              ↓                                            ║
║   ┌────────────────────────┐                             ║
║   │  Handle Decision       │                             ║
║   └──────────┬─────────────┘                             ║
║              │                                            ║
║              ├──► RETRY → Backoff → Loop back            ║
║              ├──► ESCALATE → Throw error                 ║
║              └──► RESOLVED → Continue                     ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

---

### 7.3 Multi-Path Conditional Flow

```
┌─────────────────────────────────────────────────────────┐
│  Conditional Flow: Package Pre-Flight                   │
│  ───────────────────────────────────────────────────── │
│                                                         │
│          ┌──────────────┐                               │
│     ┌───│ Code Exists? │───┐                            │
│     │   └──────────────┘   │                            │
│   TRUE                    FALSE                         │
│     ↓                       ↓                            │
│  ┌──────────┐         [Fresh Scaffold]                  │
│  │Published?│               ↓                            │
│  └────┬─────┘         [Continue...]                     │
│   TRUE│ FALSE                                            │
│       │   ↓                                              │
│       │ [Audit State] → [Continue...]                    │
│       │                                                  │
│       ↓                                                  │
│  ┌──────────┐                                            │
│  │ Upgrade? │                                            │
│  └────┬─────┘                                            │
│   TRUE│ FALSE                                            │
│       │   ↓                                              │
│       │ [Update MCP] → ⚠️ Early Exit (already published) │
│       │                                                  │
│       ↓                                                  │
│ [Audit Upgrade] → [Continue...]                         │
│                                                         │
│  🎨 Hover any path to highlight full flow               │
│  🧪 Click "Test Scenario" to see which path runs        │
└─────────────────────────────────────────────────────────┘
```

---

### 7.4 Property Panel: Coordinator Retry

```
┌───────────────────────────────────────────────────────┐
│  Retry Configuration                                  │
│  ───────────────────────────────────────────────────  │
│                                                       │
│  Retry Type:                                          │
│  ○ Simple (automatic retry with backoff)             │
│  ● Coordinator-Driven (agent fixes errors)           │
│  ○ Agent-Driven (direct agent spawn)                 │
│                                                       │
│  ───────────────────────────────────────────────────  │
│  Basic Configuration:                                 │
│  ───────────────────────────────────────────────────  │
│                                                       │
│  Max Attempts: [3          ]                          │
│               ├─┬─┬─┐ Visual attempt counter          │
│               1 2 3                                   │
│                                                       │
│  Retry On: [failure            ▼]                     │
│           • failure (activity returns error)          │
│           • error (exception thrown)                  │
│           • condition (custom expression)             │
│                                                       │
│  ───────────────────────────────────────────────────  │
│  Coordinator Configuration:                           │
│  ───────────────────────────────────────────────────  │
│                                                       │
│  Coordinator Workflow:                                │
│  [CoordinatorWorkflow          ▼]                     │
│                                                       │
│  Task Queue:                                          │
│  [engine                       ▼]                     │
│                                                       │
│  Execution Type:                                      │
│  ● executeChild (blocks parent until complete)       │
│  ○ startChild (async, non-blocking)                  │
│                                                       │
│  ℹ️ executeChild waits for coordinator decision      │
│                                                       │
│  ───────────────────────────────────────────────────  │
│  Problem Mapping:                                     │
│  ───────────────────────────────────────────────────  │
│                                                       │
│  Problem Type: [BUILD_FAILURE      ▼]                 │
│                                                       │
│  Context Fields:                                      │
│  ☑ packageName    ← input.packageName                 │
│  ☑ packagePath    ← input.packagePath                 │
│  ☑ planPath       ← input.planPath                    │
│  ☑ phase          ← 'build' (literal)                 │
│  ☑ attemptNumber  ← (auto-incremented)                │
│  ☐ Custom field   ← [expression...]                   │
│                                                       │
│  [+ Add Context Field]                                │
│                                                       │
│  ───────────────────────────────────────────────────  │
│  Decision Handling:                                   │
│  ───────────────────────────────────────────────────  │
│                                                       │
│  RETRY:                                               │
│  ● Continue retry loop (increment attempt)            │
│  ○ Break loop (stop retrying)                        │
│  ○ Custom action                                     │
│                                                       │
│  ESCALATE:                                            │
│  ● Throw error (fail workflow)                       │
│  ○ Continue workflow (ignore error)                  │
│  ○ Custom action                                     │
│                                                       │
│  RESOLVED:                                            │
│  ● Break loop (continue workflow)                    │
│  ○ Retry once more (verify fix)                      │
│  ○ Custom action                                     │
│                                                       │
│  ───────────────────────────────────────────────────  │
│  Backoff Strategy:                                    │
│  ───────────────────────────────────────────────────  │
│                                                       │
│  Type: [exponential            ▼]                     │
│                                                       │
│  Initial Interval: [1           ] [seconds ▼]         │
│  Multiplier:       [2.0         ]                     │
│  Max Interval:     [100         ] [seconds ▼]         │
│                                                       │
│  Timeline Preview:                                    │
│  Attempt 1: 0s                                        │
│  Attempt 2: 1s    ├─► (backoff)                       │
│  Attempt 3: 2s    ├───► (backoff)                     │
│                                                       │
│  ───────────────────────────────────────────────────  │
│                                                       │
│  [Reset to Defaults]   [Preview Workflow]   [Save]   │
│                                                       │
└───────────────────────────────────────────────────────┘
```

---

### 7.5 Execution State Overlay

```
┌─────────────────────────────────────────────────────────┐
│  Workflow: package-build-workflow                       │
│  Execution ID: build-123-package-a                      │
│  Status: Failed | Duration: 2m 34s                      │
│  ───────────────────────────────────────────────────── │
│                                                         │
│  [Start] ──✓──> [Check Exists] ──✓──> [Check Published]│
│   (1s)            (2s)                   (1s)           │
│                                            │            │
│                                          TRUE           │
│                                            ↓            │
│                                      [Update MCP]       │
│                                         ⚠️ (skipped)    │
│                                                         │
│  Path not taken (grayed out)                           │
│                                                         │
│  Actual path:                                          │
│  [Verify Deps] ──✓──> [Scaffold] ──✓──> [Run Build]   │
│     (5s)               (12s)              (8s)          │
│                                            │            │
│                                          FAILED         │
│                                            ↓            │
│                                    [Coordinator Retry]  │
│                                         ⏳ (running)    │
│                                        Attempt 1/3      │
│                                                         │
│  ───────────────────────────────────────────────────── │
│  Current State:                                         │
│  {                                                      │
│    packageName: "@bernier/package-a",                   │
│    buildAttempts: 1,                                    │
│    lastError: "TypeScript compilation failed"          │
│  }                                                      │
│  ───────────────────────────────────────────────────── │
│                                                         │
│  [View Full State] [View Error Details] [Retry Manual] │
└─────────────────────────────────────────────────────────┘
```

---

## 8. Implementation Recommendations

### 8.1 Phase 1: Critical Foundation (2-3 weeks)

**Priority 1: Loop Container Node**
- Implement visual container with expand/collapse
- Add concurrency slot visualization
- Build loop condition editor
- Add state mutation tracking

**Priority 2: Enhanced Retry Configuration**
- Distinguish simple vs coordinator-driven retry
- Build coordinator config UI
- Add decision handling configuration
- Implement backoff timeline preview

**Priority 3: Child Workflow Enhancement**
- Add execution type toggle (start vs execute)
- Build visual input mapper
- Add blocking indicator
- Show completion tracking for startChild

**Deliverable:** Can visually represent PackageBuilderWorkflow build loop

---

### 8.2 Phase 2: Advanced Patterns (2-3 weeks)

**Priority 1: Multi-Path Conditionals**
- Implement path highlighting on hover
- Build scenario testing mode
- Add path labeling
- Create decision tree visualization option

**Priority 2: State Flow Visualization**
- Add read/write badges to nodes
- Build state inspector panel
- Create state mutation timeline
- Implement state flow overlay toggle

**Priority 3: Phase Container Enhancement**
- Convert PhaseNode to actual container
- Implement drag-into-container interaction
- Add resize handles
- Build nested container support

**Deliverable:** Can visually represent PackageBuildWorkflow conditional pre-flight logic

---

### 8.3 Phase 3: Developer Experience (1-2 weeks)

**Priority 1: Execution State Overlay**
- Build execution history viewer
- Implement node status indicators
- Create state inspector at execution points
- Add timeline view

**Priority 2: Validation System**
- Implement canvas-level validation
- Add node-level validation
- Build type checking system
- Create validation error panel

**Priority 3: Code Generation**
- Build TypeScript code generator
- Implement code preview panel
- Add export workflow functionality
- Create import from code (future)

**Deliverable:** Can debug failed workflow executions visually

---

### 8.4 Phase 4: Polish and Usability (1-2 weeks)

**Priority 1: Path Navigation**
- Implement trace-to-start/end
- Build path highlighting
- Add multi-level zoom
- Create minimap enhancements

**Priority 2: Property Panel Improvements**
- Build visual condition builder
- Create activity selector with autocomplete
- Implement schema-based validation
- Add inline documentation

**Priority 3: Mode Switching**
- Implement visual/hybrid/advanced modes
- Build simplified UI for non-technical users
- Add template library
- Create workflow wizards

**Deliverable:** Production-ready workflow builder for all user levels

---

## 9. Success Criteria

### 9.1 Usability Goals

**For Technical Users:**
- Can represent PackageBuilderWorkflow in 15 minutes
- Can debug failed execution in 5 minutes
- Can extend workflow without reading code
- Confidence in generated TypeScript correctness

**For Non-Technical Users:**
- Can understand workflow flow in 5 minutes
- Can trace execution paths visually
- Can modify simple workflows (change activity, add condition)
- No need to understand Temporal concepts

**For All Users:**
- No "what does this do?" confusion
- Clear visual distinction between patterns
- Proactive error prevention
- Fast iteration (change → test → debug)

---

### 9.2 Visual Clarity Metrics

**Node Clarity:**
- Node purpose clear from icon and label
- Configuration preview visible without clicking
- State mutations visible on node
- Execution status immediately apparent

**Flow Clarity:**
- Path from start to end traceable
- Conditional branches clearly labeled
- Loop iterations visually distinguished
- Phase boundaries obvious

**Execution Clarity:**
- Current execution state visible
- Error location immediately obvious
- State evolution trackable
- Performance bottlenecks visible

---

### 9.3 Technical Correctness Goals

**Type Safety:**
- Input/output type mismatches caught before save
- State variable schema validation
- Activity signature checking
- Edge connection validation

**Temporal Correctness:**
- Valid Temporal workflow generated
- Timeouts configured appropriately
- Task queues correctly referenced
- Retry policies follow best practices

**Performance:**
- Canvas renders 100+ nodes smoothly
- Property panel updates < 100ms
- Validation runs without blocking UI
- Execution overlay loads in < 1s

---

## 10. Conclusion

The workflow builder UI has **foundational node types** but lacks **critical visual patterns and interaction models** to make complex production workflows understandable and editable.

**Biggest Gaps:**
1. **Loop containers** with concurrency visualization
2. **Coordinator retry pattern** representation
3. **State flow tracking** through workflow
4. **Multi-path conditional** visualization
5. **Execution state overlay** for debugging

**Recommended Approach:**
- **Phase 1:** Build loop and retry patterns (foundation)
- **Phase 2:** Add state tracking and conditionals (logic)
- **Phase 3:** Add execution debugging (developer experience)
- **Phase 4:** Polish interactions (usability)

**Strategic Decision Needed:**
- **Visual-first** (build patterns, code later) vs
- **Code-first** (generate code, visualize later)

Recommendation: **Visual-first with code preview** - build visual patterns now, add bidirectional sync later. This maximizes value for non-technical users while preserving technical user workflow.

---

**ArchitectUX Analysis Complete**
**Document Version:** 1.0
**Date:** 2025-11-19
**Next Steps:** Review with team, prioritize phases, begin implementation
