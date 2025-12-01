/**
 * Integration Tests for Git Activities
 * 
 * Tests git operations with real git repositories in isolated environments.
 * 
 * @see planning-standards.mdc - Testing requirements
 * @see plans/ui-compiler-activities.md - Comprehensive testing strategy
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  gitStatus,
  gitDiff,
  createTag,
  listBranches,
  type GitStatusInput,
  type GitDiffInput,
  type CreateTagInput,
  type ListBranchesInput,
} from '@/lib/activities/git.activities';

describe('Git Activities - Integration', () => {
  let tempDir: string;
  let gitRepoDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-git-int-'));
    gitRepoDir = path.join(tempDir, 'test-repo');
    await fs.mkdir(gitRepoDir, { recursive: true });

    // Initialize git repository
    execSync('git init', { cwd: gitRepoDir });
    execSync('git config user.name "Test User"', { cwd: gitRepoDir });
    execSync('git config user.email "test@example.com"', { cwd: gitRepoDir });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  // ========================================================================
  // Real Git Status Tests
  // ========================================================================

  describe('gitStatus - Real Execution', () => {
    it('should detect clean repository', async () => {
      const result = await gitStatus({
        workspacePath: gitRepoDir,
      });

      expect(result.success).toBe(true);
      expect(result.isClean).toBe(true);
      expect(result.hasChanges).toBe(false);
    });

    it('should detect staged files', async () => {
      // Create and stage a file
      await fs.writeFile(path.join(gitRepoDir, 'test.txt'), 'test content');
      execSync('git add test.txt', { cwd: gitRepoDir });

      const result = await gitStatus({
        workspacePath: gitRepoDir,
      });

      expect(result.success).toBe(true);
      expect(result.hasChanges).toBe(true);
      expect(result.stagedFiles.length).toBeGreaterThan(0);
    });

    it('should detect unstaged files', async () => {
      // Create initial commit first
      await fs.writeFile(path.join(gitRepoDir, 'initial.txt'), 'initial');
      execSync('git add initial.txt', { cwd: gitRepoDir });
      execSync('git commit -m "Initial commit"', { cwd: gitRepoDir });

      // Create a file and modify it but don't stage it
      await fs.writeFile(path.join(gitRepoDir, 'test.txt'), 'test content');
      execSync('git add test.txt', { cwd: gitRepoDir });
      execSync('git commit -m "Add test"', { cwd: gitRepoDir });
      
      // Now modify it without staging
      await fs.writeFile(path.join(gitRepoDir, 'test.txt'), 'modified content');

      const result = await gitStatus({
        workspacePath: gitRepoDir,
      });

      expect(result.success).toBe(true);
      expect(result.hasChanges).toBe(true);
      expect(result.unstagedFiles.length).toBeGreaterThan(0);
    });

    it('should detect untracked files', async () => {
      // Create an untracked file
      await fs.writeFile(path.join(gitRepoDir, 'newfile.txt'), 'new content');

      const result = await gitStatus({
        workspacePath: gitRepoDir,
        short: true,
      });

      expect(result.success).toBe(true);
      expect(result.hasChanges).toBe(true);
      expect(result.untrackedFiles.length).toBeGreaterThan(0);
    });

    it('should return error for non-git directory', async () => {
      const nonGitDir = path.join(tempDir, 'not-a-repo');
      await fs.mkdir(nonGitDir, { recursive: true });

      const result = await gitStatus({
        workspacePath: nonGitDir,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Not a git repository');
    });
  });

  // ========================================================================
  // Real Git Diff Tests
  // ========================================================================

  describe('gitDiff - Real Execution', () => {
    it('should get diff for working directory changes', async () => {
      // Create initial commit
      await fs.writeFile(path.join(gitRepoDir, 'file.txt'), 'original');
      execSync('git add file.txt', { cwd: gitRepoDir });
      execSync('git commit -m "Initial commit"', { cwd: gitRepoDir });

      // Modify file
      await fs.writeFile(path.join(gitRepoDir, 'file.txt'), 'modified');

      const result = await gitDiff({
        workspacePath: gitRepoDir,
      });

      expect(result.success).toBe(true);
      expect(result.diff).toContain('file.txt');
      expect(result.filesChanged).toBeGreaterThan(0);
    });

    it('should get diff stats', async () => {
      // Create initial commit
      await fs.writeFile(path.join(gitRepoDir, 'file.txt'), 'line1\nline2');
      execSync('git add file.txt', { cwd: gitRepoDir });
      execSync('git commit -m "Initial commit"', { cwd: gitRepoDir });

      // Modify file
      await fs.writeFile(path.join(gitRepoDir, 'file.txt'), 'line1\nline2\nline3');

      const result = await gitDiff({
        workspacePath: gitRepoDir,
        stat: true,
      });

      expect(result.success).toBe(true);
      expect(result.filesChanged).toBe(1);
      expect(result.insertions).toBeGreaterThanOrEqual(0);
    });

    it('should get diff between commits', async () => {
      // Create initial commit
      await fs.writeFile(path.join(gitRepoDir, 'file.txt'), 'v1');
      execSync('git add file.txt', { cwd: gitRepoDir });
      execSync('git commit -m "v1"', { cwd: gitRepoDir });
      const commit1 = execSync('git rev-parse HEAD', { cwd: gitRepoDir, encoding: 'utf-8' }).trim();

      // Create second commit
      await fs.writeFile(path.join(gitRepoDir, 'file.txt'), 'v2');
      execSync('git add file.txt', { cwd: gitRepoDir });
      execSync('git commit -m "v2"', { cwd: gitRepoDir });
      const commit2 = execSync('git rev-parse HEAD', { cwd: gitRepoDir, encoding: 'utf-8' }).trim();

      const result = await gitDiff({
        workspacePath: gitRepoDir,
        commit1,
        commit2,
      });

      expect(result.success).toBe(true);
      expect(result.diff).toBeDefined();
    });

    it('should get diff for specific file', async () => {
      // Create initial commit
      await fs.writeFile(path.join(gitRepoDir, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(gitRepoDir, 'file2.txt'), 'content2');
      execSync('git add .', { cwd: gitRepoDir });
      execSync('git commit -m "Initial"', { cwd: gitRepoDir });

      // Modify only one file
      await fs.writeFile(path.join(gitRepoDir, 'file1.txt'), 'modified');

      const result = await gitDiff({
        workspacePath: gitRepoDir,
        filePath: 'file1.txt',
      });

      expect(result.success).toBe(true);
      expect(result.diff).toContain('file1.txt');
    });
  });

  // ========================================================================
  // Real Create Tag Tests
  // ========================================================================

  describe('createTag - Real Execution', () => {
    beforeEach(async () => {
      // Create initial commit (tags need at least one commit)
      await fs.writeFile(path.join(gitRepoDir, 'file.txt'), 'content');
      execSync('git add file.txt', { cwd: gitRepoDir });
      execSync('git commit -m "Initial commit"', { cwd: gitRepoDir });
    });

    it('should create annotated tag with message', async () => {
      const result = await createTag({
        workspacePath: gitRepoDir,
        tagName: 'v1.0.0',
        message: 'Release version 1.0.0',
        annotated: true,
      });

      expect(result.success).toBe(true);
      expect(result.tagName).toBe('v1.0.0');

      // Verify tag exists
      const tags = execSync('git tag', { cwd: gitRepoDir, encoding: 'utf-8' });
      expect(tags).toContain('v1.0.0');
    });

    it('should create lightweight tag', async () => {
      const result = await createTag({
        workspacePath: gitRepoDir,
        tagName: 'v1.0.0-light',
        annotated: false,
      });

      expect(result.success).toBe(true);

      // Verify tag exists
      const tags = execSync('git tag', { cwd: gitRepoDir, encoding: 'utf-8' });
      expect(tags).toContain('v1.0.0-light');
    });

    it('should create tag at specific commit', async () => {
      // Get the initial commit hash before creating second commit
      const initialCommitHash = execSync('git rev-parse HEAD', { cwd: gitRepoDir, encoding: 'utf-8' }).trim();
      
      // Create second commit
      await fs.writeFile(path.join(gitRepoDir, 'file2.txt'), 'content2');
      execSync('git add file2.txt', { cwd: gitRepoDir });
      execSync('git commit -m "Second commit"', { cwd: gitRepoDir });
      
      // Verify we now have 2 commits
      const currentHead = execSync('git rev-parse HEAD', { cwd: gitRepoDir, encoding: 'utf-8' }).trim();
      const previousCommit = execSync('git rev-parse HEAD~1', { cwd: gitRepoDir, encoding: 'utf-8' }).trim();
      expect(previousCommit).toBe(initialCommitHash);

      const result = await createTag({
        workspacePath: gitRepoDir,
        tagName: 'v0.9.0',
        commitHash: previousCommit,
      });

      expect(result.success).toBe(true);

      // Verify tag points to correct commit
      const tagCommit = execSync('git rev-parse v0.9.0', { cwd: gitRepoDir, encoding: 'utf-8' }).trim();
      expect(tagCommit).toBe(previousCommit);
    });

    it('should handle duplicate tag creation', async () => {
      // Create tag first time
      await createTag({
        workspacePath: gitRepoDir,
        tagName: 'v1.0.0',
      });

      // Try to create again
      const result = await createTag({
        workspacePath: gitRepoDir,
        tagName: 'v1.0.0',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ========================================================================
  // Real List Branches Tests
  // ========================================================================

  describe('listBranches - Real Execution', () => {
    beforeEach(async () => {
      // Create initial commit
      await fs.writeFile(path.join(gitRepoDir, 'file.txt'), 'content');
      execSync('git add file.txt', { cwd: gitRepoDir });
      execSync('git commit -m "Initial commit"', { cwd: gitRepoDir });
    });

    it('should list local branches', async () => {
      const result = await listBranches({
        workspacePath: gitRepoDir,
      });

      expect(result.success).toBe(true);
      expect(result.branches.length).toBeGreaterThan(0);
      expect(result.currentBranch).toBeDefined();
    });

    it('should identify current branch', async () => {
      const result = await listBranches({
        workspacePath: gitRepoDir,
      });

      expect(result.success).toBe(true);
      const currentBranch = result.branches.find(b => b.isCurrent);
      expect(currentBranch).toBeDefined();
      expect(currentBranch?.name).toBe(result.currentBranch);
    });

    it('should list branches with commit info', async () => {
      const result = await listBranches({
        workspacePath: gitRepoDir,
      });

      expect(result.success).toBe(true);
      expect(result.branches.length).toBeGreaterThan(0);
      result.branches.forEach(branch => {
        expect(branch.lastCommit).toBeDefined();
        expect(branch.lastCommit.length).toBeGreaterThan(0);
      });
    });

    it('should create and list new branch', async () => {
      // Create new branch
      execSync('git checkout -b feature/test', { cwd: gitRepoDir });

      const result = await listBranches({
        workspacePath: gitRepoDir,
      });

      expect(result.success).toBe(true);
      const featureBranch = result.branches.find(b => b.name === 'feature/test');
      expect(featureBranch).toBeDefined();
      expect(featureBranch?.isCurrent).toBe(true);
    });

    it('should return error for non-git directory', async () => {
      const nonGitDir = path.join(tempDir, 'not-a-repo');
      await fs.mkdir(nonGitDir, { recursive: true });

      const result = await listBranches({
        workspacePath: nonGitDir,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Not a git repository');
    });
  });
});

