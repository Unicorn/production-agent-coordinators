# PackageBuildWorkflow - Complete Step Breakdown

## Overview

The `PackageBuildWorkflow` orchestrates the complete package building process from initial validation through scaffolding, implementation, testing, quality checks, and publishing. It uses an iterative task breakdown system with CLI agents (Gemini or Claude) to execute work in manageable chunks.

---

## Phase 1: Pre-Flight Validation

### Step 1.1: Check Package Exists
- **Activity**: `checkPackageExists`
- **Purpose**: Determine if package code already exists at the target path
- **Outcome**: Sets `codeExists` flag

### Step 1.2: Check NPM Published Status
- **Activity**: `checkNpmPublished`
- **Condition**: Only if `codeExists === true`
- **Purpose**: Check if package is already published to npm registry
- **Outcome**: Returns `npmStatus` with version if published

### Step 1.3: Check if Upgrade Plan
- **Activity**: `checkIfUpgradePlan`
- **Condition**: Only if package is published
- **Purpose**: Determine if this is an upgrade to an existing published package
- **Outcome**: Sets `isUpgrade` flag

### Step 1.4: Audit Package Upgrade
- **Activity**: `auditPackageUpgrade`
- **Condition**: Only if `isUpgrade === true`
- **Purpose**: Analyze what changes are needed for the upgrade
- **Outcome**: Returns audit with next steps

### Step 1.5: Early Exit (Published, No Upgrade)
- **Condition**: Package published AND `isUpgrade === false`
- **Action**: 
  - Update MCP status to 'published'
  - Return success immediately
  - **SKIP all remaining steps**

### Step 1.6: Audit Package State
- **Activity**: `auditPackageState`
- **Condition**: Only if code exists but NOT published
- **Purpose**: Determine completion percentage and what's missing
- **Outcome**: Returns audit with:
  - `completionPercentage` (0-100)
  - `status` ('complete' or 'incomplete')
  - `findings` (existing/missing files)
  - `nextSteps` (what needs to be done)

### Step 1.7: Store Audit Context
- **Condition**: Only if audit shows incomplete status
- **Purpose**: Prepare context for resume detection
- **Outcome**: Sets `packageAuditContext` with existing/missing files

---

## Phase 2: Setup & Preparation

### Step 2.1: Verify Dependencies
- **Activity**: `verifyDependencies`
- **Purpose**: Ensure all package dependencies are published to npm
- **Input**: `input.dependencies` array
- **Fails**: If any dependency is not published

### Step 2.2: Read Plan File
- **Activity**: `readPlanFileContent`
- **Purpose**: Load the package plan/specification
- **Input**: `input.workspaceRoot`, `input.planPath`
- **Output**: `planContent` (full plan text)

### Step 2.3: Read Requirements File
- **Activity**: `readRequirementsContent`
- **Purpose**: Load BernierLLC package requirements/standards
- **Input**: `input.workspaceRoot`
- **Output**: `requirementsContent` (full requirements text)
- **Note**: Executed in parallel with Step 2.2

### Step 2.4: Detect Resume Point
- **Activity**: `detectResumePoint`
- **Condition**: Only if `packageAuditContext.status === 'incomplete'`
- **Purpose**: Determine which phase to resume from
- **Output**: `resumePoint` with:
  - `phase` ('scaffold' | 'implement' | 'build' | 'test' | 'quality' | 'publish')
  - `completionPercentage`

### Step 2.5: Select CLI Provider
- **Activity**: `selectCLIProvider`
- **Purpose**: Choose between Gemini or Claude CLI
- **Input**: Task type ('scaffold'), optional `input.preferredProvider`
- **Output**: `provider` object with `name` ('gemini' | 'claude')
- **Logic**: Prefers Gemini, falls back to Claude if credits unavailable

### Step 2.6: Setup CLI Workspace
- **Activity**: `setupCLIWorkspace`
- **Condition**: Only if `!codeExists` OR `resumePoint.phase === 'scaffold'`
- **Purpose**: 
  - Create package directory if needed
  - Write `GEMINI.md` (for Gemini) or `CLAUDE.md` (for Claude) with context
  - Prepare workspace for CLI agent execution
- **Input**: `packageFullPath`, `requirementsContent`, `provider.name`

---

## Phase 3: Scaffolding (Iterative Task Breakdown)

### Step 3.1: Check CLI Credits
- **Activity**: `checkCLICreditsForExecution`
- **Purpose**: Verify credits available for CLI execution (for visibility in Temporal UI)
- **Input**: `provider.name`

