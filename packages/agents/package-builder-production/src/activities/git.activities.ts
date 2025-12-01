/**
 * Git Operations Activities - Provider-Agnostic
 * 
 * These activities handle git operations (commit, push, PR creation) and work
 * regardless of whether Gemini or Claude CLI is being used. They are designed
 * to be called from any workflow that needs git operations.
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

const execPromise = promisify(exec);

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface GitUser {
  name: string;
  email: string;
}

export interface GitCommitInput {
  workspacePath: string;
  message: string;
  gitUser?: GitUser;
}

export interface GitCommitResult {
  success: boolean;
  duration: number;
  commitHash?: string;
  stdout: string;
  stderr?: string;
}

export interface GitPushInput {
  workspacePath: string;
  remote?: string;
  branch?: string;
  force?: boolean;
}

export interface GitPushResult {
  success: boolean;
  duration: number;
  stdout: string;
  stderr?: string;
}

export interface CreateBranchInput {
  workspacePath: string;
  branchName: string;
  baseBranch?: string;
}

export interface CreateBranchResult {
  success: boolean;
  stdout: string;
  stderr?: string;
}

export interface CreatePRInput {
  workspacePath: string;
  branch: string;
  title: string;
  body: string;
  baseBranch?: string;
  draft?: boolean;
  labels?: string[];
}

export interface CreatePRResult {
  success: boolean;
  prUrl?: string;
  prNumber?: number;
  stdout?: string;
  stderr?: string;
  error?: string;
}

export interface CreateWorktreeInput {
  repoPath: string;
  branchName: string;
  taskName: string;
  baseBranch?: string;
}

export interface CreateWorktreeResult {
  success: boolean;
  worktreePath: string;
  branchName: string;
  stdout?: string;
  stderr?: string;
  error?: string;
}

export interface MergeWorktreesInput {
  mainWorkspace: string;
  worktrees: Array<{
    path: string;
    branchName: string;
  }>;
  commitMessage?: string;
}

export interface MergeWorktreesResult {
  success: boolean;
  mergedBranches: string[];
  conflicts?: string[];
  stdout?: string;
  stderr?: string;
  error?: string;
}

export interface CleanupWorktreesInput {
  mainWorkspace: string;
  worktrees: Array<string | { path: string; branchName: string }>;
  removeBranches?: boolean;
}

export interface CleanupWorktreesResult {
  success: boolean;
  removedWorktrees: string[];
  removedBranches?: string[];
  errors?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Git Commit
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Commit changes in the workspace
 */
