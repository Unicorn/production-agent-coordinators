# Dev Workflow Phase 3: AI-Powered Agent Execution - Design Document

**Date:** 2025-11-22
**Author:** Claude (AI Assistant)
**Status:** Design In Progress

**Related Documents:**
- [Phase 1: Foundation](/docs/plans/2025-11-21-dev-workflow-phase1-foundation.md)
- [Phase 2: Slack Integration](/docs/plans/2025-11-21-dev-workflow-phase2-slack-integration.md)
- [Turn-Based Coding Architecture](/packages/agents/package-builder-production/docs/architecture/turn-based-generation.md)

---

## Executive Summary

Phase 3 adds AI-powered task breakdown and code generation to dev-workflow, replacing Phase 2's mock tasks and simulated execution with real Claude-powered implementation. The system uses the existing turn-based coding workflow from `package-builder-production` for reliable, phase-by-phase code generation with automatic error recovery.

**Key Capabilities:**
- AI-powered task breakdown from user requirements
- Real code generation via turn-based Claude API calls
- Automatic test execution and error recovery
- Git feature branch workflow with automatic PR creation
- Slack milestone updates throughout execution

**Scope:** Full end-to-end automation from `/dev-workflow` command to ready-for-review Pull Request

---

## Requirements (Phase 1: Understanding)

### Core Requirements

1. **AI Integration**
   - Use turn-based coding workflow from `packages/agents/package-builder-production`
   - Workflow handles both task breakdown AND task execution
   - Being tested and finalized - stub out integration for now

2. **Architecture**
   - **Task Breakdown**: Single turn-based workflow run to analyze feature request and create intelligent task list
   - **Task Execution**: Separate turn-based workflow per task for code generation
   - **Orchestration**: New coordinator workflow to manage the entire process

3. **Git Workflow**
   - **Strategy**: Feature branch per workflow run
   - Branch naming: `feature/<feature-name>` (e.g., `feature/add-oauth2`)
   - All task commits go to feature branch
   - Automatic PR creation at completion

4. **Testing & Validation**
   - **When**: Run tests after each task completion
   - **On Failure**: Auto-retry with error feedback to Claude (max 3 retries)
   - **Test Suite**: Run full npm test for the repository
   - **Validation**: Each task must pass tests before proceeding to next

5. **Slack Integration**
   - **Update Frequency**: Milestone updates only (not every phase)
   - **Milestones**:
     - Workflow started
     - Task breakdown complete (with task count)
     - Each task started
     - Each task completed (with test results)
     - PR created (with link)
     - Workflow complete
   - **Error Notifications**: Send to Slack when tasks fail after retries

6. **Error Handling**
   - **Strategy**: Auto-retry with error feedback to Claude
   - **Retry Limit**: 3 attempts per task
   - **Feedback Loop**: Send test failures/errors back to Claude in conversation
   - **Escalation**: If task fails after 3 retries, notify user in Slack and pause workflow

7. **Scope Boundary**
   - **Phase 3 Delivers**: Full end-to-end automation
   - **Complete When**: Pull Request created and ready for human review
   - **Includes**: Planning → Code Generation → Testing → Auto-fix → PR Creation
   - **Excludes**: Auto-merge (requires human approval)

---

## Architectural Decision (Phase 2: Exploration)

### Chosen Approach: Orchestrator Pattern

**Decision**: Create new `DevWorkflowCoordinator` workflow that orchestrates specialized sub-workflows.

**Rationale:**
- Clean separation of concerns (planning, breakdown, execution)
- Each workflow testable independently
- Better observability (separate workflow IDs for each phase)
- Follows Temporal best practices for workflow composition
- Easier to add new capabilities later (e.g., code review, documentation)

**Rejected Alternatives:**

1. **Monolithic Workflow**: Extending `FeaturePlanningWorkflow` to include everything
   - ❌ Couples planning to execution
   - ❌ Harder to test pieces independently
   - ❌ Single failure point for entire flow

2. **Activity Delegation**: Call turn-based as long-running activities
   - ❌ Activities have timeout limits (max 10 minutes in Temporal)
   - ❌ Turn-based can take 25-35 minutes per run
   - ❌ Less flexibility for pause/resume/recovery

---

