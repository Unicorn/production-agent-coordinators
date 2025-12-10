# Phase 3: Basic Workflows Verification

**Status**: Not Started
**Duration**: 1-2 weeks
**Prerequisites**: Phase 2 (Rust Compiler Foundation)
**Blocks**: Phase 4

## Overview

Prove the Rust backend works end-to-end with simple workflows. Build 4 verification workflows that test core functionality from UI through Rust compilation to Temporal execution.

## Goals

1. Create test user and project for verification
2. Implement Start, Stop, and Log components in Rust
3. Build and verify 4 test workflows
4. Prove complete flow: UI -> Rust -> Deploy -> Execute -> Log
5. Establish logging standards

## Test Workflows

| Workflow | Pattern | Components | Proves |
|----------|---------|------------|--------|
| SimpleWorkflow | Basic | Start -> Stop | Basic compilation, deployment, execution |
| BaseWorkflow | Single Activity | Start -> Log -> Stop | Activity execution, I/O passing |
| LongRunningWorkflow | Long-running | Start -> Log (forever) | Long-running pattern |
| BaseLongRunningWorkflow | Continue-as-new | Start -> Log (100x) -> Continue | State preservation, history management |

---

## Tasks

### 3.1 Create Test User and Project

**Description**: Set up test infrastructure for verification

**Subtasks**:
- [ ] 3.1.1 Create test user in Supabase (`workflow-test@bernierllc.com`)
- [ ] 3.1.2 Generate API keys for test user
- [ ] 3.1.3 Create "Rust Migration Verification" project
- [ ] 3.1.4 Create "Simple Workflows" service in project
- [ ] 3.1.5 Create "Long Running Workflows" service in project
- [ ] 3.1.6 Configure task queues for services
- [ ] 3.1.7 Document test user credentials (secure storage)

**Database Setup**:
```sql
-- Create test user
INSERT INTO users (email, display_name, role_id)
VALUES ('workflow-test@bernierllc.com', 'Workflow Test User', 'user')
RETURNING id;

-- Create project
INSERT INTO projects (name, created_by, description)
VALUES (
  'Rust Migration Verification',
  (SELECT id FROM users WHERE email = 'workflow-test@bernierllc.com'),
  'Test project for verifying Rust compiler migration'
)
RETURNING id;
```

**Acceptance Criteria**:
- [ ] Test user can log in
- [ ] Project visible in UI
- [ ] Services created and configured

---

### 3.2 Implement Start Component

**Description**: Implement the Start (trigger) component in Rust

**Subtasks**:
- [ ] 3.2.1 Define StartInput struct (empty)
- [ ] 3.2.2 Define StartOutput struct (startedAt: DateTime)
- [ ] 3.2.3 Add Start to NodeType enum (if not already)
- [ ] 3.2.4 Create Start code generation pattern
- [ ] 3.2.5 Generate workflow entry point code
- [ ] 3.2.6 Write unit tests for Start
- [ ] 3.2.7 Write integration test for Start
- [ ] 3.2.8 Create migration record skeleton (for Phase 6)

**Rust Schema**:
```rust
// src/schema/components/start.rs

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

/// Start component input - workflow entry point
/// Takes no input as it's the workflow trigger
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct StartInput {
    // Empty - start receives input from workflow caller
}

/// Start component output
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartOutput {
    /// When the workflow started
    pub started_at: DateTime<Utc>,
}
```

**Generated TypeScript**:
```typescript
// Workflow entry - marks the start of execution
const startResult: StartOutput = {
  startedAt: new Date(),
};
```

**Acceptance Criteria**:
- [ ] Start component compiles in Rust
- [ ] Generated TypeScript is valid
- [ ] Start initializes workflow correctly

---

### 3.3 Implement Stop Component

**Description**: Implement the Stop (end) component in Rust

**Subtasks**:
- [ ] 3.3.1 Define StopInput struct (result: any type)
- [ ] 3.3.2 Define StopOutput struct (none - workflow ends)
- [ ] 3.3.3 Add Stop to NodeType enum (if not already)
- [ ] 3.3.4 Create Stop code generation pattern
- [ ] 3.3.5 Generate workflow return statement
- [ ] 3.3.6 Write unit tests for Stop
- [ ] 3.3.7 Write integration test for Stop
- [ ] 3.3.8 Create migration record skeleton

**Rust Schema**:
```rust
// src/schema/components/stop.rs

use serde::{Deserialize, Serialize};

/// Stop component input - receives final workflow result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StopInput<T = serde_json::Value> {
    /// The result to return from the workflow
    pub result: T,
}

/// Stop component has no output - it terminates the workflow
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StopOutput {
    // Empty - workflow ends here
}
```

