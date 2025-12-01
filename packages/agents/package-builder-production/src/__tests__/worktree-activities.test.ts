/**
 * Tests for Git Worktree Activities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  createWorktree,
  mergeWorktrees,
  cleanupWorktrees,
} from '../activities/git.activities.js';

const execPromise = promisify(exec);

describe('Worktree Activities', () => {
  let testRepo: string;
  let testWorkspace: string;

  beforeEach(async () => {
    testWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'worktree-test-'));
    testRepo = path.join(testWorkspace, 'main-repo');
    
    // Initialize git repo
    await fs.mkdir(testRepo, { recursive: true });
    await execPromise('git init', { cwd: testRepo });
    await execPromise('git config user.name "Test User"', { cwd: testRepo });
    await execPromise('git config user.email "test@example.com"', { cwd: testRepo });
    
    // Create initial commit
    await fs.writeFile(path.join(testRepo, 'README.md'), '# Test\n', 'utf-8');
    await execPromise('git add README.md', { cwd: testRepo });
    await execPromise('git commit -m "Initial commit"', { cwd: testRepo });
  });

  afterEach(async () => {
    // Cleanup worktrees
    try {
      const { stdout } = await execPromise('git worktree list', { cwd: testRepo });
      const worktrees = stdout.split('\n').slice(1); // Skip first line
      for (const line of worktrees) {
        const match = line.match(/\[(.+)\]/);
        if (match) {
          const worktreePath = match[1].trim();
          try {
            await execPromise(`git worktree remove ${worktreePath} --force`, {
              cwd: testRepo
            });
          } catch {
            // Ignore cleanup errors
          }
        }
      }
    } catch {
      // Ignore if no worktrees
    }
    
    // Cleanup test workspace
    await fs.rm(testWorkspace, { recursive: true, force: true });
  });

  describe('createWorktree', () => {
    it('should create a new worktree with a new branch', async () => {
      const result = await createWorktree({
        repoPath: testRepo,
        branchName: 'feature/test',
        taskName: 'test-task',
      });

      expect(result.success).toBe(true);
      expect(result.worktreePath).toBeDefined();
      expect(result.branchName).toBe('feature/test');
      
      // Verify worktree exists
      const worktreeExists = await fs.access(result.worktreePath).then(() => true).catch(() => false);
      expect(worktreeExists).toBe(true);

      // Verify branch exists
      const { stdout } = await execPromise('git branch --list feature/test', { cwd: testRepo });
      expect(stdout.trim()).toContain('feature/test');
    });

    it('should copy CLAUDE.md to worktree if it exists', async () => {
      // Create CLAUDE.md in main repo
      await fs.writeFile(
        path.join(testRepo, 'CLAUDE.md'),
        '# Requirements\nTest requirements',
        'utf-8'
      );
      await execPromise('git add CLAUDE.md', { cwd: testRepo });
      await execPromise('git commit -m "Add CLAUDE.md"', { cwd: testRepo });

      const result = await createWorktree({
        repoPath: testRepo,
        branchName: 'feature/test',
        taskName: 'test-task',
      });

      expect(result.success).toBe(true);
      
      // Verify CLAUDE.md was copied
      const claudeMdPath = path.join(result.worktreePath, 'CLAUDE.md');
      const claudeMdExists = await fs.access(claudeMdPath).then(() => true).catch(() => false);
      expect(claudeMdExists).toBe(true);
    });

    it('should handle existing worktree by removing it first', async () => {
      // Create first worktree
      const result1 = await createWorktree({
        repoPath: testRepo,
        branchName: 'feature/test1',
        taskName: 'test-task',
      });

      expect(result1.success).toBe(true);

      // Create worktree with same task name (should remove old one)
      const result2 = await createWorktree({
        repoPath: testRepo,
        branchName: 'feature/test2',
        taskName: 'test-task',
      });

      expect(result2.success).toBe(true);
      expect(result2.worktreePath).toBe(result1.worktreePath);
    });
  });

  describe('mergeWorktrees', () => {
    it('should merge worktree changes back to main', async () => {
      // Create worktree
      const worktreeResult = await createWorktree({
        repoPath: testRepo,
        branchName: 'feature/test',
        taskName: 'test-task',
      });

      // Make changes in worktree
      await fs.writeFile(
        path.join(worktreeResult.worktreePath, 'test.txt'),
        'test content',
        'utf-8'
      );

      // Merge worktree
      const mergeResult = await mergeWorktrees({
        mainWorkspace: testRepo,
        worktrees: [{
          path: worktreeResult.worktreePath,
          branchName: worktreeResult.branchName,
        }],
      });

      expect(mergeResult.success).toBe(true);
      expect(mergeResult.mergedBranches).toContain('feature/test');

      // Verify changes are in main workspace
      const testFileExists = await fs.access(path.join(testRepo, 'test.txt'))
        .then(() => true)
        .catch(() => false);
      expect(testFileExists).toBe(true);
    });

    it('should handle multiple worktrees', async () => {
      // Create multiple worktrees
      const worktree1 = await createWorktree({
        repoPath: testRepo,
        branchName: 'feature/task1',
        taskName: 'task1',
      });

      const worktree2 = await createWorktree({
        repoPath: testRepo,
        branchName: 'feature/task2',
        taskName: 'task2',
      });

      // Make changes in each
      await fs.writeFile(path.join(worktree1.worktreePath, 'file1.txt'), 'content1', 'utf-8');
      await fs.writeFile(path.join(worktree2.worktreePath, 'file2.txt'), 'content2', 'utf-8');

      // Merge all worktrees
      const mergeResult = await mergeWorktrees({
        mainWorkspace: testRepo,
        worktrees: [
          { path: worktree1.worktreePath, branchName: worktree1.branchName },
          { path: worktree2.worktreePath, branchName: worktree2.branchName },
        ],
      });

      expect(mergeResult.success).toBe(true);
      expect(mergeResult.mergedBranches.length).toBe(2);
      expect(mergeResult.mergedBranches).toContain('feature/task1');
      expect(mergeResult.mergedBranches).toContain('feature/task2');
    });
  });

  describe('cleanupWorktrees', () => {
    it('should remove worktrees', async () => {
      // Create worktree
      const worktreeResult = await createWorktree({
        repoPath: testRepo,
        branchName: 'feature/test',
        taskName: 'test-task',
      });

      // Cleanup
      const cleanupResult = await cleanupWorktrees({
        mainWorkspace: testRepo,
        worktrees: [worktreeResult.worktreePath],
      });

      expect(cleanupResult.success).toBe(true);
      expect(cleanupResult.removedWorktrees).toContain(worktreeResult.worktreePath);

      // Verify worktree is removed
      const worktreeExists = await fs.access(worktreeResult.worktreePath)
        .then(() => true)
        .catch(() => false);
      expect(worktreeExists).toBe(false);
    });

    it('should remove branches when requested', async () => {
      // Create worktree
      const worktreeResult = await createWorktree({
        repoPath: testRepo,
        branchName: 'feature/test',
        taskName: 'test-task',
      });

      // Cleanup with branch removal
      const cleanupResult = await cleanupWorktrees({
        mainWorkspace: testRepo,
        worktrees: [{
          path: worktreeResult.worktreePath,
          branchName: worktreeResult.branchName,
        }],
        removeBranches: true,
      });

      expect(cleanupResult.success).toBe(true);
      expect(cleanupResult.removedBranches).toBeDefined();
      expect(cleanupResult.removedBranches).toContain('feature/test');

      // Verify branch is removed
      const { stdout } = await execPromise('git branch --list feature/test', { cwd: testRepo });
      expect(stdout.trim()).toBe('');
    });
  });
});

