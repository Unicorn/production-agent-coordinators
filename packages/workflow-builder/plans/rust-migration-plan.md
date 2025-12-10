# Workflow Builder: Rust Backend Migration Plan

**Version**: 1.2.0
**Date**: 2025-12-09
**Status**: Draft - Pending Review

## Detailed Phase Documents

Each phase has a detailed implementation document with expanded tasks, code examples, and acceptance criteria:

| Phase | Document | Description |
|-------|----------|-------------|
| 1 | [phase-1-kong-abstraction.md](rust-migration/phase-1-kong-abstraction.md) | Kong API Gateway setup |
| 2 | [phase-2-rust-compiler-foundation.md](rust-migration/phase-2-rust-compiler-foundation.md) | Rust project setup and core schemas |
| 3 | [phase-3-basic-workflows.md](rust-migration/phase-3-basic-workflows.md) | Verification workflows |
| 4 | [phase-4-variables-state.md](rust-migration/phase-4-variables-state.md) | Variables and state management |
| 5 | [phase-5-component-migration.md](rust-migration/phase-5-component-migration.md) | Component migration with records |
| 6 | [phase-6-advanced-features.md](rust-migration/phase-6-advanced-features.md) | Advanced workflow features |
| 7 | [phase-7-production-hardening.md](rust-migration/phase-7-production-hardening.md) | Production readiness |
| 8 | [phase-8-component-builder.md](rust-migration/phase-8-component-builder.md) | AI-powered component creation |

## Example Migration Record

See [kong-logging.yaml](../component-records/kong-logging.yaml) for a complete example of a structured migration record that captures schema decisions, alternatives considered, and lessons learned.

---

## Executive Summary

This plan outlines the migration of the workflow-builder backend from TypeScript to a **Rust Validation/Compilation Service** that generates **guaranteed-safe TypeScript** for Temporal execution.

### Key Architectural Decision

**Why not full Rust Temporal?**
- Temporal's Rust SDK is pre-alpha with no production roadmap ([source](https://github.com/temporalio/sdk-core))
- API may change without warning; no official support guarantees
- TypeScript Temporal SDK is production-proven and well-supported

**The Solution: "Trust But Verify" Architecture**
- Rust validates all workflow definitions with compile-time guarantees
- Rust generates TypeScript code that is safe by construction (no `any`, no escape hatches)
- Generated code is verified with `tsc --strict` + ESLint before deployment
- Temporal executes the proven TypeScript SDK

This gives us:
- Rust's compile-time type safety for workflow validation
- Zero `any` types in generated code (impossible by construction)
- Production-ready Temporal execution
- Path to full Rust Temporal when SDK matures

---

## Current Architecture (As-Is)

```
UI (Tamagui/React Flow)
        |
        v
tRPC API (TypeScript)
        |
        v
WorkflowCompiler (TypeScript)
   - Pattern-based compilation
   - Generates: workflow.ts, activities.ts, worker.ts
        |
        v
DeploymentService (TypeScript)
   - Writes files to /tmp/workflow-builder/
   - Runs tsc compilation
   - Notifies worker to reload
        |
        v
Temporal Workers (TypeScript)
   - One worker per project
   - Loads from database/filesystem
```

**Current Files**:
- `src/lib/compiler/index.ts` - WorkflowCompiler class (287 lines)
- `src/lib/compiler/types.ts` - Type definitions (208 lines)
- `src/lib/compiler/patterns/` - Code generation patterns
- `src/lib/deployment/deployment-service.ts` - Deploy logic (345 lines)
- `src/server/api/routers/compiler.ts` - tRPC router
- `src/server/api/routers/deployment.ts` - tRPC router

---

## Target Architecture (To-Be)

```
                    UI (Tamagui/React Flow)
                              |
                              v
              Kong API Gateway (Phase 1)
              /              |              \
             /               |               \
            v                v                v
    TypeScript API     Rust Compiler     Temporal Workers
    (existing tRPC)      Service           (TypeScript)
    - Auth, CRUD         (Phase 2+)        - Proven SDK
    - Project mgmt       - Schema validation
    - UI operations      - Type-safe code gen
                         - Strict verification
```

### Rust Compiler Service Responsibilities

1. **Schema Validation** (Rust types)
   - Validate workflow JSON against Rust structs
   - Ensure all connections are type-compatible
   - Reject invalid configurations at compile time

2. **Type-Safe Code Generation** (Rust -> TypeScript)
   - Generate workflow.ts with no `any` types
   - Generate activities.ts with strict typing
   - Generate worker.ts with proper configuration
   - All output is deterministic and verifiable

3. **Verification Pipeline**
   - Run `tsc --strict --noImplicitAny` on generated code
   - Run ESLint with `@typescript-eslint/no-explicit-any: error`
   - Only proceed if ALL checks pass

4. **Deployment Orchestration**
   - Store verified code in Supabase
   - Notify workers to reload
   - Track deployment status

---

## Phase Overview

| Phase | Focus | Deliverable | Duration |
|-------|-------|-------------|----------|
| 1 | Kong Abstraction | UI -> Kong -> Backend | 1-2 weeks |
| 2 | Rust Compiler Foundation | Basic Rust service + code gen | 2-3 weeks |
| 3 | Basic Workflows | Start/Stop/Log workflows proven | 1-2 weeks |
| 4 | Variables & State | Service/Project variables | 2-3 weeks |
| 5 | Component Library | Migrate components + structured migration records | 4-6 weeks |
| 6 | Advanced Features | Connectors, interfaces, Kong plugins | 3-4 weeks |
| 7 | Production Hardening | Monitoring, scaling, security | 2-3 weeks |
| 8 | Component Builder System | AI-powered component creation via workflow-builder | 3-4 weeks |

**Total Estimated Duration**: 19-29 weeks (5-7 months)

**Note on Phase 5**: Duration increased to capture detailed structured migration records for each component. These records become training data for the Phase 8 Component Builder Agent.

---

## Phase 1: Kong Abstraction Layer

### Goal
Put Kong between UI and backend to enable transparent backend replacement.

### Why This First?
- Creates clean boundary between UI and backend
- Enables A/B testing of TypeScript vs Rust backends
- Adds security layer (rate limiting, auth, logging)
- No changes to UI required once complete

### Architecture

```
UI (localhost:3010)
        |
        v
Kong Gateway (localhost:8000)
   |-- /api/auth/*     -> TypeScript API (existing)
   |-- /api/projects/* -> TypeScript API (existing)
   |-- /api/workflows/* -> TypeScript API (existing)
   |-- /api/compiler/* -> TypeScript API (later: Rust)
   |-- /api/deploy/*   -> TypeScript API (later: Rust)
        |
        v
Backend Services
```

### Tasks

- [ ] **1.1 Kong Service Registration**
  - Register workflow-builder as Kong upstream service
  - Configure health checks
  - Set up service discovery

- [ ] **1.2 Route Configuration**
  - Create routes for all tRPC endpoints
  - Map `/api/trpc/*` through Kong
  - Configure path rewrites if needed

- [ ] **1.3 Authentication Plugin**
  - Enable JWT validation plugin
  - Configure Supabase JWT verification
  - Set up API key fallback for service-to-service

- [ ] **1.4 Rate Limiting**
  - Configure rate limits per endpoint
  - Higher limits for compilation (resource-intensive)
  - Lower limits for auth endpoints (security)