## Design (Phase 3: Design Presentation)

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Slack Bot Server                              │
│         (Phase 2 - already implemented)                          │
│  - Receives /dev-workflow command                                │
│  - Starts DevWorkflowCoordinator                                 │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│              DevWorkflowCoordinator (NEW)                        │
│                  Main orchestration workflow                     │
│                                                                  │
│  Step 1: Conversational Planning                                │
│  ┌────────────────────────────────────────────────────┐         │
│  │  Call FeaturePlanningWorkflow                      │         │
│  │  - Slack Q&A with user                             │         │
│  │  - Plan approval                                   │         │
│  │  - Returns: refinedRequirement                     │         │
│  └────────────────────────────────────────────────────┘         │
│                     │                                            │
│  Step 2: Git Setup                                               │
│  ┌────────────────────────────────────────────────────┐         │
│  │  Create feature branch                             │         │
│  │  - Branch: feature/<slugified-feature-name>        │         │
│  │  - Checkout branch                                 │         │
│  └────────────────────────────────────────────────────┘         │
│                     │                                            │
│  Step 3: AI Task Breakdown                                       │
│  ┌────────────────────────────────────────────────────┐         │
│  │  Call TurnBasedCodingAgent                         │         │
│  │  - task: "breakdown-feature"                       │         │
│  │  - prompt: refinedRequirement                      │         │
│  │  - Returns: intelligentTaskList[]                  │         │
│  └────────────────────────────────────────────────────┘         │
│                     │                                            │
│  Step 4: Task Execution Loop                                     │
│  ┌────────────────────────────────────────────────────┐         │
│  │  FOR EACH task in intelligentTaskList:             │         │
│  │                                                     │         │
│  │    4a. Send Slack: "Starting task X: <name>"       │         │
│  │                                                     │         │
│  │    4b. Call TurnBasedCodingAgent                   │         │
│  │        - task: "implement-task"                    │         │
│  │        - prompt: task description                  │         │
│  │        - 15 phases execute internally              │         │
│  │        - Returns: filesModified[]                  │         │
│  │                                                     │         │
│  │    4c. Run Tests                                   │         │
│  │        - npm test (or repo-specific command)       │         │
│  │                                                     │         │
│  │    4d. Handle Test Results                         │         │
│  │        IF tests fail:                              │         │
│  │          - Retry with error feedback (max 3x)      │         │
│  │          - If still failing: notify Slack, pause   │         │
│  │        ELSE:                                        │         │
│  │          - Send Slack: "Task X complete ✅"        │         │
│  │                                                     │         │
│  └────────────────────────────────────────────────────┘         │
│                     │                                            │
│  Step 5: PR Creation                                             │
│  ┌────────────────────────────────────────────────────┐         │
│  │  Create Pull Request                               │         │
│  │  - Title: from feature request                     │         │
│  │  - Body: task summary + results                    │         │
│  │  - Base: main (or current branch)                  │         │
│  │  - Head: feature branch                            │         │
│  └────────────────────────────────────────────────────┘         │
│                     │                                            │
│  Step 6: Completion                                              │
│  ┌────────────────────────────────────────────────────┐         │
│  │  Send Slack: PR link + summary                     │         │
│  │  Return success with PR URL                        │         │
│  └────────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                     │
                     │ delegates to
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│           TurnBasedCodingAgentWorkflow                           │
│    (Existing - from package-builder-production)                  │
│                                                                  │
│  Used in two modes:                                              │
│                                                                  │
│  MODE 1: Task Breakdown (called once)                            │
│  ┌────────────────────────────────────────────────────┐         │
│  │  Input: { task: "breakdown-feature",               │         │
│  │          prompt: refinedRequirement }              │         │
│  │  Output: intelligentTaskList[]                     │         │
│  │                                                     │         │
│  │  Phases executed:                                  │         │
│  │  - PLANNING: Analyze requirements                  │         │
│  │  - FOUNDATION: Define task structure               │         │
│  │  - TYPES: Define task metadata                     │         │
│  │  - CORE_IMPLEMENTATION: Generate task list         │         │
│  │  - (remaining phases skipped for breakdown)        │         │
│  └────────────────────────────────────────────────────┘         │
│                                                                  │
│  MODE 2: Task Implementation (called per task)                   │
│  ┌────────────────────────────────────────────────────┐         │
│  │  Input: { task: "implement-task",                  │         │
│  │          prompt: taskDescription }                 │         │
│  │  Output: { filesModified[], commits[] }            │         │
│  │                                                     │         │
│  │  All 15 phases executed:                           │         │
│  │  - PLANNING → FOUNDATION → TYPES →                 │         │
│  │  - CORE_IMPLEMENTATION → ENTRY_POINT →             │         │
│  │  - UTILITIES → ERROR_HANDLING → TESTING →          │         │
│  │  - DOCUMENTATION → EXAMPLES →                      │         │
│  │  - INTEGRATION_REVIEW → CRITICAL_FIXES →           │         │
│  │  - BUILD_VALIDATION → FINAL_POLISH                 │         │
│  └────────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

### Workflow Interactions

**Sequence Diagram:**