export async function gitCommit(input: GitCommitInput): Promise<GitCommitResult> {
  const startTime = Date.now();
  const { workspacePath, message, gitUser } = input;

  try {
    // Configure git user if provided
    if (gitUser) {
      await execPromise(
        `git config user.name "${gitUser.name}"`,
        { cwd: workspacePath }
      );
      await execPromise(
        `git config user.email "${gitUser.email}"`,
        { cwd: workspacePath }
      );
    }

    // Initialize git repo if needed
    try {
      await execPromise('git rev-parse --git-dir', { cwd: workspacePath });
    } catch {
      await execPromise('git init', { cwd: workspacePath });
    }

    // Stage all changes
    await execPromise('git add -A', { cwd: workspacePath });

    // Check if there are changes to commit
    const { stdout: statusOut } = await execPromise(
      'git status --porcelain',
      { cwd: workspacePath }
    );

    if (!statusOut.trim()) {
      return {
        success: true,
        duration: Date.now() - startTime,
        stdout: 'No changes to commit'
      };
    }

    // Commit with message
    const { stdout } = await execPromise(
      `git commit -m "${message.replace(/"/g, '\\"')}"`,
      { cwd: workspacePath }
    );

    // Get commit hash
    const { stdout: hashOut } = await execPromise(
      'git rev-parse HEAD',
      { cwd: workspacePath }
    );

    return {
      success: true,
      duration: Date.now() - startTime,
      commitHash: hashOut.trim(),
      stdout
    };
  } catch (error: any) {
    return {
      success: false,
      duration: Date.now() - startTime,
      stdout: error.stdout || '',
      stderr: error.stderr || error.message
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Git Push
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Push changes to remote repository
 */
export async function gitPush(input: GitPushInput): Promise<GitPushResult> {
  const startTime = Date.now();
  const { workspacePath, remote = 'origin', branch = 'main', force = false } = input;

  try {
    // Check if we have commits to push
    const { stdout: statusOut } = await execPromise(
      `git status -sb`,
      { cwd: workspacePath }
    );

    console.log(`[GitPush] Status: ${statusOut.trim()}`);

    // Push to remote
    const forceFlag = force ? '--force' : '';
    const { stdout, stderr } = await execPromise(
      `git push ${forceFlag} ${remote} ${branch}`.trim(),
      { cwd: workspacePath }
    );

    return {
      success: true,
      duration: Date.now() - startTime,
      stdout,
      stderr
    };
  } catch (error: any) {
    return {
      success: false,
      duration: Date.now() - startTime,
      stdout: error.stdout || '',
      stderr: error.stderr || error.message
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Create Branch
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new git branch
 */
export async function gitCreateBranch(input: CreateBranchInput): Promise<CreateBranchResult> {
  const { workspacePath, branchName, baseBranch } = input;

  try {
    // If base branch specified, checkout first
    if (baseBranch) {
      await execPromise(`git checkout ${baseBranch}`, { cwd: workspacePath });
    }

    // Create and checkout new branch
    const { stdout, stderr } = await execPromise(
      `git checkout -b ${branchName}`,
      { cwd: workspacePath }
    );

    return {
      success: true,
      stdout,
      stderr
    };
  } catch (error: any) {
    return {
      success: false,
      stdout: error.stdout || '',
      stderr: error.stderr || error.message
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Create Pull Request
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a pull request using GitHub CLI (gh)
 */
export async function gitCreatePR(input: CreatePRInput): Promise<CreatePRResult> {
  const {
    workspacePath,
    branch,
    title,
    body,
    baseBranch = 'main',
    draft = false,
    labels = []
  } = input;

  try {
    // Escape double quotes in title and body
    const escapedTitle = title.replace(/"/g, '\\"');
    const escapedBody = body.replace(/"/g, '\\"');

    // Build gh pr create command
    const draftFlag = draft ? '--draft' : '';
    const labelsFlag = labels.length > 0 ? `--label "${labels.join('","')}"` : '';
    
    const command = [
      'gh pr create',
      `--base ${baseBranch}`,
      `--head ${branch}`,
      `--title "${escapedTitle}"`,
      `--body "${escapedBody}"`,
      draftFlag,
      labelsFlag
    ].filter(Boolean).join(' ');

    const { stdout, stderr } = await execPromise(command, {
      cwd: workspacePath,
      env: { ...process.env }
    });

    // Parse PR URL from output (gh returns URL on success)
    const prUrl = stdout.trim();
    const prNumberMatch = prUrl.match(/\/pull\/(\d+)/);
    const prNumber = prNumberMatch ? parseInt(prNumberMatch[1], 10) : undefined;

    return {
      success: true,
      prUrl,
      prNumber,
      stdout,
      stderr
    };
  } catch (error: any) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stdout: error.stdout || '',
      stderr: error.stderr || ''
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Git Worktree Operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create an isolated git worktree for parallel execution
 * 
 * Worktrees allow multiple branches to be checked out simultaneously,
 * enabling true parallel execution of independent tasks.
 */
export async function createWorktree(
  input: CreateWorktreeInput
): Promise<CreateWorktreeResult> {
  const { repoPath, branchName, taskName, baseBranch } = input;

  try {
    // Ensure repo is initialized
    try {
      await execPromise('git rev-parse --git-dir', { cwd: repoPath });
    } catch {
      await execPromise('git init', { cwd: repoPath });
      // Create initial commit if needed
      try {
        await execPromise('git rev-parse HEAD', { cwd: repoPath });
      } catch {
        await fs.writeFile(path.join(repoPath, '.gitkeep'), '', 'utf-8');
        await execPromise('git add .gitkeep', { cwd: repoPath });
        await execPromise('git commit -m "Initial commit"', { cwd: repoPath });
      }
    }

    // Create worktree path (sibling to main repo)
    const repoDir = path.dirname(repoPath);
    const worktreePath = path.join(repoDir, `build-${taskName}`);

    // Check if worktree already exists
    try {
      await fs.access(worktreePath);
      // Worktree exists, remove it first
      await execPromise(`git worktree remove ${worktreePath} --force`, {
        cwd: repoPath
      });
    } catch {
      // Worktree doesn't exist, that's fine
    }

    // Create worktree with new branch
    const baseBranchFlag = baseBranch ? `-b ${branchName} ${baseBranch}` : `-b ${branchName}`;
    const { stdout, stderr } = await execPromise(
      `git worktree add ${worktreePath} ${baseBranchFlag}`,
      { cwd: repoPath }
    );

    // Copy CLAUDE.md to worktree if it exists (shared requirements)
    const claudeMdPath = path.join(repoPath, 'CLAUDE.md');
    try {
      await fs.access(claudeMdPath);
      await fs.copyFile(claudeMdPath, path.join(worktreePath, 'CLAUDE.md'));
    } catch {
      // CLAUDE.md doesn't exist, that's fine
    }

    return {
      success: true,
      worktreePath,
      branchName,
      stdout,
      stderr
    };
  } catch (error: any) {
    return {
      success: false,
      worktreePath: '',
      branchName,
      error: error instanceof Error ? error.message : 'Unknown error',
      stdout: error.stdout || '',
      stderr: error.stderr || ''
    };
  }
}

/**
 * Merge worktree changes back to main workspace
 * 
 * This commits changes in each worktree, then merges the branches
 * into the main workspace.
 */
export async function mergeWorktrees(
  input: MergeWorktreesInput
): Promise<MergeWorktreesResult> {
  const { mainWorkspace, worktrees, commitMessage } = input;
  const mergedBranches: string[] = [];
  const conflicts: string[] = [];

  try {
    // Ensure main workspace is on the correct branch
    const { stdout: currentBranch } = await execPromise(
      'git branch --show-current',
      { cwd: mainWorkspace }
    );
    const mainBranch = currentBranch.trim() || 'main';

    // Commit changes in each worktree
    for (const worktree of worktrees) {
      try {
        // Check if there are changes to commit
        const { stdout: statusOut } = await execPromise(
          'git status --porcelain',
          { cwd: worktree.path }
        );

        if (statusOut.trim()) {
          // Stage all changes
          await execPromise('git add -A', { cwd: worktree.path });

          // Commit with message
          const message = commitMessage || `Implementation from ${worktree.branchName}`;
          await execPromise(
            `git commit -m "${message.replace(/"/g, '\\"')}"`,
            { cwd: worktree.path }
          );
        }

        // Switch to main workspace and merge
        await execPromise(`git checkout ${mainBranch}`, { cwd: mainWorkspace });

        // Merge the branch
        try {
          await execPromise(
            `git merge ${worktree.branchName} --no-edit`,
            { cwd: mainWorkspace }
          );
          mergedBranches.push(worktree.branchName);
        } catch (mergeError: any) {
          // Check if it's a merge conflict
          if (mergeError.stderr?.includes('CONFLICT') || mergeError.stderr?.includes('conflict')) {
            conflicts.push(worktree.branchName);
            // Abort merge to keep workspace clean
            try {
              await execPromise('git merge --abort', { cwd: mainWorkspace });
            } catch {
              // Ignore abort errors
            }
          } else {
            throw mergeError;
          }
        }
      } catch (error: any) {
        console.error(`[MergeWorktrees] Error merging ${worktree.branchName}:`, error);
        conflicts.push(worktree.branchName);
      }
    }

    return {
      success: conflicts.length === 0,
      mergedBranches,
      conflicts: conflicts.length > 0 ? conflicts : undefined
    };
  } catch (error: any) {
    return {
      success: false,
      mergedBranches,
      conflicts,
      error: error instanceof Error ? error.message : 'Unknown error',
      stdout: error.stdout || '',
      stderr: error.stderr || ''
    };
  }
}

/**
 * Clean up worktrees and optionally remove branches
 */
export async function cleanupWorktrees(
  input: CleanupWorktreesInput
): Promise<CleanupWorktreesResult> {
  const { mainWorkspace, worktrees, removeBranches = false } = input;
  const removedWorktrees: string[] = [];
  const removedBranches: string[] = [];
  const errors: string[] = [];

  try {
    const branchNamesToRemove: string[] = [];

    for (const worktree of worktrees) {
      const worktreePath = typeof worktree === 'string' ? worktree : worktree.path;
      const branchName = typeof worktree === 'string' ? undefined : worktree.branchName;

      try {
        // Remove worktree
        await execPromise(`git worktree remove ${worktreePath} --force`, {
          cwd: mainWorkspace
        });
        removedWorktrees.push(worktreePath);

        // Collect branch name for removal if provided
        if (removeBranches && branchName) {
          branchNamesToRemove.push(branchName);
        }
      } catch (error: any) {
        errors.push(`Failed to remove worktree ${worktreePath}: ${error.message}`);
      }
    }

    // Optionally remove branches
    if (removeBranches && branchNamesToRemove.length > 0) {
      for (const branchName of branchNamesToRemove) {
        try {
          // Check if branch exists
          const { stdout } = await execPromise(
            `git branch --list ${branchName}`,
            { cwd: mainWorkspace }
          );

          if (stdout.trim()) {
            await execPromise(`git branch -D ${branchName}`, {
              cwd: mainWorkspace
            });
            removedBranches.push(branchName);
          }
        } catch (error: any) {
          errors.push(`Failed to remove branch ${branchName}: ${error.message}`);
        }
      }
    }

    return {
      success: errors.length === 0,
      removedWorktrees,
      removedBranches: removedBranches.length > 0 ? removedBranches : undefined,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error: any) {
    return {
      success: false,
      removedWorktrees,
      removedBranches,
      errors: [error instanceof Error ? error.message : 'Unknown error']
    };
  }
}

