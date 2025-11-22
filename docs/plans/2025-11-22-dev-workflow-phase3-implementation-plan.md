# Dev Workflow Phase 3: AI-Powered Agent Execution - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add AI-powered task breakdown and code generation to dev-workflow, replacing Phase 2's mock tasks with real Claude-powered implementation via turn-based coding workflow.

**Architecture:** Orchestrator pattern with DevWorkflowCoordinator calling FeaturePlanningWorkflow (Phase 2) for Slack Q&A, then TurnBasedCodingAgent for task breakdown and per-task code generation. Hierarchical workflow decomposition keeps parent workflow state minimal (~1-2KB) while child workflows handle heavy data (conversations, code).

**Tech Stack:**
- Temporal.io workflows and activities
- TurnBasedCodingAgent from `packages/agents/package-builder-production`
- GitHub CLI (`gh`) for PR creation
- Vitest for testing
- TypeScript strict mode

**Related Documents:**
- [Phase 3 Design](/docs/plans/2025-11-22-dev-workflow-phase3-agent-execution.md)
- [Phase 2 Slack Integration](/docs/plans/2025-11-21-dev-workflow-phase2-slack-integration.md)
- [Turn-Based Generation Architecture](/packages/agents/package-builder-production/docs/architecture/turn-based-generation.md)

---

## Part 1: Foundation - Types and Signals

### Task 1.1: Create User Decision Signal Types

**Files:**
- Create: `packages/dev-workflow/src/types/user-decision.types.ts`
- Test: `packages/dev-workflow/src/types/__tests__/user-decision.types.test.ts`

**Step 1: Write the failing test**

Create `packages/dev-workflow/src/types/__tests__/user-decision.types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { UserDecisionSignal, validateUserDecision } from '../user-decision.types';

describe('UserDecisionSignal Types', () => {
  it('should validate retry decision', () => {
    const signal: UserDecisionSignal = {
      decision: 'retry',
      taskId: 'task-1',
      timestamp: new Date().toISOString()
    };

    const result = validateUserDecision(signal);
    expect(result.valid).toBe(true);
  });

  it('should validate skip decision', () => {
    const signal: UserDecisionSignal = {
      decision: 'skip',
      taskId: 'task-2',
      timestamp: new Date().toISOString()
    };

    const result = validateUserDecision(signal);
    expect(result.valid).toBe(true);
  });

  it('should validate abort decision', () => {
    const signal: UserDecisionSignal = {
      decision: 'abort',
      taskId: 'task-3',
      timestamp: new Date().toISOString()
    };

    const result = validateUserDecision(signal);
    expect(result.valid).toBe(true);
  });

  it('should reject invalid decision', () => {
    const signal = {
      decision: 'invalid',
      taskId: 'task-1',
      timestamp: new Date().toISOString()
    } as any;

    const result = validateUserDecision(signal);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Invalid decision type');
  });

  it('should reject missing taskId', () => {
    const signal = {
      decision: 'retry',
      timestamp: new Date().toISOString()
    } as any;

    const result = validateUserDecision(signal);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('taskId is required');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/dev-workflow
npm test -- src/types/__tests__/user-decision.types.test.ts
```

Expected: FAIL with "Cannot find module '../user-decision.types'"

**Step 3: Write minimal implementation**

Create `packages/dev-workflow/src/types/user-decision.types.ts`:

```typescript
/**
 * User decision in response to task failures
 */
export interface UserDecisionSignal {
  decision: 'retry' | 'skip' | 'abort';
  taskId: string;
  timestamp: string;
  reason?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * Validate user decision signal
 */
export function validateUserDecision(signal: UserDecisionSignal): ValidationResult {
  const errors: string[] = [];

  if (!signal.decision || !['retry', 'skip', 'abort'].includes(signal.decision)) {
    errors.push('Invalid decision type');
  }

  if (!signal.taskId) {
    errors.push('taskId is required');
  }

  if (!signal.timestamp) {
    errors.push('timestamp is required');
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- src/types/__tests__/user-decision.types.test.ts
```

Expected: PASS (all 5 tests)

**Step 5: Commit**

```bash
git add src/types/user-decision.types.ts src/types/__tests__/user-decision.types.test.ts
git commit -m "feat(types): add user decision signal types with validation"
```

---

