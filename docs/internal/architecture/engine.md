# Engine Package Architecture

**Package:** `@coordinator/engine`
**Location:** `/Users/mattbernier/projects/coordinator/packages/engine/`
**Dependencies:** `@coordinator/contracts` only
**Status:** Core Package - Stable API

## Purpose

The Engine package implements deterministic workflow execution through pure state transitions. It is responsible for orchestrating workflow steps, processing decisions, and managing agent execution while maintaining immutability and determinism.

## Design Philosophy

### WHY Determinism Matters

Deterministic execution enables:

1. **Replay Testing:** Re-run workflows with same inputs → same outputs
2. **Debugging:** Reproduce bugs reliably in development
3. **Auditability:** Understand exactly what happened and why
4. **Temporal Integration:** Future migration to Temporal workflows

### WHY Pure Functions

Pure state transitions provide:

1. **Testability:** No mocks needed for state logic
2. **Composability:** Functions can be combined safely
3. **Parallelization:** Safe concurrent state processing
4. **Reasoning:** Easier to understand and verify

## Architecture

### File Structure

```
packages/engine/src/
├── engine.ts                 # Main Engine class
├── state-transitions.ts      # Pure transition functions
├── index.ts                  # Public exports
├── engine.test.ts           # Engine tests
└── state-transitions.test.ts # Transition tests
```

### Core Components

#### 1. Engine Class

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/engine/src/engine.ts:44-215`

**RESPONSIBILITIES:**
- Maintain workflow state
- Orchestrate execution loop
- Process decisions and responses
- Manage agent execution

**KEY METHODS:**

```typescript
class Engine {
  constructor(initialState: EngineState)
  getState(): EngineState
  processDecision(decision: EngineDecision, context: SpecExecutionContext): EngineState
  processAgentResponse(response: AgentResponse, context: SpecExecutionContext): EngineState
  async runWorkflow(spec: SpecFunction, executor: AgentExecutor, options?: WorkflowOptions): Promise<EngineState>
}
```

#### 2. State Transition Functions

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/engine/src/state-transitions.ts`

**RESPONSIBILITIES:**
- Apply actions to state (pure functions)
- Apply agent responses to state (pure functions)
- Finalize workflow state (pure function)

**KEY FUNCTIONS:**

```typescript
function applyAction(state: EngineState, action: EngineAction, context: SpecExecutionContext): EngineState
function applyAgentResponse(state: EngineState, response: AgentResponse, context: SpecExecutionContext): EngineState
function finalizeState(state: EngineState, context: SpecExecutionContext): EngineState
```

## Determinism

### Controlled Non-Determinism

All sources of non-determinism are controlled via `SpecExecutionContext`:

```typescript
interface SpecExecutionContext {
  readonly now: number;        // Controlled timestamp (not Date.now())
  readonly random: () => number; // Seeded PRNG (not Math.random())
}
```

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/contracts/src/types.ts:124-128`

### Usage in Production

```typescript
// Current implementation (in runWorkflow)
const context: SpecExecutionContext = {
  now: Date.now(),      // Real time for production
  random: Math.random,  // Real randomness for production
};
```

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/engine/src/engine.ts:151-154`

### Usage in Testing

```typescript
// Test implementation
const context: SpecExecutionContext = {
  now: 1000,                 // Fixed timestamp
  random: seededRandom(42),  // Seeded PRNG
};
```

**WHY:** Tests produce identical results on every run, enabling reliable assertions.

## Execution Loop

### Workflow State Machine

```
RUNNING ──┐
          │
          ├─> Generate Decision (Spec)
          │
          ├─> Process Actions (Engine)
          │
          ├─> Execute WAITING Steps (Agents)
          │
          ├─> Process Responses (Engine)
          │
          ├─> Check if finalized
          │   │
          │   ├─ No ──┘
          │   │
          │   └─ Yes
          │      │
          ▼      ▼
     COMPLETED/FAILED
```