### Step 3.2: Request Task Breakdown (Scaffold)
- **Activity**: `requestTaskBreakdown`
- **Purpose**: Get initial batch of scaffolding tasks from CLI agent
- **Input**:
  - `planContent`: **FULL plan** (for proper task breakdown)
  - `requirementsContent`: **FULL requirements** (for proper task breakdown)
  - `phase`: 'scaffold'
  - `workingDir`: `packageFullPath`
  - `provider`: `provider.name`
  - `contextContent`: **Truncated** context (for token efficiency)
  - `completedTaskIds`: Array of completed task IDs (empty on first call)
- **Output**: `taskBreakdown` with:
  - `tasks`: Array of 3-8 tasks
  - `outline`: Phases overview
  - `more_tasks`: Boolean indicating if more tasks available
  - `activities`: Activity requests agent needs (read_file, list_dir, etc.)

### Step 3.3: Execute Activity Requests (Scaffold)
- **Activity**: `executeAgentActivityRequest`
- **Condition**: Only if `taskBreakdown.activities.length > 0`
- **Purpose**: Execute information-gathering activities agent requested
- **Loop**: For each activity in `taskBreakdown.activities`
- **Types**: `read_file`, `list_dir`, `run_cmd`, etc.

### Step 3.4: Execute Scaffold Tasks (Loop)
- **Loop**: For each task in `taskBreakdown.tasks`
- **Sub-steps**:

#### Step 3.4.1: Check Task Dependencies
- **Purpose**: Verify all task dependencies are completed
- **Action**: Warn if unmet dependencies (but continue)

#### Step 3.4.2: Execute Task Activity Requests
- **Activity**: `executeAgentActivityRequest`
- **Condition**: Only if `task.activity_requests.length > 0`
- **Purpose**: Execute activities needed for this specific task
- **Loop**: For each activity request in `task.activity_requests`

#### Step 3.4.3: Build Task Instruction
- **Purpose**: Create focused instruction for this specific task
- **Content**:
  - Task description
  - Acceptance criteria (from task)
  - Quality gates (from task, if any)
  - Package name sanitization warning

#### Step 3.4.4: Select Claude Model (Claude Only)
- **Activity**: `selectClaudeModel`
- **Condition**: Only if `provider.name === 'claude'`
- **Purpose**: Choose appropriate Claude model for scaffold task
- **Input**: Task type ('scaffold'), error type (undefined)
- **Output**: `claudeModelConfig` with:
  - `model`: 'sonnet' | 'opus' | 'haiku'
  - `permissionMode`: 'plan' | 'acceptEdits' | 'full'
  - `instruction`: System prompt instruction

#### Step 3.4.5: Execute CLI Task
- **Activity**: `executeGeminiCLI` OR `executeClaudeCLI`
- **Purpose**: Execute the actual task via CLI agent
- **Input**:
  - `instruction`: Task-specific instruction
  - `workingDir`: `packageFullPath`
  - `contextContent`: Truncated context (for Gemini) or full context (for Claude)
  - `sessionId`: Claude session ID (for Claude, to maintain conversation)
  - `model`: Claude model (for Claude)
  - `permissionMode`: Claude permission mode (for Claude)
- **Output**: `taskResult` with:
  - `success`: Boolean
  - `result`: CLI output
  - `cost_usd`: Cost of this task
  - `session_id`: Claude session ID (for Claude)

#### Step 3.4.6: Validate CLI Result
- **Activity**: `validateCLIResult`
- **Purpose**: Verify result is valid and from correct provider
- **Input**: `taskResult`, `provider.name`
- **Fails**: If validation fails

#### Step 3.4.7: Check Task Success
- **Condition**: If `taskResult.success === false`
- **Action**: Throw error, stop workflow

#### Step 3.4.8: Mark Task Complete
- **Action**: 
  - Add `task.id` to `completedTaskIds`
  - Add `taskResult.cost_usd` to `totalScaffoldCost`
  - Log completion

#### Step 3.4.9: Capture Claude Session ID
- **Condition**: Only if `provider.name === 'claude'` AND `taskResult.session_id` exists
- **Action**: Store `taskResult.session_id` in `scaffoldSessionId` for reuse

#### Step 3.4.10: Run Quality Gates (If Any)
- **Condition**: Only if `task.quality_gates.length > 0`
- **Purpose**: Execute quality checks for this task
- **Note**: Currently logged, could be enhanced to actually run checks

### Step 3.5: Check for More Tasks
- **Condition**: After all tasks in batch complete
- **Action**: 
  - Set `moreTasksAvailable = taskBreakdown.more_tasks === true`
  - If `moreTasksAvailable === true`, loop back to Step 3.2
  - If `moreTasksAvailable === false`, proceed to Phase 4

### Step 3.6: Scaffold Complete
- **Condition**: When `moreTasksAvailable === false`
- **Action**: Log total cost and task count

---

## Phase 4: Implementation (Iterative Task Breakdown)

### Step 4.1: Check CLI Credits
- **Activity**: `checkCLICreditsForExecution`
- **Purpose**: Verify credits available (for visibility)
- **Input**: `provider.name`

