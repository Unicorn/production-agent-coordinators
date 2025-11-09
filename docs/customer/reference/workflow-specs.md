# Workflow Specs Reference

Complete reference for built-in workflow specifications and spec development.

## Available Specs

### HelloSpec

Simple single-step greeting workflow.

**Name:** `hello`
**Version:** `1.0.0`
**Package:** `@coordinator/specs-hello`

**Description:**
Demonstrates the most basic workflow pattern: request work, receive response, complete.

**Work Kinds Required:**
- `greet` - Generate a greeting

**Configuration:** None required

**Example:**
```bash
coordinator run hello
```

**Output:**
```json
{
  "greeting": {
    "message": "Hello! I'm ready to help."
  }
}
```

**Use Cases:**
- Learning workflow basics
- Testing setup
- Template for simple workflows

---

### TodoSpec

Multi-step workflow for task management.

**Name:** `todo`
**Version:** `0.1.0`
**Package:** `@coordinator/specs-todo`

**Description:**
Demonstrates stateful multi-step workflow with sequential stages.

**Workflow Stages:**
1. Gather requirements
2. Create tasks based on requirements
3. Confirm completion

**Work Kinds Required:**
- `gather_requirements` - Collect user requirements
- `create_tasks` - Generate task list
- `confirm_completion` - Verify tasks created

**Configuration:**
```json
{
  "specs": {
    "todo": {
      "maxTasks": 10
    }
  }
}
```

**Options:**
- **maxTasks** (number) - Maximum tasks to create (default: 10)

**Example:**
```bash
coordinator run todo --agent anthropic
```

**Output:**
```json
{
  "requirements": {...},
  "tasks": [...],
  "confirmation": {...}
}
```

**Use Cases:**
- Project planning
- Task breakdown
- Multi-stage workflows

## Spec Interface

All specs implement the `ISpec` interface:

```typescript
interface ISpec {
  readonly name: string;

  onAgentCompleted(
    state: EngineState,
    resp: AgentResponse,
    context: SpecExecutionContext
  ): EngineDecision;

  onAgentError?(
    state: EngineState,
    workKind: string,
    error: unknown,
    attemptNumber: number
  ): EngineDecision;

  postApply?(state: EngineState): void;
}
```

### Methods

#### onAgentCompleted

**Required:** Yes

Called when an agent completes work or initially to start workflow.

**Parameters:**
- `state` - Current workflow state
- `resp` - Agent response (or boot response initially)
- `context` - Execution context (now, random)

**Returns:** `EngineDecision` with actions and finalization flag

**Example:**
```typescript
onAgentCompleted(state, resp, context): EngineDecision {
  if ('result' in state.artifacts) {
    // Work complete
    return {
      decisionId: `decision-${context.now}`,
      basedOn: { stepId: resp.stepId, runId: resp.runId },
      actions: [],
      finalize: true
    };
  }

  // Request work
  return {
    decisionId: `decision-${context.now}`,
    basedOn: { stepId: resp.stepId, runId: resp.runId },
    actions: [{
      type: 'REQUEST_WORK',
      workKind: 'do_work',
      payload: {...}
    }],
    finalize: false
  };
}
```

#### onAgentError

**Required:** No (optional)

Called when an agent encounters an error.

**Parameters:**
- `state` - Current workflow state
- `workKind` - Type of work that failed
- `error` - Error information
- `attemptNumber` - Current attempt count

**Returns:** `EngineDecision` with retry or failure handling

**Example:**
```typescript
onAgentError(state, workKind, error, attemptNumber): EngineDecision {
  if (attemptNumber < 3) {
    // Retry
    return {
      decisionId: `retry-${attemptNumber}`,
      actions: [{
        type: 'REQUEST_WORK',
        workKind,
        payload: {...}
      }],
      finalize: false
    };
  }

  // Give up
  return {
    decisionId: `fail-${attemptNumber}`,
    actions: [],
    finalize: true
  };
}
```

#### postApply

**Required:** No (optional)

Called after each state transition for logging or side effects.

**Parameters:**
- `state` - Updated workflow state

**Returns:** void

**Example:**
```typescript
postApply(state: EngineState): void {
  this.context.logger.debug('State updated', {
    goalId: state.goalId,
    status: state.status,
    artifactCount: Object.keys(state.artifacts).length
  });
}
```

## EngineDecision Structure

Returned by spec methods to control workflow.

```typescript
interface EngineDecision {
  decisionId: string;
  basedOn?: { stepId: string; runId: string };
  actions: Action[];
  finalize: boolean;
}
```

### Fields

- **decisionId** (string, required) - Unique decision identifier
  - Must be deterministic
  - Use `context.now` and `context.random()`
  - Example: `decision-${context.now}-${Math.floor(context.random() * 1000000)}`

- **basedOn** (object, optional) - Reference to triggering step
  - `stepId` - Step that triggered this decision
  - `runId` - Run identifier

- **actions** (array, required) - Actions to execute
  - Can be empty array
  - See Action Types below

- **finalize** (boolean, required) - Whether to complete workflow
  - `true` - Workflow ends after these actions
  - `false` - Workflow continues

## Action Types

### REQUEST_WORK

Request agent to execute work.

```typescript
{
  type: 'REQUEST_WORK',
  workKind: string,
  payload: unknown
}
```