**Generated TypeScript**:
```typescript
// Workflow completion - return final result
return {
  result: previousStepResult,
  completedAt: new Date(),
};
```

**Acceptance Criteria**:
- [ ] Stop component compiles in Rust
- [ ] Generated TypeScript is valid
- [ ] Workflow terminates correctly

---

### 3.4 Implement Log Component

**Description**: Implement the Log activity component in Rust

**Subtasks**:
- [ ] 3.4.1 Define LogInput struct (message, level, metadata)
- [ ] 3.4.2 Define LogOutput struct (logged, timestamp)
- [ ] 3.4.3 Define LogLevel enum (debug, info, warn, error)
- [ ] 3.4.4 Create Log validation rules
- [ ] 3.4.5 Create Log code generation pattern
- [ ] 3.4.6 Implement Kong logging integration in generated code
- [ ] 3.4.7 Write unit tests for Log
- [ ] 3.4.8 Write integration test for Log
- [ ] 3.4.9 Create migration record skeleton

**Rust Schema**:
```rust
// src/schema/components/log.rs

use serde::{Deserialize, Serialize};
use validator::Validate;
use chrono::{DateTime, Utc};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    Debug,
    #[default]
    Info,
    Warn,
    Error,
}

/// Log activity input
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct LogInput {
    /// The message to log
    #[validate(length(min = 1, max = 10000, message = "Message must be 1-10000 characters"))]
    pub message: String,

    /// Log level
    #[serde(default)]
    pub level: LogLevel,

    /// Optional metadata to include in log
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Log activity output
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogOutput {
    /// Whether the log was successfully recorded
    pub logged: bool,

    /// Timestamp when the log was recorded
    pub timestamp: DateTime<Utc>,
}
```

**Generated TypeScript**:
```typescript
/**
 * Log Activity
 * Sends log message to Kong logging endpoint
 */
export async function log(input: LogInput): Promise<LogOutput> {
  const logPayload = {
    timestamp: new Date().toISOString(),
    level: input.level,
    message: input.message,
    metadata: input.metadata,
    workflow: {
      id: workflowInfo().workflowId,
      runId: workflowInfo().runId,
    },
  };

  // Send to Kong logging endpoint
  await fetch(process.env.KONG_LOGGING_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(logPayload),
  });

  return {
    logged: true,
    timestamp: new Date(),
  };
}
```

**Acceptance Criteria**:
- [ ] Log component compiles in Rust
- [ ] Generated TypeScript is valid
- [ ] Logs appear in Kong logging system
- [ ] Metadata included correctly

---

### 3.5 Build SimpleWorkflow

**Description**: Create and verify simplest possible workflow

**Subtasks**:
- [ ] 3.5.1 Create workflow in UI: Start -> Stop
- [ ] 3.5.2 Compile through Rust backend
- [ ] 3.5.3 Verify generated code structure
- [ ] 3.5.4 Deploy to Temporal worker
- [ ] 3.5.5 Execute workflow
- [ ] 3.5.6 Verify execution completed
- [ ] 3.5.7 Check execution logs in UI
- [ ] 3.5.8 Document any issues found

**Workflow Definition**:
```json
{
  "id": "simple-workflow-001",
  "name": "SimpleWorkflow",
  "nodes": [
    {
      "id": "start-1",
      "type": "trigger",
      "data": { "label": "Start" },
      "position": { "x": 100, "y": 100 }
    },
    {
      "id": "end-1",
      "type": "end",
      "data": { "label": "Stop" },
      "position": { "x": 100, "y": 300 }
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "start-1",
      "target": "end-1"
    }
  ],
  "variables": [],
  "settings": {}
}
```

**Acceptance Criteria**:
- [ ] Workflow visible in UI
- [ ] Compiles without errors
- [ ] Deploys successfully
- [ ] Executes and completes
- [ ] Shows in execution history

---

### 3.6 Build BaseWorkflow

**Description**: Create workflow with single activity

**Subtasks**:
- [ ] 3.6.1 Create workflow in UI: Start -> Log -> Stop
- [ ] 3.6.2 Configure Log component (message: "Hello from BaseWorkflow")
- [ ] 3.6.3 Compile through Rust backend
- [ ] 3.6.4 Verify activity code generation
- [ ] 3.6.5 Deploy to Temporal worker
- [ ] 3.6.6 Execute workflow
- [ ] 3.6.7 Verify log message appeared
- [ ] 3.6.8 Verify execution logs show all components