- [ ] **1.5 Logging Plugin**
  - Enable request/response logging
  - Configure log format for observability
  - Set up log aggregation

- [ ] **1.6 Update UI Configuration**
  - Change API base URL to Kong gateway
  - Update environment variables
  - Test all existing functionality

- [ ] **1.7 Verification**
  - All existing tests pass through Kong
  - No UI changes required
  - Latency overhead < 10ms

### Acceptance Criteria

- [ ] All UI operations work through Kong
- [ ] Authentication works via Kong JWT plugin
- [ ] All tRPC endpoints accessible via Kong routes
- [ ] Logging shows all requests in Kong
- [ ] Rate limiting prevents abuse
- [ ] No regressions in existing functionality
- [ ] All existing tests pass

### Files to Create/Modify

```
packages/workflow-builder/
  kong/
    services.yaml        # Service definitions
    routes.yaml          # Route mappings
    plugins.yaml         # Plugin configurations
  .env.local             # Update API URLs
  src/lib/api/client.ts  # Point to Kong
```

---

## Phase 2: Rust Validation/Compilation Service

### Goal
Create Rust service that validates workflow definitions and generates type-safe TypeScript.

### Architecture

```
                 Workflow JSON
                      |
                      v
    +----------------------------------+
    |     Rust Compiler Service        |
    |                                  |
    |  1. Parse JSON -> Rust structs   |
    |  2. Validate schema              |
    |  3. Check type compatibility     |
    |  4. Generate TypeScript          |
    |  5. Verify with tsc + eslint     |
    |  6. Return compiled code         |
    |                                  |
    +----------------------------------+
                      |
                      v
              Verified TypeScript
              (workflow.ts, activities.ts, worker.ts)
```

### Rust Project Structure

```
workflow-compiler-rs/
  Cargo.toml
  src/
    main.rs                 # HTTP server (Axum)
    lib.rs                  # Library exports

    schema/
      mod.rs
      workflow.rs           # WorkflowDefinition struct
      node.rs               # WorkflowNode, NodeData
      edge.rs               # WorkflowEdge
      variable.rs           # WorkflowVariable
      component.rs          # Component definitions
      validation.rs         # Schema validation

    codegen/
      mod.rs
      typescript.rs         # TypeScript code generator
      workflow_gen.rs       # Generate workflow.ts
      activities_gen.rs     # Generate activities.ts
      worker_gen.rs         # Generate worker.ts
      templates/            # Code templates
        workflow.ts.hbs
        activities.ts.hbs
        worker.ts.hbs

    verification/
      mod.rs
      tsc.rs                # TypeScript compiler wrapper
      eslint.rs             # ESLint runner

    api/
      mod.rs
      routes.rs             # HTTP endpoints
      handlers.rs           # Request handlers
      errors.rs             # Error types

    patterns/
      mod.rs
      activity_proxy.rs
      state_management.rs
      interface_component.rs
      continue_as_new.rs

  tests/
    schema_tests.rs
    codegen_tests.rs
    integration_tests.rs
```

### Rust Type Definitions

```rust
// src/schema/workflow.rs

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Workflow definition - mirrors TypeScript WorkflowDefinition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowDefinition {
    pub id: String,
    pub name: String,
    pub nodes: Vec<WorkflowNode>,
    pub edges: Vec<WorkflowEdge>,
    pub variables: Vec<WorkflowVariable>,
    pub settings: WorkflowSettings,
}

/// Node types - exhaustive enum prevents invalid types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum NodeType {
    Trigger,
    Activity,
    Agent,
    Conditional,
    Loop,
    ChildWorkflow,
    Signal,
    Phase,
    Retry,
    StateVariable,
    ApiEndpoint,
    Condition,
    End,
    DataIn,
    DataOut,
    KongLogging,
    KongCache,
    KongCors,
    GraphqlGateway,
    McpServer,
}

/// Workflow node with strict typing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowNode {
    pub id: String,
    #[serde(rename = "type")]
    pub node_type: NodeType,
    pub data: NodeData,
    pub position: Position,
}

/// Position on canvas
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}

/// Node data - validated at compile time
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeData {
    pub label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub component_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub component_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub activity_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub signal_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub config: Option<HashMap<String, serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timeout: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retry_policy: Option<RetryPolicy>,
}

/// Retry strategy - exhaustive enum
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum RetryStrategy {
    KeepTrying,
    FailAfterX,
    ExponentialBackoff,
    None,
}

/// Retry policy with validation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetryPolicy {
    pub strategy: RetryStrategy,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_attempts: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub initial_interval: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_interval: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub backoff_coefficient: Option<f64>,
}

/// Workflow edge
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_handle: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_handle: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub edge_type: Option<String>,
}

/// Variable types - exhaustive
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum VariableType {
    String,
    Number,
    Boolean,
    Array,
    Object,
}

/// Workflow variable
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowVariable {
    pub name: String,
    #[serde(rename = "type")]
    pub var_type: VariableType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub initial_value: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

/// Workflow settings
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct WorkflowSettings {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timeout: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retry_policy: Option<RetryPolicy>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub task_queue: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
}
```

### Tasks

- [ ] **2.1 Rust Project Setup**
  - Initialize Cargo project
  - Configure dependencies (axum, serde, tokio)
  - Set up workspace in monorepo

- [ ] **2.2 Schema Definitions**
  - Define all workflow types in Rust
  - Implement serde serialization
  - Add validation derive macros

- [ ] **2.3 Schema Validation**
  - Implement comprehensive validation
  - Check node connectivity
  - Validate component configurations
  - Type-check variable references

- [ ] **2.4 TypeScript Code Generator**
  - Create template-based generator
  - Generate workflow.ts (no `any`)
  - Generate activities.ts (strict types)
  - Generate worker.ts (proper config)

- [ ] **2.5 Verification Pipeline**
  - Integrate tsc with strict flags
  - Integrate ESLint
  - Fail on any warnings/errors

- [ ] **2.6 HTTP API**
  - `/compile` - Compile workflow JSON
  - `/validate` - Validate only
  - `/health` - Health check
  - JSON request/response

- [ ] **2.7 Kong Integration**
  - Register Rust service in Kong
  - Route `/api/compiler/*` to Rust
  - Configure load balancing

- [ ] **2.8 Testing**
  - Unit tests for all modules
  - Integration tests with real workflows
  - Comparison tests (TypeScript vs Rust output)

### Acceptance Criteria

- [ ] Rust service compiles and runs
- [ ] JSON schema validation catches invalid workflows
- [ ] Generated TypeScript has zero `any` types
- [ ] `tsc --strict` passes on all generated code
- [ ] ESLint passes with no-explicit-any rule
- [ ] API responds in < 100ms for typical workflows
- [ ] All existing compiler tests pass with Rust backend
- [ ] Error messages are clear and actionable

### Dependencies (Cargo.toml)

```toml
[package]
name = "workflow-compiler"
version = "0.1.0"
edition = "2021"

[dependencies]
# Web framework
axum = "0.7"
tokio = { version = "1", features = ["full"] }
tower = "0.4"
tower-http = { version = "0.5", features = ["cors", "trace"] }

# Serialization
serde = { version = "1", features = ["derive"] }
serde_json = "1"

# Validation
validator = { version = "0.16", features = ["derive"] }

# Templating
handlebars = "5"

# Error handling
thiserror = "1"
anyhow = "1"

# Logging
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }

# Process execution (for tsc/eslint)
tokio-process = "0.2"

# HTTP client (for deployment)
reqwest = { version = "0.11", features = ["json"] }

# Database
sqlx = { version = "0.7", features = ["runtime-tokio", "postgres", "uuid"] }

[dev-dependencies]
pretty_assertions = "1"
```

