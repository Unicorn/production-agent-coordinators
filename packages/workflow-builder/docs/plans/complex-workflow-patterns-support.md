# Complex Workflow Patterns Support

**Date:** 2025-01-XX  
**Status:** Design  
**Version:** 1.0

## Executive Summary

This document outlines the design for adding support for complex workflow patterns found in the package management workflows. The goal is to enable 1:1 component representation of these patterns in the workflow builder UI.

## Patterns Identified

### 1. Phase/Stage Organization
**Example:** `PackageBuilderWorkflow` with phases: INITIALIZE, PLAN, BUILD, VERIFY, COMPLETE

**Requirements:**
- Visual grouping of nodes into phases
- Sequential phase execution
- Phase-level state management
- Phase completion tracking

### 2. Conditional Branching
**Example:** `PackageBuildWorkflow` pre-flight checks with if/else logic

**Requirements:**
- Condition node with multiple output paths (true/false)
- Expression-based conditions
- Variable-based conditions
- Nested conditions (AND/OR)

### 3. Retry Loops
**Example:** Build/test retry loops with coordinator (up to 3 attempts)

**Requirements:**
- Retry node with max attempts
- Retry condition (on failure, on specific error type)
- Exponential backoff configuration
- Retry scope (activity, agent, child workflow)

### 4. Concurrent Child Workflow Spawning
**Example:** `PackageBuilderWorkflow` spawning up to N children with Promise.race()

**Requirements:**
- Concurrent spawn node with max concurrency
- Dependency-aware scheduling
- Promise.race() pattern for completion handling
- Dynamic child workflow spawning

### 5. Dependency-Aware Scheduling
**Example:** Building dependency graphs and respecting dependencies

**Requirements:**
- Dependency graph builder
- Dependency node/edge visualization
- Dependency satisfaction tracking
- Blocking until dependencies complete

### 6. State Management
**Example:** Maintaining state across workflow execution (completedPackages, failedPackages)

**Requirements:**
- State variable nodes
- State update operations (set, append, increment)
- State access in conditions
- State scoping (workflow, phase, loop)

### 7. Long-Running Orchestrators
**Example:** `ContinuousBuilderWorkflow` with signals and continue-as-new

**Requirements:**
- Long-running workflow flag
- Signal handlers (already supported)
- Continue-as-new configuration
- State preservation across continue-as-new

### 8. Cron Scheduling
**Example:** `MCPPollerWorkflow` with scheduled execution

**Requirements:**
- Cron schedule configuration (already partially supported)
- Scheduled workflow trigger
- Recurring execution pattern

## Component Design

### Phase Node
```typescript
type: 'phase'
config: {
  name: string;              // Phase name (e.g., 'INITIALIZE')
  description?: string;
  sequential: boolean;       // Execute child nodes sequentially (default: true)
  maxConcurrency?: number;   // If not sequential, max concurrent children
}
```

**Visual:** Container node that groups child nodes visually

### Condition Node
```typescript
type: 'condition'
config: {
  expression: string;       // JavaScript expression (e.g., 'result.success === true')
  conditions?: Array<{      // Alternative: structured conditions
    variable: string;
    operator: '<' | '>' | '==' | '!=' | '>=' | '<=' | 'contains' | 'startsWith';
    value: any;
  }>;
  operator?: 'AND' | 'OR';  // For multiple conditions
}
```

**Visual:** Diamond shape with two output handles (true/false)

### Retry Node
```typescript
type: 'retry'
config: {
  maxAttempts: number;      // Maximum retry attempts
  retryOn: 'failure' | 'error' | 'condition';  // When to retry
  condition?: string;      // Condition expression if retryOn === 'condition'
  backoff?: {
    type: 'none' | 'linear' | 'exponential';
    initialInterval?: string;  // e.g., '1s', '1m'
    maxInterval?: string;
    multiplier?: number;
  };
  scope: 'activity' | 'agent' | 'child-workflow' | 'block';  // What to retry
}
```

