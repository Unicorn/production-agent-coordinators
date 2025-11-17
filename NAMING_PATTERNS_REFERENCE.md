# Temporal Workflow & Activity Naming Patterns - Quick Reference

## Pattern Summary Table

### WORKFLOWS

```
Pattern:        <Purpose>Workflow OR <Entity><Purpose>Workflow
Case:           camelCase (simple) or PascalCase (complex)
Suffix:         Always ends with "Workflow"
Location:       /src/workflows/*.workflow.ts

Examples:
✓ helloWorkflow                    (simple, demo)
✓ multiStepWorkflow                (simple, multi-step)
✓ PackageBuilderWorkflow           (complex orchestrator - PascalCase)
✓ PackageBuildWorkflow             (complex child workflow - PascalCase)
```

---

### ACTIVITIES

```
Pattern:        <verb><noun> OR <verb><Entity> OR run<Command>
Case:           Always camelCase
Suffix:         NO "Activity" suffix (proxy pattern handles this)
Location:       /src/activities/*.activities.ts

General Purpose:
✓ executeSpecDecision              (<verb><noun>)
✓ executeAgentStep                 (<verb><Entity>)
✓ processAgentResponse             (<verb><noun>)

CLI-Style Operations:
✓ runBuild                         (run<Command>)
✓ runTests                         (run<Command>)
✓ runQualityChecks                 (run<Command>)

Complex Operations:
✓ writePackageBuildReport          (<verb><Entity><noun>)
✓ loadAllPackageReports            (<verb>All<Entity>)
✓ buildDependencyGraph             (<verb><noun>)

Initialization/Storage:
✓ initializeWorkflow               (<verb><noun>)
✓ storeArtifact                    (<verb><noun>)

Verification:
✓ verifyDependencies               (verify<Resource>)
```

---

### AGENTIC ACTIVITIES (Special Category)

```
Pattern:        spawn<Agent> OR spawn<Entity><Action>
Purpose:        Activities that invoke external agents
Status:         Partially implemented (TODO integration)
Location:       /src/activities/agent.activities.ts

Examples:
✓ spawnFixAgent                    (spawn<Agent>)
  └─ Spawns external agent to fix quality failures
  └─ Receives failures + plan + package context
  └─ Manages prompt template lookup
  
✓ verifyDependencies               (verify<Resource>)
  └─ Checks dependencies published
  └─ Validation activity
```

---

### TYPES & INTERFACES

```
Pattern:        <Entity><Purpose><Kind>
Case:           PascalCase
Location:       /src/types/index.ts

Enums:
✓ BuildPhase                       (phase names)

Workflow I/O:
✓ PackageBuilderInput              (parent workflow input)
✓ PackageBuildInput                (child workflow input)
✓ PackageBuildResult               (child workflow result)
✓ PackageBuilderState              (orchestrator state)

Activity Results:
✓ BuildResult                      (runBuild output)
✓ TestResult                       (runTests output)
✓ QualityResult                    (runQualityChecks output)
✓ PublishResult                    (publishPackage output)
✓ QualityFailure                   (failure detail)

Reports:
✓ PackageBuildReport               (per-package metrics)
✓ BuildReport                      (suite-level aggregate)
```

---

## File Organization Reference

```
/package/
├── workflows/
│   ├── package-builder.workflow.ts       (parent orchestrator)
│   ├── package-build.workflow.ts         (child executor)
│   └── __tests__/
│       └── package-build.workflow.test.ts
│
├── activities/
│   ├── build.activities.ts               (runBuild, runTests, etc.)
│   ├── agent.activities.ts               (spawnFixAgent, verify*, etc.)
│   ├── report.activities.ts              (write*, load*, etc.)
│   └── __tests__/
│       ├── build.activities.test.ts
│       └── report.activities.test.ts
│
├── types/
│   └── index.ts                          (all type definitions)
│
├── worker.ts                              (Worker setup)
└── index.ts                               (public exports)
```

---

## Activity Proxy Configuration Pattern

### Standard Configuration

```typescript
const { activity1, activity2 } = proxyActivities<typeof activities>({
  startToCloseTimeout: '<timeout>',
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumInterval: '30s',
    maximumAttempts: 3,
  },
});
```

### Common Timeouts

| Operation Type | Duration | Example Module |
|---|---|---|
| General coordination | 5 minutes | temporal-coordinator |
| Build operations | 10 minutes | package-builder |
| Agent spawning | 30 minutes | package-builder |
| Reporting | 1 minute | package-builder |

---

## Import Pattern

```typescript
// In workflow file:
import { proxyActivities } from '@temporalio/workflow';
import type * as buildActivities from '../activities/build.activities';

// At top of workflow:
const { runBuild, runTests, runQualityChecks } = 
  proxyActivities<typeof buildActivities>({
    startToCloseTimeout: '10 minutes'
  });

// Usage in workflow:
const result = await runBuild({ workspaceRoot, packagePath });
```