---

## Phase 3: Basic Workflows Verification

### Goal
Prove the Rust backend works with simple workflows end-to-end.

### Test User Setup

Create a dedicated test user for all verification workflows:
- Email: `workflow-test@bernierllc.com`
- Used for demos and testing
- Workflows visible in UI

### Base Components to Implement

| Component | Type | Input | Output | Description |
|-----------|------|-------|--------|-------------|
| Start | trigger | none | `{ startedAt: Date }` | Workflow entry point |
| Stop | end | `{ result: any }` | none | Workflow exit point |
| Log | activity | `{ message: string, level: string, metadata?: object }` | `{ logged: boolean, timestamp: Date }` | Push to Kong log |

### Workflows to Build

#### 1. SimpleWorkflow
```
[Start] --> [Stop]
```
- Simplest possible workflow
- Proves: basic compilation, worker loading, execution

#### 2. BaseWorkflow
```
[Start] --> [Log] --> [Stop]
```
- Single activity between start/stop
- Proves: activity execution, input/output passing

#### 3. LongRunningWorkflow
```
[Start] --> [Log (loop)] --> ...continues...
```
- Never-ending workflow with periodic log
- Proves: long-running pattern, continue-as-new

#### 4. BaseLongRunningWorkflow
```
[Start] --> [Log (100 iterations)] --> [Continue-As-New]
```
- 100 iterations then continue-as-new
- Proves: state preservation, history management

### Project Structure in UI

```
Project: "Rust Migration Verification"
  |
  +-- Service: "Simple Workflows"
  |     +-- SimpleWorkflow
  |     +-- BaseWorkflow
  |
  +-- Service: "Long Running Workflows"
        +-- LongRunningWorkflow
        +-- BaseLongRunningWorkflow
```

### Tasks

- [ ] **3.1 Create Test User**
  - Add user to Supabase
  - Set up API keys
  - Configure project access

- [ ] **3.2 Implement Start Component**
  - Rust schema definition
  - TypeScript code generation
  - Activity implementation

- [ ] **3.3 Implement Stop Component**
  - Rust schema definition
  - TypeScript code generation
  - Proper workflow completion

- [ ] **3.4 Implement Log Component**
  - Rust schema definition
  - TypeScript code generation
  - Kong logging integration

- [ ] **3.5 Build SimpleWorkflow**
  - Create in UI
  - Compile through Rust
  - Deploy and execute
  - Verify logs

- [ ] **3.6 Build BaseWorkflow**
  - Create in UI
  - Compile through Rust
  - Deploy and execute
  - Verify activity ran

- [ ] **3.7 Build LongRunningWorkflow**
  - Create in UI
  - Configure long-running settings
  - Deploy and verify continues

- [ ] **3.8 Build BaseLongRunningWorkflow**
  - Create in UI
  - Configure continue-as-new (100 iterations)
  - Verify state preservation

- [ ] **3.9 Logging Verification**
  - All executions logged in UI
  - Logs show: project, service, components, timing
  - API keys tracked if interface used

- [ ] **3.10 End-to-End Tests**
  - Automated tests for all workflows
  - CI/CD pipeline integration
  - 100% pass rate required

### Acceptance Criteria

- [ ] Test project visible in UI
- [ ] All 4 workflows created via UI
- [ ] All 4 workflows compile through Rust backend
- [ ] All 4 workflows deploy successfully
- [ ] All 4 workflows execute correctly
- [ ] Execution logs visible in UI
- [ ] Logs include: project name, service, components, timing
- [ ] All tests pass (100%)
- [ ] No `any` types in generated code

### Log Format

```json
{
  "timestamp": "2025-01-15T10:30:00Z",
  "project": {
    "id": "proj_123",
    "name": "Rust Migration Verification"
  },
  "service": {
    "id": "svc_456",
    "name": "Simple Workflows"
  },
  "workflow": {
    "id": "wf_789",
    "name": "BaseWorkflow",
    "runId": "run_abc"
  },
  "component": {
    "id": "comp_log",
    "name": "Log",
    "type": "activity"
  },
  "execution": {
    "startedAt": "2025-01-15T10:30:00Z",
    "completedAt": "2025-01-15T10:30:01Z",
    "durationMs": 1000,
    "status": "completed"
  },
  "input": { "message": "Hello from workflow", "level": "info" },
  "output": { "logged": true, "timestamp": "2025-01-15T10:30:01Z" }
}
```

---

## Phase 4: Variables and State Management

### Goal
Implement service and project-level variables with proper state management.

### Variable Scopes

| Scope | Storage | Access | Use Case |
|-------|---------|--------|----------|
| Service | Workflow state | Within service workflows | Local state |
| Project | Project workflow | All services in project | Shared state |
| Connector | External system | Via connector activities | Persistent storage |

### Components to Add

| Component | Type | Description |
|-----------|------|-------------|
| ServiceVariable | state-variable | Variable scoped to service |
| ProjectVariable | state-variable | Variable scoped to project |
| GetVariable | activity | Read variable value |
| SetVariable | activity | Write variable value |
| ProjectInterface | signal/query | Access project variables |

### Architecture

```
Project Workflow (Long-Running)
  |
  +-- Manages project-level variables
  +-- Exposes signals for variable updates
  +-- Exposes queries for variable reads
  |
  +-- Service 1 Workflow
  |     +-- Local service variables
  |     +-- Can query/signal project workflow
  |
  +-- Service 2 Workflow
        +-- Local service variables
        +-- Can query/signal project workflow
```

### Project Workflow Pattern

```typescript
// Generated for projects with project-level variables
export async function projectWorkflow(
  projectId: string,
  initialState: ProjectState
): Promise<void> {
  // Initialize state
  let state: ProjectState = { ...initialState };

  // Set up query handlers
  setHandler(getVariableQuery, (key: string) => {
    return state.variables[key];
  });

  // Set up signal handlers
  setHandler(setVariableSignal, (key: string, value: unknown) => {
    state.variables[key] = value;
  });

  // Long-running: wait for signals
  while (true) {
    await condition(() => false, '24h');

    // Continue-as-new to prevent history growth
    if (workflowInfo().historyLength > 1000) {
      await continueAsNew<typeof projectWorkflow>(projectId, state);
    }
  }
}
```

### Tasks

- [ ] **4.1 Service Variable Component**
  - Rust schema for service variables
  - Code generation for local state
  - UI component for configuration

- [ ] **4.2 Project Variable Component**
  - Rust schema for project variables
  - Project workflow generation
  - Signal/query generation

- [ ] **4.3 GetVariable Activity**
  - Local variable read
  - Project variable query
  - Type-safe return

- [ ] **4.4 SetVariable Activity**
  - Local variable write
  - Project variable signal
  - Type validation

- [ ] **4.5 Project Workflow Generation**
  - Auto-generate when project has variables
  - Long-running pattern
  - Continue-as-new handling

- [ ] **4.6 Cross-Service Access**
  - Service can query project workflow
  - Service can signal project workflow
  - Type-safe communication