### Task 1.2: Create Coordinator Workflow Input/Output Types

**Files:**
- Modify: `packages/dev-workflow/src/types/workflow.types.ts`
- Test: `packages/dev-workflow/src/types/__tests__/workflow.types.test.ts`

**Step 1: Write the failing test**

Create `packages/dev-workflow/src/types/__tests__/workflow.types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { DevWorkflowCoordinatorInput, DevWorkflowCoordinatorResult } from '../workflow.types';

describe('Workflow Types', () => {
  it('should accept valid coordinator input', () => {
    const input: DevWorkflowCoordinatorInput = {
      featureRequest: 'Add OAuth2 authentication',
      slackChannel: 'C12345',
      slackThreadTs: '1234567890.123456',
      repoPath: '/workspace/my-repo'
    };

    expect(input).toBeDefined();
    expect(input.featureRequest).toBe('Add OAuth2 authentication');
  });

  it('should accept optional baseBranch', () => {
    const input: DevWorkflowCoordinatorInput = {
      featureRequest: 'Add feature',
      slackChannel: 'C12345',
      slackThreadTs: '123',
      repoPath: '/workspace',
      baseBranch: 'develop'
    };

    expect(input.baseBranch).toBe('develop');
  });

  it('should create success result', () => {
    const result: DevWorkflowCoordinatorResult = {
      success: true,
      prUrl: 'https://github.com/user/repo/pull/123',
      prNumber: 123,
      tasksCompleted: 5,
      tasksFailed: 0
    };

    expect(result.success).toBe(true);
    expect(result.prUrl).toBeDefined();
  });

  it('should create failure result', () => {
    const result: DevWorkflowCoordinatorResult = {
      success: false,
      tasksCompleted: 2,
      tasksFailed: 1,
      error: 'Task 3 failed after retries'
    };

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- src/types/__tests__/workflow.types.test.ts
```

Expected: FAIL with "Cannot find module '../workflow.types'" or type errors

**Step 3: Write minimal implementation**

Create or modify `packages/dev-workflow/src/types/workflow.types.ts`:

```typescript
/**
 * Input for DevWorkflowCoordinator workflow
 */
export interface DevWorkflowCoordinatorInput {
  /** Feature request from Slack command */
  featureRequest: string;

  /** Slack channel for progress updates */
  slackChannel: string;

  /** Slack thread timestamp */
  slackThreadTs: string;

  /** Repository root path */
  repoPath: string;

  /** Base branch for PR (default: main) */
  baseBranch?: string;

  /** Workspace root (default: repoPath) */
  workspaceRoot?: string;
}

/**
 * Output from DevWorkflowCoordinator workflow
 */
export interface DevWorkflowCoordinatorResult {
  /** Whether workflow completed successfully */
  success: boolean;

  /** Pull request URL if created */
  prUrl?: string;

  /** Pull request number if created */
  prNumber?: number;

  /** Number of tasks completed successfully */
  tasksCompleted: number;

  /** Number of tasks that failed */
  tasksFailed: number;

  /** Error message if workflow failed */
  error?: string;

  /** Feature branch name */
  featureBranch?: string;
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- src/types/__tests__/workflow.types.test.ts
```

Expected: PASS (all 4 tests)

**Step 5: Commit**

```bash
git add src/types/workflow.types.ts src/types/__tests__/workflow.types.test.ts
git commit -m "feat(types): add DevWorkflowCoordinator input/output types"
```

---

## Part 2: Git Operations Activities

### Task 2.1: Create Feature Branch Activity

**Files:**
- Create: `packages/dev-workflow/src/activities/git-operations.activities.ts`
- Test: `packages/dev-workflow/src/activities/__tests__/git-operations.activities.test.ts`

**Step 1: Write the failing test**

