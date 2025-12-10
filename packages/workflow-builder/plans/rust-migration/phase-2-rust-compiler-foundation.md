# Phase 2: Rust Validation/Compilation Service

**Status**: COMPLETED
**Completed**: 2025-12-10
**Duration**: 2-3 weeks
**Prerequisites**: Phase 1 (Kong Abstraction)
**Blocks**: Phase 3

## Overview

Create the Rust service that validates workflow definitions and generates type-safe TypeScript code. This is the core of the "Trust But Verify" architecture.

## Goals

1. Build Rust HTTP service with Axum
2. Define all workflow schemas in Rust
3. Implement JSON validation with strict typing
4. Generate TypeScript code with zero `any` types
5. Verify generated code with tsc and ESLint
6. Integrate with Kong for routing

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Rust Compiler Service                         │
│                                                                  │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐ │
│  │ HTTP API     │   │ Schema       │   │ Code Generator       │ │
│  │ (Axum)       │──►│ Validation   │──►│ (Handlebars)         │ │
│  │              │   │ (serde+      │   │                      │ │
│  │ POST /compile│   │  validator)  │   │ workflow.ts          │ │
│  │ POST /validate   │              │   │ activities.ts        │ │
│  │ GET /health  │   │              │   │ worker.ts            │ │
│  └──────────────┘   └──────────────┘   └──────────────────────┘ │
│                                                  │               │
│                                                  ▼               │
│                                        ┌──────────────────────┐ │
│                                        │ Verification         │ │
│                                        │ Pipeline             │ │
│                                        │                      │ │
│                                        │ tsc --strict         │ │
│                                        │ eslint               │ │
│                                        └──────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tasks

### 2.1 Rust Project Setup

**Description**: Initialize Cargo project and configure dependencies

**Subtasks**:
- [x] 2.1.1 Create `workflow-compiler-rs` directory in monorepo
- [x] 2.1.2 Initialize Cargo project with `cargo init`
- [x] 2.1.3 Configure Cargo.toml with dependencies
- [x] 2.1.4 Set up workspace integration
- [x] 2.1.5 Create directory structure
- [x] 2.1.6 Configure rustfmt.toml
- [x] 2.1.7 Configure clippy.toml
- [ ] 2.1.8 Add to monorepo build scripts
- [ ] 2.1.9 Set up CI/CD for Rust builds
- [x] 2.1.10 Create Dockerfile for Rust service

**Files to Create**:
```
workflow-compiler-rs/
  Cargo.toml
  Cargo.lock
  rustfmt.toml
  clippy.toml
  Dockerfile
  .dockerignore
  src/
    main.rs
    lib.rs
```

**Cargo.toml**:
```toml
[package]
name = "workflow-compiler"
version = "0.1.0"
edition = "2021"
authors = ["Bernier LLC"]
description = "Rust-based workflow compiler for type-safe TypeScript generation"

[dependencies]
# Web framework
axum = "0.7"
tokio = { version = "1", features = ["full"] }
tower = "0.4"
tower-http = { version = "0.5", features = ["cors", "trace", "timeout"] }

# Serialization
serde = { version = "1", features = ["derive"] }
serde_json = "1"
serde_yaml = "0.9"

# Validation
validator = { version = "0.16", features = ["derive"] }

# Templating
handlebars = "5"

# Error handling
thiserror = "1"
anyhow = "1"

# Logging
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter", "json"] }

# Async utilities
futures = "0.3"

# Process execution (for tsc/eslint)
tokio-process = "0.2"

# HTTP client
reqwest = { version = "0.11", features = ["json"] }

# Database (optional, for storing compiled code)
sqlx = { version = "0.7", features = ["runtime-tokio", "postgres", "uuid"], optional = true }

# UUID generation
uuid = { version = "1", features = ["v4", "serde"] }

# Date/time
chrono = { version = "0.4", features = ["serde"] }

# Regex for validation
regex = "1"

[dev-dependencies]
pretty_assertions = "1"
tokio-test = "0.4"
tempfile = "3"

[features]
default = []
database = ["sqlx"]
```

