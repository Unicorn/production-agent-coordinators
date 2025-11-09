# System Architecture Overview

**Last Updated:** 2025-11-09
**Status:** Current
**Maintainers:** Agent Coordinator Team

## Purpose

This document provides a comprehensive architectural overview of the agent-coordinator system, a deterministic multi-agent workflow orchestration platform. It serves as the canonical reference for understanding system design, component relationships, and architectural decisions.

## System Context

Agent Coordinator is a TypeScript monorepo that orchestrates AI agents through deterministic workflows. The system enables complex multi-agent interactions while maintaining predictable execution, type safety, and clean separation of concerns.

### Key Characteristics

- **Deterministic Execution:** Pure state transitions enable replay and testing
- **Pluggable Architecture:** Specs and agents are hot-swappable via factory pattern
- **Type-Safe:** Strict TypeScript with zero `any` types in contracts
- **Monorepo Structure:** Workspace-based organization with explicit dependency rules
- **Infrastructure-Ready:** Docker Compose setup for PostgreSQL, Redis, and Temporal

## High-Level Architecture

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

**WHY:** Enables replay testing, debugging, and predictable behavior across environments.

**IMPLEMENTATION:**
- All state transitions are pure functions (no side effects)
- Controlled time and randomness via `SpecExecutionContext`
- Immutable state updates using object spread
- Async operations isolated to agent calls only

