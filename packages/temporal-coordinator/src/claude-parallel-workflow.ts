/**
 * Parallel Build Workflow using Git Worktrees
 * 
 * This workflow enables true parallel execution by creating isolated git worktrees
 * for independent tasks. Each worktree runs its own Claude CLI instance, allowing
 * multiple parts of a package to be built simultaneously.
 * 
 * Use cases:
 * - Large packages with independent modules (types, core, client, tests)
 * - Parallel test generation
 * - Independent feature implementation
 */

import { proxyActivities, ApplicationFailure, workflowInfo } from '@temporalio/workflow';
import type * as claudeActivities from './claude-activities';
import type * as gitActivities from '../../agents/package-builder-production/src/activities/git.activities.js';

// Activity proxies
const {
  executeClaudeAgent,
  setupClaudeWorkspace,
  runClaudeComplianceChecks,
  logClaudeAuditEntry,
} = proxyActivities<typeof claudeActivities>({
  startToCloseTimeout: '15 minutes',
  retry: {
    maximumAttempts: 1,
  },
});

const {
  createWorktree,
  mergeWorktrees,
  cleanupWorktrees,
} = proxyActivities<typeof gitActivities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    maximumAttempts: 2,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ParallelTask {
  name: string;
  branchName: string;
  instruction: string;
  model?: 'opus' | 'sonnet' | 'haiku';
  allowedTools?: string[];
}

export interface ParallelBuildWorkflowInput {
  specFileContent: string;
  requirementsFileContent: string;
  tasks: ParallelTask[];
  basePath?: string;
  createPR?: boolean;
  prConfig?: {
    title: string;
    body: string;
    labels?: string[];
  };
}