**Visual:** Loop-like node wrapping retryable nodes

### Concurrent Spawn Node
```typescript
type: 'concurrent-spawn'
config: {
  maxConcurrent: number;    // Maximum concurrent children
  workflowType: string;     // Child workflow type/name
  inputMapping: Record<string, string>;  // Map workflow inputs
  completionStrategy: 'race' | 'all' | 'any';  // How to handle completion
  dependencyAware: boolean;  // Respect dependency constraints
  dependencyGraph?: {        // Dependency graph definition
    nodes: Array<{ name: string; dependencies: string[] }>;
  };
}
```

**Visual:** Container node showing concurrent spawns

### State Variable Node
```typescript
type: 'state-variable'
config: {
  name: string;             // Variable name
  operation: 'set' | 'append' | 'increment' | 'decrement' | 'get';
  value?: any;               // Value for set/append
  scope: 'workflow' | 'phase' | 'loop';
  initialValue?: any;        // Initial value
}
```

**Visual:** Variable node with operation indicator

### Dependency Node
```typescript
type: 'dependency'
config: {
  dependsOn: string[];      // Node IDs or workflow names that must complete first
  blocking: boolean;        // Block until dependencies complete
}
```

**Visual:** Edge or node showing dependency relationship

## Implementation Plan

### Phase 1: Core Control Flow
1. Condition/Branch node
2. Loop node (basic)
3. State Variable node

### Phase 2: Advanced Patterns
4. Phase/Stage node
5. Retry node
6. Concurrent Spawn node

### Phase 3: Orchestration
7. Dependency node
8. Long-running orchestrator support
9. Enhanced cron scheduling

## Compiler Updates

The compiler needs to generate code for:

1. **Conditional branching:**
```typescript
const conditionResult = ${conditionExpression};
if (conditionResult) {
  // true branch
} else {
  // false branch
}
```

2. **Retry loops:**
```typescript
let attempts = 0;
while (attempts < maxAttempts) {
  try {
    const result = await activity();
    if (result.success) break;
  } catch (error) {
    attempts++;
    if (attempts >= maxAttempts) throw error;
    await sleep(backoffInterval);
  }
}
```

3. **Concurrent spawning:**
```typescript
const activeBuilds = new Map();
while (hasUnbuiltItems) {
  const ready = getReadyItems();
  const batch = ready.slice(0, maxConcurrent - activeBuilds.size);
  
  for (const item of batch) {
    const handle = await startChild(Workflow, { args: [item] });
    activeBuilds.set(item.id, handle);
  }
  
  const completed = await Promise.race(
    Array.from(activeBuilds.values()).map(h => h.result())
  );
  // Process completion
}
```

4. **Phases:**
```typescript
// Phase: INITIALIZE
await initializePhase();

// Phase: PLAN
await planPhase();

// Phase: BUILD
await buildPhase();
```

## Database Schema Updates

May need to add:
- `component_types` entries for new node types
- `workflow_phases` table for phase organization
- `workflow_state_variables` table for state management

## UI/UX Considerations

1. **Visual Grouping:** Phases should visually group nodes
2. **Condition Visualization:** Clear true/false paths
3. **Retry Indicators:** Show retry count and status
4. **Concurrency Visualization:** Show active concurrent executions
5. **Dependency Graph:** Visual dependency relationships

## Testing Strategy

1. Create test workflows for each pattern
2. Verify compiler generates correct code
3. Test execution in Temporal
4. Validate visual representation in UI

## References

- PackageBuilderWorkflow: `packages/agents/package-builder-production/src/workflows/package-builder.workflow.ts`
- PackageBuildWorkflow: `packages/agents/package-builder-production/src/workflows/package-build.workflow.ts`
- ContinuousBuilderWorkflow: `packages/package-queue-orchestrator/src/workflows/continuous-builder.workflow.ts`
- MCPPollerWorkflow: `packages/package-queue-orchestrator/src/workflows/mcp-poller.workflow.ts`

