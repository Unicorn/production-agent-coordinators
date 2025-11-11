# Agent Coordinator Architecture Design

**Date:** 2025-11-07
**Version:** 1.0.0
**Status:** Approved
**Reviewers:** Backend Architect Agent, AI Engineer Agent

---

## Executive Summary

This document describes the architecture for a general-purpose AI agent coordination platform built on Temporal workflows. The system orchestrates multi-agent workflows using a generic, extensible engine with pluggable decision logic (Specs) and agent implementations.

**Core Design Principles:**
- **Dependency Injection via Factories** - Extensible, testable, database/UI-ready
- **Temporal Workflow Determinism** - Strict adherence to deterministic execution
- **TypeScript Strict Mode** - Pragmatic strict typing with explicit `any` when needed
- **Start Small, Scale Later** - Simple implementations with interfaces for future growth
- **Multi-Layer Testing** - Unit, integration (TestWorkflowEnvironment), mocked agents, E2E

**Target Use Cases:**
- General-purpose agent orchestration (not domain-specific)
- Multi-agent workflows (code generation, content creation, data processing)
- Future: UI workflow builder, database-backed specs, production-scale deployment

---

## 1. System Architecture

### 1.1 High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         CLI / UI (Future)                    │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                      Coordinator                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ CoordinatorBuilder │ Dispatcher │ │  Registries  │      │
│  │ (DI Container)│  │ (Polling)    │ │ (Specs/Agents)│      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└───────────┬───────────────────────────────────┬─────────────┘
            │                                   │
            │ Temporal Client                   │
            ▼                                   ▼
┌─────────────────────────┐         ┌─────────────────────────┐
│   Temporal Workflows    │         │      Agent Pool         │
│  ┌──────────────────┐   │         │  ┌────────────────┐    │
│  │ EngineWorkflow   │   │         │  │ Claude Agent   │    │
│  │ (Generic)        │   │         │  ├────────────────┤    │
│  │                  │   │         │  │ Mock Agent     │    │
│  │ Signals/Queries  │   │         │  ├────────────────┤    │
│  └──────────────────┘   │         │  │ Custom Agents  │    │
└─────────────────────────┘         └─────────────────────────┘
            │
            ▼