export interface ParallelBuildWorkflowResult {
  success: boolean;
  workspacePath: string;
  totalCost: number;
  taskResults: Array<{
    taskName: string;
    success: boolean;
    cost: number;
    sessionId?: string;
  }>;
  mergeResult?: {
    mergedBranches: string[];
    conflicts?: string[];
  };
  prUrl?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Workflow Implementation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parallel Build Workflow
 * 
 * Creates isolated worktrees for each task, runs Claude CLI in parallel,
 * then merges results back to main workspace.
 */
export async function ParallelBuildWorkflow(
  input: ParallelBuildWorkflowInput
): Promise<ParallelBuildWorkflowResult> {
  const {
    specFileContent,
    requirementsFileContent,
    tasks,
    basePath = '/tmp/claude-builds',
    createPR = false,
    prConfig,
  } = input;

  let totalCost = 0;
  const taskResults: ParallelBuildWorkflowResult['taskResults'] = [];
  const worktreeInfo: Array<{ path: string; branchName: string }> = [];

  // ─────────────────────────────────────────────────────────────────────────────
  // Phase 1: Setup Main Workspace
  // ─────────────────────────────────────────────────────────────────────────────

  const mainWorkspace = await setupClaudeWorkspace({
    basePath,
    requirementsContent: requirementsFileContent,
    specContent: specFileContent,
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Phase 2: Create Worktrees for Parallel Tasks
  // ─────────────────────────────────────────────────────────────────────────────

  const worktreeResults = await Promise.all(
    tasks.map(task =>
      createWorktree({
        repoPath: mainWorkspace,
        branchName: task.branchName,
        taskName: task.name,
        baseBranch: 'main',
      })
    )
  );

  // Verify all worktrees created successfully
  for (let i = 0; i < worktreeResults.length; i++) {
    const result = worktreeResults[i];
    const task = tasks[i];

    if (!result.success) {
      throw ApplicationFailure.create({
        message: `Failed to create worktree for task ${task.name}: ${result.error}`,
        type: 'WORKTREE_CREATION_FAILED',
        nonRetryable: true,
      });
    }

    worktreeInfo.push({
      path: result.worktreePath,
      branchName: result.branchName,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Phase 3: Execute Tasks in Parallel
  // ─────────────────────────────────────────────────────────────────────────────

  const executionResults = await Promise.all(
    tasks.map(async (task, index) => {
      const worktreePath = worktreeInfo[index].path;
      let sessionId: string | undefined;

      try {
        // Execute Claude agent in worktree
        const result = await executeClaudeAgent({
          instruction: task.instruction,
          workingDir: worktreePath,
          model: task.model || 'sonnet',
          allowedTools: task.allowedTools || ['Read', 'Write', 'Edit', 'Bash'],
          permissionMode: 'acceptEdits',
        });

        sessionId = result.session_id;
        totalCost += result.cost_usd;

        await logClaudeAuditEntry({
          workflow_run_id: workflowInfo().workflowId,
          step_name: `parallel_${task.name}`,
          timestamp: new Date().toISOString(),
          cost_usd: result.cost_usd,
          session_id: sessionId,
          validation_status: 'N/A',
          model_used: task.model || 'sonnet',
        });

        return {
          taskName: task.name,
          success: result.success,
          cost: result.cost_usd,
          sessionId,
        };
      } catch (error: any) {
        return {
          taskName: task.name,
          success: false,
          cost: 0,
          sessionId,
        };
      }
    })
  );

  taskResults.push(...executionResults);

  // Check if any tasks failed
  const failedTasks = taskResults.filter(r => !r.success);
  if (failedTasks.length > 0) {
    // Still try to merge successful tasks, but report failures
    console.warn(`[ParallelBuild] ${failedTasks.length} tasks failed`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Phase 4: Merge Worktrees Back to Main
  // ─────────────────────────────────────────────────────────────────────────────

  const mergeResult = await mergeWorktrees({
    mainWorkspace,
    worktrees: worktreeInfo,
    commitMessage: 'Merge parallel implementation tasks',
  });

  if (mergeResult.conflicts && mergeResult.conflicts.length > 0) {
    console.warn(`[ParallelBuild] Merge conflicts in branches: ${mergeResult.conflicts.join(', ')}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Phase 5: Run Compliance Checks on Merged Result
  // ─────────────────────────────────────────────────────────────────────────────

  const validation = await runClaudeComplianceChecks(mainWorkspace);

  await logClaudeAuditEntry({
    workflow_run_id: workflowInfo().workflowId,
    step_name: 'validation_merged',
    timestamp: new Date().toISOString(),
    cost_usd: 0,
    validation_status: validation.success ? 'pass' : 'fail',
    validation_error_type: validation.errorType,
  });

  if (!validation.success) {
    throw ApplicationFailure.create({
      message: `Merged build failed validation: ${validation.output.substring(0, 500)}`,
      type: 'VALIDATION_FAILED',
      nonRetryable: true,
      details: {
        workspacePath: mainWorkspace,
        mergeResult,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Phase 6: Cleanup Worktrees
  // ─────────────────────────────────────────────────────────────────────────────

  const cleanupResult = await cleanupWorktrees({
    mainWorkspace,
    worktrees: worktreeInfo.map(w => w.path),
    removeBranches: true,
  });

  if (!cleanupResult.success && cleanupResult.errors) {
    console.warn(`[ParallelBuild] Cleanup errors: ${cleanupResult.errors.join(', ')}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Phase 7: Create PR (Optional)
  // ─────────────────────────────────────────────────────────────────────────────

  let prUrl: string | undefined;

  if (createPR && prConfig) {
    const { gitCreateBranch, gitCommit, gitPush, gitCreatePR } = proxyActivities<typeof gitActivities>({
      startToCloseTimeout: '5 minutes',
    });

    // Create feature branch
    await gitCreateBranch({
      workspacePath: mainWorkspace,
      branchName: `parallel-build-${Date.now()}`,
      baseBranch: 'main',
    });

    // Commit merged changes
    await gitCommit({
      workspacePath: mainWorkspace,
      message: 'feat: Parallel build implementation',
    });

    // Push branch
    await gitPush({
      workspacePath: mainWorkspace,
      branch: `parallel-build-${Date.now()}`,
    });

    // Create PR
    const prResult = await gitCreatePR({
      workspacePath: mainWorkspace,
      branch: `parallel-build-${Date.now()}`,
      title: prConfig.title,
      body: prConfig.body,
      labels: prConfig.labels || ['automated', 'parallel-build'],
    });

    if (prResult.success) {
      prUrl = prResult.prUrl;
    }
  }

  return {
    success: true,
    workspacePath: mainWorkspace,
    totalCost,
    taskResults,
    mergeResult: {
      mergedBranches: mergeResult.mergedBranches,
      conflicts: mergeResult.conflicts,
    },
    prUrl,
  };
}