**Workflow Definition**:
```json
{
  "id": "base-workflow-001",
  "name": "BaseWorkflow",
  "nodes": [
    {
      "id": "start-1",
      "type": "trigger",
      "data": { "label": "Start" },
      "position": { "x": 100, "y": 100 }
    },
    {
      "id": "log-1",
      "type": "activity",
      "data": {
        "label": "Log Message",
        "activity_name": "log",
        "config": {
          "message": "Hello from BaseWorkflow",
          "level": "info"
        }
      },
      "position": { "x": 100, "y": 200 }
    },
    {
      "id": "end-1",
      "type": "end",
      "data": { "label": "Stop" },
      "position": { "x": 100, "y": 300 }
    }
  ],
  "edges": [
    { "id": "edge-1", "source": "start-1", "target": "log-1" },
    { "id": "edge-2", "source": "log-1", "target": "end-1" }
  ],
  "variables": [],
  "settings": {}
}
```

**Acceptance Criteria**:
- [ ] Activity executes correctly
- [ ] Input passed to activity
- [ ] Output captured from activity
- [ ] Log message visible in Kong logs

---

### 3.7 Build LongRunningWorkflow

**Description**: Create never-ending workflow with periodic logging

**Subtasks**:
- [ ] 3.7.1 Create workflow in UI with loop pattern
- [ ] 3.7.2 Configure Log to run every 60 seconds
- [ ] 3.7.3 Compile through Rust backend
- [ ] 3.7.4 Verify long-running pattern code generation
- [ ] 3.7.5 Deploy to Temporal worker
- [ ] 3.7.6 Start workflow execution
- [ ] 3.7.7 Verify workflow continues running
- [ ] 3.7.8 Verify periodic logs appear
- [ ] 3.7.9 Test workflow cancellation

**Generated Pattern**:
```typescript
export async function longRunningWorkflow(): Promise<void> {
  // Long-running: loop forever
  while (true) {
    await acts.log({
      message: 'Long running workflow heartbeat',
      level: 'info',
      metadata: { iteration: iterationCount++ }
    });

    // Wait before next iteration
    await sleep('60s');

    // Continue-as-new if history grows too large
    if (workflowInfo().historyLength > 1000) {
      await continueAsNew<typeof longRunningWorkflow>();
    }
  }
}
```

**Acceptance Criteria**:
- [ ] Workflow starts and continues
- [ ] Logs appear periodically
- [ ] Can be cancelled via UI
- [ ] History doesn't grow unbounded

---

### 3.8 Build BaseLongRunningWorkflow

**Description**: Create workflow with explicit continue-as-new

**Subtasks**:
- [ ] 3.8.1 Create workflow with 100 iteration limit
- [ ] 3.8.2 Configure continue-as-new after 100 iterations
- [ ] 3.8.3 Compile through Rust backend
- [ ] 3.8.4 Verify continue-as-new code generation
- [ ] 3.8.5 Deploy to Temporal worker
- [ ] 3.8.6 Execute workflow
- [ ] 3.8.7 Verify iteration counter preserved
- [ ] 3.8.8 Verify continue-as-new triggered at 100
- [ ] 3.8.9 Verify new run continues from correct state

**Generated Pattern**:
```typescript
interface WorkflowState {
  totalIterations: number;
  currentBatchStart: number;
}

export async function baseLongRunningWorkflow(
  state: WorkflowState = { totalIterations: 0, currentBatchStart: 0 }
): Promise<void> {
  const BATCH_SIZE = 100;

  for (let i = 0; i < BATCH_SIZE; i++) {
    const currentIteration = state.totalIterations + i;

    await acts.log({
      message: `Iteration ${currentIteration}`,
      level: 'info',
      metadata: {
        iteration: currentIteration,
        batch: Math.floor(currentIteration / BATCH_SIZE)
      }
    });

    await sleep('1s');
  }

  // Continue-as-new with updated state
  await continueAsNew<typeof baseLongRunningWorkflow>({
    totalIterations: state.totalIterations + BATCH_SIZE,
    currentBatchStart: state.totalIterations + BATCH_SIZE,
  });
}
```

**Acceptance Criteria**:
- [ ] Runs 100 iterations
- [ ] Triggers continue-as-new
- [ ] State preserved across continues
- [ ] Total iterations tracked correctly

---

### 3.9 Logging Verification

**Description**: Verify all logging works correctly

