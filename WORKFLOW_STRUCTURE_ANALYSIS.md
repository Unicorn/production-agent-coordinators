# Temporal Workflow Structure & Naming Conventions - Comprehensive Analysis

## Executive Summary

This codebase implements a sophisticated Temporal-based agent coordination framework for building and publishing npm packages. The system features:
- Dual-workflow architecture (orchestrator + worker patterns)
- Activity-based separation of concerns
- Type-safe Temporal integration
- Agentic activities for dynamic code remediation
- Multi-phase build orchestration with dependency graphs

---

## 1. DIRECTORY STRUCTURE

### Core Workflow Locations

```
/packages/temporal-coordinator/
  ├── src/
  │   ├── workflows.ts          # Main hello world workflow examples
  │   ├── activities.ts         # Activities that wrap Engine/Coordinator
  │   ├── worker.ts            # Worker process setup
  │   └── index.ts             # Exports

/packages/agents/package-builder-production/
  ├── src/
  │   ├── workflows/
  │   │   ├── package-builder.workflow.ts    # Parent/orchestrator workflow
  │   │   ├── package-build.workflow.ts      # Child/individual package workflow
  │   │   └── __tests__/
  │   ├── activities/
  │   │   ├── build.activities.ts            # Build/test/quality activities
  │   │   ├── agent.activities.ts            # Agentic activities (AI-driven)
  │   │   ├── report.activities.ts           # Reporting activities
  │   │   └── __tests__/
  │   ├── types/
  │   │   └── index.ts                       # Shared type definitions
  │   ├── worker.ts                          # Worker process
  │   └── index.ts                           # Public exports

/production/
  ├── scripts/
  │   ├── build-package.ts                   # Single package build script
  │   └── build-content-suite.ts             # Suite-level orchestration
  └── configs/
      └── example-build-env.json             # Configuration template

/packages/workflows/
  └── .gitkeep                               # Placeholder for future workflows
```

---

## 2. WORKFLOW DEFINITIONS

### 2.1 Temporal Coordinator Workflows

**File:** `/packages/temporal-coordinator/src/workflows.ts`

#### `helloWorkflow(config: HelloWorkflowConfig): Promise<EngineState>`
- **Purpose:** Demonstrates basic integration of Temporal + Agent Coordinator
- **Type:** Orchestration workflow
- **Deterministic:** Yes - uses only activity calls and state management
- **Pattern:** Loop-based iteration with waiting steps execution
- **Naming Pattern:** `<purpose>Workflow`
  
```typescript
export async function helloWorkflow(config: HelloWorkflowConfig): Promise<EngineState>
export async function multiStepWorkflow(config: HelloWorkflowConfig): Promise<EngineState>
```

**Key Characteristics:**
- Wrapped activity proxies with 5-minute timeout
- Retry policy: 3 attempts with exponential backoff
- Coordinates spec decisions and agent execution
- Deterministic state updates within workflow
- Comprehensive logging at each step

---

### 2.2 Package Builder Production Workflows

**Files:** 
- `/packages/agents/package-builder-production/src/workflows/package-builder.workflow.ts`
- `/packages/agents/package-builder-production/src/workflows/package-build.workflow.ts`

#### `PackageBuilderWorkflow(input: PackageBuilderInput): Promise<void>`
- **Purpose:** Master orchestrator for building entire package suites
- **Type:** Parent workflow using child workflow execution
- **Pattern:** Multi-phase orchestration with dynamic child spawning
- **Naming Pattern:** `<Entity><Purpose>Workflow` (PascalCase)

```typescript
export async function PackageBuilderWorkflow(input: PackageBuilderInput): Promise<void>
```

**Phases:**
1. INITIALIZE - Parse audit report, build dependency graph
2. PLAN - Verify package plans exist
3. BUILD - Spawn parallel child workflows (respecting dependencies)
4. VERIFY - Run integration tests
5. COMPLETE - Generate aggregate reports

**Key Characteristics:**
- Parent workflow spawning up to N children (maxConcurrentBuilds = 4 default)
- Dependency-aware scheduling (validators → core → utilities → services → ui → suites)
- Promise.race() for handling child completion
- State tracking for completed/failed packages

---

#### `PackageBuildWorkflow(input: PackageBuildInput): Promise<PackageBuildResult>`
- **Purpose:** Execute build for a single package
- **Type:** Child workflow (invoked by PackageBuilderWorkflow)
- **Pattern:** Linear sequential activities with agent-driven remediation
- **Naming Pattern:** `<Entity><Purpose>Workflow` (PascalCase)