- [ ] **4.7 Variable UI**
  - Show service variables in service UI
  - Show project variables in project UI
  - Show connections between them

- [ ] **4.8 Cross-Project Communication**
  - Project A can access Project B's interfaces
  - Through public interfaces (Kong)
  - Proper authentication

### Test Projects

```
Project: "Variable Test Alpha"
  |
  +-- Project Variables:
  |     - counter: number
  |     - lastUpdated: string
  |
  +-- Service: "Counter Service"
        +-- IncrementWorkflow
        +-- ReadCounterWorkflow

Project: "Variable Test Beta"
  |
  +-- Service: "Reader Service"
        +-- ReadAlphaCounterWorkflow (cross-project)
```

### Acceptance Criteria

- [ ] Service variables work within service
- [ ] Project variables accessible from all services
- [ ] Project workflow auto-generated when needed
- [ ] Variables persist across continue-as-new
- [ ] Cross-project access works via interfaces
- [ ] UI shows variable connections
- [ ] API interfaces registered in Kong
- [ ] All tests pass (100%)

---

## Phase 5: Component Library Migration (with Structured Migration Records)

### Goal
Migrate all existing components to the Rust compiler **while creating detailed structured migration records** that will serve as training data for the Phase 8 Component Builder Agent.

### Why Structured Records?

Simple logs capture *what happened*, but not *why* or *the decision process*. For an AI agent to learn how to build components, it needs to understand:
- Why specific input types were chosen
- What validation rules apply and why
- How components connect to others
- What edge cases exist
- What alternatives were considered and rejected

**These records are as important as the migration itself.**

### Existing Components (from codebase analysis)

**Core Components** (7):
- trigger, end
- activity, agent
- conditional, loop
- condition

**State Components** (4):
- state-variable, retry
- data-in, data-out

**Integration Components** (4):
- child-workflow, signal
- api-endpoint, phase

**Kong Components** (3):
- kong-logging
- kong-cache
- kong-cors

**Advanced Components** (2):
- graphql-gateway
- mcp-server

**Total: 20 components**

### Migration Order

1. **Core Flow** (trigger, end, activity) - Foundation
2. **Control Flow** (conditional, loop, condition, phase) - Logic
3. **State** (state-variable, retry, data-in, data-out) - Data handling
4. **Integration** (signal, child-workflow, api-endpoint) - Communication
5. **Kong** (logging, cache, cors) - Infrastructure
6. **Advanced** (graphql-gateway, mcp-server, agent) - Complex

### Structured Migration Record Format

Every component migration MUST produce a `component-migration-record.yaml` file.

**Location**: `packages/workflow-builder/component-records/{component-name}.yaml`

**Required Sections**:

```yaml
# =============================================================================
# COMPONENT MIGRATION RECORD
# =============================================================================
# This record captures the complete decision-making process for migrating
# a component to the Rust compiler. It serves as training data for the
# Phase 8 Component Builder Agent.
# =============================================================================

component:
  name: "{component-name}"
  type: "{activity|trigger|end|conditional|...}"
  category: "{core-flow|control-flow|state|integration|kong|advanced}"
  complexity: "{low|medium|high}"

migration:
  date: "YYYY-MM-DD"
  migrated_by: "{human|agent|human+agent}"
  duration_hours: {number}

# -----------------------------------------------------------------------------
# 1. DISCOVERY PHASE
# -----------------------------------------------------------------------------
# Document what was learned about the existing component
discovery:
  original_typescript_location: "{path to original .ts file}"
  original_lines_of_code: {number}

  dependencies:
    - "{dependency 1}"
    - "{dependency 2}"

  # What does this component do in plain English?
  purpose: |
    {Detailed description of what the component does and why it exists}

  # How is it currently used in workflows?
  usage_patterns:
    - pattern: "{pattern name}"
      description: "{how it's used}"
      frequency: "{common|occasional|rare}"

  # What problems or edge cases exist?
  known_issues:
    - issue: "{description}"
      severity: "{low|medium|high}"
      resolution: "{how we'll handle it}"

# -----------------------------------------------------------------------------
# 2. SCHEMA DESIGN DECISIONS
# -----------------------------------------------------------------------------
# Document WHY each schema decision was made
schema_decisions:
  - decision: "{what was decided}"
    reasoning: |
      {Why this decision was made - be detailed}
    alternatives_considered:
      - option: "{alternative 1}"
        rejected_because: "{reason}"
      - option: "{alternative 2}"
        rejected_because: "{reason}"

# -----------------------------------------------------------------------------
# 3. INPUT SPECIFICATION
# -----------------------------------------------------------------------------
input_schema:
  "{field_name}":
    type: "{string|number|boolean|enum|object|array}"
    required: {true|false}
    default: "{default value if any}"
    validation:
      - rule: "{validation rule}"
        error_message: "{user-friendly error}"
    description: "{what this field is for}"

    # For enum types
    values: ["{value1}", "{value2}"]

    # For object types
    properties:
      "{nested_field}":
        type: "{type}"
        # ... same structure

# -----------------------------------------------------------------------------
# 4. OUTPUT SPECIFICATION
# -----------------------------------------------------------------------------
output_schema:
  "{field_name}":
    type: "{type}"
    description: "{what this output represents}"
    guaranteed: {true|false}  # Is this always present?

# -----------------------------------------------------------------------------
# 5. VALIDATION RULES
# -----------------------------------------------------------------------------
validation_rules:
  - rule: "{rule description}"
    error_code: "{ERROR_CODE}"
    error_message: "{user-friendly message}"
    severity: "{error|warning}"

    # When does this rule apply?
    applies_when: "{condition or 'always'}"

# -----------------------------------------------------------------------------
# 6. CONNECTION COMPATIBILITY
# -----------------------------------------------------------------------------
connections:
  # What can connect TO this component's input?
  accepts_from:
    - component_type: "{type or 'any'}"
      output_field: "{field name or '*'}"
      maps_to_input: "{input field name}"
      transformation: "{none|required transformation}"

  # What can this component connect TO?
  outputs_to:
    - component_type: "{type or 'any'}"
      output_field: "{field name}"
      compatible_with_input: "{target input field or '*'}"

# -----------------------------------------------------------------------------
# 7. RUST SCHEMA
# -----------------------------------------------------------------------------
rust_schema: |
  /// {Component name} - {brief description}
  #[derive(Debug, Clone, Serialize, Deserialize, Validate)]
  pub struct {ComponentName}Input {
      // ... full Rust struct
  }

  #[derive(Debug, Clone, Serialize, Deserialize)]
  pub struct {ComponentName}Output {
      // ... full Rust struct
  }

# -----------------------------------------------------------------------------
# 8. TYPESCRIPT TEMPLATE
# -----------------------------------------------------------------------------
typescript_template: |
  /**
   * {Component name} Activity
   * {description}
   */
  export async function {functionName}(
    input: {InputType}
  ): Promise<{OutputType}> {
    // ... implementation template
  }

# -----------------------------------------------------------------------------
# 9. TEST CASES
# -----------------------------------------------------------------------------
test_cases:
  # Happy path tests
  - name: "{test name}"
    type: "happy_path"
    input:
      {field}: {value}
    expected_output:
      {field}: {value}
    description: "{what this test verifies}"

  # Error cases
  - name: "{test name}"
    type: "error_case"
    input:
      {field}: {invalid_value}
    expected_error:
      code: "{ERROR_CODE}"
      message: "{expected message pattern}"
    description: "{what this test verifies}"

  # Edge cases
  - name: "{test name}"
    type: "edge_case"
    input: {special input}
    expected_output: {expected result}
    description: "{why this edge case matters}"

# -----------------------------------------------------------------------------
# 10. LESSONS LEARNED
# -----------------------------------------------------------------------------
lessons_learned:
  - category: "{schema|validation|codegen|testing|integration}"
    lesson: |
      {What was learned that would help with future components}
    applies_to: ["{component types this applies to}"]

# -----------------------------------------------------------------------------
# 11. RELATED COMPONENTS
# -----------------------------------------------------------------------------
related_components:
  - name: "{component name}"
    relationship: "{similar_to|depends_on|often_used_with|alternative_to}"
    notes: "{why this relationship matters}"

# -----------------------------------------------------------------------------
# 12. FUTURE IMPROVEMENTS
# -----------------------------------------------------------------------------
future_improvements:
  - improvement: "{what could be better}"
    priority: "{low|medium|high}"
    effort: "{low|medium|high}"
    blocked_by: "{nothing|other component|external dependency}"
```