**Subtasks**:
- [ ] 3.9.1 Define standard log format
- [ ] 3.9.2 Verify logs include project name
- [ ] 3.9.3 Verify logs include service name
- [ ] 3.9.4 Verify logs include workflow name
- [ ] 3.9.5 Verify logs include component name
- [ ] 3.9.6 Verify logs include timing information
- [ ] 3.9.7 Verify logs appear in UI
- [ ] 3.9.8 Test log search/filtering
- [ ] 3.9.9 Document log format

**Standard Log Format**:
```json
{
  "timestamp": "2025-01-15T10:30:00.000Z",
  "level": "info",
  "project": {
    "id": "proj_xxx",
    "name": "Rust Migration Verification"
  },
  "service": {
    "id": "svc_xxx",
    "name": "Simple Workflows"
  },
  "workflow": {
    "id": "wf_xxx",
    "name": "BaseWorkflow",
    "runId": "run_xxx"
  },
  "component": {
    "id": "log-1",
    "name": "Log Message",
    "type": "activity"
  },
  "execution": {
    "startedAt": "2025-01-15T10:30:00.000Z",
    "completedAt": "2025-01-15T10:30:01.000Z",
    "durationMs": 1000,
    "status": "completed"
  },
  "message": "Hello from BaseWorkflow",
  "metadata": {}
}
```

**Acceptance Criteria**:
- [ ] All required fields present
- [ ] Logs searchable by project/service/workflow
- [ ] Timing accurate
- [ ] Visible in UI

---

### 3.10 End-to-End Tests

**Description**: Automated tests for all workflows

**Subtasks**:
- [ ] 3.10.1 Create test suite for SimpleWorkflow
- [ ] 3.10.2 Create test suite for BaseWorkflow
- [ ] 3.10.3 Create test suite for LongRunningWorkflow
- [ ] 3.10.4 Create test suite for BaseLongRunningWorkflow
- [ ] 3.10.5 Add tests to CI/CD pipeline
- [ ] 3.10.6 Verify 100% test pass rate
- [ ] 3.10.7 Document test procedures

**Test Structure**:
```typescript
// tests/e2e/rust-verification.test.ts

describe('Rust Migration Verification', () => {
  describe('SimpleWorkflow', () => {
    it('compiles through Rust backend', async () => {
      const result = await compileWorkflow('simple-workflow-001');
      expect(result.success).toBe(true);
      expect(result.verification.tscPassed).toBe(true);
    });

    it('deploys to Temporal', async () => {
      const result = await deployWorkflow('simple-workflow-001');
      expect(result.success).toBe(true);
    });

    it('executes and completes', async () => {
      const execution = await executeWorkflow('simple-workflow-001');
      expect(execution.status).toBe('completed');
    });
  });

  describe('BaseWorkflow', () => {
    it('executes Log activity', async () => {
      const execution = await executeWorkflow('base-workflow-001');
      expect(execution.status).toBe('completed');

      const logs = await getWorkflowLogs(execution.runId);
      expect(logs).toContainEqual(
        expect.objectContaining({ message: 'Hello from BaseWorkflow' })
      );
    });
  });

  // ... more tests
});
```

**Acceptance Criteria**:
- [ ] All tests pass
- [ ] Tests run in CI/CD
- [ ] < 5 minute test execution time
- [ ] Clear failure messages

---

## Rollback Plan

If Phase 3 workflows have issues:

1. Keep test project isolated from production
2. Route compiler requests back to TypeScript
3. Debug Rust compiler issues
4. Re-deploy when fixed

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Workflows created | 4/4 | UI verification |
| Workflows compile | 4/4 | Rust compiler |
| Workflows deploy | 4/4 | Temporal |
| Workflows execute | 4/4 | Execution history |
| Test pass rate | 100% | CI/CD |
| Log completeness | 100% | Log verification |

---

## Files Created

```
packages/workflow-builder/
  component-records/
    start.yaml                   # Start component record (skeleton)
    stop.yaml                    # Stop component record (skeleton)
    log.yaml                     # Log component record (skeleton)

workflow-compiler-rs/
  src/schema/components/
    mod.rs
    start.rs
    stop.rs
    log.rs
  src/codegen/patterns/
    start.rs
    stop.rs
    log.rs

tests/e2e/
  rust-verification.test.ts
```

---

## Checklist

Before marking Phase 3 complete:

- [ ] Test user and project created
- [ ] Start, Stop, Log components implemented
- [ ] SimpleWorkflow working end-to-end
- [ ] BaseWorkflow working end-to-end
- [ ] LongRunningWorkflow working end-to-end
- [ ] BaseLongRunningWorkflow working end-to-end
- [ ] All logs appear correctly
- [ ] All E2E tests pass
- [ ] Documentation complete
