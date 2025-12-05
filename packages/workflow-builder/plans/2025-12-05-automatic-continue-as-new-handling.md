# Automatic Continue-as-New Handling Plan

**Date:** 2025-12-05  
**Status:** Planning  
**Principle:** Obfuscate Temporal functionality from users - all continue-as-new handling must be automatic and invisible

---

## Overview

This plan implements automatic continue-as-new handling for long-running services and workflows. All Temporal internals are hidden from users - the system automatically detects service patterns, configures continue-as-new, and handles state preservation without user intervention.

---

## 1. Service Classification System

### 1.1 Automatic Detection Logic

Create a workflow analyzer that automatically classifies workflows as `'service'` or `'task'` based on structural patterns:

**Service Indicators (any of these = service):**
- Has signal handler nodes (`type === 'signal'`)
- Has query handler nodes (`type === 'query'` or `type === 'data-out'` with query interface)
- Has loop nodes with no max iterations (`loop` node with `config.maxIterations === undefined` or `config.maxIterations === null`)
- Has no end nodes (workflow never terminates)
- Has scheduled triggers (`is_scheduled === true` in database)
- Has infinite loops (loop condition that never becomes false)

**Task Indicators (all of these = task):**
- Has explicit end node (`type === 'end'`)
- All loops have max iterations
- No signal handlers
- No query handlers
- Has clear termination path

**Implementation:**
- File: `packages/workflow-builder/src/lib/workflow-analyzer/service-classifier.ts`
- Function: `classifyWorkflow(definition: WorkflowDefinition): 'service' | 'task'`
- Called during workflow save/compile
- Result stored in `workflow.definition.settings._workflowType` (internal, not exposed to UI)

### 1.2 Database Schema Update

Add internal classification field (not exposed in UI):

```sql
-- Migration: Add workflow type classification
ALTER TABLE workflows
  ADD COLUMN workflow_type VARCHAR(20) DEFAULT 'auto' CHECK (workflow_type IN ('service', 'task', 'auto'));

CREATE INDEX idx_workflows_workflow_type ON workflows(workflow_type);

COMMENT ON COLUMN workflows.workflow_type IS 'Internal classification: service (long-running) or task (short-running). Auto-detected from workflow structure.';
```

---

## 2. Automatic Continue-as-New Configuration

### 2.1 Settings Schema Extension

Extend `WorkflowSettings` interface to include internal long-running config:

```typescript
// packages/workflow-builder/src/lib/compiler/types.ts

export interface WorkflowSettings {
  timeout?: string;
  retryPolicy?: RetryPolicy;
  taskQueue?: string;
  description?: string;
  version?: string;
  // Internal: Auto-configured, never exposed to UI
  _longRunning?: {
    autoContinueAsNew: boolean;
    maxHistoryEvents: number;      // Default: 1000
    maxDurationMs: number;         // Default: 24 hours
    preserveState: boolean;       // Always true - preserve all variables
  };
  // Internal: Auto-detected workflow type
  _workflowType?: 'service' | 'task';
}
```

### 2.2 Auto-Configuration Logic

**For Services (workflowType === 'service'):**
- Automatically set `_longRunning.autoContinueAsNew = true`
- Set `maxHistoryEvents = 1000` (default)
- Set `maxDurationMs = 24 * 60 * 60 * 1000` (24 hours)
- Set `preserveState = true`

**For Tasks (workflowType === 'task'):**
- Set `_longRunning.autoContinueAsNew = false`
- No continue-as-new needed

**Implementation:**
- File: `packages/workflow-builder/src/lib/workflow-analyzer/continue-as-new-config.ts`
- Function: `configureContinueAsNew(definition: WorkflowDefinition): WorkflowDefinition`
- Called automatically during workflow save/compile
- Never exposed in UI - completely automatic

---

## 3. Loop Detection and Automatic Continue-as-New

### 3.1 Loop Pattern Detection

Detect loops that may need continue-as-new:

