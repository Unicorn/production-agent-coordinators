# Task Activity Loop Implementation Plan

## Overview

This plan implements the task activity loop pattern with efficient CLI communication, ensuring deterministic workflows while maintaining full CLI interactivity and visibility.

## Core Principles

### 1. Deterministic Workflows
- Activities return only deterministic values: file paths, session IDs, boolean flags
- No non-deterministic content (conversation text) in workflow decisions
- All file operations use deterministic file paths

### 2. Efficient CLI Communication
- **No JSON serialization of file contents** - CLI reads/writes files directly via Read/Write/Edit tools
- **Status/errors written to files** - CLI reads from filesystem, not JSON payloads
- **Only metadata in JSON responses** - sessionId, cost, duration, success flags
- **File paths in prompts** - Pass file paths (strings), not file contents

### 3. Full Visibility
- Each loop iteration = separate activity in Temporal UI
- Task loop: `executeTaskWithCLI-1`, `executeTaskWithCLI-2`, etc.
- Validation loop: `runTaskValidations-1`, `executeFixWithCLI-1`, `runTaskValidations-2`, etc.

## Architecture

### Phase 1: Task Breakdown (One-Time)
```
requestTaskBreakdown() → Returns taskBreakdownFilePath (deterministic)
```

### Phase 2: Task Activity Loop (Per Task)
```
For each task:
  while (!taskComplete):
    executeTaskWithCLI() → Returns logFilePath, sessionId, taskComplete
    if (!taskComplete): loop back
    else: → Validation Loop
```

### Phase 3: Validation Task Activity Loop (Per Task)
```
while (!allValidationsPassed):
  runTaskValidations() → Returns validationErrorsFilePath (deterministic)
  if (allPassed): break
  executeFixWithCLI(validationErrorsFilePath) → Returns logFilePath, fixed
  → Loop back to runTaskValidations()
```

## Implementation Steps

### Step 1: Create New Activities

#### 1.1 `executeTaskWithCLI` Activity
- **Location**: `packages/agents/package-builder-production/src/activities/cli-agent.activities.ts`
- **Purpose**: Execute task with CLI, loop until agent signals completion
- **Input**: task, sessionId, workingDir, workflowId, sequenceNumber, continueTask, previousLogFilePath
- **Output**: success, logFilePath, sessionId, taskComplete, cost_usd, duration_ms
- **Key Features**:
  - Writes log to deterministic file path
  - Parses agent response for `task_complete` signal
  - Returns only deterministic values

#### 1.2 `runTaskValidations` Activity
- **Location**: `packages/agents/package-builder-production/src/activities/cli-agent.activities.ts`
- **Purpose**: Run validation steps (lint, tests, typecheck, file existence)
- **Input**: task, workingDir, workflowId
- **Output**: success, validationErrorsFilePath, allPassed, errors[]
- **Key Features**:
  - Runs each validation step from task.validation_steps
  - Writes errors to deterministic file path
  - Returns file path (not error content) for deterministic workflow

#### 1.3 `executeFixWithCLI` Activity
- **Location**: `packages/agents/package-builder-production/src/activities/cli-agent.activities.ts`
- **Purpose**: Fix validation errors using CLI
- **Input**: task, validationErrorsFilePath, sessionId, workingDir, workflowId, sequenceNumber
- **Output**: success, logFilePath, sessionId, fixed, cost_usd, duration_ms
- **Key Features**:
  - Reads validation errors from deterministic file path
  - Passes file path in prompt (not file contents)
  - CLI reads errors file directly using Read tool
  - Writes log to deterministic file path

### Step 2: Update Task Definition

#### 2.1 Add `validation_steps` to Task Interface
- **Location**: `packages/agents/package-builder-production/src/types/index.ts`
- **Add field**: `validation_steps?: string[]`
- **Examples**:
  - `"file_exists:src/index.ts"`
  - `"tests_pass"`
  - `"lint_passes"`
  - `"typecheck_passes"`

### Step 3: Update Workflow

#### 3.1 Replace Single CLI Calls with Task Loop
- **Location**: `packages/agents/package-builder-production/src/workflows/package-build.workflow.ts`
- **Replace**: Current single `executeClaudeCLI` call per task
- **With**: Task activity loop pattern
- **Add**: Validation loop after each task

### Step 4: File Path Generation

#### 4.1 Deterministic File Paths
- **Pattern**: `.claude/{category}/{workflowId}-{identifier}-{sequenceNumber}.{ext}`
- **Categories**:
  - `logs/` - CLI execution logs
  - `validation-errors/` - Validation error files
  - `task-breakdowns/` - Task breakdown files
- **Example**: `.claude/logs/workflow-123-task-T1-1.jsonl`

## Testing Requirements

### CRITICAL: Un-Mocked Unit Tests for Everything

**Principle**: Every activity must have un-mocked unit tests that:
1. Call the actual activity code (not Temporal-wrapped)
2. Use real CLI calls (not mocks)
3. Validate actual file operations
4. Test deterministic file path generation
5. Verify CLI communication patterns

### Test Structure

#### Test File Organization
```
src/activities/__tests__/
├── cli-agent.activities.test.ts          # Unit tests (mocked)
├── cli-agent.activities.integration.test.ts  # Integration tests (REAL CLI)
├── task-execution.integration.test.ts    # Task loop tests (REAL CLI)
└── validation.integration.test.ts        # Validation loop tests (REAL CLI)
```

#### Test Requirements for Each Activity