```
User          SlackBot       DevWorkflowCoordinator    FeaturePlanningWF    TurnBasedCodingAgent
 │                │                    │                       │                    │
 │ /dev-workflow  │                    │                       │                    │
 │───────────────>│                    │                       │                    │
 │                │                    │                       │                    │
 │                │  start()           │                       │                    │
 │                │───────────────────>│                       │                    │
 │                │                    │                       │                    │
 │                │                    │  startChildWorkflow   │                    │
 │                │                    │──────────────────────>│                    │
 │                │                    │                       │                    │
 │                │                    │   (Slack Q&A)         │                    │
 │<───────────────────────────────────────────────────────────│                    │
 │  Questions     │                    │                       │                    │
 │───────────────────────────────────────────────────────────>│                    │
 │  Answers       │                    │                       │                    │
 │                │                    │                       │                    │
 │                │                    │  refinedRequirement   │                    │
 │                │                    │<──────────────────────│                    │
 │                │                    │                       │                    │
 │                │                    │  createFeatureBranch()│                    │
 │                │                    │───────────┐           │                    │
 │                │                    │           │           │                    │
 │                │                    │<──────────┘           │                    │
 │                │                    │                       │                    │
 │                │                    │  startChildWorkflow(breakdown-feature)     │
 │                │                    │───────────────────────────────────────────>│
 │                │                    │                       │                    │
 │                │                    │                       │  (15 phases...)    │
 │                │                    │                       │                    │
 │                │                    │  taskList[]           │                    │
 │                │                    │<───────────────────────────────────────────│
 │                │                    │                       │                    │
 │<───Slack: "Task breakdown complete: 5 tasks"───────────────────────────────────│
 │                │                    │                       │                    │
 │                │                    │  FOR EACH task:       │                    │
 │                │                    │    startChildWorkflow(implement-task)      │
 │                │                    │───────────────────────────────────────────>│
 │<───Slack: "Starting task 1"────────────────────────────────│                    │
 │                │                    │                       │  (15 phases...)    │
 │                │                    │  filesModified[]      │                    │
 │                │                    │<───────────────────────────────────────────│
 │                │                    │                       │                    │
 │                │                    │  runTests()           │                    │
 │                │                    │───────────┐           │                    │
 │                │                    │           │           │                    │
 │                │                    │<──────────┘           │                    │
 │<───Slack: "Task 1 complete ✅"─────────────────────────────│                    │
 │                │                    │                       │                    │
 │                │                    │  (repeat for all tasks)                    │
 │                │                    │                       │                    │
 │                │                    │  createPullRequest()  │                    │
 │                │                    │───────────┐           │                    │
 │                │                    │           │           │                    │
 │                │                    │<──────────┘           │                    │
 │                │                    │                       │                    │
 │<───Slack: "PR created: <link>"─────────────────────────────│                    │
 │                │                    │                       │                    │
```

---

## Component Details

### 1. DevWorkflowCoordinator Workflow

**File:** `packages/dev-workflow/src/workflows/dev-workflow-coordinator.workflow.ts`

**Purpose:** Main orchestration workflow that coordinates conversational planning, task breakdown, code generation, testing, and PR creation.

**Inputs:**
```typescript
interface DevWorkflowCoordinatorInput {
  featureRequest: string;        // From Slack command
  slackChannel: string;          // For progress updates
  slackThreadTs: string;         // Thread for conversation
  repoPath: string;              // Repository root path
  baseBranch?: string;           // Default: "main"
}
```

**Outputs:**
```typescript
interface DevWorkflowCoordinatorResult {
  success: boolean;
  prUrl?: string;
  prNumber?: number;
  tasksCompleted: number;
  tasksFailed: number;
  error?: string;
}
```

**Responsibilities:**
1. Delegates to `FeaturePlanningWorkflow` for Slack Q&A and requirement gathering
2. Creates Git feature branch: `feature/<slugified-request>`
3. Calls `TurnBasedCodingAgent` with task="breakdown-feature" to get intelligent task list
4. For each task:
   - Calls `TurnBasedCodingAgent` with task="implement-task"
   - Monitors execution (minimal state - just workflow IDs)
   - Runs tests after code generation
   - Auto-retries with error feedback on test failures (max 3 times)
   - Sends Slack milestone updates
5. Creates Pull Request using GitHub CLI
6. Returns final result with PR link

**State Management (Hierarchical Decomposition):**
- Parent workflow stores only:
  - Child workflow IDs (strings)
  - Task completion status (boolean array)
  - PR URL (string)
  - Total: ~1-2KB regardless of code size
- Heavy data stays in child workflows:
  - `TurnBasedCodingAgent` stores conversation history, file contents
  - Each child workflow has own 50MB limit
  - 10 tasks = 10 separate child workflows = 500MB total capacity

**Key Activities Used:**
- `createFeatureBranch(branchName, baseBranch, repoPath)`
- `runTests(repoPath)`
- `createPullRequest(branch, title, body, baseBranch)`
- `sendSlackMilestone(channel, threadTs, milestone, metadata)`

**Child Workflows:**
- `FeaturePlanningWorkflow` (Phase 2) - called once
- `TurnBasedCodingAgent` (breakdown mode) - called once
- `TurnBasedCodingAgent` (implement mode) - called N times (one per task)

**Recovery:** If workflow fails mid-execution, Temporal resumes from last completed task. Child workflows that completed successfully are not re-executed.

### 2. Turn-Based Integration Activities

**File:** `packages/dev-workflow/src/activities/turn-based-integration.activities.ts`

**Purpose:** Wrapper activities for calling TurnBasedCodingAgent workflow as child workflows.

