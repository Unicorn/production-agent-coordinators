# Spec Architecture

**Interface:** `ISpec`, `ISpecFactory`
**Location:** `/Users/mattbernier/projects/coordinator/packages/contracts/src/interfaces.ts`
**Implementations:** `packages/specs/hello/`, `packages/specs/todo/`
**Dependencies:** `@coordinator/contracts` ONLY

## Purpose

Specs define workflow decision logic. They evaluate workflow state and generate decisions (actions to take) without knowing how those actions are executed. Specs embody the "what to do next" intelligence of multi-agent workflows.

## Design Philosophy

### WHY Specs Exist

Specs provide:

1. **Separation of Concerns:** Decision logic separate from execution
2. **Reusability:** Same spec works with different agent implementations
3. **Testability:** Test decision logic without running agents
4. **Pluggability:** Swap specs at runtime for different workflows

### WHY Specs Cannot Depend on Engine

**CRITICAL RULE:** Specs depend on `contracts` ONLY, never `engine`.

**REASONS:**

1. **Prevent Circular Dependency:** Engine uses ISpec → Spec cannot use Engine
2. **Enable Dynamic Loading:** Specs loaded as plugins cannot require engine
3. **Clean Abstraction:** Specs don't need to know about execution details
4. **Future Plugin System:** Hot-reload specs without engine restart

**ENFORCED BY:** TypeScript references in `tsconfig.json`

## ISpec Interface

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/contracts/src/interfaces.ts`

```typescript
interface ISpec {
  readonly name: string;

  onAgentCompleted(
    state: EngineState,
    response: AgentResponse,
    context: SpecExecutionContext
  ): EngineDecision;

  onAgentError?(
    state: EngineState,
    workKind: string,
    error: AgentError,
    attemptNumber: number
  ): EngineDecision;
}
```

### onAgentCompleted

**PURPOSE:** Generate next decision based on completed agent work.

**PARAMETERS:**
- `state`: Current workflow state (read-only)
- `response`: Agent's response from last execution
- `context`: Deterministic context (now, random)

**RETURNS:** `EngineDecision` with actions and finalize flag

**CALLED BY:** Engine after processing each agent response

**EXAMPLE:**

```typescript
onAgentCompleted(
  state: EngineState,
  resp: AgentResponse,
  context: SpecExecutionContext
): EngineDecision {
  // Check if agent succeeded
  if (resp.status !== 'OK') {
    return {
      decisionId: `dec-${context.now}`,
      basedOn: { stepId: resp.stepId },
      actions: [],
      finalize: true,  // Give up on failure
    };
  }

  // Request next step
  return {
    decisionId: `dec-${context.now}`,
    basedOn: { stepId: resp.stepId },
    actions: [{
      type: 'REQUEST_WORK',
      workKind: 'REVIEW_CODE',
      payload: { code: resp.content },
    }],
    finalize: false,  // Continue workflow
  };
}
```

### onAgentError (Optional)

**PURPOSE:** Handle agent errors with custom retry logic.

**PARAMETERS:**
- `state`: Current workflow state
- `workKind`: Type of work that failed
- `error`: Error details from agent
- `attemptNumber`: How many times this work has been attempted

**RETURNS:** `EngineDecision` with retry or abort

**EXAMPLE:**

```typescript
onAgentError(
  state: EngineState,
  workKind: string,
  error: AgentError,
  attemptNumber: number
): EngineDecision {
  // Retry rate limits with exponential backoff
  if (error.type === 'RATE_LIMIT' && attemptNumber < 3) {
    return {
      decisionId: `dec-retry-${attemptNumber}`,
      actions: [{
        type: 'REQUEST_WORK',
        workKind,
        payload: state.artifacts[`${workKind}_payload`],
      }],
    };
  }

  // Give up on other errors
  return {
    decisionId: `dec-abort`,
    actions: [],
    finalize: true,
  };
}
```

## ISpecFactory Interface

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/contracts/src/interfaces.ts`