**Acceptance Criteria**:
- [x] `cargo build` succeeds
- [x] `cargo test` runs (43 tests pass)
- [x] `cargo clippy` passes
- [x] `cargo fmt --check` passes

---

### 2.2 Schema Definitions

**Description**: Define all workflow types as Rust structs

**Subtasks**:
- [ ] 2.2.1 Create `schema/mod.rs` module structure
- [ ] 2.2.2 Define `WorkflowDefinition` struct
- [ ] 2.2.3 Define `WorkflowNode` struct with `NodeType` enum
- [ ] 2.2.4 Define `WorkflowEdge` struct
- [ ] 2.2.5 Define `WorkflowVariable` struct with `VariableType` enum
- [ ] 2.2.6 Define `WorkflowSettings` struct
- [ ] 2.2.7 Define `NodeData` struct with all config options
- [ ] 2.2.8 Define `RetryPolicy` struct with `RetryStrategy` enum
- [ ] 2.2.9 Define `Position` struct
- [ ] 2.2.10 Add serde derive macros to all types
- [ ] 2.2.11 Add validation derive macros where needed
- [ ] 2.2.12 Write unit tests for serialization/deserialization

**Files to Create**:
```
src/schema/
  mod.rs
  workflow.rs
  node.rs
  edge.rs
  variable.rs
  settings.rs
  validation.rs
```

**Example - node.rs**:
```rust
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Node types - exhaustive enum prevents invalid types at compile time
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
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

/// Position on canvas
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub x: f64,
    pub y: f64,
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

/// Node data - all possible configuration fields
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
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
```

**Acceptance Criteria**:
- [ ] All TypeScript types have Rust equivalents
- [ ] JSON from current TypeScript compiler parses correctly
- [ ] Round-trip serialization works (deserialize then serialize)
- [ ] Unit tests cover all types

---

### 2.3 Schema Validation

**Description**: Implement comprehensive validation logic

**Subtasks**:
- [ ] 2.3.1 Create `validation/mod.rs` module
- [ ] 2.3.2 Implement graph connectivity validation (no orphan nodes)
- [ ] 2.3.3 Implement start node validation (exactly one trigger with no incoming edges)
- [ ] 2.3.4 Implement end node validation (at least one end node)
- [ ] 2.3.5 Implement cycle detection
- [ ] 2.3.6 Implement component configuration validation
- [ ] 2.3.7 Implement variable reference validation
- [ ] 2.3.8 Implement edge source/target validation
- [ ] 2.3.9 Create validation error types
- [ ] 2.3.10 Implement validation result aggregation
- [ ] 2.3.11 Write comprehensive validation tests

**Files to Create**:
```
src/validation/
  mod.rs
  graph.rs        # Graph structure validation
  components.rs   # Component config validation
  variables.rs    # Variable reference validation
  errors.rs       # Error types
```

**Example - errors.rs**:
```rust
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ValidationError {
    #[error("No start node found. Workflow must have exactly one trigger node.")]
    NoStartNode,

    #[error("Multiple start nodes found: {0:?}. Workflow must have exactly one trigger.")]
    MultipleStartNodes(Vec<String>),

    #[error("No end node found. Workflow must have at least one end node.")]
    NoEndNode,

    #[error("Orphan node '{0}' has no connections.")]
    OrphanNode(String),

    #[error("Cycle detected involving nodes: {0:?}")]
    CycleDetected(Vec<String>),

    #[error("Invalid edge: source node '{0}' not found.")]
    InvalidEdgeSource(String),

    #[error("Invalid edge: target node '{0}' not found.")]
    InvalidEdgeTarget(String),

    #[error("Node '{node_id}' references unknown variable '{var_name}'.")]
    UnknownVariable { node_id: String, var_name: String },

    #[error("Node '{node_id}' has invalid configuration: {message}")]
    InvalidConfig { node_id: String, message: String },
}

#[derive(Debug)]
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<ValidationError>,
    pub warnings: Vec<ValidationWarning>,
}
```

