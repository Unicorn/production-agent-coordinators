# @coordinator/engine

Deterministic workflow execution engine for the agent coordinator system.

## Overview

The engine package provides a deterministic workflow execution framework that:

- Implements pure state transition functions (no side effects)
- Isolates all async operations to agent calls
- Ensures deterministic behavior through `SpecExecutionContext`
- Maintains immutable state updates
- Provides a clean separation between workflow logic and execution

## Core Concepts

### Engine State

The engine maintains an `EngineState` that includes:
- `goalId`: Unique identifier for the goal
- `status`: Current workflow status (RUNNING, AWAITING_APPROVAL, COMPLETED, FAILED, CANCELLED)
- `openSteps`: Map of step IDs to step states
- `artifacts`: Key-value store for workflow data
- `log`: Chronological event log

### State Transitions

All state transitions are pure functions that take the current state, an action or response, and a context, then return a new state without mutating the original.

Pure transition functions:
- `applyRequestWork` - Add a new work step
- `applyAnnotate` - Add or update an artifact
- `applyRequestApproval` - Request human approval
- `applyAgentResponse` - Process agent execution results
- `finalizeState` - Mark workflow as completed

### Deterministic Execution

The engine uses `SpecExecutionContext` to ensure deterministic behavior:
- `now`: Controlled timestamp (instead of `Date.now()`)
- `random`: Seeded random function (instead of `Math.random()`)

This allows workflows to be replayed and tested reliably.

## Usage

### Basic Example

```typescript
import { Engine } from "@coordinator/engine";
import type { EngineState, EngineDecision } from "@coordinator/contracts";

// Create initial state
const initialState: EngineState = {
  goalId: "goal-123",
  status: "RUNNING",
  openSteps: {},
  artifacts: {},
  log: [],
};

// Create engine
const engine = new Engine(initialState);

// Define a spec function
function mySpec(state: EngineState): EngineDecision {
  if (Object.keys(state.openSteps).length === 0) {
    return {
      decisionId: "dec-1",
      actions: [
        {
          type: "REQUEST_WORK",
          workKind: "analyze",
          stepId: "step-1",
          payload: { data: "analyze this" },
        },
      ],
    };
  }

  return {
    decisionId: "dec-final",
    actions: [],
    finalize: true,
  };
}

// Define agent executor
async function executeAgent(stepId: string, step: StepState): Promise<AgentResponse> {
  // Execute agent work
  return {
    goalId: "goal-123",
    workflowId: "workflow-1",
    stepId,
    runId: "run-1",
    agentRole: "analyzer",
    status: "OK",
    content: { result: "Analysis complete" },
  };
}

// Run workflow
const finalState = await engine.runWorkflow(mySpec, executeAgent);
console.log(finalState.status); // "COMPLETED"
```

### Processing Decisions

```typescript
import { Engine } from "@coordinator/engine";
import type { SpecExecutionContext } from "@coordinator/contracts";

const engine = new Engine(initialState);

const decision: EngineDecision = {
  decisionId: "dec-1",
  actions: [
    { type: "ANNOTATE", key: "step1", value: "started" },
    { type: "REQUEST_WORK", workKind: "analyze", stepId: "step-1" },
  ],
};

const context: SpecExecutionContext = {
  now: Date.now(),
  random: Math.random,
};

const newState = engine.processDecision(decision, context);
```

### Processing Agent Responses

```typescript
const response: AgentResponse = {
  goalId: "goal-123",
  workflowId: "workflow-1",
  stepId: "step-1",
  runId: "run-1",
  agentRole: "analyzer",
  status: "OK",
  content: { result: "done" },
};

const context: SpecExecutionContext = {
  now: Date.now(),
  random: Math.random,
};

const newState = engine.processAgentResponse(response, context);
```

## Architecture Principles

### Pure State Transitions

All state transition functions are pure:
- No side effects
- No mutations
- Same inputs always produce same outputs
- Easy to test and reason about

### Isolated Async Operations

All async operations are isolated to the `runWorkflow` method:
- Agent execution is the only async operation
- State transitions remain synchronous and pure
- Errors are handled at the execution boundary

### Immutable State Updates

State is never mutated:
- All updates create new state objects
- Original state remains unchanged
- Enables time-travel debugging and replay

### Deterministic Behavior

Using `SpecExecutionContext`:
- Timestamps come from `context.now`
- Random values come from `context.random`
- Same inputs produce same outputs
- Workflows can be reliably replayed

## Testing

Run tests:
```bash
yarn test
```

Watch mode:
```bash
yarn test:watch
```

## API Reference

### Engine

- `constructor(initialState: EngineState)` - Create new engine instance
- `getState(): EngineState` - Get current state (immutable copy)
- `processDecision(decision, context): EngineState` - Process a decision
- `processAgentResponse(response, context): EngineState` - Process agent response
- `runWorkflow(spec, executor, options): Promise<EngineState>` - Run complete workflow

### State Transitions

- `applyRequestWork(state, action, context): EngineState`
- `applyAnnotate(state, action, context): EngineState`
- `applyRequestApproval(state, action, context): EngineState`
- `applyAgentResponse(state, response, context): EngineState`
- `finalizeState(state, context): EngineState`
- `applyAction(state, action, context): EngineState`
- `generateStepId(context): string`

## License

MIT