### runWorkflow Implementation

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/engine/src/engine.ts:128-214`

```typescript
async runWorkflow(
  spec: SpecFunction,
  agentExecutor: AgentExecutor,
  options: WorkflowOptions = {}
): Promise<EngineState> {
  const { maxIterations = 1000, timeout } = options;
  let iterations = 0;

  while (this.state.status === "RUNNING") {
    // Safety checks
    if (iterations >= maxIterations) throw new Error(...);
    if (timeout && elapsed > timeout) throw new Error(...);

    // 1. Create deterministic context
    const context: SpecExecutionContext = {
      now: Date.now(),
      random: Math.random,
    };

    // 2. Get decision from spec
    const decision = spec(this.getState());

    // 3. Process decision (pure)
    this.processDecision(decision, context);

    // 4. Execute waiting steps (async)
    for (const [stepId, step] of waitingSteps) {
      // Mark IN_PROGRESS
      // Execute agent
      const response = await agentExecutor(stepId, step);
      // Process response
      this.processAgentResponse(response, context);
    }

    iterations++;
  }

  return this.getState();
}
```

### Loop Invariants

1. **State consistency:** State is always valid after each iteration
2. **Progress:** Each iteration moves workflow forward (or terminates)
3. **Termination:** Loop exits when status != RUNNING or safety limit hit
4. **Determinism:** All state updates use controlled context

## State Transitions

### Action Processing

**LOCATION:** State transitions in `state-transitions.ts`

#### REQUEST_WORK Action

Creates a new workflow step:

```typescript
{
  type: "REQUEST_WORK",
  workKind: "GENERATE_CODE",
  payload: { prompt: "..." },
  stepId?: "step-1"  // Optional, generated if not provided
}
```

**RESULT:**
```typescript
state.openSteps[stepId] = {
  kind: "GENERATE_CODE",
  status: "WAITING",
  payload: { prompt: "..." },
  requestedAt: context.now,
  updatedAt: context.now,
}
```

#### REQUEST_APPROVAL Action

Creates an approval step:

```typescript
{
  type: "REQUEST_APPROVAL",
  payload: { changes: [...] },
  stepId?: "approval-1"
}
```

**RESULT:** Similar to REQUEST_WORK, with kind = "APPROVAL"

#### ANNOTATE Action

Stores a key-value artifact:

```typescript
{
  type: "ANNOTATE",
  key: "user_requirements",
  value: { features: [...] }
}
```

**RESULT:**
```typescript
state.artifacts[key] = value
state.log.push({ at: context.now, event: "ANNOTATE", data: { key } })
```

### Response Processing

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/engine/src/state-transitions.ts`

```typescript
function applyAgentResponse(
  state: EngineState,
  response: AgentResponse,
  context: SpecExecutionContext
): EngineState {
  const step = state.openSteps[response.stepId];
  if (!step) throw new Error(...);

  // Update step based on response status
  const updatedStep = {
    ...step,
    status: response.status === 'OK' ? 'DONE' : 'FAILED',
    updatedAt: context.now,
  };

  // Store artifacts if present
  const updatedArtifacts = { ...state.artifacts };
  if (response.artifacts) {
    for (const artifact of response.artifacts) {
      if (artifact.ref) {
        updatedArtifacts[artifact.ref] = artifact;
      }
    }
  }

  return {
    ...state,
    openSteps: {
      ...state.openSteps,
      [response.stepId]: updatedStep,
    },
    artifacts: updatedArtifacts,
    log: [
      ...state.log,
      { at: context.now, event: 'AGENT_RESPONSE', data: response },
    ],
  };
}
```

### Finalization

**LOCATION:** State transitions in `state-transitions.ts`

```typescript
function finalizeState(
  state: EngineState,
  context: SpecExecutionContext
): EngineState {
  // Determine final status based on step outcomes
  const allDone = Object.values(state.openSteps).every(s => s.status === 'DONE');
  const anyFailed = Object.values(state.openSteps).some(s => s.status === 'FAILED');

  const finalStatus = anyFailed ? 'FAILED' :
                      allDone ? 'COMPLETED' :
                      'COMPLETED';

  return {
    ...state,
    status: finalStatus,
    log: [
      ...state.log,
      { at: context.now, event: 'FINALIZE', data: { status: finalStatus } },
    ],
  };
}
```

## Error Handling

### Agent Execution Errors

When agent execution throws an exception:

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/engine/src/engine.ts:188-207`

```typescript
try {
  const response = await agentExecutor(stepId, step);
  this.processAgentResponse(response, context);
} catch (error) {
  // Create error response
  const errorResponse: AgentResponse = {
    goalId: this.state.goalId,
    workflowId: "unknown",
    stepId,
    runId: "unknown",
    agentRole: "unknown",
    status: "FAIL",
    errors: [{
      type: "PROVIDER_ERROR",
      message: error.message,
      retryable: false,
    }],
  };
  this.processAgentResponse(errorResponse, context);
  throw error;  // Re-throw to halt workflow
}
```

**WHY:**
- Records failure in state before re-throwing
- Maintains state consistency
- Allows inspection of final state even on error

### Safety Limits

**Max Iterations:** Prevents infinite loops

```typescript
if (iterations >= maxIterations) {
  throw new Error(`Maximum iterations (${maxIterations}) reached`);
}
```

**Timeout:** Prevents runaway workflows

```typescript
if (timeout && Date.now() - startTime > timeout) {
  throw new Error(`Workflow timeout (${timeout}ms) exceeded`);
}
```

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/engine/src/engine.ts:139-148`