### Tasks

- [ ] **5.0 Set Up Migration Record Infrastructure**
  - Create `component-records/` directory
  - Create migration record template
  - Set up validation for record completeness

- [ ] **5.1 Activity Component Migration + Record**
- [ ] **5.2 Trigger Component Migration + Record**
- [ ] **5.3 End Component Migration + Record**
- [ ] **5.4 Conditional Component Migration + Record**
- [ ] **5.5 Loop Component Migration + Record**
- [ ] **5.6 Condition Component Migration + Record**
- [ ] **5.7 Phase Component Migration + Record**
- [ ] **5.8 State Variable Component Migration + Record**
- [ ] **5.9 Retry Component Migration + Record**
- [ ] **5.10 Data-In Component Migration + Record**
- [ ] **5.11 Data-Out Component Migration + Record**
- [ ] **5.12 Signal Component Migration + Record**
- [ ] **5.13 Child Workflow Component Migration + Record**
- [ ] **5.14 API Endpoint Component Migration + Record**
- [ ] **5.15 Kong Logging Pattern Migration + Record**
- [ ] **5.16 Kong Cache Pattern Migration + Record**
- [ ] **5.17 Kong CORS Pattern Migration + Record**
- [ ] **5.18 GraphQL Gateway Migration + Record**
- [ ] **5.19 MCP Server Migration + Record**
- [ ] **5.20 Agent Component Migration + Record**

- [ ] **5.21 Record Quality Review**
  - Review all records for completeness
  - Ensure consistent formatting
  - Validate YAML syntax
  - Cross-reference related components

- [ ] **5.22 Record Analysis Summary**
  - Create summary of patterns across all records
  - Identify common schema patterns
  - Document reusable validation rules
  - List common lessons learned

### Per-Component Migration Checklist

For EACH component, complete ALL of the following:

**Technical Migration**:
- [ ] Analyze existing TypeScript implementation
- [ ] Define Rust schema (structs, enums)
- [ ] Implement validation rules in Rust
- [ ] Create TypeScript code generation template
- [ ] Write Rust unit tests (90% coverage)
- [ ] Write integration tests
- [ ] Update UI component registry
- [ ] Verify zero `any` types in output
- [ ] Run comparison tests (TS vs Rust output)

**Migration Record**:
- [ ] Complete Discovery section
- [ ] Document all Schema Decisions with reasoning
- [ ] Define complete Input Schema
- [ ] Define complete Output Schema
- [ ] List all Validation Rules
- [ ] Map Connection Compatibility
- [ ] Include full Rust Schema
- [ ] Include TypeScript Template
- [ ] Write comprehensive Test Cases (happy, error, edge)
- [ ] Document Lessons Learned
- [ ] Identify Related Components
- [ ] Note Future Improvements

### Migration Record Quality Criteria

Each record must meet these quality bars:

1. **Completeness**: All 12 sections filled out
2. **Reasoning Documented**: Every decision has a "why"
3. **Alternatives Listed**: At least 1 rejected alternative per major decision
4. **Test Coverage**: Minimum 3 happy path, 2 error, 1 edge case
5. **Lessons Captured**: At least 2 lessons learned per component
6. **Valid YAML**: Passes YAML linter
7. **Cross-Referenced**: Related components identified

### Acceptance Criteria

**Technical**:
- [ ] All 20 components migrated to Rust compiler
- [ ] All existing workflows still compile
- [ ] All existing tests pass
- [ ] Generated code quality maintained
- [ ] No regressions in functionality
- [ ] Zero `any` types in generated code

**Migration Records**:
- [ ] 20 complete migration records created
- [ ] All records pass quality criteria
- [ ] Records stored in `component-records/` directory
- [ ] Summary analysis document created
- [ ] Records validated and cross-referenced

### Files Created

```
packages/workflow-builder/
  component-records/
    _template.yaml              # Template for new records
    _summary.md                 # Analysis summary (created at end)

    # Core Flow
    activity.yaml
    trigger.yaml
    end.yaml

    # Control Flow
    conditional.yaml
    loop.yaml
    condition.yaml
    phase.yaml

    # State
    state-variable.yaml
    retry.yaml
    data-in.yaml
    data-out.yaml

    # Integration
    signal.yaml
    child-workflow.yaml
    api-endpoint.yaml

    # Kong
    kong-logging.yaml
    kong-cache.yaml
    kong-cors.yaml

    # Advanced
    graphql-gateway.yaml
    mcp-server.yaml
    agent.yaml
```

---

## Phase 6: Advanced Features

### Goal
Implement advanced features: connectors, public interfaces, service-to-service communication.

### Features

1. **Connectors**
   - PostgreSQL connector
   - Redis connector
   - External API connector

2. **Public Interfaces**
   - HTTP endpoints via Kong
   - Authentication options
   - Rate limiting per interface

3. **Service-to-Service Communication**
   - Within project (signals/queries)
   - Cross-project (Kong APIs)

4. **Project-to-Project Communication**
   - Public interface registration
   - API key management
   - Access control

### Tasks

- [ ] **6.1 PostgreSQL Connector**
- [ ] **6.2 Redis Connector**
- [ ] **6.3 External API Connector**
- [ ] **6.4 HTTP Endpoint Generation**
- [ ] **6.5 Interface Authentication**
- [ ] **6.6 Rate Limiting Configuration**
- [ ] **6.7 Service-to-Service Calls**
- [ ] **6.8 Cross-Project APIs**
- [ ] **6.9 API Key Management**
- [ ] **6.10 Access Control Rules**

### Acceptance Criteria

- [ ] Connectors store/retrieve data correctly
- [ ] Public interfaces accessible via Kong
- [ ] Authentication enforced
- [ ] Rate limiting works
- [ ] Service-to-service communication works
- [ ] Cross-project communication works
- [ ] All tests pass

---

## Phase 7: Production Hardening

### Goal
Prepare for production deployment with monitoring, scaling, and security.

### Features

1. **Monitoring**
   - Prometheus metrics from Rust service
   - Grafana dashboards
   - Alert configuration

2. **Scaling**
   - Horizontal scaling of Rust service
   - Connection pooling
   - Caching layer

3. **Security**
   - Input sanitization
   - Rate limiting
   - Audit logging