**Loop Indicators:**
- Node with `type === 'loop'`
- Loop with no `maxIterations` in config (infinite loop)
- Loop with `maxIterations > 100` (potentially long-running)
- Loop that contains signal handlers (indicates service pattern)

**Implementation:**
- File: `packages/workflow-builder/src/lib/workflow-analyzer/loop-detector.ts`
- Function: `detectLongRunningLoops(definition: WorkflowDefinition): string[]` (returns node IDs)
- Automatically marks loops for continue-as-new if parent workflow is a service

### 3.2 Compiler Integration

Extend compiler to automatically inject continue-as-new checks:

**Pattern: Continue-as-New Pattern**
- File: `packages/workflow-builder/src/lib/compiler/patterns/continue-as-new-pattern.ts`
- Detects: `settings._longRunning?.autoContinueAsNew === true`
- Generates: Continue-as-new check code at strategic points

**Code Generation:**
```typescript
// Generated code (hidden from user)
if (workflowInfo().historyLength > 1000 || 
    (Date.now() - workflowStartTime) > 24 * 60 * 60 * 1000) {
  // Preserve all workflow variables automatically
  await continueAsNew<typeof WorkflowName>({
    ...state, // All variables preserved automatically
    _workflowStartTime: Date.now(),
    _historyResetCount: (state._historyResetCount || 0) + 1
  });
}
```

**Injection Points:**
1. After each loop iteration (if loop detected)
2. After signal handler processing (if signals detected)
3. Before long-running activity calls (if activity timeout > 1 hour)

---

## 4. State Preservation

### 4.1 Automatic State Collection

Collect all workflow variables automatically for continue-as-new:

**State Collection:**
- All `variables` from `WorkflowDefinition.variables`
- All state variables from state-variable nodes
- All loop iteration counters
- All signal queue state

**Implementation:**
- File: `packages/workflow-builder/src/lib/compiler/state-collector.ts`
- Function: `collectWorkflowState(definition: WorkflowDefinition): StateMap`
- Automatically generates state preservation code

**Generated Code:**
```typescript
// Automatically collect all state
const state = {
  // All workflow variables
  ...workflowVariables,
  // All state variables
  ...stateVariables,
  // Loop counters
  iterationCount: iterationCount,
  // Signal queues
  signalQueue: signalQueue,
  // Internal tracking
  _workflowStartTime: workflowStartTime,
  _historyResetCount: historyResetCount || 0
};

// Continue as new with all state
await continueAsNew<typeof WorkflowName>(state);
```

---

## 5. Migration for Existing Workflows

### 5.1 Migration Script

Create migration to classify and configure existing workflows:

```typescript
// packages/workflow-builder/scripts/migrate-continue-as-new.ts

async function migrateExistingWorkflows() {
  // 1. Fetch all workflows
  const workflows = await supabase.from('workflows').select('*');
  
  for (const workflow of workflows) {
    const definition = workflow.definition as WorkflowDefinition;
    
    // 2. Classify workflow
    const workflowType = classifyWorkflow(definition);
    
    // 3. Configure continue-as-new
    const updatedDefinition = configureContinueAsNew(definition);
    
    // 4. Update database
    await supabase
      .from('workflows')
      .update({
        workflow_type: workflowType,
        definition: updatedDefinition
      })
      .eq('id', workflow.id);
  }
}
```

**Migration Strategy:**
- Run automatically on next deployment
- Aggressively enable continue-as-new for all services (per requirement 5B)
- Log classification results for review
- No user action required

---

## 6. Compiler Pattern Implementation

### 6.1 Continue-as-New Pattern

