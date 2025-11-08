# Architecture

This document provides a comprehensive overview of the Agent Coordinator system architecture, design patterns, and implementation details.

## Table of Contents

- [System Overview](#system-overview)
- [Core Design Principles](#core-design-principles)
- [Package Architecture](#package-architecture)
- [Data Flow](#data-flow)
- [State Management](#state-management)
- [Dependency Injection](#dependency-injection)
- [Error Handling](#error-handling)
- [Determinism and Replay](#determinism-and-replay)
- [Extension Points](#extension-points)
- [Design Patterns](#design-patterns)
- [Performance Considerations](#performance-considerations)

## System Overview

The Agent Coordinator is a multi-layer architecture designed for orchestrating AI agent workflows with deterministic execution guarantees.

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     Application Layer                        │
│                  (CLI, Future: Web UI)                       │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                   Coordination Layer                         │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐ │
│  │   Container    │  │   Coordinator  │  │   Factories    │ │
│  │   (Service     │  │   (Orchestr.)  │  │   (Creation)   │ │
│  │   Locator)     │  │                │  │                │ │
│  └────────────────┘  └────────────────┘  └────────────────┘ │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                    Execution Layer                           │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                   Engine                               │  │
│  │  • Pure state transitions                             │  │
│  │  • Deterministic execution                            │  │
│  │  • Workflow orchestration                             │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                   Domain Layer                               │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │   Specifications │         │      Agents       │          │
│  │   • HelloSpec    │         │   • MockAgent     │          │
│  │   • TodoSpec     │         │   • Anthropic     │          │
│  │   • CustomSpecs  │         │   • CustomAgents  │          │
│  └──────────────────┘         └──────────────────┘          │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                 Infrastructure Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Storage    │  │    Logger    │  │  Contracts   │       │
│  │   (Local/S3) │  │  (Console)   │  │  (Types)     │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└──────────────────────────────────────────────────────────────┘
```

## Core Design Principles

### 1. Deterministic Execution

All workflow state transitions are deterministic, enabling reliable replay and testing:

- **Pure Functions**: State transitions have no side effects
- **Deterministic Context**: Controlled timestamps and random values
- **Immutable State**: State objects are never mutated
- **Reproducible Results**: Same inputs always produce same outputs

```typescript
// Example: Deterministic state transition
function applyRequestWork(
  state: EngineState,
  action: RequestWorkAction,
  context: SpecExecutionContext
): EngineState {
  // Pure function - no side effects
  // Uses context.now and context.random for determinism
  return {
    ...state,
    openSteps: {
      ...state.openSteps,
      [action.stepId]: {
        kind: action.workKind,
        status: 'WAITING',
        payload: action.payload,
        createdAt: context.now, // Deterministic timestamp
      },
    },
  };
}
```

### 2. Dependency Injection

Components receive dependencies through factory-created contexts:

- **Factory Pattern**: All components created via factories
- **Context Objects**: Dependencies bundled in context objects
- **Service Locator**: Container manages singleton services
- **Testability**: Easy to mock dependencies for testing

### 3. Separation of Concerns

Clear boundaries between layers:

- **Contracts**: Pure TypeScript interfaces with zero dependencies
- **Engine**: Workflow execution logic, no domain knowledge
- **Specs/Agents**: Domain logic, no workflow knowledge
- **Infrastructure**: Cross-cutting concerns (storage, logging)

### 4. Type Safety

Strict TypeScript configuration ensures type safety:

- **Strict Mode**: All packages use `strict: true`
- **No Implicit Any**: Explicit typing required
- **Type Inference**: Leverage TypeScript's type inference
- **Generic Constraints**: Properly typed payloads and results

## Package Architecture

### Dependency Graph

```
┌─────────────────────────────────────────────────────────────┐
│                        contracts                             │
│                    (Pure Interfaces)                         │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┬──────────────┐
          │               │               │              │
          ▼               ▼               ▼              ▼
    ┌─────────┐     ┌─────────┐    ┌─────────┐    ┌─────────┐
    │ engine  │     │ storage │    │ specs/* │    │agents/* │
    └────┬────┘     └─────────┘    └─────────┘    └─────────┘
         │
         ▼
    ┌─────────────┐
    │ coordinator │
    └──────┬──────┘
           │
           ▼
    ┌─────────┐
    │   cli   │
    └─────────┘
```

### Package Responsibilities

#### contracts/

**Purpose**: Pure TypeScript interfaces and types

**Key Exports**:
- `EngineState`: Workflow state structure
- `ISpec`, `ISpecFactory`: Specification interfaces
- `IAgent`, `IAgentFactory`: Agent interfaces
- `IStorage`, `ILogger`: Infrastructure interfaces
- `AgentResult`, `AgentResponse`: Result types

**Dependencies**: None (zero dependencies)

#### engine/

**Purpose**: Deterministic workflow execution

**Key Exports**:
- `Engine`: Main workflow execution class
- State transition functions (`applyRequestWork`, `applyAgentResponse`, etc.)
- `generateStepId`: Deterministic ID generation

**Dependencies**: `contracts`

**Principles**:
- Pure functions for all state transitions
- No async operations except in `runWorkflow`
- Deterministic execution via `SpecExecutionContext`
- Immutable state updates

#### coordinator/

**Purpose**: Dependency injection and orchestration

**Key Exports**:
- `Container`: Service locator and factory registry
- `Coordinator`: High-level orchestration API
- `ConsoleLogger`: Console-based logger implementation

**Dependencies**: `contracts`, `engine`

**Responsibilities**:
- Register and resolve factories
- Manage singleton services (storage, logger)
- Create spec and agent instances with proper contexts
- Provide configuration management

#### storage/

**Purpose**: Storage implementations

**Key Exports**:
- `LocalFileStorage`: File-based storage for local development

**Dependencies**: `contracts`

**Future**: S3Storage, GCSStorage, DatabaseBlobStorage

#### specs/

**Purpose**: Workflow specification implementations

**Packages**:
- `specs/hello`: Simple greeting workflow
- `specs/todo`: Multi-step todo app generator

**Dependencies**: `contracts` ONLY (never `engine`!)

**Critical Rule**: Specs must not depend on `engine` to prevent circular dependencies and enable dynamic loading.

#### agents/

**Purpose**: Agent implementations

**Packages**:
- `agents/mock`: Deterministic mock agents for testing
- `agents/anthropic`: Claude-powered agents

**Dependencies**: `contracts` ONLY (never `engine`!)

**Critical Rule**: Agents must not depend on `engine` to prevent circular dependencies.

#### cli/

**Purpose**: Command-line interface

**Key Exports**:
- CLI commands for running workflows
- Example scripts

**Dependencies**: All packages (integration layer)

## Data Flow

### Workflow Execution Flow

```
1. Initialize Engine
   │
   ├─> Create initial EngineState
   │
   ▼
2. Spec generates boot decision
   │
   ├─> Create REQUEST_WORK actions
   │
   ▼
3. Engine processes decision
   │
   ├─> Apply actions to state
   ├─> Create WAITING steps
   │
   ▼
4. Engine detects WAITING steps
   │
   ├─> Extract step details
   │
   ▼
5. Agent executor invoked
   │
   ├─> Agent.execute() called
   ├─> Returns AgentResult
   │
   ▼
6. Convert to AgentResponse
   │
   ├─> Map AgentResult to AgentResponse
   │
   ▼
7. Engine processes response
   │
   ├─> Update step status (IN_PROGRESS → DONE/FAILED)
   ├─> Store artifacts
   │
   ▼
8. Spec.onAgentCompleted()
   │
   ├─> Evaluate state
   ├─> Generate next EngineDecision
   │
   ▼
9. Repeat from step 3 until finalized
```

### State Transition Flow

```typescript
// Pure state transition pipeline
initialState
  → applyRequestWork(state, action, context)
  → applyAgentResponse(state, response, context)
  → applyAnnotate(state, action, context)
  → finalizeState(state, context)
  → finalState
```

## State Management

### EngineState Structure

```typescript
interface EngineState {
  goalId: string;                  // Workflow identifier
  status: WorkflowStatus;          // RUNNING | AWAITING_APPROVAL | COMPLETED | FAILED | CANCELLED
  openSteps: Record<string, StepState>;  // Active workflow steps
  artifacts: Record<string, unknown>;    // Key-value artifact store
  log: LogEntry[];                 // Chronological event log
}
```

### StepState Lifecycle

```
WAITING
   │
   ├─> Agent picks up work
   │
   ▼
IN_PROGRESS
   │
   ├─> Agent completes successfully
   │
   ▼
DONE
```

or

```
IN_PROGRESS
   │
   ├─> Agent encounters error
   │
   ▼
FAILED
```

### Artifact Management

Artifacts are stored as key-value pairs:

```typescript
state.artifacts = {
  'greeting': { message: 'Hello, World!' },
  'file-content': { path: 'file://./output/result.txt' },
  'analysis': { confidence: 0.95, result: '...' },
};
```

## Dependency Injection

### Factory Pattern

All components are created through factories:

```typescript
// Spec Factory
class HelloSpecFactory implements ISpecFactory {
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
    };
  }
}

// Agent Factory
class MockAgentFactory implements IAgentFactory {
  readonly supportedWorkKinds = ['HELLO'];

  create(context: AgentContext): IAgent {
    return new MockAgent(context);
  }

  describe(): AgentDescriptor {
    return {
      name: 'mock-agent',
      version: '1.0.0',
      supportedWorkKinds: this.supportedWorkKinds,
    };
  }
}
```

### Context Objects

Dependencies are injected via context objects:

#### SpecContext

```typescript
interface SpecContext {
  storage: IStorage;   // Artifact storage
  logger: ILogger;     // Logging service
  config: Record<string, unknown>;  // Spec-specific config
}
```

#### AgentContext

```typescript
interface AgentContext {
  storage: IStorage;   // Artifact storage
  logger: ILogger;     // Logging service
  apiKeys: Record<string, string>;  // API credentials
  config: Record<string, unknown>;  // Agent-specific config
}
```

### Container Registration

```typescript
// Setup container
const container = new Container();
container.registerStorage(new LocalFileStorage('./output'));
container.registerLogger(new ConsoleLogger('APP'));

// Register factories
const coordinator = new Coordinator(container);
coordinator.registerSpec(new HelloSpecFactory());
coordinator.registerAgent('mock', new MockAgentFactory(['HELLO']));

// Create instances with injected dependencies
const spec = coordinator.createSpec('hello', { workKind: 'HELLO' });
const agent = coordinator.createAgent('mock', {}, {});
```

## Error Handling

### Multi-Layer Error Handling

#### Layer 1: Agent-Level

Agents catch and wrap provider errors:

```typescript
async execute(workKind: string, payload: unknown): Promise<AgentResult> {
  try {
    const result = await this.callProvider(payload);
    return { status: 'OK', content: result };
  } catch (error) {
    if (isRateLimitError(error)) {
      return {
        status: 'RATE_LIMITED',
        errors: [{
          type: 'RATE_LIMIT',
          message: error.message,
          retryable: true,
          retryAfterMs: 60000,
        }],
      };
    }
    // ... handle other error types
  }
}
```

#### Layer 2: Engine-Level

Engine propagates errors through state:

```typescript
// Agent failure updates step status
const newState = applyAgentResponse(state, {
  status: 'FAIL',
  errors: [{ type: 'RATE_LIMIT', message: '...' }],
}, context);

// Step marked as FAILED
newState.openSteps[stepId].status === 'FAILED';
```

#### Layer 3: Spec-Level

Specs decide retry strategy:

```typescript
onAgentCompleted(state: EngineState, resp: AgentResponse): EngineDecision {
  if (resp.status === 'FAIL') {
    const error = resp.errors?.[0];

    if (error?.retryable && attemptNumber < 3) {
      // Retry with exponential backoff
      return {
        actions: [{
          type: 'REQUEST_WORK',
          workKind: resp.workKind,
          payload: originalPayload,
        }],
      };
    }

    // Give up
    return { actions: [], finalize: true };
  }

  // Success path...
}
```

### Error Taxonomy

```typescript
type ErrorType =
  | 'RATE_LIMIT'           // Provider rate limiting
  | 'CONTEXT_EXCEEDED'     // Prompt too long
  | 'INVALID_REQUEST'      // Malformed request
  | 'PROVIDER_ERROR'       // Provider-side error
  | 'VALIDATION_ERROR'     // Response validation failed
  | 'TIMEOUT';             // Execution timeout
```

## Determinism and Replay

### Deterministic Context

All non-deterministic operations use controlled values:

```typescript
interface SpecExecutionContext {
  now: number;           // Controlled timestamp (not Date.now())
  random: () => number;  // Seeded PRNG (not Math.random())
}
```

### Usage in State Transitions

```typescript
function generateStepId(context: SpecExecutionContext): string {
  // Deterministic ID generation
  return `step-${context.now}-${Math.floor(context.random() * 1000)}`;
}

function applyAnnotate(
  state: EngineState,
  action: AnnotateAction,
  context: SpecExecutionContext
): EngineState {
  return {
    ...state,
    artifacts: {
      ...state.artifacts,
      [action.key]: action.value,
    },
    log: [
      ...state.log,
      {
        timestamp: context.now,  // Deterministic timestamp
        event: 'ANNOTATE',
        key: action.key,
      },
    ],
  };
}
```

### Replay Testing

Determinism enables replay testing:

```typescript
// Record execution
const events = [];
const context1 = { now: 1000, random: seededRandom(42) };
const state1 = executeWorkflow(spec, context1, events);

// Replay execution
const context2 = { now: 1000, random: seededRandom(42) };
const state2 = executeWorkflow(spec, context2, events);

// States should be identical
expect(state1).toEqual(state2);
```

## Extension Points

### Custom Specifications

Implement `ISpec` interface to create custom workflows:

```typescript
class CustomSpec implements ISpec {
  readonly name = 'custom-spec';

  onAgentCompleted(
    state: EngineState,
    resp: AgentResponse,
    context: SpecExecutionContext
  ): EngineDecision {
    // Your workflow logic here
  }

  onAgentError?(
    state: EngineState,
    workKind: string,
    error: AgentError,
    attemptNumber: number
  ): EngineDecision {
    // Custom error handling
  }
}
```

### Custom Agents

Implement `IAgent` interface for custom execution:

```typescript
class CustomAgent implements IAgent {
  async execute(
    workKind: string,
    payload: unknown,
    context: AgentExecutionContext
  ): Promise<AgentResult> {
    // Your agent logic here
  }
}
```

### Custom Storage

Implement `IStorage` interface for different backends:

```typescript
class S3Storage implements IStorage {
  async write(key: string, data: Buffer | string): Promise<string> {
    // Upload to S3
    return `s3://bucket/${key}`;
  }

  async read(key: string): Promise<Buffer> {
    // Download from S3
  }

  async exists(key: string): Promise<boolean> {
    // Check if key exists
  }

  async delete(key: string): Promise<void> {
    // Delete from S3
  }

  async list(prefix: string): Promise<string[]> {
    // List keys with prefix
  }
}
```

## Design Patterns

### 1. Factory Pattern

Used for component creation with dependency injection:

- `ISpecFactory` creates `ISpec` instances
- `IAgentFactory` creates `IAgent` instances
- Enables configuration validation before instantiation
- Provides metadata via `describe()` method

### 2. Service Locator Pattern

`Container` class acts as central registry:

- Register singleton services (storage, logger)
- Register and resolve factories by name
- Manage application configuration
- Create contexts with injected dependencies

### 3. Strategy Pattern

Specs define pluggable decision strategies:

- Engine executes any spec that implements `ISpec`
- Specs define custom workflow logic
- Easy to swap spec implementations
- Testable in isolation

### 4. Template Method Pattern

`Engine.runWorkflow()` defines workflow template:

```typescript
async runWorkflow(
  spec: SpecFunction,
  executor: AgentExecutor,
  options?: RunOptions
): Promise<EngineState> {
  // 1. Initialize
  // 2. While not finalized:
  //    a. Get decision from spec
  //    b. Process decision
  //    c. Execute agents for WAITING steps
  //    d. Process responses
  // 3. Return final state
}
```

### 5. Immutable Data Pattern

All state transitions create new objects:

```typescript
// Never mutate state
state.openSteps[stepId] = newStep;  // ❌ BAD

// Always create new state
const newState = {
  ...state,
  openSteps: {
    ...state.openSteps,
    [stepId]: newStep,
  },
};  // ✅ GOOD
```

## Performance Considerations

### State Copying

Immutable updates create many object copies:

- **Current**: Shallow copying is fast for small states
- **Future**: Use immutable data structures (Immutable.js) for large states

### Agent Execution

Agent calls are the primary bottleneck:

- **Parallel Execution**: Engine can execute multiple WAITING steps in parallel
- **Caching**: Consider caching agent responses for identical requests
- **Rate Limiting**: Implement backoff for provider rate limits

### Storage Operations

Artifact storage can become expensive:

- **Current**: Local file system is fast
- **Future**: Batch S3 operations, use multipart uploads for large files

### Memory Usage

Long workflows accumulate events in log:

- **Current**: Full log kept in memory
- **Future**: Stream log to persistent storage, keep summary in memory

## Future Enhancements

### Database Integration

- Persist workflow state to PostgreSQL
- Event sourcing for full audit trail
- CQRS pattern for queries

### Temporal Workflows

- Migrate to Temporal for production
- Use Temporal's built-in determinism
- Leverage Temporal's durability and observability

### Advanced Agent Patterns

- Map-Reduce: Parallel agent execution with aggregation
- Critic-Executor: One agent critiques another's output
- Hierarchical: Parent agents coordinate child agents

### Observability

- Distributed tracing (OpenTelemetry)
- Metrics collection (Prometheus)
- Structured logging with trace IDs
- Real-time monitoring dashboards

## Conclusion

The Agent Coordinator architecture provides a solid foundation for building complex multi-agent systems with deterministic execution, clean separation of concerns, and extensive extensibility. The design balances simplicity for current needs with flexibility for future growth.