```typescript
export async function PackageBuildWorkflow(input: PackageBuildInput): Promise<PackageBuildResult>
```

**Execution Sequence:**
1. Verify dependencies published
2. Run build activity
3. Run tests activity
4. Run quality checks activity
5. If failures → Spawn fix agent activity (up to 3 retry loops)
6. Publish package activity
7. Write package report activity

**Key Characteristics:**
- Try/catch with error categorization
- Agent-in-the-loop quality fixes
- Comprehensive report building
- Finally block for report writing

---

## 3. ACTIVITY DEFINITIONS

### 3.1 Temporal Coordinator Activities

**File:** `/packages/temporal-coordinator/src/activities.ts`

```typescript
export async function initializeWorkflow(
  goalId: string,
  config: { specType: string; agentType: string; ... }
): Promise<EngineState>

export async function executeSpecDecision(
  state: EngineState,
  config: { specType: string; lastResponse?: AgentResponse }
): Promise<EngineState>

export async function executeAgentStep(
  goalId: string,
  stepId: string,
  step: StepState,
  config: { agentType: string; agentConfig?: Record<string, unknown> }
): Promise<AgentResponse>

export async function storeArtifact(
  goalId: string,
  key: string,
  value: unknown
): Promise<void>

export async function processAgentResponse(
  state: EngineState,
  response: AgentResponse
): Promise<EngineState>
```

**Naming Pattern:** `<verb><noun>` or `<verb><Entity>` (camelCase)
- Verb-first: `execute*`, `process*`, `initialize*`, `store*`
- No "Activity" suffix in function name
- Activity pattern enforced at proxy creation time

---

### 3.2 Package Builder Production Activities

#### Build Activities

**File:** `/packages/agents/package-builder-production/src/activities/build.activities.ts`

```typescript
export async function runBuild(input: {
  workspaceRoot: string;
  packagePath: string;
}): Promise<BuildResult>

export async function runTests(input: {
  workspaceRoot: string;
  packagePath: string;
}): Promise<TestResult>

export async function runQualityChecks(input: {
  workspaceRoot: string;
  packagePath: string;
}): Promise<QualityResult>

export async function publishPackage(input: {
  packageName: string;
  packagePath: string;
  config: BuildConfig;
}): Promise<PublishResult>

export async function buildDependencyGraph(auditReportPath: string): Promise<PackageNode[]>
```

**Naming Pattern:** `<verb><object>` (camelCase)
- Examples: `runBuild`, `runTests`, `runQualityChecks`, `publishPackage`
- Follows npm/yarn command naming conventions
- Input/output typing is explicit
- Internal helpers use same pattern (e.g., `parseQualityFailures`)

---

#### Agent Activities (Agentic Activities)

**File:** `/packages/agents/package-builder-production/src/activities/agent.activities.ts`

```typescript
export async function spawnFixAgent(input: {
  packagePath: string;
  planPath: string;
  failures: QualityFailure[];
}): Promise<void>

export async function verifyDependencies(dependencies: string[]): Promise<void>

// Internal helper
async function getOrCreateFixPrompt(failureTypes: string[]): Promise<string>
```

**CRITICAL PATTERN - "Agentic Activity":**
- `spawnFixAgent` is the primary agentic activity
- Categorizes failures → finds/creates fix prompt → would call external agent
- Currently logs what would be spawned (TODO: integrate actual spawning)
- No direct agent invocation; would use task-based spawning system
- Helper functions prefixed with lowercase (internal pattern)

**Naming Pattern:** 
- Agentic: `spawn<Agent>`, `spawn<Entity><Action>`
- Verification: `verify<Resource>`
- Helpers: `<verb><noun>` or `<verb><Entity>` (lowercase)

---

#### Report Activities

**File:** `/packages/agents/package-builder-production/src/activities/report.activities.ts`

```typescript
export async function writePackageBuildReport(
  report: PackageBuildReport,
  workspaceRoot: string
): Promise<void>

export async function loadAllPackageReports(
  _suiteId: string,
  workspaceRoot: string
): Promise<PackageBuildReport[]>

export async function writeBuildReport(
  report: BuildReport,
  workspaceRoot: string
): Promise<void>
```

**Naming Pattern:** `<verb><Entity><noun>` (camelCase)
- Examples: `writePackageBuildReport`, `loadAllPackageReports`, `writeBuildReport`
- Entity clarifies scope (Package vs Build/Suite level)
- Verb first: write, load, delete operations

---

## 4. NAMING CONVENTIONS SUMMARY

### 4.1 Workflow Naming