Create `packages/dev-workflow/src/activities/__tests__/git-operations.activities.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createFeatureBranch } from '../git-operations.activities';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Git Operations Activities', () => {
  let testRepoPath: string;

  beforeEach(async () => {
    // Create temporary git repo for testing
    testRepoPath = path.join(os.tmpdir(), `test-repo-${Date.now()}`);
    fs.mkdirSync(testRepoPath, { recursive: true });

    // Initialize git repo
    execSync('git init', { cwd: testRepoPath });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath });
    execSync('git config user.name "Test User"', { cwd: testRepoPath });

    // Create initial commit
    fs.writeFileSync(path.join(testRepoPath, 'README.md'), '# Test Repo');
    execSync('git add .', { cwd: testRepoPath });
    execSync('git commit -m "Initial commit"', { cwd: testRepoPath });
  });

  afterEach(() => {
    // Clean up test repo
    if (fs.existsSync(testRepoPath)) {
      fs.rmSync(testRepoPath, { recursive: true, force: true });
    }
  });

  describe('createFeatureBranch', () => {
    it('should create new branch from main', async () => {
      const result = await createFeatureBranch({
        branchName: 'feature/test',
        baseBranch: 'master',
        repoPath: testRepoPath
      });

      expect(result.success).toBe(true);
      expect(result.branchName).toBe('feature/test');

      // Verify branch exists
      const branches = execSync('git branch', { cwd: testRepoPath }).toString();
      expect(branches).toContain('feature/test');
    });

    it('should handle existing branch by adding timestamp', async () => {
      // Create branch first time
      await createFeatureBranch({
        branchName: 'feature/test',
        baseBranch: 'master',
        repoPath: testRepoPath
      });

      // Second call should add timestamp
      const result = await createFeatureBranch({
        branchName: 'feature/test',
        baseBranch: 'master',
        repoPath: testRepoPath
      });

      expect(result.success).toBe(true);
      expect(result.branchName).toMatch(/feature\/test-\d+/);

      // Verify both branches exist
      const branches = execSync('git branch', { cwd: testRepoPath }).toString();
      expect(branches).toContain('feature/test');
      expect(branches).toContain(result.branchName);
    });

    it('should return error for invalid repo path', async () => {
      const result = await createFeatureBranch({
        branchName: 'feature/test',
        baseBranch: 'master',
        repoPath: '/invalid/path'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- src/activities/__tests__/git-operations.activities.test.ts
```

Expected: FAIL with "Cannot find module '../git-operations.activities'"

**Step 3: Write minimal implementation**

Create `packages/dev-workflow/src/activities/git-operations.activities.ts`:

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export interface CreateBranchInput {
  branchName: string;
  baseBranch: string;
  repoPath: string;
}

export interface CreateBranchResult {
  success: boolean;
  branchName?: string;
  error?: string;
}

/**
 * Check if git branch exists
 */
async function checkBranchExists(repoPath: string, branchName: string): Promise<boolean> {
  try {
    const { stdout } = await execPromise('git branch --list', { cwd: repoPath });
    return stdout.includes(branchName);
  } catch {
    return false;
  }
}

/**
 * Create feature branch from base branch
 */