**Acceptance Criteria**:
- [ ] Invalid workflows fail validation with clear errors
- [ ] Valid workflows pass validation
- [ ] All error types are descriptive and actionable
- [ ] Test coverage > 90%

---

### 2.4 TypeScript Code Generator

**Description**: Generate type-safe TypeScript from validated workflows

**Subtasks**:
- [ ] 2.4.1 Create `codegen/mod.rs` module
- [ ] 2.4.2 Set up Handlebars template engine
- [ ] 2.4.3 Create workflow.ts template
- [ ] 2.4.4 Create activities.ts template
- [ ] 2.4.5 Create worker.ts template
- [ ] 2.4.6 Create package.json template
- [ ] 2.4.7 Create tsconfig.json template
- [ ] 2.4.8 Implement template data preparation
- [ ] 2.4.9 Implement code generation pipeline
- [ ] 2.4.10 Add strict TypeScript settings in generated tsconfig
- [ ] 2.4.11 Ensure no `any` types in output
- [ ] 2.4.12 Write generation tests

**Files to Create**:
```
src/codegen/
  mod.rs
  typescript.rs
  templates/
    workflow.ts.hbs
    activities.ts.hbs
    worker.ts.hbs
    package.json.hbs
    tsconfig.json.hbs
```

**Example - workflow.ts.hbs**:
```handlebars
// Generated by workflow-compiler-rs v{{version}}
// DO NOT EDIT - This file is auto-generated from workflow definition
// Workflow: {{workflow.name}} ({{workflow.id}})
// Generated: {{generated_at}}

import {
  proxyActivities,
{{#if has_queries}}
  defineQuery,
{{/if}}
{{#if has_signals}}
  defineSignal,
  setHandler,
{{/if}}
{{#if is_long_running}}
  condition,
  workflowInfo,
  continueAsNew,
{{/if}}
} from '@temporalio/workflow';

import type * as activities from './activities';

// Type-safe activity proxy
const acts = proxyActivities<typeof activities>({
  startToCloseTimeout: '{{default_timeout}}',
{{#if has_retry_policy}}
  retry: {
    maximumAttempts: {{retry_policy.max_attempts}},
    initialInterval: '{{retry_policy.initial_interval}}',
    maximumInterval: '{{retry_policy.max_interval}}',
    backoffCoefficient: {{retry_policy.backoff_coefficient}},
  },
{{/if}}
});

{{#each variables}}
// Variable: {{name}} (type: {{type}})
{{/each}}

{{#if queries}}
// Query definitions
{{#each queries}}
export const {{name}}Query = defineQuery<{{return_type}}>('{{name}}');
{{/each}}
{{/if}}

{{#if signals}}
// Signal definitions
{{#each signals}}
export const {{name}}Signal = defineSignal<[{{param_types}}]>('{{name}}');
{{/each}}
{{/if}}

/**
 * {{workflow.name}} Workflow
 * {{workflow.description}}
 */
export async function {{function_name}}(
  input: {{input_type}}
): Promise<{{output_type}}> {
{{#each code_blocks}}
  {{{this}}}
{{/each}}
}
```

**Acceptance Criteria**:
- [ ] Generated TypeScript compiles with `--strict`
- [ ] No `any` types in generated code
- [ ] Templates are readable and maintainable
- [ ] Generated code matches existing TypeScript compiler output

---

### 2.5 Verification Pipeline

**Description**: Verify generated code before returning