| Pattern | Example | Location |
|---------|---------|----------|
| `<Purpose>Workflow` | `helloWorkflow` | hello world/simple examples |
| `<Entity><Purpose>Workflow` | `PackageBuilderWorkflow` | complex orchestrators |
| `<Entity><Purpose>Workflow` | `PackageBuildWorkflow` | child workflows |

**Rules:**
- Always ends with `Workflow`
- PascalCase for multi-word workflows
- camelCase for simple/demo workflows
- Exported as named exports

---

### 4.2 Activity Naming

| Pattern | Example | Purpose |
|---------|---------|---------|
| `<verb><noun>` | `executeSpecDecision` | General purpose |
| `<verb><Entity>` | `executeAgentStep` | Entity-focused |
| `run<Command>` | `runBuild`, `runTests` | CLI-style operations |
| `<verb><Entity><noun>` | `writePackageBuildReport` | Complex multi-part |
| `spawn<Agent>` | `spawnFixAgent` | **Agentic Activities** |
| `verify<Resource>` | `verifyDependencies` | Validation |
| `<verb><noun>` | `buildDependencyGraph` | Complex operations |

**Rules:**
- No "Activity" suffix in name (proxy pattern handles this)
- Verbs first: execute, run, write, load, spawn, verify, build, process, store
- camelCase always
- Input object typed, output explicit
- Exported as named exports

---

### 4.3 Agentic Activity Naming Pattern

**Key Distinction:** Agentic activities spawn external agents to perform work

```typescript
// AGENTIC ACTIVITY PATTERN
export async function spawnFixAgent(input: {
  packagePath: string;
  planPath: string;
  failures: QualityFailure[];
}): Promise<void>

// Characteristics:
// 1. Uses "spawn<Agent>" naming
// 2. Would invoke external agent system
// 3. Receives failure context and plan
// 4. Currently TODO: would use Task tool integration
// 5. Manages agent prompt selection/creation
```

**Current Status:**
- Not yet integrated with actual agent spawning
- TODO comment indicates future integration
- Supports prompt template lookup in `.claude/agents/fix-prompts/`

---

## 5. ACTIVITY PROXY CONFIGURATION

### Pattern

```typescript
const { activity1, activity2, activity3 } = proxyActivities<typeof activityModule>({
  startToCloseTimeout: '5 minutes', // or '10 minutes', '1 minute'
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumInterval: '30s',
    maximumAttempts: 3,
  },
});
```

### Current Timeouts

| Activity Type | Timeout | Module |
|---------------|---------|--------|
| General | 5 minutes | temporal-coordinator |
| Build operations | 10 minutes | package-builder |
| Agent activities | 30 minutes | package-builder |
| Reporting | 1 minute | package-builder |
| Dependency operations | 5 minutes | package-builder |

---

## 6. TYPE DEFINITIONS

### Location: `/packages/agents/package-builder-production/src/types/index.ts`

**Key Type Exports:**

#### Phases & Statuses
```typescript
enum BuildPhase {
  INITIALIZE = 'INITIALIZE',
  PLAN = 'PLAN',
  BUILD = 'BUILD',
  VERIFY = 'VERIFY',
  COMPLETE = 'COMPLETE'
}

type PackageCategory = 'validator' | 'core' | 'utility' | 'service' | 'ui' | 'suite';
```

#### Workflow Inputs/Outputs
```typescript
interface PackageBuilderInput { }      // Parent workflow input
interface PackageBuildInput { }        // Child workflow input
interface PackageBuildResult { }       // Child workflow result
interface PackageBuilderState { }      // State tracking
```

#### Activity Results
```typescript
interface BuildResult { }              // runBuild output
interface TestResult { }               // runTests output
interface QualityResult { }            // runQualityChecks output
interface PublishResult { }            // publishPackage output
interface QualityFailure { }           // Failure categorization
```

#### Reporting
```typescript
interface PackageBuildReport { }       // Per-package report
interface BuildReport { }              // Suite-level report
```

**Naming Pattern for Interfaces:**
- `<Entity><Purpose><Type>` (PascalCase)
- Examples: `PackageBuilderInput`, `PackageBuildResult`, `PackageBuildReport`

---

## 7. WORKER SETUP

### Temporal Coordinator Worker

**File:** `/packages/temporal-coordinator/src/worker.ts`

```typescript
const worker = await Worker.create({
  connection,
  namespace: 'default',
  taskQueue: 'agent-coordinator-queue',
  workflowsPath: 'src/workflows.ts' or 'dist/workflows.js',
  activities,
  maxConcurrentActivityTaskExecutions: 10,
  maxConcurrentWorkflowTaskExecutions: 10,
});
```