## State Validation

### Initial State Validation

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/engine/src/engine.ts:55-71`

```typescript
private validateState(state: EngineState): void {
  if (!state.goalId) throw new Error("EngineState must have goalId");
  if (!state.status) throw new Error("EngineState must have status");
  if (!state.openSteps) throw new Error("EngineState must have openSteps");
  if (!state.artifacts) throw new Error("EngineState must have artifacts");
  if (!state.log) throw new Error("EngineState must have log");
}
```

**WHY:** Fail fast on invalid state to prevent cryptic downstream errors.

## Immutability

### State Cloning

All state returned from Engine is cloned to prevent external mutation:

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/engine/src/engine.ts:76-78`

```typescript
getState(): EngineState {
  return structuredClone(this.state);
}
```

**WHY:**
- Prevents accidental mutation by callers
- Enforces immutability boundary
- Enables safe concurrent access

### Update Pattern

All internal state updates follow immutable pattern:

```typescript
// ❌ NEVER mutate
this.state.openSteps[stepId] = newStep;

// ✅ ALWAYS create new object
this.state = {
  ...this.state,
  openSteps: {
    ...this.state.openSteps,
    [stepId]: newStep,
  },
};
```

## Performance Characteristics

### Time Complexity

- `processDecision`: O(n) where n = number of actions
- `processAgentResponse`: O(1) for single response
- `runWorkflow`: O(m × a) where m = iterations, a = agents per iteration

### Space Complexity

- State size: O(s + a + l) where:
  - s = number of steps
  - a = number of artifacts
  - l = number of log entries

### Memory Considerations

**CURRENT:** Full state and log kept in memory

**CONCERN:** Long-running workflows accumulate log entries

**FUTURE:**
- Stream log to persistent storage
- Keep summary in memory only
- Implement log rotation/archiving

## Testing Strategy

### Unit Tests

Test pure state transitions in isolation:

```typescript
describe('applyAction', () => {
  it('should add REQUEST_WORK step to state', () => {
    const state = createInitialState();
    const action = { type: 'REQUEST_WORK', workKind: 'TEST', stepId: 'step-1' };
    const context = { now: 1000, random: () => 0.5 };

    const newState = applyAction(state, action, context);

    expect(newState.openSteps['step-1']).toBeDefined();
    expect(newState.openSteps['step-1'].status).toBe('WAITING');
  });
});
```

### Integration Tests

Test Engine with mock spec and agent:

```typescript
describe('Engine.runWorkflow', () => {
  it('should complete simple workflow', async () => {
    const engine = new Engine(initialState);
    const mockSpec = (state) => ({ actions: [], finalize: true });
    const mockExecutor = async () => ({ status: 'OK', ... });

    const finalState = await engine.runWorkflow(mockSpec, mockExecutor);

    expect(finalState.status).toBe('COMPLETED');
  });
});
```

### Determinism Tests

Verify replay produces identical results:

```typescript
it('should produce identical results with same context', () => {
  const context1 = { now: 1000, random: seededRandom(42) };
  const state1 = applyAction(initialState, action, context1);

  const context2 = { now: 1000, random: seededRandom(42) };
  const state2 = applyAction(initialState, action, context2);

  expect(state1).toEqual(state2);
});
```

## Future Enhancements

### Parallel Step Execution

**CURRENT:** Steps execute sequentially in for loop

**FUTURE:** Execute independent steps in parallel

```typescript
const waitingSteps = Object.entries(this.state.openSteps)
  .filter(([_, step]) => step.status === "WAITING");

// Execute all in parallel
const responses = await Promise.all(
  waitingSteps.map(([stepId, step]) =>
    agentExecutor(stepId, step)
  )
);
```

**BENEFIT:** Reduced latency for workflows with independent steps

### Temporal Migration

**FUTURE:** Migrate to Temporal for production workflows

**CHANGES NEEDED:**
- Replace `runWorkflow` with Temporal activities
- Use Temporal's built-in determinism
- Leverage Temporal's durability and retry logic

**COMPATIBILITY:** State transitions remain unchanged (already pure)

### State Snapshots

**FUTURE:** Snapshot state at intervals for long workflows

**IMPLEMENTATION:**
- Persist state after N iterations
- Enable resume from last snapshot
- Reduce replay time for debugging

## Related Documentation

- [Overview](./overview.md) - System architecture
- [Coordinator](./coordinator.md) - DI container and orchestration
- [Specs](./specs.md) - Specification interface
- [Agents](./agents.md) - Agent interface
- [API: Engine API](../api/engine-api.md) - Public API reference
- [Development: Testing](../development/testing.md) - Testing guidelines

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2025-11-09 | Internal Docs Agent | Initial creation |