```typescript
interface ISpecFactory {
  readonly name: string;
  readonly version: string;

  create(context: SpecContext): ISpec;
  describe(): SpecDescriptor;
}
```

### create

**PURPOSE:** Create spec instance with injected dependencies.

**PARAMETERS:**
- `context`: SpecContext with storage, logger, config

**RETURNS:** ISpec instance

**EXAMPLE:**

```typescript
create(context: SpecContext): ISpec {
  return new MySpec(context);
}
```

### describe

**PURPOSE:** Provide metadata about spec without instantiation.

**RETURNS:** SpecDescriptor with name, version, description, requirements

**EXAMPLE:**

```typescript
describe(): SpecDescriptor {
  return {
    name: 'todo-generator',
    version: '1.0.0',
    description: 'Multi-step todo app generator',
    requiredWorkKinds: ['GENERATE_CODE', 'GENERATE_TESTS', 'REVIEW_CODE'],
    configSchema: {
      outputDir: { type: 'string', required: true },
      includeTests: { type: 'boolean', default: true },
    },
  };
}
```

## EngineDecision Structure

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/contracts/src/types.ts:24-29`

```typescript
interface EngineDecision {
  decisionId: string;
  basedOn?: { stepId?: string; runId?: string };
  actions: EngineAction[];
  finalize?: boolean;
}
```

### Fields

**decisionId:** Unique identifier for this decision (use `context.now` for determinism)

**basedOn:** Which step/run triggered this decision (for traceability)

**actions:** Array of actions to execute (see Action Types below)

**finalize:** If true, marks workflow as complete

## Action Types

### REQUEST_WORK

**PURPOSE:** Request agent to perform work.

```typescript
{
  type: 'REQUEST_WORK',
  workKind: string,       // Type of work (e.g., 'GENERATE_CODE')
  payload?: unknown,      // Work-specific data
  stepId?: string,        // Optional ID (auto-generated if omitted)
}
```

**RESULT:** Creates WAITING step in state.openSteps

**EXAMPLE:**

```typescript
{
  type: 'REQUEST_WORK',
  workKind: 'GENERATE_CODE',
  payload: { prompt: 'Create a React component', language: 'typescript' },
  stepId: 'generate-1',
}
```

### REQUEST_APPROVAL

**PURPOSE:** Request human approval.

```typescript
{
  type: 'REQUEST_APPROVAL',
  payload?: unknown,      // Approval request data
  stepId?: string,
}
```

**RESULT:** Creates WAITING step with kind = 'APPROVAL'

**EXAMPLE:**

```typescript
{
  type: 'REQUEST_APPROVAL',
  payload: {
    changes: ['Created 5 files', 'Modified 2 files'],
    question: 'Apply these changes?',
  },
}
```

### ANNOTATE

**PURPOSE:** Store artifact in state.artifacts.

```typescript
{
  type: 'ANNOTATE',
  key: string,           // Artifact key
  value: unknown,        // Artifact value
}
```

**RESULT:** Sets `state.artifacts[key] = value`

**EXAMPLE:**

```typescript
{
  type: 'ANNOTATE',
  key: 'user_requirements',
  value: {
    features: ['authentication', 'database', 'API'],
    tech_stack: 'React + Node.js',
  },
}
```

## Spec Implementation Patterns

### Pattern 1: Linear Workflow

**USE CASE:** Fixed sequence of steps.

```typescript
class LinearSpec implements ISpec {
  readonly name = 'linear-workflow';
  private steps = ['STEP_A', 'STEP_B', 'STEP_C'];