**Subtasks**:
- [ ] 2.5.1 Create `verification/mod.rs` module
- [ ] 2.5.2 Implement temporary directory creation for verification
- [ ] 2.5.3 Implement tsc runner with strict flags
- [ ] 2.5.4 Implement ESLint runner with no-explicit-any rule
- [ ] 2.5.5 Parse tsc output for errors
- [ ] 2.5.6 Parse ESLint output for errors
- [ ] 2.5.7 Implement verification result aggregation
- [ ] 2.5.8 Handle verification timeouts
- [ ] 2.5.9 Clean up temporary directories
- [ ] 2.5.10 Write verification tests

**Files to Create**:
```
src/verification/
  mod.rs
  tsc.rs
  eslint.rs
  runner.rs
```

**Example - tsc.rs**:
```rust
use std::process::Command;
use std::path::Path;
use anyhow::Result;

pub struct TscResult {
    pub success: bool,
    pub errors: Vec<TscError>,
    pub stdout: String,
    pub stderr: String,
}

pub struct TscError {
    pub file: String,
    pub line: usize,
    pub column: usize,
    pub message: String,
    pub code: String,
}

pub async fn run_tsc(project_dir: &Path) -> Result<TscResult> {
    let output = Command::new("npx")
        .args([
            "tsc",
            "--noEmit",
            "--strict",
            "--noImplicitAny",
            "--strictNullChecks",
            "--noUncheckedIndexedAccess",
            "--project", project_dir.join("tsconfig.json").to_str().unwrap()
        ])
        .current_dir(project_dir)
        .output()?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    let errors = parse_tsc_output(&stderr);

    Ok(TscResult {
        success: output.status.success() && errors.is_empty(),
        errors,
        stdout,
        stderr,
    })
}
```

**Acceptance Criteria**:
- [ ] tsc verification catches TypeScript errors
- [ ] ESLint verification catches `any` types
- [ ] Verification completes in < 10 seconds
- [ ] Temporary files are cleaned up

---

### 2.6 HTTP API

**Description**: Create REST API for compilation service

**Subtasks**:
- [ ] 2.6.1 Create `api/mod.rs` module
- [ ] 2.6.2 Set up Axum router
- [ ] 2.6.3 Implement `POST /compile` endpoint
- [ ] 2.6.4 Implement `POST /validate` endpoint
- [ ] 2.6.5 Implement `GET /health` endpoint
- [ ] 2.6.6 Implement error handling middleware
- [ ] 2.6.7 Implement request logging middleware
- [ ] 2.6.8 Implement CORS middleware
- [ ] 2.6.9 Implement request timeout middleware
- [ ] 2.6.10 Write API integration tests

**Files to Create**:
```
src/api/
  mod.rs
  routes.rs
  handlers.rs
  middleware.rs
  errors.rs
```

**Example - handlers.rs**:
```rust
use axum::{Json, extract::State};
use serde::{Deserialize, Serialize};
use crate::schema::WorkflowDefinition;
use crate::compiler::WorkflowCompiler;

#[derive(Deserialize)]
pub struct CompileRequest {
    pub workflow: WorkflowDefinition,
    #[serde(default)]
    pub options: CompileOptions,
}

#[derive(Deserialize, Default)]
pub struct CompileOptions {
    pub strict_mode: Option<bool>,
    pub include_comments: Option<bool>,
}

#[derive(Serialize)]
pub struct CompileResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<GeneratedCode>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub errors: Vec<CompilerError>,
    pub metadata: CompileMetadata,
    pub verification: VerificationResult,
}

#[derive(Serialize)]
pub struct GeneratedCode {
    pub workflow: String,
    pub activities: String,
    pub worker: String,
    pub package_json: String,
    pub tsconfig: String,
}

pub async fn compile(
    State(compiler): State<WorkflowCompiler>,
    Json(request): Json<CompileRequest>,
) -> Json<CompileResponse> {
    let result = compiler.compile(request.workflow, request.options).await;
    Json(result)
}

pub async fn validate(
    State(compiler): State<WorkflowCompiler>,
    Json(workflow): Json<WorkflowDefinition>,
) -> Json<ValidationResponse> {
    let result = compiler.validate(&workflow);
    Json(result)
}

pub async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "healthy".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}
```