```typescript
/**
 * Call TurnBasedCodingAgent in breakdown mode
 */
export async function breakdownFeatureIntoTasks(
  input: BreakdownFeatureInput
): Promise<TaskBreakdownResult> {
  const { refinedRequirement, repoPath, workspaceRoot } = input;

  // Start child workflow
  const handle = await startChildWorkflow(TurnBasedCodingAgentWorkflow, {
    args: [{
      task: 'breakdown-feature',
      prompt: `Analyze this feature request and create intelligent task breakdown:\n\n${refinedRequirement}`,
      workspaceRoot,
      targetPath: repoPath,
      contextPaths: [] // No additional context needed for breakdown
    }],
    taskQueue: 'turn-based-coding'
  });

  const result = await handle.result();

  // Parse task list from result
  const tasks = parseTaskListFromGeneratedFiles(result.filesModified);

  return { tasks, sessionId: result.context.sessionId };
}

/**
 * Call TurnBasedCodingAgent in implement mode
 */
export async function implementTask(
  input: ImplementTaskInput
): Promise<TaskImplementationResult> {
  const { task, repoPath, workspaceRoot } = input;

  const handle = await startChildWorkflow(TurnBasedCodingAgentWorkflow, {
    args: [{
      task: 'implement-task',
      prompt: `Implement this task:\n\nName: ${task.name}\nDescription: ${task.description}\nDependencies: ${task.dependencies.join(', ')}`,
      workspaceRoot,
      targetPath: repoPath,
      contextPaths: task.contextFiles || []
    }],
    taskQueue: 'turn-based-coding'
  });

  const result = await handle.result();

  return {
    success: result.success,
    filesModified: result.filesModified,
    commitHash: result.context.lastSuccessfulCommit
  };
}
```

### 3. Git Operations Activities

**File:** `packages/dev-workflow/src/activities/git-operations.activities.ts`

**Purpose:** Git operations for feature branches and PR creation.

```typescript
/**
 * Create feature branch from base branch
 */
export async function createFeatureBranch(
  input: CreateBranchInput
): Promise<CreateBranchResult> {
  const { branchName, baseBranch = 'main', repoPath } = input;

  try {
    // Check if branch exists
    const branchExists = await checkBranchExists(repoPath, branchName);

    let finalBranchName = branchName;
    if (branchExists) {
      // Add timestamp suffix
      finalBranchName = `${branchName}-${Date.now()}`;
    }

    // Create and checkout branch
    await execPromise(`git checkout -b ${finalBranchName} ${baseBranch}`, { cwd: repoPath });

    return { success: true, branchName: finalBranchName };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Create Pull Request using GitHub CLI
 */
export async function createPullRequest(
  input: CreatePRInput
): Promise<CreatePRResult> {
  const { branch, title, body, baseBranch = 'main', repoPath } = input;

  try {
    // Use gh CLI to create PR
    const result = await execPromise(
      `gh pr create --base ${baseBranch} --head ${branch} --title "${title}" --body "${body}"`,
      { cwd: repoPath }
    );

    // Parse PR URL from output
    const prUrl = result.stdout.trim();
    const prNumber = parseInt(prUrl.split('/').pop());

    return { success: true, prUrl, prNumber };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

### 4. Test Execution Activities

**File:** `packages/dev-workflow/src/activities/test-execution.activities.ts`

**Purpose:** Run tests and parse results for auto-fix feedback loop.

```typescript
/**
 * Run tests and capture results
 */
export async function runTests(
  input: RunTestsInput
): Promise<TestExecutionResult> {
  const { repoPath, testCommand = 'npm test' } = input;

  try {
    const startTime = Date.now();

    // Run tests (don't throw on non-zero exit)
    const result = await execPromise(testCommand, {
      cwd: repoPath,
      env: { ...process.env, CI: 'true' } // Disable watch mode
    });

    const duration = Date.now() - startTime;

    // Parse test results from stdout/stderr
    const { passed, failures } = parseTestOutput(result.stdout, result.stderr);

    return {
      passed,
      failures,
      duration,
      stdout: result.stdout,
      stderr: result.stderr
    };
  } catch (error) {
    // Tests failed (non-zero exit)
    const { passed, failures } = parseTestOutput(error.stdout, error.stderr);

    return {
      passed: false,
      failures,
      duration: Date.now() - startTime,
      stdout: error.stdout,
      stderr: error.stderr
    };
  }
}

/**
 * Parse test output to extract failure messages
 */