  onAgentCompleted(state, resp, context): EngineDecision {
    if (resp.status !== 'OK') {
      return { decisionId: `${context.now}`, actions: [], finalize: true };
    }

    // Find current step index
    const currentIndex = this.steps.indexOf(resp.content?.workKind);
    const nextIndex = currentIndex + 1;

    // If more steps, request next
    if (nextIndex < this.steps.length) {
      return {
        decisionId: `${context.now}`,
        actions: [{
          type: 'REQUEST_WORK',
          workKind: this.steps[nextIndex],
        }],
      };
    }

    // No more steps, finalize
    return {
      decisionId: `${context.now}`,
      actions: [],
      finalize: true,
    };
  }
}
```

### Pattern 2: Conditional Branching

**USE CASE:** Different paths based on agent output.

```typescript
onAgentCompleted(state, resp, context): EngineDecision {
  if (resp.workKind === 'ANALYZE') {
    const needsRefactor = resp.content?.refactorNeeded;

    if (needsRefactor) {
      return {
        decisionId: `${context.now}`,
        actions: [{
          type: 'REQUEST_WORK',
          workKind: 'REFACTOR',
          payload: resp.content,
        }],
      };
    } else {
      return {
        decisionId: `${context.now}`,
        actions: [{
          type: 'REQUEST_WORK',
          workKind: 'GENERATE_TESTS',
          payload: resp.content,
        }],
      };
    }
  }

  // ... handle other work kinds
}
```

### Pattern 3: Parallel Execution

**USE CASE:** Multiple independent tasks.

```typescript
onAgentCompleted(state, resp, context): EngineDecision {
  if (resp.workKind === 'BOOT') {
    // Request multiple steps in parallel
    return {
      decisionId: `${context.now}`,
      actions: [
        { type: 'REQUEST_WORK', workKind: 'GENERATE_CODE', stepId: 'code' },
        { type: 'REQUEST_WORK', workKind: 'GENERATE_TESTS', stepId: 'tests' },
        { type: 'REQUEST_WORK', workKind: 'GENERATE_DOCS', stepId: 'docs' },
      ],
    };
  }

  // Wait for all steps to complete
  const allDone = ['code', 'tests', 'docs'].every(
    id => state.openSteps[id]?.status === 'DONE'
  );

  if (allDone) {
    return {
      decisionId: `${context.now}`,
      actions: [],
      finalize: true,
    };
  }

  // Still waiting
  return {
    decisionId: `${context.now}`,
    actions: [],
  };
}
```

### Pattern 4: Map-Reduce

**USE CASE:** Process items, then aggregate results.

```typescript
onAgentCompleted(state, resp, context): EngineDecision {
  if (resp.workKind === 'SPLIT') {
    const items = resp.content?.items || [];

    // Map: Create work for each item
    return {
      decisionId: `${context.now}`,
      actions: items.map((item, i) => ({
        type: 'REQUEST_WORK',
        workKind: 'PROCESS_ITEM',
        payload: { item },
        stepId: `item-${i}`,
      })),
    };
  }

  // Check if all items processed
  const allProcessed = Object.values(state.openSteps)
    .filter(s => s.kind === 'PROCESS_ITEM')
    .every(s => s.status === 'DONE');

  if (allProcessed && resp.workKind === 'PROCESS_ITEM') {
    // Reduce: Aggregate results
    return {
      decisionId: `${context.now}`,
      actions: [{
        type: 'REQUEST_WORK',
        workKind: 'AGGREGATE',
        payload: { results: state.artifacts },
      }],
    };
  }

  if (resp.workKind === 'AGGREGATE') {
    return {
      decisionId: `${context.now}`,
      actions: [],
      finalize: true,
    };
  }

  // Still processing items
  return {
    decisionId: `${context.now}`,
    actions: [],
  };
}
```

## Example: HelloSpec

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/specs/hello/src/hello-spec.ts`

**WORKFLOW:** Single-step greeting workflow.