**Acceptance Criteria**:
- [ ] All endpoints return correct responses
- [ ] Error responses are structured and helpful
- [ ] Request logging works
- [ ] Health check returns version info

---

### 2.7 Kong Integration

**Description**: Register Rust service with Kong

**Subtasks**:
- [ ] 2.7.1 Create Kong upstream for Rust service
- [ ] 2.7.2 Create routes for `/api/compiler/rust/*`
- [ ] 2.7.3 Configure load balancing with TypeScript backend
- [ ] 2.7.4 Set up feature flag routing (percentage-based)
- [ ] 2.7.5 Configure health checks
- [ ] 2.7.6 Test routing
- [ ] 2.7.7 Document rollback procedure

**Files to Create/Modify**:
```yaml
# kong/upstreams/rust-compiler.yaml
name: rust-compiler-upstream
algorithm: round-robin
healthchecks:
  active:
    healthy:
      interval: 5
      successes: 2
    unhealthy:
      interval: 5
      http_failures: 3
    http_path: /health
targets:
  - target: localhost:3020
    weight: 100
```

**Acceptance Criteria**:
- [ ] Requests route to Rust service
- [ ] Health checks pass
- [ ] Failover to TypeScript works

---

### 2.8 Testing

**Description**: Comprehensive testing of Rust compiler

**Subtasks**:
- [ ] 2.8.1 Write schema serialization tests
- [ ] 2.8.2 Write validation tests (valid/invalid workflows)
- [ ] 2.8.3 Write code generation tests
- [ ] 2.8.4 Write verification tests
- [ ] 2.8.5 Write API integration tests
- [ ] 2.8.6 Write comparison tests (TypeScript vs Rust output)
- [ ] 2.8.7 Set up CI/CD test pipeline
- [ ] 2.8.8 Create test fixtures from real workflows

**Acceptance Criteria**:
- [ ] Unit test coverage > 90%
- [ ] All comparison tests pass
- [ ] CI/CD runs all tests

---

## Rollback Plan

If Rust compiler has issues:

1. Update Kong to route 100% to TypeScript
2. Disable `RUST_COMPILER_ENABLED` flag
3. Investigate and fix issues
4. Gradually re-enable with percentage routing

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Compilation time | < 100ms (p95) | API timing |
| `any` types in output | 0 | ESLint check |
| Schema validation coverage | 100% | Test coverage |
| API availability | 99.9% | Health checks |

---

## Files Created

```
workflow-compiler-rs/
  Cargo.toml
  src/
    main.rs
    lib.rs
    schema/
      mod.rs
      workflow.rs
      node.rs
      edge.rs
      variable.rs
      settings.rs
    validation/
      mod.rs
      graph.rs
      components.rs
      errors.rs
    codegen/
      mod.rs
      typescript.rs
      templates/
        workflow.ts.hbs
        activities.ts.hbs
        worker.ts.hbs
        package.json.hbs
        tsconfig.json.hbs
    verification/
      mod.rs
      tsc.rs
      eslint.rs
    api/
      mod.rs
      routes.rs
      handlers.rs
      middleware.rs
  tests/
    schema_tests.rs
    validation_tests.rs
    codegen_tests.rs
    integration_tests.rs
```

---

## Checklist

Before marking Phase 2 complete:

- [ ] Rust service builds and runs
- [ ] All schema types defined
- [ ] Validation catches invalid workflows
- [ ] Code generation produces valid TypeScript
- [ ] Verification pipeline works
- [ ] API endpoints functional
- [ ] Kong integration working
- [ ] Test coverage > 90%
- [ ] Comparison tests pass
- [ ] Documentation complete