function parseTestOutput(stdout: string, stderr: string): {
  passed: boolean;
  failures: string[];
} {
  const output = stdout + stderr;

  // Look for common test failure patterns
  const failures: string[] = [];

  // Jest/Vitest pattern: "FAIL src/__tests__/..."
  const failRegex = /FAIL\s+(.+)/g;
  let match;
  while ((match = failRegex.exec(output)) !== null) {
    failures.push(match[1]);
  }

  // Extract error messages
  const errorRegex = /Error:\s+(.+)/g;
  while ((match = errorRegex.exec(output)) !== null) {
    failures.push(match[1]);
  }

  return {
    passed: failures.length === 0 && !output.includes('FAIL'),
    failures
  };
}
```

---

## Data Flow

**Data transforms as it flows through the system:**

### Stage 1: User Input → Refined Requirements

**Input:** `/dev-workflow Add OAuth2 authentication`

**Process:**
- `FeaturePlanningWorkflow` asks clarifying questions via Slack
- User responds conversationally (Phase 2 signal-based interaction)

**Output:**
```typescript
refinedRequirement = "Add OAuth2 authentication with Google provider, store tokens in PostgreSQL, support refresh tokens"
```

### Stage 2: Requirements → Task Breakdown

**Input:** `refinedRequirement` string

**Process:**
- `TurnBasedCodingAgent` (breakdown mode) analyzes with Claude API
- Executes subset of phases: PLANNING, FOUNDATION, TYPES, CORE_IMPLEMENTATION
- Claude outputs structured task list in JSON format

**Output:**
```typescript
intelligentTaskList: Task[] = [
  {
    id: "task-1",
    name: "Add OAuth2 dependencies",
    description: "Install passport, passport-google-oauth20, express-session packages",
    dependencies: [],
    estimatedComplexity: "simple"
  },
  {
    id: "task-2",
    name: "Create OAuth2 service",
    description: "Implement OAuth2Service class with Google provider configuration",
    dependencies: ["task-1"],
    estimatedComplexity: "medium"
  },
  {
    id: "task-3",
    name: "Add token storage",
    description: "Create TokenRepository for PostgreSQL with encryption",
    dependencies: ["task-2"],
    estimatedComplexity: "medium"
  },
  {
    id: "task-4",
    name: "Write tests",
    description: "Unit and integration tests for OAuth2 flow",
    dependencies: ["task-2", "task-3"],
    estimatedComplexity: "medium"
  }
]
```

### Stage 3: Task → Code Generation

**Input:** Individual task object

**Process:**
- `TurnBasedCodingAgent` (implement mode) executes all 15 phases
- Each phase generates file operations via Claude API
- Files written to disk progressively
- Each phase commits to Git for checkpoint

**Output:**
```typescript
{
  success: true,
  filesModified: [
    "src/services/oauth2.service.ts",
    "src/repositories/token.repository.ts",
    "src/__tests__/oauth2.service.test.ts"
  ],
  commitHash: "abc123def456"
}
```

### Stage 4: Code → Test Results

**Input:** Modified files on disk (in feature branch)

**Process:**
- `runTests()` activity executes `npm test` with CI=true
- Captures stdout/stderr
- Parses output for failures

**Output:**
```typescript
{
  passed: false,
  failures: [
    "TypeError: Cannot read property 'tokens' of undefined at OAuth2Service.getTokens",
    "5 tests failing in src/__tests__/oauth2.service.test.ts"
  ],
  duration: 2341,
  stdout: "...",
  stderr: "..."
}
```

### Stage 5: Failures → Auto-Fix (if needed)

**Input:** Test failures string

**Process:**
- Send error back to `TurnBasedCodingAgent` in conversation context
- Claude sees: previous code + test failures + error messages
- Generates fixes via CRITICAL_FIXES phase
- Re-runs tests
- Retry up to 3 times

**Output:** Either:
- `{ passed: true, failures: [] }` → Success, continue
- After 3 retries: Escalate to user via Slack signal

### Stage 6: All Tasks → Pull Request

**Input:** List of completed tasks with commit hashes

**Process:**
- Generate PR title from feature request
- Generate PR body with task summary:
  ```markdown
  ## Feature: Add OAuth2 Authentication

  ### Tasks Completed
  - ✅ Task 1: Add OAuth2 dependencies (abc123)
  - ✅ Task 2: Create OAuth2 service (def456)
  - ✅ Task 3: Add token storage (ghi789)
  - ✅ Task 4: Write tests (jkl012)

  ### Testing
  All tasks passed tests successfully.

  🤖 Generated with Claude via dev-workflow
  ```
- Call `gh pr create` with title, body, base, head

**Output:**
```typescript
{
  success: true,
  prUrl: "https://github.com/user/repo/pull/123",
  prNumber: 123
}
```

### State Persistence

At each stage, data is persisted in multiple layers:

1. **Temporal Workflow State** (in-memory, recovered on failure):
   - Parent workflow: Child workflow IDs, task completion booleans (~1-2KB)
   - Child workflows: Full conversation history, file contents (~10-50MB each)

2. **Generation State Files** (`.generation-state/*.json`):
   - Persisted after each phase by `TurnBasedCodingAgent`
   - Used for recovery if workflow crashes
   - Cleaned up after successful completion

3. **Git Commits** (permanent record):
   - Each phase commits its changes
   - Full history of how code was generated
   - Easy to inspect/debug individual phases

---

## Error Handling

### Error Categories and Handling Strategies

#### 1. Temporal/Infrastructure Errors

**Examples:**
- Network failures
- Temporal server unavailable
- Activity heartbeat timeouts

**Strategy:** Automatic retry via Temporal's built-in retry policies

**Configuration:**
```typescript
proxyActivities({
  startToCloseTimeout: '15 minutes',
  retry: {
    initialInterval: '1s',
    maximumInterval: '60s',
    backoffCoefficient: 2,
    maximumAttempts: 5
  }
});
```

**Workflow State:** Preserved automatically, resume from last completed step

**User Notification:** None (transparent recovery)

#### 2. Task Execution Errors (Code Generation Failures)

**Examples:**
- Claude API errors (rate limits, timeouts)
- Malformed JSON responses
- Phase execution failures

**Strategy:**
1. Retry with exponential backoff (Temporal activity retry)
2. `TurnBasedCodingAgent` has own retry logic per phase
3. Max 3 retries at workflow level

**User Notification:**
```
❌ Task 2 (Create OAuth2 service) failed after 3 attempts

Error: Claude API rate limit exceeded

Options:
🔄 Retry task (will attempt again)
⏭️  Skip task (mark as manual, continue)
⛔ Abort workflow (cancel entire feature)

Reply: retry | skip | abort
```

**Workflow State:** Pauses at failed task, waits for user signal via Slack

#### 3. Test Failures

**Examples:**
- Generated code doesn't compile
- Unit tests fail
- Integration tests timeout

**Strategy:** Auto-retry with error feedback loop

**Process:**
1. Capture test output (stdout/stderr)
2. Send back to Claude in conversation:
   ```
   Previous code had these test failures:

   TypeError: Cannot read property 'tokens' of undefined
     at OAuth2Service.getTokens (src/services/oauth2.service.ts:45:12)

   Please fix the code to resolve these errors.
   ```
3. Claude generates fixes via CRITICAL_FIXES phase
4. Retry tests
5. Max 3 iterations per task

**User Notification:**
- After each retry: `⚙️ Task 2 tests failing, auto-fixing... (attempt 2/3)`
- After final failure: `❌ Task 2 tests still failing after 3 fix attempts. Pausing for manual review.`

**Workflow State:** If auto-fix succeeds → continue. If fails → pause for user decision.

#### 4. Git Operation Errors

**Examples:**
- Branch already exists
- Merge conflicts
- Permission errors (can't push)

**Strategy:**

**Branch exists:**
```typescript
if (await branchExists(branchName)) {
  branchName = `${branchName}-${Date.now()}`;
}
```

**Merge conflicts:**
- Should not occur (feature branch is isolated from base)
- If occurs: fail workflow with error details

**Permission errors:**
- Fail immediately with clear message
- User must fix git permissions and restart

**User Notification:**
```
❌ Git error: Permission denied (publickey)

Unable to create feature branch. Please check:
1. GitHub token has write access
2. SSH keys are configured
3. Repository permissions are correct

Workflow paused. Reply 'abort' to cancel.
```

**Workflow State:** Fail workflow, cannot proceed without git access

#### 5. Large Workflow State (Size Constraints)

**Prevention via Hierarchical Decomposition:**

**Parent Workflow State (~1-2KB):**
```typescript
{
  refinedRequirement: "string (~1KB max)",
  featureBranch: "string",
  taskStatuses: [true, true, false, false], // boolean array
  childWorkflowIds: ["wf-123", "wf-456"],   // string array
  prUrl: "string"
}
```

**Child Workflow State (10-50MB each):**
- `TurnBasedCodingAgent` stores:
  - Conversation history (messages array)
  - File contents (code strings)
  - Generation context (phase-by-phase state)
- Each child workflow has own 50MB limit
- 10 tasks = 10 separate child workflows = 500MB total capacity

**Monitoring:**
- Log workflow state size after each step
- Alert if parent approaches 10MB (should never happen)

**Escalation:**
If a single task generates > 50MB of state:
- Child workflow will fail with Temporal error
- Retry won't help (structural problem)
- User notified: "Task too large for single workflow, needs manual splitting"

#### Error Recovery User Experience

**Slack Interaction for Errors:**

```
❌ Task 2 (Create OAuth2 service) failed after 3 auto-fix attempts.

Test failures:
- TypeError: Cannot read property 'tokens' of undefined
- 5 tests failing in src/__tests__/oauth2.service.test.ts

Full error log: https://temporal.example.com/workflows/wf-123

Options:
🔄 Retry task (will attempt fix again)
⏭️  Skip task (mark as manual, continue to next)
⛔ Abort workflow (cancel entire feature)

Reply: retry | skip | abort
```

**User Response Handling:**
- `retry` → Reset retry counter, execute task again
- `skip` → Mark task as skipped, continue to next task, note in PR that task requires manual completion
- `abort` → Cancel workflow, clean up feature branch (optional), send final summary

---

## Testing Strategy

### Test Pyramid for Phase 3

#### Level 1: Unit Tests (Fast, Isolated)

**Purpose:** Test individual activities in isolation with mocked dependencies

**Coverage:** 90%+ of activity code

**Examples:**

```typescript
describe('Git Operations Activities', () => {
  describe('createFeatureBranch', () => {
    it('should create branch from base branch', async () => {
      const mockRepo = await setupMockGitRepo();

      const result = await createFeatureBranch({
        branchName: 'feature/test',
        baseBranch: 'main',
        repoPath: mockRepo.path
      });

      expect(result.success).toBe(true);
      expect(result.branchName).toBe('feature/test');

      // Verify branch exists in git
      const branches = await mockRepo.getBranches();
      expect(branches).toContain('feature/test');
    });

    it('should handle existing branch by adding timestamp', async () => {
      const mockRepo = await setupMockGitRepo();

      // Create branch first time
      await createFeatureBranch({ branchName: 'feature/test', baseBranch: 'main', repoPath: mockRepo.path });

      // Second call should add timestamp
      const result = await createFeatureBranch({ branchName: 'feature/test', baseBranch: 'main', repoPath: mockRepo.path });

      expect(result.branchName).toMatch(/feature\/test-\d+/);
    });

    it('should fail gracefully on permission errors', async () => {
      const mockRepo = await setupMockGitRepo({ readOnly: true });

      const result = await createFeatureBranch({ branchName: 'feature/test', baseBranch: 'main', repoPath: mockRepo.path });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');
    });
  });

  describe('runTests', () => {
    it('should execute npm test and parse passing results', async () => {
      const mockRepo = await setupMockRepoWithTests({ allPass: true });

      const result = await runTests({ repoPath: mockRepo.path });

      expect(result.passed).toBe(true);
      expect(result.failures).toEqual([]);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should capture test failures with details', async () => {
      const mockRepo = await setupMockRepoWithTests({
        failing: ['src/__tests__/oauth2.test.ts']
      });

      const result = await runTests({ repoPath: mockRepo.path });

      expect(result.passed).toBe(false);
      expect(result.failures.length).toBeGreaterThan(0);
      expect(result.failures[0]).toContain('oauth2.test.ts');
    });

    it('should disable watch mode in CI', async () => {
      const mockRepo = await setupMockRepoWithTests();

      const execSpy = jest.spyOn(require('child_process'), 'exec');

      await runTests({ repoPath: mockRepo.path });

      expect(execSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          env: expect.objectContaining({ CI: 'true' })
        })
      );
    });
  });
});
```

**Mock Validation (per CLAUDE.md):**
```typescript
describe('Mock Validation: TurnBasedCodingAgent Interface', () => {
  it('should validate mock matches real TurnBasedCodingAgentInput interface', () => {
    const mockInput = createMockTurnBasedInput();

    // TypeScript compile-time check
    const validInput: TurnBasedCodingAgentInput = mockInput;

    // Runtime validation
    expect(mockInput).toHaveProperty('task');
    expect(mockInput).toHaveProperty('prompt');
    expect(mockInput).toHaveProperty('workspaceRoot');
    expect(mockInput).toHaveProperty('targetPath');
  });
});
```

#### Level 2: Workflow Integration Tests (Medium, Realistic)

**Purpose:** Test workflows with mocked activities but real Temporal execution

**Coverage:** All workflow paths (success, retry, failure, skip)

**Examples:**

```typescript
describe('DevWorkflowCoordinator Integration', () => {
  let testEnv: TestWorkflowEnvironment;
  let client: WorkflowClient;
  let nativeConnection: NativeConnection;

  beforeAll(async () => {
    testEnv = await TestWorkflowEnvironment.createTimeSkipping();
    client = testEnv.client;
    nativeConnection = testEnv.nativeConnection;
  });

  afterAll(async () => {
    await testEnv.teardown();
  });

  it('should orchestrate full workflow successfully', async () => {
    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue: 'test',
      workflowsPath: require.resolve('../workflows'),
      activities: {
        createFeatureBranch: async () => ({ success: true, branchName: 'feature/test' }),
        runTests: async () => ({ passed: true, failures: [], duration: 1000 }),
        createPullRequest: async () => ({ success: true, prUrl: 'https://github.com/...', prNumber: 1 }),
        sendSlackMilestone: async () => ({ success: true })
      }
    });

    const handle = await client.workflow.start(DevWorkflowCoordinator, {
      args: [{
        featureRequest: 'Add OAuth2',
        slackChannel: 'test',
        slackThreadTs: '123',
        repoPath: '/tmp/test'
      }],
      taskQueue: 'test',
      workflowId: 'test-wf-1'
    });

    const result = await handle.result();

    expect(result.success).toBe(true);
    expect(result.prUrl).toBeDefined();
    expect(result.tasksCompleted).toBeGreaterThan(0);
    expect(result.tasksFailed).toBe(0);
  });

  it('should handle task failures with retries', async () => {
    let testAttempts = 0;

    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue: 'test',
      activities: {
        runTests: async () => {
          testAttempts++;
          if (testAttempts < 3) {
            return { passed: false, failures: ['Test error'], duration: 1000 };
          }
          return { passed: true, failures: [], duration: 1000 };
        },
        // ... other activities
      }
    });

    const result = await client.workflow.execute(DevWorkflowCoordinator, { ... });

    expect(testAttempts).toBe(3); // Verify retries happened
    expect(result.success).toBe(true);
  });

  it('should pause on user-escalated failures', async () => {
    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue: 'test',
      activities: {
        runTests: async () => ({ passed: false, failures: ['Persistent error'], duration: 1000 }),
        // ... other activities
      }
    });

    const handle = await client.workflow.start(DevWorkflowCoordinator, { ... });

    // Wait for workflow to pause
    await testEnv.sleep('1 minute');

    // Verify workflow is blocked waiting for signal
    const state = await handle.describe();
    expect(state.status.name).toBe('RUNNING'); // Not completed

    // Send skip signal
    await handle.signal('userDecisionSignal', { decision: 'skip', taskId: 'task-2' });

    // Workflow should continue
    const result = await handle.result();
    expect(result.tasksCompleted).toBeLessThan(result.tasksCompleted + result.tasksFailed);
  });
});
```

#### Level 3: End-to-End Tests (Slow, Real Dependencies)

**Purpose:** Test with real TurnBasedCodingAgent and actual git repos

**Coverage:** At least 3 realistic scenarios

**Examples:**

```typescript
describe('Phase 3 E2E Tests', () => {
  jest.setTimeout(300000); // 5 minutes for real AI calls

  it('should generate real code from simple feature request', async () => {
    const testRepo = await setupRealTestRepository();

    const result = await client.workflow.execute(DevWorkflowCoordinator, {
      args: [{
        featureRequest: 'Add simple calculator function with add/subtract',
        repoPath: testRepo.path,
        slackChannel: 'test-e2e',
        slackThreadTs: Date.now().toString()
      }],
      taskQueue: 'dev-workflow',
      workflowId: `e2e-test-${Date.now()}`
    });

    // Verify files were created
    expect(fs.existsSync(`${testRepo.path}/src/calculator.ts`)).toBe(true);
    expect(fs.existsSync(`${testRepo.path}/src/__tests__/calculator.test.ts`)).toBe(true);

    // Verify code compiles
    const compileResult = execSync('npm run build', { cwd: testRepo.path });
    expect(compileResult.toString()).not.toContain('error');

    // Verify tests pass
    const testResult = execSync('npm test', { cwd: testRepo.path, env: { CI: 'true' } });
    expect(testResult.toString()).toContain('PASS');

    // Verify PR was created
    expect(result.prUrl).toMatch(/github\.com/);

    // Cleanup
    await testRepo.cleanup();
  });

  it('should handle complex feature with multiple tasks', async () => {
    const testRepo = await setupRealTestRepository();

    const result = await client.workflow.execute(DevWorkflowCoordinator, {
      args: [{
        featureRequest: 'Add OAuth2 authentication with Google provider, token storage, and refresh logic',
        repoPath: testRepo.path,
        slackChannel: 'test-e2e',
        slackThreadTs: Date.now().toString()
      }],
      taskQueue: 'dev-workflow',
      workflowId: `e2e-test-${Date.now()}`
    });

    expect(result.success).toBe(true);
    expect(result.tasksCompleted).toBeGreaterThanOrEqual(3); // Multiple tasks

    // Verify complex integration
    const files = await listFilesRecursive(testRepo.path);
    expect(files).toContain('src/services/oauth2.service.ts');
    expect(files).toContain('src/repositories/token.repository.ts');
    expect(files).toContain('src/__tests__/oauth2.integration.test.ts');

    await testRepo.cleanup();
  });

  it('should recover from test failures with auto-fix', async () => {
    const testRepo = await setupRealTestRepository();

    // Inject a subtle bug that Claude should catch in testing
    await injectBugIntoRepo(testRepo, 'off-by-one-error');

    const result = await client.workflow.execute(DevWorkflowCoordinator, {
      args: [{
        featureRequest: 'Fix the array indexing bug',
        repoPath: testRepo.path,
        slackChannel: 'test-e2e',
        slackThreadTs: Date.now().toString()
      }],
      taskQueue: 'dev-workflow',
      workflowId: `e2e-test-${Date.now()}`
    });

    expect(result.success).toBe(true);

    // Verify bug was fixed and tests pass
    const testResult = execSync('npm test', { cwd: testRepo.path, env: { CI: 'true' } });
    expect(testResult.toString()).toContain('PASS');

    await testRepo.cleanup();
  });
});
```

### Test Coverage Requirements

- **Unit Tests**: 90%+ coverage of all activities
- **Integration Tests**: 100% coverage of workflow paths (success, retry, failure, skip, abort)
- **E2E Tests**: Minimum 3 scenarios (simple, complex, error recovery)
- **Mock Validation**: All mocks validated against real interfaces (per CLAUDE.md)

### CI/CD Integration

**On Every Commit:**
- Unit tests (~2 minutes, free)
- Integration tests (~3 minutes, free)
- Lint and type checking (~1 minute)

**On Pull Request:**
- All of the above, PLUS:
- E2E tests (~10 minutes, uses AI API credits)
- Block merge if any tests fail

**Manual Testing:**
- Full E2E suite can be run locally with `npm run test:e2e`
- Requires `ANTHROPIC_API_KEY` and `GH_TOKEN` in environment

---

## Implementation Notes

### Dependencies

**New Dependencies:**
- None - reuses existing `TurnBasedCodingAgentWorkflow` from `package-builder-production`

**Internal Dependencies:**
- `packages/agents/package-builder-production` (turn-based workflow)
- `packages/dev-workflow` (Phase 1 & 2 foundation)
- `@slack/bolt`, `@slack/web-api` (Phase 2 Slack integration)

### Configuration

**Environment Variables:**
```bash
# Existing (from Phase 1 & 2)
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
DEV_WORKFLOW_TASK_QUEUE=dev-workflow
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...

# New for Phase 3
ANTHROPIC_API_KEY=sk-ant-...           # Claude API key
GH_TOKEN=ghp_...                        # GitHub token for PR creation
DEFAULT_BASE_BRANCH=main                # Base branch for PRs
MAX_TASK_RETRIES=3                      # Max retries per task
```

---

## Success Criteria

Phase 3 is complete when:

- [ ] `/dev-workflow` command triggers full automation
- [ ] AI generates intelligent task breakdown from requirements
- [ ] Each task's code is generated via turn-based workflow
- [ ] Tests run after each task
- [ ] Failed tests trigger auto-fix with error feedback
- [ ] All tasks complete successfully
- [ ] Feature branch created with all commits
- [ ] Pull Request created automatically
- [ ] Slack updates sent at all milestones
- [ ] Full test coverage for new components
- [ ] Integration tests validate end-to-end flow

---

## Next Steps

1. **Complete Design Presentation**: Finish remaining component details, data flow, error handling, testing
2. **Design Documentation**: Finalize this document with complete sections
3. **Worktree Setup**: Create isolated workspace for Phase 3 development
4. **Implementation Plan**: Create detailed task breakdown with TDD approach

---

**Document Status:** Design Complete - All sections validated and ready for implementation