---

## Workflow ID Naming

```
Pattern:        <verb>-<entity>-<timestamp>
Case:           kebab-case
Format:         ${action}-${packageName}-${Date.now()}

Examples:
✓ build-email-template-service-1699999999999
✓ fix-validation-package-1699999888888
```

---

## Verb Inventory

### Common Activity Verbs (by category)

**Execution:** execute, run, spawn, build, deploy, publish
**Data:** load, write, store, read, fetch, send
**Validation:** verify, validate, check
**Processing:** process, parse, format, convert
**Initialization:** initialize, setup, create

---

## Anti-Patterns (What NOT to Do)

```
✗ Activity named with suffix:
  executeBuildActivity        (❌ no Activity suffix)
  
✗ Workflow without Workflow suffix:
  buildPackage               (❌ must be buildPackageWorkflow)
  
✗ Activity without verb:
  PackageBuilder             (❌ must start with verb like buildPackage)
  
✗ Mixed case in workflow IDs:
  build_EmailService         (❌ use kebab-case)
  
✗ Activity with Entity before verb:
  PackageExecuteBuild        (❌ verb comes first: executePackageBuild)
```

---

## Decision Tree: Naming Your Activity

```
┌─ Does this invoke an external agent?
│  └─ YES → spawn<Agent> (e.g., spawnFixAgent)
│  └─ NO  → Continue...
│
├─ Is it a CLI-like command (build, test, publish)?
│  └─ YES → run<Command> (e.g., runBuild, runTests)
│  └─ NO  → Continue...
│
├─ Is it validation/checking?
│  └─ YES → verify/validate<Resource> (e.g., verifyDependencies)
│  └─ NO  → Continue...
│
├─ Is it multi-part with Entity scope?
│  └─ YES → <verb><Entity><noun> (e.g., writePackageBuildReport)
│  └─ NO  → Continue...
│
└─ Is it general processing?
   └─ YES → <verb><noun> (e.g., processAgentResponse)
```

---

## Decision Tree: Naming Your Workflow

```
┌─ Is it simple/demo level?
│  └─ YES → <purpose>Workflow (camelCase)
│           e.g., helloWorkflow
│  └─ NO  → Continue...
│
└─ Is it complex/production?
   └─ YES → <Entity><Purpose>Workflow (PascalCase)
            e.g., PackageBuildWorkflow
```

---

## Code Examples

### Workflow Declaration

```typescript
// Simple workflow (camelCase)
export async function helloWorkflow(
  config: HelloWorkflowConfig
): Promise<EngineState> {
  // ...
}

// Complex workflow (PascalCase)
export async function PackageBuildWorkflow(
  input: PackageBuildInput
): Promise<PackageBuildResult> {
  // ...
}
```

### Activity Declaration

```typescript
// General purpose
export async function executeSpecDecision(
  state: EngineState,
  config: DecisionConfig
): Promise<EngineState> {
  // ...
}

// CLI-style
export async function runBuild(input: {
  workspaceRoot: string;
  packagePath: string;
}): Promise<BuildResult> {
  // ...
}

// Agentic
export async function spawnFixAgent(input: {
  packagePath: string;
  failures: QualityFailure[];
}): Promise<void> {
  // ...
}
```

### Type Declaration

```typescript
// Workflow input
interface PackageBuildInput {
  packageName: string;
  packagePath: string;
  // ...
}

// Activity result
interface BuildResult {
  success: boolean;
  duration: number;
  stdout: string;
  stderr: string;
}
```

---

## Consistency Checklist

Before committing workflows/activities:

- [ ] Workflow ends with `Workflow` suffix
- [ ] Workflow is either simple camelCase or complex PascalCase
- [ ] Activity starts with a verb
- [ ] Activity has NO "Activity" suffix
- [ ] Activity is camelCase
- [ ] Activity has explicit input/output types
- [ ] Agentic activities use `spawn<Agent>` pattern
- [ ] Types use `<Entity><Purpose><Kind>` pattern
- [ ] File follows naming convention (*.workflow.ts, *.activities.ts)
- [ ] Activities organized by domain (build, agent, report)
- [ ] Tests in __tests__ subdirectory

---

## Related Files to Reference

- **Workflow Examples:** `/packages/temporal-coordinator/src/workflows.ts`
- **Activity Examples:** `/packages/agents/package-builder-production/src/activities/`
- **Type Definitions:** `/packages/agents/package-builder-production/src/types/index.ts`
- **Worker Setup:** `/packages/agents/package-builder-production/src/worker.ts`
- **Integration Script:** `/production/scripts/build-package.ts`