### Step 4.2: Request Task Breakdown (Implement)
- **Activity**: `requestTaskBreakdown`
- **Purpose**: Get initial batch of implementation tasks from CLI agent
- **Input**:
  - `planContent`: **FULL plan** (sanitized)
  - `requirementsContent`: **FULL requirements** (sanitized)
  - `phase`: 'implement'
  - `workingDir`: `packageFullPath`
  - `provider`: `provider.name`
  - `contextContent`: Full context (sanitized)
  - `completedTaskIds`: Array of completed task IDs (empty on first call)
- **Output**: `implementTaskBreakdown` (same structure as scaffold breakdown)

### Step 4.3: Execute Activity Requests (Implement)
- **Activity**: `executeAgentActivityRequest`
- **Condition**: Only if `implementTaskBreakdown.activities.length > 0`
- **Purpose**: Execute information-gathering activities
- **Loop**: For each activity in `implementTaskBreakdown.activities`

### Step 4.4: Execute Implement Tasks (Loop)
- **Loop**: For each task in `implementTaskBreakdown.tasks`
- **Sub-steps**: (Same as Step 3.4, but for implementation tasks)

#### Step 4.4.1: Check Task Dependencies
#### Step 4.4.2: Execute Task Activity Requests
#### Step 4.4.3: Build Task Instruction
#### Step 4.4.4: Select Claude Model (Claude Only)
- **Input**: Task type ('implement'), error type (undefined)

#### Step 4.4.5: Execute CLI Task
- **Note**: Reuses `sessionId` from scaffold phase (for Claude)

#### Step 4.4.6: Validate CLI Result
#### Step 4.4.7: Check Task Success
#### Step 4.4.8: Mark Task Complete
- **Action**: 
  - Add `task.id` to `implementCompletedTaskIds`
  - Add `taskResult.cost_usd` to `totalImplementCost`

#### Step 4.4.9: Capture Claude Session ID
- **Action**: Update `sessionId` for next task

#### Step 4.4.10: Run Quality Gates (If Any)

### Step 4.5: Check for More Tasks
- **Condition**: After all tasks in batch complete
- **Action**: 
  - Set `moreImplementTasksAvailable = implementTaskBreakdown.more_tasks === true`
  - If `moreImplementTasksAvailable === true`, loop back to Step 4.2
  - If `moreImplementTasksAvailable === false`, proceed to Phase 5

### Step 4.6: Implement Complete
- **Condition**: When `moreImplementTasksAvailable === false`
- **Action**: Log total cost and task count

---

## Phase 5: Build & Test

### Step 5.1: Run Build
- **Activity**: `runBuild`
- **Purpose**: Execute `npm run build` in package directory
- **Input**: `input.workspaceRoot`, `input.packagePath`, `input.packageName`
- **Output**: `buildResult` with:
  - `success`: Boolean
  - `duration`: Build time in ms
  - `stderr`: Error output (if failed)
- **Fails**: If build fails, throws error

### Step 5.2: Run Tests
- **Activity**: `runTests`
- **Purpose**: Execute `npm test` in package directory
- **Input**: `input.workspaceRoot`, `input.packagePath`
- **Output**: `testResult` with:
  - `success`: Boolean
  - `duration`: Test time in ms
  - `coverage`: Test coverage percentage
  - `stderr`: Error output (if failed)
- **Fails**: If tests fail, throws error

### Step 5.3: Commit Test Results
- **Activity**: `commitChanges`
- **Purpose**: Git commit after successful build and tests
- **Input**: 
  - `workspaceRoot`: `input.workspaceRoot`
  - `packagePath`: `input.packagePath`
  - `message`: Commit message with coverage info
  - `gitUser`: Automated git user
- **Output**: `testCommitResult` with `commitHash` if successful

---

## Phase 6: Quality Checks (With Retry Logic)

### Step 6.1: Run Quality Checks
- **Activity**: `runQualityChecks`
- **Purpose**: Execute linting, type checking, and other quality gates
- **Input**: `input.workspaceRoot`, `input.packagePath`
- **Output**: `qualityResult` with:
  - `passed`: Boolean
  - `duration`: Quality check time in ms
  - `failures`: Array of failure objects

### Step 6.2: Fix Loop (Up to 3 Attempts)
- **Loop**: While `qualityResult.passed === false` AND `fixAttempt <= 3`
- **Sub-steps**:

#### Step 6.2.1: Spawn Fix Agent
- **Activity**: `spawnFixAgent`
- **Purpose**: Use CLI agent to fix quality issues
- **Input**:
  - `packagePath`: `input.packagePath`
  - `planPath`: `input.planPath`
  - `failures`: `qualityResult.failures`
  - `workspaceRoot`: `input.workspaceRoot`