**LOCATION:** See [engine.md](./engine.md#determinism)

### 2. Dependency Injection

**WHY:** Enables testability, modularity, and configuration flexibility.

**IMPLEMENTATION:**
- Factory pattern for component creation
- Context objects bundle dependencies (storage, logger, config)
- Service locator pattern via Container class
- No global state

**LOCATION:** See [coordinator.md](./coordinator.md#dependency-injection)

### 3. Separation of Concerns

**WHY:** Prevents circular dependencies, enables independent testing, supports dynamic loading.

**IMPLEMENTATION:**
- Contracts package has zero dependencies (pure interfaces)
- Engine has no domain knowledge (only state transitions)
- Specs/Agents depend on contracts ONLY (never engine)
- Infrastructure layer isolated from business logic

**LOCATION:** See [Package Architecture](#package-architecture)

### 4. Type Safety

**WHY:** Catch errors at compile time, improve developer experience, enable refactoring.

**IMPLEMENTATION:**
- Strict TypeScript mode in all packages
- No implicit `any` types
- Generic constraints for payloads and results
- Interface-first design

**LOCATION:** See [contracts.md](../api/contracts.md)

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

| Package | Purpose | Dependencies | Key Exports |
|---------|---------|--------------|-------------|
| **contracts** | Pure TypeScript interfaces and types | None | `EngineState`, `ISpec`, `IAgent`, `IStorage` |
| **engine** | Deterministic workflow execution | contracts | `Engine`, state transition functions |
| **coordinator** | DI container and orchestration | contracts, engine | `Container`, `Coordinator` |
| **storage** | Storage implementations | contracts | `LocalFileStorage` |
| **specs/*** | Workflow specifications | contracts ONLY | Spec factories and implementations |
| **agents/*** | Agent implementations | contracts ONLY | Agent factories and implementations |
| **cli** | Command-line interface | All packages | CLI commands, examples |

**CRITICAL RULE:** Specs and agents must NEVER depend on `engine` to prevent circular dependencies and enable dynamic loading.

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/`

## Data Flow

### Workflow Execution Sequence

```
1. Application creates Container and Coordinator
   │
   ├─> Register factories (specs, agents)
   ├─> Register services (storage, logger)
   │
   ▼
2. Application creates Engine with initial state
   │
   ├─> Engine.state = { goalId, status: "RUNNING", ... }
   │
   ▼
3. Spec generates boot decision
   │
   ├─> spec.onAgentCompleted(state, bootResponse, context)
   ├─> Returns EngineDecision with REQUEST_WORK actions
   │
   ▼
4. Engine processes decision
   │
   ├─> For each action: applyAction(state, action, context)
   ├─> Creates WAITING steps in state.openSteps
   │
   ▼
5. Engine executes WAITING steps
   │
   ├─> Mark step as IN_PROGRESS
   ├─> agentExecutor(stepId, step) [ASYNC]
   ├─> Returns AgentResponse
   │
   ▼
6. Engine processes agent response
   │
   ├─> applyAgentResponse(state, response, context)
   ├─> Updates step status (DONE/FAILED)
   ├─> Stores artifacts
   │
   ▼
7. Spec evaluates updated state
   │
   ├─> spec.onAgentCompleted(state, lastResponse, context)
   ├─> Returns next EngineDecision
   │
   ▼
8. Repeat steps 4-7 until finalized
   │
   ▼
9. Engine.state.status becomes COMPLETED/FAILED
   │
   ▼
10. Workflow terminates, returns final state
```

**LOCATION:** See [engine.md](./engine.md#execution-loop) for detailed implementation.

## State Management

### EngineState Structure

```typescript
interface EngineState {
  goalId: string;                           // Workflow identifier
  status: WorkflowStatus;                   // RUNNING | COMPLETED | FAILED | ...
  openSteps: Record<string, StepState>;     // Active workflow steps
  artifacts: Record<string, unknown>;       // Key-value artifact store
  log: LogEntry[];                          // Chronological event log
}
```

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/contracts/src/types.ts:2-8`

### StepState Lifecycle

```
WAITING → IN_PROGRESS → DONE
                      ↓
                    FAILED
```

**WAITING:** Step created, waiting for agent execution
**IN_PROGRESS:** Agent currently executing
**DONE:** Agent completed successfully
**FAILED:** Agent encountered unrecoverable error

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/contracts/src/types.ts:10-16`

### State Immutability

All state transitions create new objects:

```typescript
// ❌ BAD: Mutation
state.openSteps[stepId] = newStep;

// ✅ GOOD: Immutable update
const newState = {
  ...state,
  openSteps: {
    ...state.openSteps,
    [stepId]: newStep,
  },
};
```

**LOCATION:** See [engine.md](./engine.md#state-transitions)

## Extension Points

The system provides three primary extension points:

### 1. Custom Specifications

Implement `ISpec` interface to define custom workflow logic.

**USE CASE:** Multi-step workflows, approval flows, map-reduce patterns

**LOCATION:** See [specs.md](./specs.md)

### 2. Custom Agents

Implement `IAgent` interface for custom execution backends.

**USE CASE:** Different LLM providers, tool-based agents, human-in-the-loop

**LOCATION:** See [agents.md](./agents.md)

### 3. Custom Storage

Implement `IStorage` interface for different storage backends.

**USE CASE:** S3, GCS, database blob storage

**LOCATION:** See [storage.md](./storage.md)

## Cross-Cutting Concerns

### Error Handling

Multi-layer error handling with retryability hints:

1. **Agent Layer:** Catch provider errors, map to error taxonomy
2. **Engine Layer:** Propagate errors through state
3. **Spec Layer:** Decide retry strategy based on error type

**LOCATION:** See [engine.md](./engine.md#error-handling)

### Logging

Structured logging with context propagation:

- `ILogger` interface for pluggable logging
- Console logger implementation provided
- Future: OpenTelemetry integration

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/coordinator/src/logger.ts`

### Observability

**CURRENT:** Basic logging and metrics in AgentResponse

**FUTURE:**
- Distributed tracing (OpenTelemetry)
- Metrics collection (Prometheus)
- Structured logging with trace IDs
- Real-time monitoring dashboards

**LOCATION:** See [operations/monitoring.md](../operations/monitoring.md)

## Performance Considerations

### Current Optimizations

1. **Immutable Updates:** Shallow copying is fast for small states
2. **Parallel Execution:** Engine can execute multiple WAITING steps concurrently
3. **Local Storage:** File system access is fast for development

### Future Optimizations

1. **Immutable Data Structures:** Use Immutable.js for large states
2. **Agent Response Caching:** Cache identical requests
3. **Batch Storage Operations:** Multipart uploads for large artifacts
4. **Log Streaming:** Stream events to persistent storage

**LOCATION:** See [design/patterns.md](../design/patterns.md#performance)

## Security Considerations

### Storage Path Validation

LocalFileStorage prevents directory traversal and system path access:

```typescript
private static readonly FORBIDDEN_SEGMENTS = new Set([
  "etc", "bin", "sbin", "var", "usr", "lib", "root", "home", ...
]);
```

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/storage/src/local.ts:7-27`

### API Key Management

API keys passed via `AgentContext.apiKeys`, never logged or stored in state.

**LOCATION:** See [storage.md](./storage.md#security)

## Infrastructure

### Docker Services

- **PostgreSQL:** Port 5432 (future: state persistence)
- **Redis:** Port 6379 (future: caching, pub/sub)
- **Temporal:** Ports 7233 (gRPC), 8080 (UI) (future: production workflows)

**LOCATION:** `/Users/mattbernier/projects/coordinator/docker/`
**DETAILS:** See [operations/docker.md](../operations/docker.md)

## Related Documentation

- [Engine Architecture](./engine.md) - Detailed execution engine design
- [Coordinator Architecture](./coordinator.md) - DI container implementation
- [Storage Architecture](./storage.md) - Storage abstraction and security
- [Spec Architecture](./specs.md) - Specification interface and patterns
- [Agent Architecture](./agents.md) - Agent interface and implementations
- [API Contracts](../api/contracts.md) - Core types and interfaces
- [Design Principles](../design/principles.md) - Core design philosophy
- [Design Patterns](../design/patterns.md) - Patterns used throughout system

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2025-11-09 | Internal Docs Agent | Initial creation from ARCHITECTURE.md |