4. **Reliability**
   - Health checks
   - Graceful degradation
   - Circuit breakers

### Tasks

- [ ] **7.1 Prometheus Metrics**
- [ ] **7.2 Grafana Dashboards**
- [ ] **7.3 Alert Rules**
- [ ] **7.4 Horizontal Scaling Config**
- [ ] **7.5 Connection Pooling**
- [ ] **7.6 Response Caching**
- [ ] **7.7 Input Sanitization**
- [ ] **7.8 Audit Logging**
- [ ] **7.9 Health Check Endpoints**
- [ ] **7.10 Circuit Breaker Pattern**
- [ ] **7.11 Load Testing**
- [ ] **7.12 Chaos Testing**

### Acceptance Criteria

- [ ] Metrics exposed and collected
- [ ] Dashboards show system health
- [ ] Alerts fire on issues
- [ ] Service scales horizontally
- [ ] No security vulnerabilities
- [ ] System handles failures gracefully
- [ ] Load tests pass (target: 1000 compilations/minute)

---

## Phase 8: Component Builder System

### Goal
Build an AI-powered Component Builder as a project within the workflow-builder itself, using the Phase 5 migration records as training data. Admins can talk to an AI agent to create new components through a conversational interface.

### The Meta-Vision

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Workflow Builder UI                                  │
│                                                                             │
│   Project: "Component Factory" (Admin-only)                                 │
│   ┌───────────────────────────────────────────────────────────────────┐    │
│   │                                                                    │    │
│   │  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐   │    │
│   │  │   Human     │    │  Component  │    │   Generated         │   │    │
│   │  │   Admin     │───►│  Builder    │───►│   Component         │   │    │
│   │  │   (Chat)    │    │  Agent      │    │   (Ready to Use)    │   │    │
│   │  └─────────────┘    └──────┬──────┘    └─────────────────────┘   │    │
│   │                            │                                      │    │
│   │                            ▼                                      │    │
│   │  ┌────────────────────────────────────────────────────────────┐  │    │
│   │  │                 Services (Workflows)                        │  │    │
│   │  │                                                             │  │    │
│   │  │  [Conversation] → [Spec Gen] → [Schema Gen] → [Code Gen]  │  │    │
│   │  │        │              │             │              │        │  │    │
│   │  │        ▼              ▼             ▼              ▼        │  │    │
│   │  │  [Validate] ← [Test Gen] ← [Template] ← [Register]        │  │    │
│   │  │                                                             │  │    │
│   │  └────────────────────────────────────────────────────────────┘  │    │
│   │                                                                    │    │
│   └───────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│   Training Data: 20 Component Migration Records from Phase 5               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Why Build It This Way?

1. **Self-Bootstrapping**: The workflow-builder builds its own component system
2. **Training Data Ready**: Phase 5 migration records provide 20 detailed examples
3. **Pattern Extraction**: Records contain decisions, alternatives, lessons learned
4. **Continuous Improvement**: As more components are built, the agent gets better
5. **Meta-Validation**: If the Component Builder works, the workflow-builder works

### Architecture

```
Component Factory Project
│
├── Service: "Component Conversation"
│   │
│   ├── [Start: Admin initiates]
│   │
│   ├── [Agent: Component Builder Agent]
│   │   - System prompt with migration record patterns
│   │   - Conversational component design
│   │   - Asks clarifying questions
│   │   - Proposes schema incrementally
│   │
│   ├── [Spec Validation]
│   │   - Validates generated spec against schema
│   │   - Checks for completeness
│   │   - Suggests improvements
│   │
│   └── [Output: Component Specification YAML]
│
├── Service: "Code Generation"
│   │
│   ├── [Start: Receives validated spec]
│   │
│   ├── [Rust Schema Generator]
│   │   - Generates Rust structs from spec
│   │   - Adds validation derive macros
│   │   - Creates enum types
│   │
│   ├── [TypeScript Template Generator]
│   │   - Generates activity code template
│   │   - Applies patterns from migration records
│   │   - Ensures no `any` types
│   │
│   ├── [Test Case Generator]
│   │   - Generates test cases from spec
│   │   - Happy path, error, edge cases
│   │   - Creates test fixtures
│   │
│   └── [Output: Generated Code Bundle]
│
├── Service: "Component Registration"
│   │
│   ├── [Start: Receives code bundle]
│   │
│   ├── [Code Verification]
│   │   - Runs Rust compilation
│   │   - Runs tsc --strict
│   │   - Runs ESLint
│   │   - Executes generated tests
│   │
│   ├── [Database Registration]
│   │   - Inserts into components table
│   │   - Sets up component_types mapping
│   │   - Configures visibility
│   │
│   ├── [UI Registry Update]
│   │   - Adds to component palette
│   │   - Generates UI configuration
│   │
│   └── [Output: Component Ready for Use]
│
└── Project Variables:
    - current_spec: object
    - generation_status: string
    - validation_results: object
```

### Component Builder Agent Design

#### System Prompt Structure

```
You are the Component Builder Agent for the Workflow Builder system.

Your role is to help admins create new components through conversation.
You have been trained on 20 component migration records that document
how existing components were designed.

## Your Knowledge Base

You have access to:
1. 20 detailed migration records from Phase 5
2. Common schema patterns extracted from these records
3. Validation rules that work across components
4. Lessons learned from previous component development

## Your Process

1. UNDERSTAND the component need
   - What problem does it solve?
   - What category does it belong to?
   - What are the inputs and outputs?

2. EXPLORE alternatives
   - Is there an existing component that could work?
   - What are different ways to design this?
   - What trade-offs exist?

3. DESIGN incrementally
   - Start with input/output schema
   - Add validation rules
   - Define connection compatibility
   - Consider error cases

4. VALIDATE continuously
   - Check against similar components
   - Ensure type safety
   - Verify completeness

## Output Format

You produce a Component Specification in YAML format matching the
migration record schema. This spec is then used by the Code Generation
service to produce actual code.

## Quality Standards

- Every field must have a type
- Every input must have validation rules
- Error messages must be user-friendly
- Test cases must cover happy, error, and edge cases
- Lessons from similar components must be considered
```

#### Conversation Flow Example

```
Admin: I need a component that calls an external REST API

Agent: I'll help you create a REST API component. Let me understand your needs.

1. What type of API calls will this support?
   a) GET requests only
   b) GET and POST
   c) Full CRUD (GET, POST, PUT, DELETE)
   d) Custom method selection

Admin: b) GET and POST

Agent: Good choice. Looking at similar components (like the External API
Connector from migration records), I recommend:

Input Schema:
- url: string (required) - The API endpoint
- method: enum ['GET', 'POST'] - HTTP method
- headers: object (optional) - Custom headers
- body: object (optional, required for POST) - Request body
- timeout: number (optional, default: 30000) - Timeout in ms

Does this match your needs, or should we adjust?

Admin: Add authentication support

Agent: I'll add authentication. Based on the kong-logging and api-endpoint
migration records, here are the common patterns:

Authentication Options:
a) API Key (header or query param)
b) Bearer Token
c) Basic Auth
d) OAuth2
e) Multiple options (let user choose)

Which authentication method(s) should we support?

[...conversation continues until spec is complete...]

Agent: Here's the complete component specification:

```yaml
component:
  name: "rest-api-call"
  type: "activity"
  category: "integration"
  complexity: "medium"
