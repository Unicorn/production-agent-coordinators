/**
 * Git Operations Activities - Provider-Agnostic
 *
 * These activities handle git operations (commit, push, PR creation) and work
 * regardless of whether Gemini or Claude CLI is being used. They are designed
 * to be called from any workflow that needs git operations.
 */
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
    worktrees: Array<string | {
        path: string;
        branchName: string;
    }>;
    removeBranches?: boolean;
}
export interface CleanupWorktreesResult {
    success: boolean;
    removedWorktrees: string[];
    removedBranches?: string[];
    errors?: string[];
}
/**
 * Commit changes in the workspace
 */
export declare function gitCommit(input: GitCommitInput): Promise<GitCommitResult>;
/**
 * Push changes to remote repository
 */
export declare function gitPush(input: GitPushInput): Promise<GitPushResult>;
/**
 * Create a new git branch
 */
export declare function gitCreateBranch(input: CreateBranchInput): Promise<CreateBranchResult>;
/**
 * Create a pull request using GitHub CLI (gh)
 */
export declare function gitCreatePR(input: CreatePRInput): Promise<CreatePRResult>;
/**
 * Create an isolated git worktree for parallel execution
 *
 * Worktrees allow multiple branches to be checked out simultaneously,
 * enabling true parallel execution of independent tasks.
 */
export declare function createWorktree(input: CreateWorktreeInput): Promise<CreateWorktreeResult>;
/**
 * Merge worktree changes back to main workspace
 *
 * This commits changes in each worktree, then merges the branches
 * into the main workspace.
 */
export declare function mergeWorktrees(input: MergeWorktreesInput): Promise<MergeWorktreesResult>;
/**
 * Clean up worktrees and optionally remove branches
 */
export declare function cleanupWorktrees(input: CleanupWorktreesInput): Promise<CleanupWorktreesResult>;
//# sourceMappingURL=git.activities.d.ts.map