export async function createFeatureBranch(
  input: CreateBranchInput
): Promise<CreateBranchResult> {
  const { branchName, baseBranch, repoPath } = input;

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

    return {
      success: true,
      branchName: finalBranchName
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- src/activities/__tests__/git-operations.activities.test.ts
```

Expected: PASS (all 3 tests)

**Step 5: Commit**

```bash
git add src/activities/git-operations.activities.ts src/activities/__tests__/git-operations.activities.test.ts
git commit -m "feat(activities): add createFeatureBranch git operation"
```

---

### Task 2.2: Create Pull Request Activity

**Files:**
- Modify: `packages/dev-workflow/src/activities/git-operations.activities.ts`
- Modify: `packages/dev-workflow/src/activities/__tests__/git-operations.activities.test.ts`

**Step 1: Write the failing test**

Add to `packages/dev-workflow/src/activities/__tests__/git-operations.activities.test.ts`:

```typescript
import { createPullRequest } from '../git-operations.activities';
import { vi } from 'vitest';

describe('createPullRequest', () => {
  it('should create PR using gh CLI', async () => {
    // Mock execPromise to simulate gh pr create
    const mockExec = vi.spyOn(require('child_process'), 'exec');
    mockExec.mockImplementation((cmd: string, opts: any, callback: any) => {
      if (cmd.includes('gh pr create')) {
        callback(null, {
          stdout: 'https://github.com/user/repo/pull/123\n',
          stderr: ''
        });
      }
    });

    const result = await createPullRequest({
      branch: 'feature/test',
      title: 'Add test feature',
      body: 'Test PR body',
      baseBranch: 'main',
      repoPath: testRepoPath
    });

    expect(result.success).toBe(true);
    expect(result.prUrl).toBe('https://github.com/user/repo/pull/123');
    expect(result.prNumber).toBe(123);

    mockExec.mockRestore();
  });

  it('should handle gh CLI errors', async () => {
    const mockExec = vi.spyOn(require('child_process'), 'exec');
    mockExec.mockImplementation((cmd: string, opts: any, callback: any) => {
      if (cmd.includes('gh pr create')) {
        callback(new Error('gh: not authenticated'), null);
      }
    });

    const result = await createPullRequest({
      branch: 'feature/test',
      title: 'Add test feature',
      body: 'Test PR body',
      baseBranch: 'main',
      repoPath: testRepoPath
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('not authenticated');

    mockExec.mockRestore();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- src/activities/__tests__/git-operations.activities.test.ts
```

Expected: FAIL with "createPullRequest is not defined"

**Step 3: Write minimal implementation**

Add to `packages/dev-workflow/src/activities/git-operations.activities.ts`:

```typescript
export interface CreatePRInput {
  branch: string;
  title: string;
  body: string;
  baseBranch: string;
  repoPath: string;
}

export interface CreatePRResult {
  success: boolean;
  prUrl?: string;
  prNumber?: number;
  error?: string;
}

/**
 * Create Pull Request using GitHub CLI
 */
export async function createPullRequest(
  input: CreatePRInput
): Promise<CreatePRResult> {
  const { branch, title, body, baseBranch, repoPath } = input;

  try {
    // Escape double quotes in title and body
    const escapedTitle = title.replace(/"/g, '\\"');
    const escapedBody = body.replace(/"/g, '\\"');

    // Use gh CLI to create PR
    const { stdout } = await execPromise(
      `gh pr create --base ${baseBranch} --head ${branch} --title "${escapedTitle}" --body "${escapedBody}"`,
      { cwd: repoPath }
    );

    // Parse PR URL from output (gh returns URL on success)
    const prUrl = stdout.trim();
    const prNumber = parseInt(prUrl.split('/').pop() || '0', 10);

    return {
      success: true,
      prUrl,
      prNumber
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- src/activities/__tests__/git-operations.activities.test.ts
```

Expected: PASS (all 5 tests)

**Step 5: Commit**

```bash
git add src/activities/git-operations.activities.ts src/activities/__tests__/git-operations.activities.test.ts
git commit -m "feat(activities): add createPullRequest using gh CLI"
```

---

## Part 3: Test Execution Activities

### Task 3.1: Run Tests Activity

**Files:**
- Create: `packages/dev-workflow/src/activities/test-execution.activities.ts`
- Test: `packages/dev-workflow/src/activities/__tests__/test-execution.activities.test.ts`

**Step 1: Write the failing test**

Create `packages/dev-workflow/src/activities/__tests__/test-execution.activities.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runTests } from '../test-execution.activities';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

describe('Test Execution Activities', () => {
  let testRepoPath: string;

  beforeEach(() => {
    testRepoPath = path.join(os.tmpdir(), `test-repo-${Date.now()}`);
    fs.mkdirSync(testRepoPath, { recursive: true });

    // Create package.json with test script
    fs.writeFileSync(
      path.join(testRepoPath, 'package.json'),
      JSON.stringify({
        name: 'test-repo',
        scripts: {
          test: 'echo "PASS: All tests passed"'
        }
      }, null, 2)
    );
  });

  afterEach(() => {
    if (fs.existsSync(testRepoPath)) {
      fs.rmSync(testRepoPath, { recursive: true, force: true });
    }
  });

  describe('runTests', () => {
    it('should run tests and return passing result', async () => {
      const result = await runTests({
        repoPath: testRepoPath
      });

      expect(result.passed).toBe(true);
      expect(result.failures).toEqual([]);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.stdout).toContain('PASS');
    });

    it('should detect test failures', async () => {
      // Override test script to fail
      fs.writeFileSync(
        path.join(testRepoPath, 'package.json'),
        JSON.stringify({
          name: 'test-repo',
          scripts: {
            test: 'echo "FAIL src/test.ts" && exit 1'
          }
        }, null, 2)
      );

      const result = await runTests({
        repoPath: testRepoPath
      });

      expect(result.passed).toBe(false);
      expect(result.failures.length).toBeGreaterThan(0);
      expect(result.failures[0]).toContain('src/test.ts');
    });

    it('should use custom test command', async () => {
      const result = await runTests({
        repoPath: testRepoPath,
        testCommand: 'echo "Custom test runner"'
      });

      expect(result.stdout).toContain('Custom test runner');
    });

    it('should set CI environment variable', async () => {
      const mockExec = vi.spyOn(require('child_process'), 'exec');

      await runTests({ repoPath: testRepoPath });

      expect(mockExec).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          env: expect.objectContaining({ CI: 'true' })
        }),
        expect.any(Function)
      );

      mockExec.mockRestore();
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- src/activities/__tests__/test-execution.activities.test.ts
```

Expected: FAIL with "Cannot find module '../test-execution.activities'"

**Step 3: Write minimal implementation**

Create `packages/dev-workflow/src/activities/test-execution.activities.ts`:

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export interface RunTestsInput {
  repoPath: string;
  testCommand?: string;
}

export interface TestExecutionResult {
  passed: boolean;
  failures: string[];
  duration: number;
  stdout: string;
  stderr: string;
}

/**
 * Parse test output to extract failure messages
 */
function parseTestOutput(stdout: string, stderr: string): {
  passed: boolean;
  failures: string[];
} {
  const output = stdout + stderr;
  const failures: string[] = [];

  // Look for common test failure patterns
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

/**
 * Run tests and capture results
 */
export async function runTests(
  input: RunTestsInput
): Promise<TestExecutionResult> {
  const { repoPath, testCommand = 'npm test' } = input;
  const startTime = Date.now();

  try {
    // Run tests (don't throw on non-zero exit)
    const { stdout, stderr } = await execPromise(testCommand, {
      cwd: repoPath,
      env: { ...process.env, CI: 'true' } // Disable watch mode
    });

    const duration = Date.now() - startTime;
    const { passed, failures } = parseTestOutput(stdout, stderr);

    return {
      passed,
      failures,
      duration,
      stdout,
      stderr
    };
  } catch (error: any) {
    // Tests failed (non-zero exit)
    const duration = Date.now() - startTime;
    const { passed, failures } = parseTestOutput(error.stdout || '', error.stderr || '');

    return {
      passed: false,
      failures,
      duration,
      stdout: error.stdout || '',
      stderr: error.stderr || ''
    };
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- src/activities/__tests__/test-execution.activities.test.ts
```

Expected: PASS (all 4 tests)

**Step 5: Commit**

```bash
git add src/activities/test-execution.activities.ts src/activities/__tests__/test-execution.activities.test.ts
git commit -m "feat(activities): add runTests activity with failure parsing"
```

---

## Part 4: Turn-Based Integration Activities

### Task 4.1: Add Turn-Based Package Dependency

**Files:**
- Modify: `packages/dev-workflow/package.json`

**Step 1: Add dependency**

```bash
cd packages/dev-workflow
npm install --save file:../agents/package-builder-production
```

**Step 2: Verify imports work**

Create temporary test file:

```typescript
// temp-test.ts
import { TurnBasedCodingAgentWorkflow } from '@bernierllc/package-builder-production';
console.log('Import successful:', typeof TurnBasedCodingAgentWorkflow);
```

Run: `npx tsx temp-test.ts`
Expected: "Import successful: function"

**Step 3: Remove temp file**

```bash
rm temp-test.ts
```

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(deps): add package-builder-production for turn-based workflow"
```

---

### Task 4.2: Create Turn-Based Integration Activities (Part 1 - Task Breakdown)

**Files:**
- Create: `packages/dev-workflow/src/activities/turn-based-integration.activities.ts`
- Test: `packages/dev-workflow/src/activities/__tests__/turn-based-integration.activities.test.ts`

**Step 1: Write the failing test**

Create `packages/dev-workflow/src/activities/__tests__/turn-based-integration.activities.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { breakdownFeatureIntoTasks } from '../turn-based-integration.activities';

// Mock startChildWorkflow from Temporal
vi.mock('@temporalio/workflow', () => ({
  startChildWorkflow: vi.fn()
}));

import { startChildWorkflow } from '@temporalio/workflow';

describe('Turn-Based Integration Activities', () => {
  describe('breakdownFeatureIntoTasks', () => {
    it('should call TurnBasedCodingAgent in breakdown mode', async () => {
      // Mock workflow response
      const mockHandle = {
        result: vi.fn().mockResolvedValue({
          success: true,
          filesModified: ['tasks.json'],
          context: { sessionId: 'session-123' }
        })
      };

      (startChildWorkflow as any).mockResolvedValue(mockHandle);

      const result = await breakdownFeatureIntoTasks({
        refinedRequirement: 'Add OAuth2 authentication',
        repoPath: '/workspace/repo',
        workspaceRoot: '/workspace'
      });

      expect(startChildWorkflow).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          args: expect.arrayContaining([
            expect.objectContaining({
              task: 'breakdown-feature',
              prompt: expect.stringContaining('Add OAuth2 authentication')
            })
          ]),
          taskQueue: 'turn-based-coding'
        })
      );

      expect(result.tasks).toBeDefined();
      expect(result.sessionId).toBe('session-123');
    });

    it('should parse task list from generated files', async () => {
      // Mock workflow that generates task file
      const mockHandle = {
        result: vi.fn().mockResolvedValue({
          success: true,
          filesModified: ['task-breakdown.json'],
          context: { sessionId: 'session-456' }
        })
      };

      (startChildWorkflow as any).mockResolvedValue(mockHandle);

      // Mock file reading (will be implemented in activity)
      const mockReadFile = vi.fn().mockResolvedValue(JSON.stringify({
        tasks: [
          { id: 'task-1', name: 'Setup', dependencies: [] },
          { id: 'task-2', name: 'Implementation', dependencies: ['task-1'] }
        ]
      }));

      const result = await breakdownFeatureIntoTasks({
        refinedRequirement: 'Add feature',
        repoPath: '/workspace/repo',
        workspaceRoot: '/workspace'
      });

      expect(result.tasks).toHaveLength(2);
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- src/activities/__tests__/turn-based-integration.activities.test.ts
```

Expected: FAIL with "Cannot find module '../turn-based-integration.activities'"

**Step 3: Write minimal implementation**

Create `packages/dev-workflow/src/activities/turn-based-integration.activities.ts`:

```typescript
import { startChildWorkflow } from '@temporalio/workflow';
import { TurnBasedCodingAgentWorkflow } from '@bernierllc/package-builder-production';
import * as fs from 'fs';
import * as path from 'path';

export interface BreakdownFeatureInput {
  refinedRequirement: string;
  repoPath: string;
  workspaceRoot: string;
}

export interface Task {
  id: string;
  name: string;
  description?: string;
  dependencies: string[];
  estimatedComplexity?: string;
}

export interface TaskBreakdownResult {
  tasks: Task[];
  sessionId: string;
}

/**
 * Parse task list from generated files
 */
function parseTaskListFromGeneratedFiles(filesModified: string[], workspaceRoot: string): Task[] {
  // Look for task breakdown file
  const taskFile = filesModified.find(f => f.includes('task') || f.includes('breakdown'));

  if (taskFile) {
    try {
      const fullPath = path.join(workspaceRoot, taskFile);
      const content = fs.readFileSync(fullPath, 'utf-8');
      const data = JSON.parse(content);
      return data.tasks || [];
    } catch {
      // Fallback: return empty array if parsing fails
      return [];
    }
  }

  return [];
}

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
  const tasks = parseTaskListFromGeneratedFiles(result.filesModified, workspaceRoot);

  return {
    tasks,
    sessionId: result.context.sessionId
  };
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- src/activities/__tests__/turn-based-integration.activities.test.ts
```

Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add src/activities/turn-based-integration.activities.ts src/activities/__tests__/turn-based-integration.activities.test.ts
git commit -m "feat(activities): add breakdownFeatureIntoTasks integration"
```

---

**Due to length constraints, I'll continue the plan in the next message. This plan will include:**

- Task 4.3: Implement Task Activity
- Part 5: Slack Milestone Activities
- Part 6: DevWorkflowCoordinator Workflow
- Part 7: Integration Tests
- Part 8: E2E Tests
- Summary and next steps

**Remaining tasks to document:**
- ~15 more tasks across 4 parts
- Estimated total: 25-30 tasks

Would you like me to continue writing the complete plan, or would you prefer to start implementation with what we have so far?