...
```

Shall I proceed with code generation?
```

### Sub-Phases

#### 8.1 Component Specification Schema

**Goal**: Formalize the migration record format into a validated schema

**Tasks**:
- [ ] **8.1.1** Create JSON Schema for component specifications
- [ ] **8.1.2** Create Rust types for component specs
- [ ] **8.1.3** Create TypeScript types for UI
- [ ] **8.1.4** Build spec validation service
- [ ] **8.1.5** Create spec linter/formatter

**Deliverables**:
- `component-spec-schema.json` - JSON Schema
- `src/schema/component_spec.rs` - Rust types
- `src/types/component-spec.ts` - TypeScript types

#### 8.2 Schema-to-Code Generation

**Goal**: Build service that converts specs to code

**Tasks**:
- [ ] **8.2.1** Rust Schema Generator
  - Input: Component spec YAML
  - Output: Rust struct definitions
  - Handles: enums, validation, optional fields

- [ ] **8.2.2** TypeScript Template Generator
  - Input: Component spec YAML
  - Output: Activity function code
  - Handles: async functions, error handling, types

- [ ] **8.2.3** Test Case Generator
  - Input: Component spec test_cases section
  - Output: Vitest test file
  - Handles: happy path, error, edge cases

- [ ] **8.2.4** Integration with Rust Compiler
  - Add generated components to compiler
  - Register patterns for new components
  - Update validation rules

**Deliverables**:
- Code generation service (Rust)
- Template files for each output type
- Integration with existing compiler

#### 8.3 Component Builder Agent

**Goal**: Design and implement the conversational agent

**Tasks**:
- [ ] **8.3.1** Agent System Prompt
  - Incorporate migration record patterns
  - Define conversation flow
  - Set quality standards

- [ ] **8.3.2** Pattern Extraction from Migration Records
  - Analyze 20 records for common patterns
  - Extract reusable schema patterns
  - Document decision heuristics

- [ ] **8.3.3** Agent Workflow Definition
  - Define as workflow in workflow-builder
  - Configure agent component
  - Set up conversation loop

- [ ] **8.3.4** Spec Generation Logic
  - Convert conversation to YAML spec
  - Validate incrementally
  - Handle revisions

**Deliverables**:
- Agent system prompt document
- Pattern extraction summary
- Agent workflow definition

#### 8.4 Component Builder Project

**Goal**: Build the Component Factory as a workflow-builder project

**Tasks**:
- [ ] **8.4.1** Create "Component Factory" Project
  - Admin-only visibility
  - Special permissions

- [ ] **8.4.2** Build "Component Conversation" Service
  - Start trigger
  - Agent component (Component Builder Agent)
  - Spec validation component
  - Output to project variable

- [ ] **8.4.3** Build "Code Generation" Service
  - Triggered by spec completion
  - Rust schema generation
  - TypeScript template generation
  - Test case generation

- [ ] **8.4.4** Build "Component Registration" Service
  - Code verification
  - Database registration
  - UI registry update
  - Notification of completion

- [ ] **8.4.5** Wire Services Together
  - Project variables for state
  - Service-to-service signals
  - Error handling

**Deliverables**:
- Component Factory project (visible in UI)
- Three services configured and connected
- End-to-end workflow tested

#### 8.5 Admin UI Integration

**Goal**: Create admin interface for Component Builder

**Tasks**:
- [ ] **8.5.1** "Create Component" Admin Button
  - Visible only to admins
  - Opens Component Builder interface

- [ ] **8.5.2** Chat Interface
  - Real-time conversation with agent
  - Spec preview panel
  - Validation feedback

- [ ] **8.5.3** Code Preview
  - Show generated Rust schema
  - Show generated TypeScript
  - Show generated tests

- [ ] **8.5.4** Component Preview
  - Show how component will appear in palette
  - Preview input/output configuration
  - Test connection compatibility

- [ ] **8.5.5** Publish Flow
  - Review generated code
  - Approve and publish
  - Rollback capability

**Deliverables**:
- Admin UI components
- Chat interface
- Preview panels
- Publish workflow

### Agent Training Data

The Component Builder Agent's knowledge comes from:

1. **20 Migration Records** (from Phase 5)
   - Complete decision-making documentation
   - Alternatives considered and rejected
   - Lessons learned

2. **Pattern Summary** (created in Phase 5.22)
   - Common schema patterns
   - Reusable validation rules
   - Connection compatibility patterns

3. **Component Taxonomy**
   - Categories and their characteristics
   - Complexity classifications
   - Relationship mappings

### Example: Creating a New Component

**Admin Request**: "I need a component that sends Slack notifications"

**Agent Process**:
1. Identifies category: integration
2. Finds similar: kong-logging (notification pattern)
3. Proposes schema based on patterns
4. Asks about: channel selection, message format, attachments
5. Generates complete spec
6. Triggers code generation
7. Validates and registers

**Output**: New `slack-notification` component ready to use

### Tasks Summary

- [ ] **8.1** Component Specification Schema (5 tasks)
- [ ] **8.2** Schema-to-Code Generation (4 tasks)
- [ ] **8.3** Component Builder Agent (4 tasks)
- [ ] **8.4** Component Builder Project (5 tasks)
- [ ] **8.5** Admin UI Integration (5 tasks)

**Total: 23 tasks**

### Acceptance Criteria

- [ ] Component specification schema is validated and documented
- [ ] Code generation produces valid Rust and TypeScript
- [ ] Agent successfully uses migration records as training data
- [ ] Component Factory project exists and is functional
- [ ] Admin can create new component through conversation
- [ ] Generated components work in workflows
- [ ] End-to-end test: create component, use in workflow, execute
- [ ] At least 3 new components created via Component Builder

### Success Metrics

- Component creation time: < 30 minutes (conversation to ready)
- Generated code quality: 100% pass tsc --strict
- Agent accuracy: > 90% specs complete on first generation
- Admin satisfaction: qualitative feedback positive

### Files Created

```
packages/workflow-builder/
  component-records/
    _spec-schema.json           # JSON Schema for specs
    _patterns.md                # Extracted patterns summary

  src/
    lib/
      component-builder/
        spec-validator.ts       # Spec validation
        code-generator.ts       # Code generation orchestration
        agent-prompt.ts         # Agent system prompt

    components/
      admin/
        ComponentBuilderButton.tsx
        ComponentBuilderChat.tsx
        ComponentPreview.tsx
        CodePreview.tsx
        PublishFlow.tsx

  workflow-compiler-rs/
    src/
      component_spec/
        mod.rs
        schema.rs               # Spec parsing
        generator.rs            # Code generation
```

### Future Evolution

Once Phase 8 is complete, the Component Builder can be enhanced:

1. **Self-Improvement**: Agent learns from each component created
2. **Template Library**: Save successful patterns as templates
3. **Community Components**: Allow users to share components
4. **Version Management**: Component versioning and migration
5. **Deprecation Workflow**: Safely deprecate old components

---

## Testing Strategy

### Test Pyramid

```
        /\
       /  \     E2E Tests (Playwright)
      /----\    - Full UI workflows
     /      \   - Cross-browser
    /--------\
   /          \ Integration Tests
  /            \- Rust + TypeScript
 /--------------\- Rust + Temporal
/                \- Kong routing
------------------
     Unit Tests
     - Rust modules
     - TypeScript generators
     - Schema validation
```

### Test Categories