┌─────────────────────────┐
│      Spec Instances     │
│  ┌────────────────┐     │
│  │ HelloSpec      │     │
│  ├────────────────┤     │
│  │ TodoSpec       │     │
│  ├────────────────┤     │
│  │ Custom Specs   │     │
│  └────────────────┘     │
└─────────────────────────┘
```

### 1.2 Package Structure

```
packages/
├─ contracts/          # PURE: Interfaces, types, zero dependencies
│  ├─ src/
│  │  ├─ types.ts      # Core types (EngineState, AgentResult, etc.)
│  │  └─ interfaces.ts # Factory interfaces (ISpecFactory, IAgentFactory)
│  └─ package.json
│
├─ engine/             # Temporal workflow implementation
│  ├─ src/
│  │  ├─ workflow.ts   # EngineWorkflow with signals/queries
│  │  └─ worker.ts     # Temporal worker registration
│  ├─ package.json
│  └─ depends on: @temporalio/*, contracts
│
├─ coordinator/        # Orchestration and dispatch
│  ├─ src/
│  │  ├─ builder.ts    # CoordinatorBuilder (DI container)
│  │  ├─ coordinator.ts # Main coordinator logic
│  │  └─ logger.ts     # ConsoleLogger implementation
│  ├─ package.json
│  └─ depends on: @temporalio/client, contracts
│
├─ specs/              # Spec implementations
│  ├─ hello/           # Phase 1: Hello world spec
│  ├─ todo/            # Phase 2: Todo app generator spec
│  └─ depends on: contracts ONLY (not engine!)
│
├─ agents/             # Agent implementations
│  ├─ mock/            # Mock agents for testing
│  ├─ anthropic/       # Claude-powered agents
│  └─ depends on: contracts ONLY
│
├─ storage/            # Storage implementations
│  ├─ src/
│  │  └─ local.ts      # LocalFileStorage
│  ├─ package.json
│  └─ depends on: contracts ONLY
│
└─ cli/                # Development tools
   ├─ src/
   │  ├─ start-hello.ts
   │  ├─ start-todo.ts
   │  └─ state.ts
   └─ depends on: @temporalio/client, contracts
```

**Critical Dependency Rule:**
Specs and agents **MUST NOT** depend on `engine` package. This prevents circular dependencies and enables dynamic loading in production.

---

## 2. Core Contracts

### 2.1 Enhanced AgentResult

Incorporates AI Engineer recommendations for LLM-specific metadata:

```typescript
export interface AgentResult<T = unknown> {
  status: "OK" | "PARTIAL" | "FAIL" | "RATE_LIMITED" | "CONTEXT_EXCEEDED";
  content?: T;

  artifacts?: Array<{
    type: string;
    url?: string;
    ref?: string;
    meta?: unknown;
    size?: number;        // Track data volume
    checksum?: string;    // Verification
  }>;

  metrics?: {
    tokens?: {
      prompt: number;
      completion: number;
      cached?: number;    // Claude prompt caching
    };
    costUsd?: number;
    latencyMs?: number;
    modelName?: string;   // Track model version
  };

  llmMetadata?: {
    modelId: string;
    temperature?: number;
    maxTokens?: number;
    stopReason?: "end_turn" | "max_tokens" | "stop_sequence" | "tool_use";
  };

  confidence?: {
    score?: number;       // 0-1 confidence
    reasoning?: string;
    requiresHumanReview?: boolean;
  };

  errors?: Array<{
    type: "RATE_LIMIT" | "CONTEXT_EXCEEDED" | "INVALID_REQUEST" |
          "PROVIDER_ERROR" | "VALIDATION_ERROR" | "TIMEOUT";
    message: string;
    retryable: boolean;
    retryAfterMs?: number;
    details?: unknown;
  }>;

  provenance?: {
    agentId: string;
    agentVersion: string;
    executionId: string;
    timestamp: string;
  };
}
```

### 2.2 Enhanced AgentExecutionContext

Provides agents with workflow context for better decision-making:

```typescript
export interface AgentExecutionContext {
  // Workflow identification
  runId: string;
  goalId: string;
  workflowType: string;

  // Execution position
  stepNumber: number;
  totalSteps?: number;
  previousSteps?: Array<{
    workKind: string;
    status: string;
    summary?: string;     // Brief summary, not full content
  }>;

  // Shared state from workflow
  annotations?: Record<string, unknown>;

  // Resource constraints
  constraints?: {
    maxTokens?: number;
    maxCostUsd?: number;
    timeoutMs?: number;
    modelPreference?: string;
  };

  // Observability
  traceId: string;
  spanId: string;

  // LLM optimization
  cacheContext?: {
    systemPromptHash?: string;
    conversationId?: string;
  };
}
```

### 2.3 Factory Interfaces

```typescript
export interface ISpecFactory<TPayload = unknown, TResult = unknown> {
  readonly name: string;
  readonly version: string;

  create(context: SpecContext): ISpec<TPayload, TResult>;
  describe(): SpecDescriptor;
  validate?(config: unknown): boolean;
}

export interface ISpec<TPayload = unknown, TResult = unknown> {
  readonly name: string;

  onAgentCompleted(
    state: EngineState,
    resp: AgentResponse,
    context: SpecExecutionContext  // Deterministic context
  ): EngineDecision;

  onAgentError?(
    state: EngineState,
    workKind: string,
    error: AgentError,
    attemptNumber: number
  ): EngineDecision;

  onCustomEvent?(
    state: EngineState,
    eventType: string,
    payload: unknown
  ): EngineDecision | void;

  postApply?(state: EngineState): void;
}

export interface IAgentFactory<TInput = unknown, TOutput = unknown> {
  readonly supportedWorkKinds: readonly string[];

  create(context: AgentContext): IAgent<TInput, TOutput>;
  describe(): AgentDescriptor;
}

export interface IAgent<TInput = unknown, TOutput = unknown> {
  execute(
    workKind: string,
    payload: TInput,
    context: AgentExecutionContext
  ): Promise<AgentResult<TOutput>>;
}
```

---

## 3. Temporal Workflow Implementation

### 3.1 Determinism Fixes

**Critical Issues Identified by Backend Architect:**
1. ❌ `Date.now()` in workflow code (non-deterministic)
2. ❌ No `continueAsNew` logic (unbounded history growth)
3. ❌ Static spec registry (prevents database-backed specs)

**Solutions Applied:**

```typescript
import { Date as WorkflowDate } from "@temporalio/workflow";

export async function EngineWorkflow(args: EngineArgs): Promise<void> {
  const MAX_EVENTS = args.maxEventsBeforeContinue ?? 1000;

  // ✅ Deterministic PRNG for specs
  let seed = 12345;
  const deterministicRandom = (): number => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  // ✅ Deterministic timestamp provider
  const getSpecContext = (): SpecExecutionContext => ({
    now: WorkflowDate.now(),
    random: deterministicRandom,
  });

  // ... workflow logic ...

  // ✅ continueAsNew to prevent unbounded history
  if (state.log.length >= MAX_EVENTS) {
    await continueAsNew<typeof EngineWorkflow>({
      ...args,
      bootDecision: {
        decisionId: `continue-${WorkflowDate.now()}`,
        actions: [
          { type: "ANNOTATE", key: "_continuedFrom", value: state.log.length }
        ],
      },
    });
  }
}
```

### 3.2 Workflow Signals and Queries

**Signals (Modify State):**
- `agentCompleted(stepId, response)` - Agent finished work
- `applyDecision(decision)` - Apply spec decision
- `approve(stepId)` - Approve manual step
- `cancel(reason)` - Cancel workflow
- `custom(eventType, payload)` - Custom domain events

**Queries (Read State):**
- `currentState()` - Get current workflow state

### 3.3 Externalized Spec Configuration

**Phase 1/2 Approach:**
- Spec logic executed in coordinator
- Coordinator sends `applyDecision` signal with decision

**Future Production Approach:**
- Serialize spec configuration to workflow args
- Deserialize and execute decision logic in workflow
- Enables database-backed specs and A/B testing

---

## 4. Coordinator & Dependency Injection

### 4.1 CoordinatorBuilder Pattern

```typescript
const coordinator = new CoordinatorBuilder()
  .withLogger(new ConsoleLogger())
  .withStorage(new LocalFileStorage("./out"))
  .withTemporal("localhost:7233", "default")
  .registerSpec(new HelloSpecFactory())
  .registerSpec(new TodoSpecFactory())
  .registerAgent(new MockAgentFactory())
  .registerAgent(new AnthropicAgentFactory())
  .build();

await coordinator.start();
await coordinator.dispatchOnce("workflow-id");
```

**Benefits:**
- ✅ Fluent API for configuration
- ✅ Validation before build
- ✅ Easy to swap implementations (mock vs real agents)
- ✅ Builder config can be serialized to JSON (future: UI/database)

### 4.2 Coordinator Responsibilities

1. **Poll workflows** for `WAITING` steps
2. **Route work** to appropriate agents based on `workKind`
3. **Execute agents** with rich execution context
4. **Signal workflows** with agent results
5. **Execute spec logic** and send decisions
6. **Handle errors** by signaling workflow (not silent failures)

### 4.3 Error Handling Strategy

**Multi-Layer Retry (AI Engineer Recommendation):**

- **Layer 1: Agent-level** - Immediate retries for transient failures
- **Layer 2: Coordinator-level** - Rate limits, provider issues with exponential backoff
- **Layer 3: Spec-level** - Strategic retries, task decomposition, fallback models

```typescript
// Coordinator signals workflow on agent failure
await handle.signal("agentCompleted", stepId, {
  status: "FAIL",
  errors: [{
    type: "RATE_LIMIT",
    message: "Anthropic API rate limit exceeded",
    retryable: true,
    retryAfterMs: 60000,
  }],
});

// Spec decides retry strategy
onAgentError(state, workKind, error, attemptNumber): EngineDecision {
  if (error.type === "CONTEXT_EXCEEDED") {
    // Strategic: break into chunks
    return {
      actions: [
        { type: "REQUEST_WORK", workKind: "chunk-1", ... },
        { type: "REQUEST_WORK", workKind: "chunk-2", ... },
      ],
    };
  }

  if (error.retryable && attemptNumber < 3) {
    // Retry with same payload
    return {
      actions: [{ type: "REQUEST_WORK", workKind, payload }],
    };
  }

  // Give up
  return { actions: [], finalize: true };
}
```

---

## 5. Storage & Logging Abstraction

### 5.1 IStorage Interface

```typescript
export interface IStorage {
  write(key: string, data: Buffer | string): Promise<string>;  // Returns URL
  read(key: string): Promise<Buffer>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}
```

**Phase 1/2 Implementation:**
- `LocalFileStorage` - Writes to `./out/<workflowId>/`
- Returns `file://` URLs for consistency with future `s3://` URLs

**Future Implementations:**
- `S3Storage` - AWS S3 backend
- `GCSStorage` - Google Cloud Storage
- `DatabaseBlobStorage` - PostgreSQL bytea/blob columns

### 5.2 ILogger Interface

```typescript
export interface ILogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, error?: Error, meta?: Record<string, unknown>): void;
}
```

**Phase 1/2 Implementation:**
- `ConsoleLogger` - JSON-formatted logs to stdout/stderr

**Future Implementations:**
- `CloudWatchLogger` - AWS CloudWatch Logs
- `DatadogLogger` - Datadog APM
- `StructuredLogger` - Generic structured logging with custom transports

---

## 6. Example Implementations

### 6.1 HelloSpec (Phase 1)

**Decision Logic:**
- Boot: Request `HELLO` work
- On `HELLO` OK: Finalize workflow
- On error: Fail immediately (no retry)

```typescript
onAgentCompleted(state, resp, execContext): EngineDecision {
  const finalize = resp.status === "OK";

  return {
    decisionId: `dec-${execContext.now}`,  // ✅ Deterministic
    basedOn: { stepId: resp.stepId, runId: resp.runId },
    actions: [],
    finalize,
  };
}
```

### 6.2 TodoSpec (Phase 2)

**Decision Logic:**
- Boot: Request `REQUIREMENTS_TODO`
- After requirements: Request `GENERATE_TODO_APP`
- After generation: Request `WRITE_README`, `BASIC_TESTS`, `PR_REVIEW` (parallel)
- Finalize when GEN, DOC, TEST all DONE

**Error Handling:**
- Retry up to 3 times for retryable errors
- Non-retryable or max attempts: Finalize

### 6.3 MockAgent

**Supported Work Kinds:**
- `HELLO` - Returns simple greeting
- `REQUIREMENTS_TODO` - Returns acceptance criteria
- `GENERATE_TODO_APP` - Returns file list + artifact
- `WRITE_README`, `BASIC_TESTS`, `PR_REVIEW` - Returns success

**Purpose:**
- Fast execution for local development
- Deterministic responses for testing
- **CRITICAL:** Must validate against real agent responses (per CLAUDE.md)

### 6.4 AnthropicAgent

**Features:**
- Calls Claude via `@anthropic-ai/sdk`
- Maps Anthropic errors to error taxonomy
- Calculates cost based on token usage
- Includes LLM metadata in response

**Error Mapping:**
- HTTP 429 → `RATE_LIMITED`
- "prompt too long" → `CONTEXT_EXCEEDED`
- Unknown → `PROVIDER_ERROR` (retryable)

---

## 7. Testing Strategy

### 7.1 Test Levels

**Unit Tests:**
- Spec decision logic with fixture states
- Agent response parsing
- Error taxonomy mapping
- Storage path normalization

**Integration Tests:**
- `TestWorkflowEnvironment.createLocal()` for time-skipping
- End-to-end workflow execution with mocked agents
- Signal/query interactions
- `continueAsNew` behavior

**Mock Validation Tests (CRITICAL):**
- Verify mock agents match real agent schemas
- Periodically re-record mock responses
- Flag when mocks diverge from reality

**End-to-End Tests (Future):**
- Real Temporal + real agents + real workflows
- Production deployment validation
- Performance benchmarking

### 7.2 Test Example

```typescript
describe("EngineWorkflow integration", () => {
  let testEnv: TestWorkflowEnvironment;

  beforeAll(async () => {
    testEnv = await TestWorkflowEnvironment.createLocal();
  });

  it("should complete hello workflow", async () => {
    const { client } = testEnv;

    const handle = await client.workflow.start(EngineWorkflow, {
      workflowId: "test-hello",
      taskQueue: "test",
      args: [{
        goalId: "test",
        specName: "hello",
        specVersion: "1.0.0",
        specConfig: {},
        bootDecision: { /* ... */ },
      }],
    });

    // Verify initial state
    let state = await handle.query("currentState");
    expect(state.openSteps["HELLO-1"].status).toBe("WAITING");

    // Send completion signal
    await handle.signal("agentCompleted", "HELLO-1", {
      status: "OK",
      content: { message: "Hello" },
    });

    // Apply decision
    await handle.signal("applyDecision", {
      decisionId: "dec-1",
      actions: [],
      finalize: true,
    });

    // Verify finalized
    state = await handle.query("currentState");
    expect(state.status).toBe("COMPLETED");
  });
});
```

---

## 8. Future Extensibility

### 8.1 Database Integration

**Spec Repository:**
```typescript
interface ISpecRepository {
  save(spec: SpecDescriptor): Promise<void>;
  findByName(name: string): Promise<SpecDescriptor[]>;
  findByNameAndVersion(name: string, version: string): Promise<SpecDescriptor | null>;
  list(filters?: SpecFilters): Promise<SpecDescriptor[]>;
}
```

**Workflow State Projection:**
- External service listens to workflow events
- Updates materialized view in PostgreSQL
- Enables fast UI queries without polling Temporal

**CQRS Pattern:**
- Commands: Via Temporal signals
- Queries: Via PostgreSQL read models

### 8.2 UI Workflow Builder

**Builder → Config Mapping:**
- Factory pattern maps to UI form fields
- Builder config serializable to JSON
- Store configurations in database
- Hydrate builders from stored configs

**Example:**
```typescript
// UI sends JSON
const config = {
  logger: { type: "cloudwatch", logGroup: "/prod/coordinator" },
  storage: { type: "s3", bucket: "prod-artifacts" },
  specs: [
    { factory: "todo", version: "2.0.0", config: { maxSteps: 10 } }
  ],
  agents: [
    { factory: "anthropic", config: { model: "claude-sonnet-4-5" } }
  ],
};