- **Output**: Fix agent executes and modifies code

#### Step 6.2.2: Record Fix Attempt
- **Action**: Add fix attempt to `report.fixAttempts` with:
  - `count`: Attempt number
  - `types`: Failure types
  - `agentPromptUsed`: 'cli-agent'
  - `fixDuration`: Time taken

#### Step 6.2.3: Retry Quality Checks
- **Activity**: `runQualityChecks` (again)
- **Purpose**: Verify fixes resolved issues
- **Output**: Updated `qualityResult`

#### Step 6.2.4: Increment Fix Attempt
- **Action**: `fixAttempt++`

### Step 6.3: Check Final Quality Status
- **Condition**: After loop completes
- **Fails**: If `qualityResult.passed === false` after 3 attempts, throws error

---

## Phase 7: Publish & Git

### Step 7.1: Publish Package
- **Activity**: `publishPackage`
- **Purpose**: Publish package to npm registry
- **Input**: 
  - `packageName`: `input.packageName`
  - `packagePath`: `input.packagePath`
  - `config`: `input.config`
- **Output**: `publishResult` with:
  - `success`: Boolean
  - `duration`: Publish time in ms
  - `stdout`: Publish output
- **Fails**: If publish fails, throws error

### Step 7.2: Push Git Changes
- **Activity**: `pushChanges`
- **Purpose**: Push all commits to remote repository
- **Input**: 
  - `workspaceRoot`: `input.workspaceRoot`
  - `packagePath`: `input.packagePath`
  - `remote`: 'origin'
  - `branch`: 'main'
- **Output**: `pushResult` with `success` boolean
- **Note**: Does NOT fail workflow if push fails (package already published)

### Step 7.3: Update MCP Status
- **Activity**: `updateMCPPackageStatus`
- **Purpose**: Update package status in MCP system
- **Input**: `input.packageName`, status 'published'
- **Note**: Called implicitly on success

---

## Phase 8: Finalization

### Step 8.1: Write Build Report
- **Activity**: `writePackageBuildReport`
- **Purpose**: Save build report to disk
- **Input**: `report`, `input.workspaceRoot`
- **Condition**: Always executed (in `finally` block)
- **Report Contains**:
  - Package name, workflow ID, timestamps
  - Duration, build metrics (build/test/quality/publish times)
  - Quality scores (lint, coverage, TypeScript errors)
  - Fix attempts history
  - Status ('success' | 'failed')
  - Dependencies, error messages

### Step 8.2: Return Result
- **Success Case**:
  ```typescript
  {
    success: true,
    packageName: input.packageName,
    report: report
  }
  ```
- **Failure Case**:
  ```typescript
  {
    success: false,
    packageName: input.packageName,
    failedPhase: 'build' | 'test' | 'quality' | 'publish' | 'build',
    error: errorMessage,
    fixAttempts: report.fixAttempts.length,
    report: report
  }
  ```

---

## Key Features

### Iterative Task Breakdown
- Both scaffold and implement phases use iterative task breakdown
- Agent returns 3-8 tasks at a time
- Workflow requests more tasks until `more_tasks === false`
- Each task has dependencies, acceptance criteria, quality gates

### Activity Requests
- Agent can request workflow activities (read_file, list_dir, run_cmd)
- Activities executed before task execution
- Results could be fed back to agent in next iteration

### Session Management (Claude)
- Claude sessions maintained across tasks within a phase
- `scaffoldSessionId` used for all scaffold tasks
- `sessionId` reused from scaffold to implement phase

### Cost Tracking
- Tracks cost per task (`taskResult.cost_usd`)
- Accumulates `totalScaffoldCost` and `totalImplementCost`
- Logged at phase completion

### Resume Support
- Detects resume point if package is partially complete
- Skips phases that are already done
- Uses audit context to determine what's missing

### Error Handling
- Each phase can fail and stop workflow
- Quality checks have retry logic (3 attempts)
- Build report always written (in `finally` block)
- Failed phase tracked in result

---

## Activity Timeouts

- **Build activities**: 10 minutes
- **Agent activities**: 30 minutes
- **Report activities**: 1 minute
- **CLI activities**: 30 minutes
- **Resume activities**: 5 minutes
- **MCP activities**: 1 minute

---

## Total Steps Summary

1. **Pre-Flight**: 7 steps (with conditional paths)
2. **Setup**: 6 steps
3. **Scaffold**: ~15-30 steps (depending on task count, iterative)
4. **Implement**: ~15-30 steps (depending on task count, iterative)
5. **Build & Test**: 3 steps
6. **Quality**: 1-4 steps (with retry loop)
7. **Publish & Git**: 2 steps
8. **Finalization**: 2 steps

**Total**: ~50-80 steps (varies based on task breakdown iterations and quality fix attempts)