```typescript
// packages/workflow-builder/src/lib/compiler/patterns/continue-as-new-pattern.ts

export const ContinueAsNewPattern: Pattern = {
  name: 'continue-as-new',
  priority: 10, // Run last, after all other patterns

  detect: (context: GeneratorContext): boolean => {
    return context.settings._longRunning?.autoContinueAsNew === true;
  },

  generate: (context: GeneratorContext): CodeBlock => {
    const config = context.settings._longRunning!;
    const maxEvents = config.maxHistoryEvents || 1000;
    const maxDuration = config.maxDurationMs || 24 * 60 * 60 * 1000;
    
    // Collect all state variables
    const stateVars = collectWorkflowState(context);
    const stateObject = generateStateObject(stateVars);
    
    const imports = [
      `import { continueAsNew, workflowInfo } from '@temporalio/workflow';`
    ];
    
    const checkCode = `
// Automatic history management (internal optimization)
const workflowStartTime = workflowStartTime || Date.now();
const historyLength = workflowInfo().historyLength;

if (historyLength > ${maxEvents} || 
    (Date.now() - workflowStartTime) > ${maxDuration}) {
  console.log('[Workflow] Resetting history for optimal performance');
  
  // Preserve all workflow state automatically
  await continueAsNew<typeof ${context.workflowName}>({
    ${stateObject},
    _workflowStartTime: Date.now(),
    _historyResetCount: (_historyResetCount || 0) + 1
  });
}
    `.trim();
    
    return {
      imports,
      declarations: ['let workflowStartTime: number;'],
      code: checkCode
    };
  }
};
```

### 6.2 Integration with Compiler

Register pattern in compiler:

```typescript
// packages/workflow-builder/src/lib/compiler/index.ts

import { ContinueAsNewPattern } from './patterns/continue-as-new-pattern';

export class WorkflowCompiler {
  private patterns: Pattern[] = [
    // ... other patterns
    ContinueAsNewPattern, // Register continue-as-new pattern
  ];
  
  compile(definition: WorkflowDefinition): CompilerResult {
    // 1. Auto-classify workflow
    const classified = classifyWorkflow(definition);
    definition.settings._workflowType = classified;
    
    // 2. Auto-configure continue-as-new
    const configured = configureContinueAsNew(definition);
    
    // 3. Compile with patterns
    return this.compileWithPatterns(configured);
  }
}
```

---

## 7. Testing Strategy

### 7.1 Unit Tests

**Service Classifier Tests:**
- Test: Detects service with signal handlers
- Test: Detects service with infinite loop
- Test: Detects service with no end node
- Test: Detects task with end node
- Test: Detects task with max iterations

**Continue-as-New Config Tests:**
- Test: Auto-enables for services
- Test: Auto-disables for tasks
- Test: Default values (1000 events, 24h)

**Loop Detection Tests:**
- Test: Detects infinite loops
- Test: Detects long-running loops (>100 iterations)
- Test: Ignores short loops (<10 iterations)

### 7.2 Integration Tests

**Workflow Compilation Tests:**
- Test: Service workflow generates continue-as-new code
- Test: Task workflow does not generate continue-as-new code
- Test: State preservation includes all variables
- Test: Continue-as-new check injected at correct points

**End-to-End Tests:**
- Test: Long-running service workflow (1000+ operations) continues successfully
- Test: State preserved across continue-as-new
- Test: Workflow runs for 24+ hours without history bloat

### 7.3 Migration Tests

- Test: Existing services auto-classified correctly
- Test: Existing services auto-configured with continue-as-new
- Test: Existing tasks remain unchanged

---

## 8. Implementation Checklist

### Phase 1: Core Infrastructure
- [ ] Create `workflow-analyzer` package/module
- [ ] Implement `ServiceClassifier`
- [ ] Implement `ContinueAsNewConfig`
- [ ] Implement `LoopDetector`
- [ ] Implement `StateCollector`
- [ ] Update `WorkflowSettings` interface
- [ ] Create database migration

### Phase 2: Compiler Integration
- [ ] Create `ContinueAsNewPattern`
- [ ] Register pattern in compiler
- [ ] Implement state collection logic
- [ ] Implement code generation
- [ ] Add continue-as-new injection points

### Phase 3: Migration
- [ ] Create migration script
- [ ] Test migration on sample workflows
- [ ] Run migration on existing workflows
- [ ] Verify classification results