| Category | Location | Framework | Coverage Target |
|----------|----------|-----------|-----------------|
| Rust Unit | `workflow-compiler-rs/tests/` | cargo test | 90% |
| TS Unit | `tests/unit/` | Vitest | 80% |
| Integration | `tests/integration/` | Vitest | 80% |
| E2E | `tests/e2e/` | Playwright | Critical paths |

### Comparison Tests

For migration safety, run **comparison tests**:
1. Compile workflow with TypeScript compiler
2. Compile same workflow with Rust compiler
3. Compare generated code (structure, not whitespace)
4. Both must produce valid, equivalent code

### Mock Validation

Per AGENTINFO.md requirements:
- All mocks must be tested against real systems
- Mock tests run in CI
- Parity checks for external services

---

## Risk Mitigation

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Rust learning curve | Medium | Medium | Pair programming, code reviews |
| Generated code bugs | Low | High | Extensive testing, comparison tests |
| Performance regression | Low | Medium | Benchmarks, load testing |
| Kong routing issues | Low | Medium | Incremental rollout, monitoring |

### Rollback Plan

Each phase has a rollback plan:
- **Phase 1**: Remove Kong routes, point UI to direct backend
- **Phase 2**: Route compiler endpoints back to TypeScript
- **Phase 3+**: Revert to previous TypeScript compiler version

### Feature Flags

Use feature flags for gradual rollout:
- `RUST_COMPILER_ENABLED` - Use Rust compiler
- `RUST_COMPILER_PERCENTAGE` - % of requests to Rust
- `RUST_COMPILER_PROJECTS` - Specific projects for Rust

---

## Success Metrics

### Phase 1 (Kong)
- Latency overhead < 10ms
- Zero downtime during migration
- All existing tests pass

### Phase 2 (Rust Compiler)
- Compilation time < 100ms (p95)
- Zero `any` types in output
- 100% schema validation coverage

### Phase 3 (Basic Workflows)
- 4/4 workflows execute correctly
- 100% test pass rate
- Logging complete and accurate

### Phase 4 (Variables)
- Variable operations < 50ms
- Cross-project communication works
- State preserves across continue-as-new

### Phase 5 (Component Migration + Records)
- All 20 components migrated
- 20 complete migration records created
- No functionality regressions
- Production-ready performance

### Phase 8 (Component Builder)
- Component creation time < 30 minutes
- Generated code 100% passes tsc --strict
- Agent accuracy > 90% on first generation
- At least 3 new components created via builder

---

## Appendix A: Rust Code Templates

### Workflow Template (Handlebars)

```handlebars
// Generated by workflow-compiler-rs
// DO NOT EDIT - This file is auto-generated

import {
  proxyActivities,
  defineQuery,
  defineSignal,
  setHandler,
  condition,
  workflowInfo,
  continueAsNew,
} from '@temporalio/workflow';

import type * as activities from './activities';

// Activity proxy with strict typing
const acts = proxyActivities<typeof activities>({
  startToCloseTimeout: '{{settings.timeout}}',
  {{#if settings.retry_policy}}
  retry: {
    maximumAttempts: {{settings.retry_policy.max_attempts}},
    initialInterval: '{{settings.retry_policy.initial_interval}}',
    maximumInterval: '{{settings.retry_policy.max_interval}}',
    backoffCoefficient: {{settings.retry_policy.backoff_coefficient}},
  },
  {{/if}}
});

{{#each variables}}
// Variable: {{name}} ({{type}})
{{/each}}

/**
 * {{name}} Workflow
 * Generated from workflow definition: {{id}}
 */
export async function {{functionName}}(
  input: {{inputType}}
): Promise<{{outputType}}> {
  {{#each codeBlocks}}
  {{{code}}}
  {{/each}}
}
```

### Activities Template (Handlebars)

```handlebars
// Generated by workflow-compiler-rs
// DO NOT EDIT - This file is auto-generated

{{#each imports}}
import { {{items}} } from '{{module}}';
{{/each}}

{{#each activities}}
/**
 * {{name}} Activity
 * Component: {{componentName}}
 */
export async function {{functionName}}(
  input: {{inputType}}
): Promise<{{outputType}}> {
  {{#if isLogActivity}}
  // Kong logging integration
  const logPayload = {
    timestamp: new Date().toISOString(),
    level: input.level,
    message: input.message,
    metadata: input.metadata,
  };

  await fetch(process.env.KONG_LOGGING_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(logPayload),
  });

  return { logged: true, timestamp: new Date() };
  {{else}}
  {{{implementation}}}
  {{/if}}
}
{{/each}}
```

---

## Appendix B: Environment Configuration

### Development

```env
# Rust Compiler Service
RUST_COMPILER_URL=http://localhost:3020
RUST_COMPILER_ENABLED=true

# Kong Gateway
KONG_ADMIN_URL=http://localhost:8001
KONG_GATEWAY_URL=http://localhost:8000

# Temporal
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default

# Supabase
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Feature Flags
RUST_COMPILER_PERCENTAGE=100
RUST_COMPILER_PROJECTS=*
```

### Production

```env
# Rust Compiler Service (Kubernetes)
RUST_COMPILER_URL=http://workflow-compiler:3020
RUST_COMPILER_ENABLED=true

# Kong Gateway
KONG_ADMIN_URL=http://kong-admin:8001
KONG_GATEWAY_URL=https://api.example.com

# Temporal Cloud
TEMPORAL_ADDRESS=namespace.account.tmprl.cloud:7233
TEMPORAL_NAMESPACE=production
TEMPORAL_TLS_CERT=/certs/client.pem
TEMPORAL_TLS_KEY=/certs/client.key

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-production-key
```

---

## Appendix C: API Specifications

### Rust Compiler API

#### POST /compile

Request:
```json
{
  "workflow": {
    "id": "wf_123",
    "name": "MyWorkflow",
    "nodes": [...],
    "edges": [...],
    "variables": [...],
    "settings": {...}
  },
  "options": {
    "strictMode": true,
    "includeComments": true
  }
}
```

Response (Success):
```json
{
  "success": true,
  "code": {
    "workflow": "// Generated workflow code...",
    "activities": "// Generated activities code...",
    "worker": "// Generated worker code..."
  },
  "metadata": {
    "nodeCount": 5,
    "edgeCount": 4,
    "compilationTimeMs": 45,
    "version": "1.0.0"
  },
  "verification": {
    "tscPassed": true,
    "eslintPassed": true,
    "anyTypesFound": 0
  }
}
```

Response (Error):
```json
{
  "success": false,
  "errors": [
    {
      "code": "INVALID_CONNECTION",
      "message": "Node 'log_1' output type 'LogOutput' is not compatible with node 'end_1' input type 'EndInput'",
      "nodeId": "log_1",
      "severity": "error"
    }
  ]
}
```

#### POST /validate

Request:
```json
{
  "workflow": {...}
}
```

Response:
```json
{
  "valid": true,
  "warnings": [],
  "suggestions": [
    "Consider adding retry policy to activity 'fetchData'"
  ]
}
```

#### GET /health

Response:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 3600,
  "dependencies": {
    "tsc": "available",
    "eslint": "available"
  }
}
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-12-09 | Claude | Initial plan |
| 1.1.0 | 2025-12-09 | Claude | Added Phase 8 (Component Builder System), enhanced Phase 5 with structured migration records, updated timeline |