##### `executeTaskWithCLI` Tests
- [ ] **Unit test (mocked)**: Verify deterministic file path generation
- [ ] **Integration test (REAL CLI)**: Execute real CLI, verify task completion signal parsing
- [ ] **Integration test (REAL CLI)**: Verify multi-turn task loop (continue task)
- [ ] **Integration test (REAL CLI)**: Verify log file writing
- [ ] **Integration test (REAL CLI)**: Verify session ID persistence

##### `runTaskValidations` Tests
- [ ] **Unit test (mocked)**: Verify deterministic error file path generation
- [ ] **Integration test (REAL)**: Run actual lint command, capture errors
- [ ] **Integration test (REAL)**: Run actual tests, capture failures
- [ ] **Integration test (REAL)**: Check file existence validation
- [ ] **Integration test (REAL)**: Verify error file writing

##### `executeFixWithCLI` Tests
- [ ] **Unit test (mocked)**: Verify deterministic log file path generation
- [ ] **Integration test (REAL CLI)**: Read validation errors from file
- [ ] **Integration test (REAL CLI)**: Pass file path in prompt (not contents)
- [ ] **Integration test (REAL CLI)**: Verify CLI reads errors file using Read tool
- [ ] **Integration test (REAL CLI)**: Verify fix signal parsing
- [ ] **Integration test (REAL CLI)**: Verify log file writing

### Test Environment Setup

#### Test Workspace
- Create isolated test workspace for each test
- Clean up after each test
- Use deterministic test data

#### Test Data
- Pre-create test files for validation tests
- Pre-create validation error files for fix tests
- Use consistent test package structure

### Test Execution

#### Run Integration Tests
```bash
# Run all integration tests (REAL CLI)
npm test -- --run src/activities/__tests__/*.integration.test.ts

# Run specific integration test
npm test -- --run src/activities/__tests__/task-execution.integration.test.ts
```

#### Test Flags
- Use environment variable: `RUN_INTEGRATION_TESTS=true`
- Skip integration tests by default in CI (too slow)
- Run integration tests locally before committing

## File Structure

```
.claude/
├── logs/
│   ├── {workflowId}-task-{taskId}-{sequenceNumber}.jsonl
│   ├── {workflowId}-fix-{taskId}-{sequenceNumber}.jsonl
│   └── {workflowId}-task-breakdown-{sequenceNumber}.jsonl
├── validation-errors/
│   └── {workflowId}-task-{taskId}-errors.json
└── task-breakdowns/
    └── {workflowId}-breakdown-{sequenceNumber}.json
```

## Implementation Checklist

### Phase 1: Core Activities
- [ ] Create `executeTaskWithCLI` activity
- [ ] Create `runTaskValidations` activity
- [ ] Create `executeFixWithCLI` activity
- [ ] Add `validation_steps` to Task interface
- [ ] Update activity exports

### Phase 2: Testing
- [ ] Write un-mocked unit tests for `executeTaskWithCLI`
- [ ] Write un-mocked unit tests for `runTaskValidations`
- [ ] Write un-mocked unit tests for `executeFixWithCLI`
- [ ] Create test workspace utilities
- [ ] Verify all tests pass with REAL CLI

### Phase 3: Workflow Integration
- [ ] Update workflow to use task activity loop
- [ ] Update workflow to use validation loop
- [ ] Update workflow to read from deterministic file paths
- [ ] Test workflow with real CLI

### Phase 4: Documentation
- [ ] Update activity documentation
- [ ] Update workflow documentation
- [ ] Document file path patterns
- [ ] Document testing approach

## Key Implementation Details

### Efficient CLI Communication Pattern

#### DO: Pass File Paths
```typescript
const instruction = `Fix validation errors.
Read the errors from: ${validationErrorsFilePath}`;
```

#### DON'T: Pass File Contents
```typescript
// ❌ BAD: Serializing file contents
const instruction = `Fix validation errors: ${JSON.stringify(errors)}`;
```

#### DO: CLI Reads Files Directly
```typescript
// CLI uses Read tool to read ${validationErrorsFilePath}
// No JSON serialization needed!
```

#### DO: Write Results to Files
```typescript
// CLI writes files using Write/Edit tools
// We read results from filesystem (deterministic paths)
```

### Deterministic File Paths

```typescript
function generateLogFilePath(
  workflowId: string,
  activityName: string,
  identifier: string,
  sequenceNumber: number
): string {
  return `.claude/logs/${workflowId}-${activityName}-${identifier}-${sequenceNumber}.jsonl`;
}
```

### Task Completion Signal Parsing

```typescript
// Parse agent response for task_complete signal
const jsonMatch = cliResult.result.match(/```json\s*([\s\S]*?)\s*```/);
if (jsonMatch) {
  const parsed = JSON.parse(jsonMatch[1]);
  taskComplete = parsed.task_complete === true;
}
```

## Success Criteria

1. ✅ All activities return only deterministic values
2. ✅ No file contents in JSON responses (only file paths)
3. ✅ CLI reads/writes files directly (no serialization)
4. ✅ All integration tests pass with REAL CLI
5. ✅ Workflow is deterministic (can replay)
6. ✅ Full visibility in Temporal UI (each iteration = activity)
7. ✅ Validation loop enforces quality before next task

## Next Steps

1. Start with `executeTaskWithCLI` activity
2. Write un-mocked integration tests immediately
3. Verify tests pass with REAL CLI
4. Move to next activity
5. Repeat until all activities implemented and tested