// Backend hydrates builder
const coordinator = hydrateCoordinatorFromConfig(config);
```

### 8.3 Production Coordinator

**Queue-Based Dispatch:**
- Subscribe to Temporal workflow events
- Enqueue work in SQS/RabbitMQ with idempotency keys
- Worker pool consumes from queue
- Backpressure handling and rate limiting

**Observability:**
- Structured logging with trace IDs
- Metrics: agent latency, cost, success rate
- Distributed tracing (OpenTelemetry)
- Alerting on error rates, budget overruns

---

## 9. Migration Path: Dev → Production

### Phase 1 (Current - Local Dev)
- LocalFileStorage
- ConsoleLogger
- Poll-based coordinator (single execution)
- Mock agents for testing

### Phase 2 (Team Use)
- S3Storage for shared artifacts
- CloudWatch/Datadog logging
- Continuous polling coordinator
- Real Anthropic agents
- Basic observability

### Phase 3 (Production)
- Queue-based dispatch
- Multi-worker coordinator
- Database-backed specs
- Event projection for UI
- Advanced observability (traces, metrics, alerts)
- A/B testing framework
- Cost tracking and budgets

---

## 10. Architectural Decisions

### 10.1 Why Dependency Injection?

**Alternatives Considered:**
1. Registry Pattern - Central registries with type-safe lookup
2. Convention-based Plugins - Directory structure discovery
3. **Dependency Injection (CHOSEN)** - Factory pattern with builders

**Rationale:**
- Builder pattern ↔ UI forms natural mapping
- Factories enable database configuration storage
- Best testability (mock dependencies separately)
- Clearest path to UI workflow builder

### 10.2 Why Externalized Spec Logic?

**Phase 1/2:** Spec logic in coordinator (simple, fast iteration)
**Future:** Spec logic in workflow (enables database-backed specs, A/B testing)

**Tradeoff:**
- Phase 1/2: Extra signal roundtrip, but simpler development
- Production: Deterministic execution, versioning, database loading

### 10.3 Why Multi-Package Monorepo?

**Benefits:**
- Clear dependency boundaries prevent coupling
- Specs/agents can be distributed independently
- Easy to test packages in isolation
- Future: Extract to separate repos if needed

**Risks:**
- More build complexity
- Need clear dependency rules

**Mitigation:**
- Enforce `contracts` as zero-dependency package
- Prevent `specs`/`agents` from depending on `engine`

---

## 11. Known Limitations & Future Work

### 11.1 Phase 1/2 Limitations

❌ **No streaming support** - Agents block until completion
❌ **No prompt registry** - Prompts hardcoded in agents
❌ **No rate limiting** - Can exceed provider limits
❌ **No cost tracking at workflow level** - Only per-agent metrics
❌ **No multi-agent patterns** - Only sequential execution

### 11.2 Future Enhancements

**High Priority:**
- Streaming support for long-running LLM generations
- Prompt registry with versioning and A/B testing
- Rate limiting with token bucket algorithm
- Workflow-level cost tracking and budgets

**Medium Priority:**
- Multi-agent patterns: map-reduce, critic-executor, hierarchical
- Provider abstraction with capability-based selection
- Advanced caching (Claude prompt caching integration)

**Low Priority:**
- Agent-to-agent communication
- Recursive task decomposition
- HTN planning for complex workflows

---

## 12. Success Criteria

### Phase 1 (Hello World)
- ✅ Generic EngineWorkflow with deterministic execution
- ✅ HelloSpec completes successfully
- ✅ Mock agent returns valid response
- ✅ Workflow finalizes correctly
- ✅ All determinism issues fixed

### Phase 2 (Todo App Generator)
- ✅ TodoSpec orchestrates multiple agents
- ✅ Parallel work requests (DOC, TEST, REVIEW)
- ✅ Agent responses stored as artifacts
- ✅ Workflow completes with generated app
- ✅ Error handling with retry logic

### Production Readiness
- ⬜ Queue-based coordinator with idempotency
- ⬜ Database-backed specs
- ⬜ Event projection for UI
- ⬜ Comprehensive observability
- ⬜ Rate limiting and cost controls
- ⬜ A/B testing framework

---

## 13. References

**Expert Reviews:**
- Backend Architect Agent - Architectural assessment (Grade: B+)
- AI Engineer Agent - LLM orchestration patterns

**Key Architectural Fixes:**
1. Package structure with `contracts/` to break circular dependencies
2. Workflow determinism (WorkflowDate.now, deterministic PRNG)
3. continueAsNew for unbounded history prevention
4. Externalized spec configuration for future database integration
5. Error signaling instead of silent failures
6. Enhanced AgentResult with LLM-specific metadata
7. Rich AgentExecutionContext with previous steps and annotations

**Documentation:**
- Phase1.md - Hello world implementation
- Phase2.md - Todo app generator implementation
- README.md - High-level architecture overview
- Temporal TypeScript SDK documentation (Context7)
- TypeScript strict mode best practices (Context7)

---

## Appendix A: Type Definitions

See `packages/contracts/src/` for complete type definitions:
- `types.ts` - Core types (EngineState, AgentResult, etc.)
- `interfaces.ts` - Factory interfaces (ISpecFactory, IAgentFactory, etc.)

---

## Appendix B: Glossary

**Spec** - Pluggable decision logic module that determines workflow behavior
**Agent** - Executor that performs work (e.g., call LLM, run tests, generate code)
**Coordinator** - Orchestrator that polls workflows and dispatches work to agents
**Factory** - Pattern for creating instances with injected dependencies
**Builder** - Fluent API for configuring dependencies before instantiation
**EngineWorkflow** - Generic Temporal workflow that executes any spec
**Determinism** - Property of workflows that replay identically given same history
**continueAsNew** - Temporal pattern to prevent unbounded workflow history growth

---

**End of Design Document**