### Phase 4: Testing
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Write E2E tests
- [ ] Test long-running workflows (24h+)

### Phase 5: Documentation
- [ ] Document automatic behavior (internal)
- [ ] Update architecture docs
- [ ] Add code comments explaining auto-configuration

---

## 9. File Structure

```
packages/workflow-builder/
├── src/
│   ├── lib/
│   │   ├── workflow-analyzer/
│   │   │   ├── service-classifier.ts      # Auto-classify service vs task
│   │   │   ├── continue-as-new-config.ts  # Auto-configure continue-as-new
│   │   │   ├── loop-detector.ts           # Detect long-running loops
│   │   │   └── state-collector.ts         # Collect state for preservation
│   │   ├── compiler/
│   │   │   ├── patterns/
│   │   │   │   └── continue-as-new-pattern.ts  # Compiler pattern
│   │   │   └── index.ts                   # Register pattern
│   │   └── compiler/
│   │       └── types.ts                   # Extend WorkflowSettings
│   └── scripts/
│       └── migrate-continue-as-new.ts     # Migration script
├── supabase/
│   └── migrations/
│       └── YYYYMMDDHHMMSS_add_workflow_type.sql
└── tests/
    ├── unit/
    │   └── workflow-analyzer/
    ├── integration/
    │   └── continue-as-new/
    └── e2e/
        └── long-running-workflows/
```

---

## 10. Success Criteria

- ✅ All services automatically classified correctly
- ✅ All services automatically configured with continue-as-new
- ✅ Continue-as-new code generated automatically
- ✅ State preserved automatically across continue-as-new
- ✅ No Temporal terminology exposed in UI
- ✅ Existing workflows migrated successfully
- ✅ Long-running workflows (24h+, 1000+ operations) work without history bloat
- ✅ Zero user configuration required

---

## 11. Design Decisions

### 11.1 Why Automatic Detection?

**Decision:** Use automatic detection instead of user configuration

**Rationale:**
- Obfuscates Temporal internals from users
- Reduces cognitive load - users don't need to understand continue-as-new
- Prevents misconfiguration - system makes correct decisions automatically
- Consistent behavior across all workflows

### 11.2 Why Preserve All State?

**Decision:** Automatically preserve all workflow variables

**Rationale:**
- Simplest approach - no user decisions needed
- Prevents data loss - all state preserved by default
- Matches user expectations - workflow continues seamlessly
- Temporal handles serialization automatically

### 11.3 Why Default Thresholds?

**Decision:** Use 1000 events and 24 hours as defaults

**Rationale:**
- 1000 events: Prevents history bloat while allowing reasonable workflow execution
- 24 hours: Matches typical service deployment cycles
- Based on Temporal best practices
- Can be adjusted internally if needed (not exposed to users)

### 11.4 Why Aggressive Migration?

**Decision:** Auto-enable continue-as-new for all existing services

**Rationale:**
- Prevents history bloat in existing long-running workflows
- No risk - continue-as-new is safe and transparent
- Improves performance automatically
- Users don't need to do anything

---

## 12. Related Documentation

- [Long-Running Workflow Patterns](../../../docs/guides/long-running-workflow-patterns.md)
- [Temporal Workflow Standardization](../../../docs/plans/2025-11-13-temporal-workflow-standardization-and-service-architecture.md)
- [Backend Execution Gap Analysis](../../docs/BACKEND_EXECUTION_GAP_ANALYSIS.md)
- [Pattern Library Implementation](packagebuildermigrate/PATTERN-LIBRARY-IMPLEMENTATION.md)

---

## Notes

- **Principle:** All continue-as-new handling is automatic and invisible to users
- **No UI Changes:** No new UI components needed - everything is automatic
- **Backward Compatible:** Existing workflows continue to work, auto-upgraded on next save/compile
- **Performance:** Continue-as-new prevents history bloat, improving workflow performance
- **Internal Only:** All `_longRunning` and `_workflowType` fields are internal and never exposed in UI