```typescript
export class HelloSpecFactory implements ISpecFactory {
  readonly name = 'hello';
  readonly version = '1.0.0';

  create(context: SpecContext): ISpec {
    return new HelloSpec(context);
  }

  describe(): SpecDescriptor {
    return {
      name: this.name,
      version: this.version,
      description: 'Simple greeting workflow',
      requiredWorkKinds: ['HELLO'],
      configSchema: {
        workKind: { type: 'string', required: true },
      },
    };
  }
}

class HelloSpec implements ISpec {
  readonly name = 'hello';

  constructor(private context: SpecContext) {}

  onAgentCompleted(
    state: EngineState,
    resp: AgentResponse,
    execContext: SpecExecutionContext
  ): EngineDecision {
    // Boot decision: request initial work
    if (resp.workKind === 'BOOT') {
      const workKind = this.context.config.workKind as string;

      return {
        decisionId: `dec-${execContext.now}`,
        basedOn: { stepId: resp.stepId, runId: resp.runId },
        actions: [{
          type: 'REQUEST_WORK',
          workKind,
          stepId: `step-${execContext.now}`,
        }],
        finalize: false,
      };
    }

    // Completion decision: finalize after greeting
    const finalize = resp.status === 'OK';

    return {
      decisionId: `dec-${execContext.now}`,
      basedOn: { stepId: resp.stepId, runId: resp.runId },
      actions: [],
      finalize,
    };
  }
}
```

## Testing Specs

### Unit Tests

Test decision logic in isolation:

```typescript
describe('HelloSpec', () => {
  let spec: HelloSpec;
  let context: SpecContext;

  beforeEach(() => {
    context = {
      storage: mockStorage,
      logger: mockLogger,
      config: { workKind: 'HELLO' },
    };
    spec = new HelloSpec(context);
  });

  it('should request work on boot', () => {
    const state = createInitialState();
    const bootResponse = createBootResponse();
    const execContext = { now: 1000, random: () => 0.5 };

    const decision = spec.onAgentCompleted(state, bootResponse, execContext);

    expect(decision.actions).toHaveLength(1);
    expect(decision.actions[0].type).toBe('REQUEST_WORK');
    expect(decision.actions[0].workKind).toBe('HELLO');
  });

  it('should finalize on success', () => {
    const state = createStateWithStep('step-1', 'DONE');
    const successResponse = createAgentResponse('step-1', 'OK');
    const execContext = { now: 1000, random: () => 0.5 };

    const decision = spec.onAgentCompleted(state, successResponse, execContext);

    expect(decision.finalize).toBe(true);
  });
});
```

### Integration Tests

Test spec with real engine:

```typescript
describe('HelloSpec integration', () => {
  it('should complete workflow', async () => {
    const container = new Container();
    // ... setup container

    const coordinator = new Coordinator(container);
    coordinator.registerSpec(new HelloSpecFactory());

    const spec = coordinator.createSpec('hello', { workKind: 'HELLO' });
    const engine = new Engine(createInitialState());

    const finalState = await engine.runWorkflow(
      (state) => spec.onAgentCompleted(state, lastResponse, context),
      mockAgentExecutor
    );

    expect(finalState.status).toBe('COMPLETED');
  });
});
```

## Best Practices

### 1. Use Deterministic IDs

```typescript
// ✅ GOOD: Use context.now
decisionId: `dec-${context.now}`

// ❌ BAD: Use Date.now()
decisionId: `dec-${Date.now()}`
```

### 2. Check Agent Status

```typescript
// ✅ GOOD: Check status before proceeding
if (resp.status !== 'OK') {
  return { decisionId: '...', actions: [], finalize: true };
}

// ❌ BAD: Assume success
const result = resp.content;  // May be undefined on failure
```

### 3. Validate State

```typescript
// ✅ GOOD: Validate state before using
const step = state.openSteps[stepId];
if (!step || step.status !== 'DONE') {
  throw new Error(`Step ${stepId} not done`);
}

// ❌ BAD: Assume step exists
const payload = state.openSteps[stepId].payload;
```

### 4. Use TypeScript Generics

```typescript
// ✅ GOOD: Type payload
interface CodeGenPayload {
  prompt: string;
  language: string;
}

const payload = resp.content as CodeGenPayload;

// ❌ BAD: Unsafe cast
const payload = resp.content;
```

## Related Documentation

- [Overview](./overview.md) - System architecture
- [Engine](./engine.md) - How decisions are processed
- [Agents](./agents.md) - How work is executed
- [API: Contracts](../api/contracts.md) - Interface definitions
- [Development: Adding Packages](../development/adding-packages.md) - Create new spec

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2025-11-09 | Internal Docs Agent | Initial creation |