### Package Builder Worker

**File:** `/packages/agents/package-builder-production/src/worker.ts`

```typescript
const worker = await Worker.create({
  taskQueue: 'engine' (from env or default),
  workflowsPath: './workflows' (directory, not file),
  activities: { ...activities, ...agentActivities, ...reportActivities },
});
```

**Key Difference:** 
- Different task queues
- Multiple activity modules merged
- Workflow path handling differs

---

## 8. EXISTING STANDARDIZATION PATTERNS

### 8.1 File Organization

```
/workflows/
  - Named with `.workflow.ts` suffix
  - Contains exported workflow functions

/activities/
  - Organized by domain: build.activities.ts, agent.activities.ts, report.activities.ts
  - Contains exported activity functions (no Activity suffix)
  - Test files in __tests__/ subdirectory

/types/
  - Centralized type definitions
  - Single index.ts file
  - Shared across workflows and activities
```

### 8.2 Import Patterns

```typescript
// Workflows import activities as types
import type * as activities from '../activities/build.activities';

// Use proxyActivities for runtime
const { runBuild, runTests } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 minutes'
});
```

### 8.3 Error Handling

**Workflow Level:**
- Try/catch with error categorization
- Phase detection from error message
- Return structured result with failure details

**Activity Level:**
- Try/catch with explicit return types
- Success/failure fields in return type
- Stderr captured for diagnostics

---

## 9. CURRENT WORKFLOW EXAMPLES IN CODEBASE

### Simple Example: Hello World
**Location:** `/packages/temporal-coordinator/src/workflows.ts`
- Linear execution with state updates
- Activity-based work delegation
- Loop-based iteration pattern

### Complex Example: Package Builder
**Location:** `/packages/agents/package-builder-production/src/workflows/`
- Parent/child workflow pattern
- Dependency-aware scheduling
- Agent-in-the-loop (via agentic activities)
- Comprehensive reporting

---

## 10. SCRIPTS AND INTEGRATION

### Build Script

**File:** `/production/scripts/build-package.ts`

```typescript
// Workflow ID naming pattern
const workflowId = `build-${fileName}-${Date.now()}`;

// Input construction
const input: PackageBuildInput = {
  packageName: `@bernierllc/${fileName}`,
  packagePath: path.join(workspaceRoot, 'packages', category, fileName),
  planPath: planFilePath,
  category: category as any,
  dependencies: [],
  workspaceRoot,
  config: buildConfig
};
```

**Naming Pattern for Workflow IDs:**
- `<verb>-<entity>-<timestamp>` 
- Example: `build-email-template-service-1699999999999`
- Format: kebab-case with timestamp

---

## 11. KEY FINDINGS & STANDARDIZATION

### Established Patterns

1. **Workflow Suffix Required:** All workflows end with `Workflow`
2. **No Activity Suffix:** Activities don't include "Activity" in name
3. **Verb-First Naming:** Both workflows and activities start with action verbs
4. **Type Safety:** All activities have explicit input/output types
5. **Proxy Pattern:** Activity proxies defined with explicit timeouts
6. **Module Organization:** Separate concerns into separate files (build, agent, report)
7. **Test Placement:** Tests in `__tests__` subdirectories

### Naming Tiers

| Tier | Pattern | Examples |
|------|---------|----------|
| Workflows | `<Purpose>Workflow` or `<Entity><Purpose>Workflow` | `helloWorkflow`, `PackageBuildWorkflow` |
| Activities | `<verb><noun>` or `run<Command>` | `executeSpecDecision`, `runBuild` |
| Agentic Activities | `spawn<Agent>` or `spawn<Entity><Action>` | `spawnFixAgent` |
| Types | `<Entity><Purpose><Kind>` | `PackageBuildInput`, `BuildReport` |
| Workflow IDs | `<verb>-<entity>-<timestamp>` | `build-package-name-1699999999999` |

---

## 12. AREAS FOR STANDARDIZATION

1. **Agentic Activity Documentation:** Needs clear guidelines (currently limited)
2. **Naming Consistency:** Some inconsistency in activity parameter naming (input objects)
3. **Error Types:** Could standardize error response structures
4. **Activity Timeout Standards:** Currently varies (1m to 30m)
5. **Plan Writer Workflows:** Not yet created/examined

---

## 13. NEXT STEPS FOR INVESTIGATION

1. Locate/examine "plan writer" workflow mentioned in requirements
2. Document "plan writer" naming patterns
3. Create unified naming standard document
4. Define agentic activity integration patterns
5. Establish error handling conventions