**Fields:**
- **workKind** - Type of work to execute
- **payload** - Data passed to agent

**Example:**
```typescript
{
  type: 'REQUEST_WORK',
  workKind: 'analyze_code',
  payload: {
    code: 'function test() { return 42; }',
    language: 'typescript'
  }
}
```

### ANNOTATE

Store data in workflow artifacts.

```typescript
{
  type: 'ANNOTATE',
  key: string,
  value: unknown
}
```

**Fields:**
- **key** - Artifact key
- **value** - Data to store (must be JSON-serializable)

**Example:**
```typescript
{
  type: 'ANNOTATE',
  key: 'analysis_result',
  value: {
    score: 85,
    issues: []
  }
}
```

## Spec Factory Interface

Specs are created through factories:

```typescript
interface ISpecFactory {
  readonly name: string;
  readonly version: string;

  create(context: SpecContext): ISpec;
  describe(): SpecDescriptor;
  validate?(config: unknown): boolean;
}
```

### Methods

#### create

Create spec instance with dependencies injected.

**Parameters:**
- `context` - Spec context (storage, logger, config)

**Returns:** `ISpec` instance

#### describe

Provide spec metadata.

**Returns:** `SpecDescriptor` with:
- `name` - Spec name
- `version` - Spec version
- `description` - Human-readable description
- `requiredWorkKinds` - Work kinds this spec uses
- `configSchema` - JSON schema for configuration

#### validate

Validate spec configuration (optional).

**Parameters:**
- `config` - Configuration to validate

**Returns:** `true` if valid, `false` otherwise

## Creating Custom Specs

### Basic Template

```typescript
import type {
  ISpec,
  ISpecFactory,
  SpecContext,
  SpecDescriptor,
  EngineState,
  AgentResponse,
  EngineDecision,
  SpecExecutionContext,
} from '@coordinator/contracts';

export class MySpec implements ISpec {
  readonly name = 'my-spec';

  constructor(private context: SpecContext) {}

  onAgentCompleted(
    state: EngineState,
    resp: AgentResponse,
    context: SpecExecutionContext
  ): EngineDecision {
    const decisionId = `decision-${context.now}-${Math.floor(context.random() * 1000000)}`;

    // Your workflow logic here

    return {
      decisionId,
      basedOn: { stepId: resp.stepId, runId: resp.runId },
      actions: [],
      finalize: false
    };
  }
}

export class MySpecFactory implements ISpecFactory {
  readonly name = 'my-spec';
  readonly version = '1.0.0';

  create(context: SpecContext): ISpec {
    return new MySpec(context);
  }

  describe(): SpecDescriptor {
    return {
      name: this.name,
      version: this.version,
      description: 'Description of my spec',
      requiredWorkKinds: ['work_kind_1', 'work_kind_2'],
      configSchema: {}
    };
  }

  validate(config: unknown): boolean {
    // Validate configuration
    return true;
  }
}
```

### Spec Context

Specs receive context with dependencies:

```typescript
interface SpecContext {
  storage: IStorage;
  logger: ILogger;
  config: Record<string, unknown>;
}
```

**Usage:**
```typescript
constructor(private context: SpecContext) {
  // Access dependencies
  this.context.logger.info('Spec initialized');
}

async someMethod() {
  // Use storage
  await this.context.storage.write('key', 'value');

  // Use config
  const maxRetries = this.context.config.maxRetries || 3;
}
```

## Best Practices

### 1. Deterministic Decision IDs

Always use context values:

```typescript
// Good
const decisionId = `decision-${context.now}-${Math.floor(context.random() * 1000000)}`;

// Bad - non-deterministic!
const decisionId = `decision-${Date.now()}-${Math.random()}`;
```

### 2. Clear State Management

Use explicit artifact checks:

```typescript
const hasStage1 = 'stage1_result' in state.artifacts;
const hasStage2 = 'stage2_result' in state.artifacts;

if (!hasStage1) {
  // Stage 1 logic
} else if (!hasStage2) {
  // Stage 2 logic
} else {
  // Complete
}
```

### 3. Comprehensive Logging

Log at key points:

```typescript
this.context.logger.info('Starting workflow', { goalId: state.goalId });
this.context.logger.debug('Processing response', { stepId: resp.stepId });
this.context.logger.error('Workflow failed', error);
```

### 4. Error Handling

Implement retry logic:

```typescript
onAgentError(state, workKind, error, attemptNumber): EngineDecision {
  if (attemptNumber < MAX_RETRIES) {
    return { /* retry */ };
  }
  return { /* fail gracefully */ };
}
```

### 5. Configuration Schema

Document expected configuration:

```typescript
describe(): SpecDescriptor {
  return {
    name: this.name,
    version: this.version,
    description: '...',
    configSchema: {
      type: 'object',
      properties: {
        maxItems: {
          type: 'number',
          description: 'Maximum items to process',
          default: 10
        }
      }
    }
  };
}
```

## Related Documentation

- [Create Custom Workflow Guide](../how-to/create-custom-workflow.md)
- [Hello Workflow Guide](../how-to/run-hello-workflow.md)
- [Todo Workflow Guide](../how-to/run-todo-workflow.md)
- [Multi-Step Workflows](../use-cases/multi-step-workflows.md)
