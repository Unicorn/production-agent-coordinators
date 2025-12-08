import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyFileChanges, normalizeContent, verifyFileCreated } from '../file-operations.activities';
import * as fs from 'fs/promises';
<<<<<<< HEAD
=======
import * as path from 'path';
>>>>>>> 60f2dcf (chore: commit worktree changes from Cursor IDE)

// Mock fs/promises
vi.mock('fs/promises', () => ({
  writeFile: vi.fn(),
  readFile: vi.fn(),
  mkdir: vi.fn(),
  unlink: vi.fn(),
  access: vi.fn(),
<<<<<<< HEAD
  stat: vi.fn(),
=======
>>>>>>> 60f2dcf (chore: commit worktree changes from Cursor IDE)
}));

describe('File Operations Activities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('applyFileChanges', () => {
    it('should create new files successfully', async () => {
      const result = await applyFileChanges({
        operations: [
          {
            operation: 'create',
            path: 'src/index.ts',
            content: 'export const foo = "bar";'
          }
        ],
        packagePath: 'packages/core/test',
        workspaceRoot: '/workspace'
      });

      expect(result.modifiedFiles).toEqual(['src/index.ts']);
      expect(result.failedOperations).toHaveLength(0);
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/workspace/packages/core/test/src/index.ts',
        'export const foo = "bar";',
        'utf-8'
      );
      expect(fs.mkdir).toHaveBeenCalledWith(
        '/workspace/packages/core/test/src',
        { recursive: true }
      );
    });

    it('should update existing files successfully', async () => {
      const result = await applyFileChanges({
        operations: [
          {
            operation: 'update',
            path: 'package.json',
            content: '{"name":"test"}'
          }
        ],
        packagePath: 'packages/core/test',
        workspaceRoot: '/workspace'
      });

      expect(result.modifiedFiles).toEqual(['package.json']);
      expect(result.failedOperations).toHaveLength(0);
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/workspace/packages/core/test/package.json',
        '{"name":"test"}',
        'utf-8'
      );
    });

    it('should delete files successfully', async () => {
      const result = await applyFileChanges({
        operations: [
          {
            operation: 'delete',
            path: 'old-file.ts'
          }
        ],
        packagePath: 'packages/core/test',
        workspaceRoot: '/workspace'
      });

      expect(result.modifiedFiles).toEqual(['old-file.ts']);
      expect(result.failedOperations).toHaveLength(0);
      expect(fs.unlink).toHaveBeenCalledWith('/workspace/packages/core/test/old-file.ts');
    });

    it('should handle multiple operations', async () => {
      const result = await applyFileChanges({
        operations: [
          { operation: 'create', path: 'src/new.ts', content: 'new' },
          { operation: 'update', path: 'src/existing.ts', content: 'updated' },
          { operation: 'delete', path: 'src/old.ts' }
        ],
        packagePath: 'packages/core/test',
        workspaceRoot: '/workspace'
      });

      expect(result.modifiedFiles).toEqual(['src/new.ts', 'src/existing.ts', 'src/old.ts']);
      expect(result.failedOperations).toHaveLength(0);
    });

    it('should reject path traversal with ".."', async () => {
      const result = await applyFileChanges({
        operations: [
          {
            operation: 'create',
            path: '../../../etc/passwd',
            content: 'hacked'
          }
        ],
        packagePath: 'packages/core/test',
        workspaceRoot: '/workspace'
      });

      expect(result.modifiedFiles).toHaveLength(0);
      expect(result.failedOperations).toHaveLength(1);
<<<<<<< HEAD
      expect(result.failedOperations[0].error).toContain('Path contains ".." (path traversal)');
=======
      expect(result.failedOperations[0].error).toContain('Path contains unsafe characters');
>>>>>>> 60f2dcf (chore: commit worktree changes from Cursor IDE)
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should reject absolute paths', async () => {
      const result = await applyFileChanges({
        operations: [
          {
            operation: 'create',
            path: '/etc/passwd',
            content: 'hacked'
          }
        ],
        packagePath: 'packages/core/test',
        workspaceRoot: '/workspace'
      });

      expect(result.modifiedFiles).toHaveLength(0);
      expect(result.failedOperations).toHaveLength(1);
<<<<<<< HEAD
      expect(result.failedOperations[0].error).toContain('Absolute paths not allowed');
=======
      expect(result.failedOperations[0].error).toContain('Absolute paths are not allowed');
>>>>>>> 60f2dcf (chore: commit worktree changes from Cursor IDE)
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should reject null byte injection', async () => {
      const result = await applyFileChanges({
        operations: [
          {
            operation: 'create',
            path: 'file.txt\0.exe',
            content: 'malicious'
          }
        ],
        packagePath: 'packages/core/test',
        workspaceRoot: '/workspace'
      });

      expect(result.modifiedFiles).toHaveLength(0);
      expect(result.failedOperations).toHaveLength(1);
<<<<<<< HEAD
      expect(result.failedOperations[0].error).toContain('Path contains null byte');
=======
      expect(result.failedOperations[0].error).toContain('Path contains unsafe characters');
>>>>>>> 60f2dcf (chore: commit worktree changes from Cursor IDE)
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should reject empty paths', async () => {
      const result = await applyFileChanges({
        operations: [
          {
            operation: 'create',
            path: '',
            content: 'test'
          }
        ],
        packagePath: 'packages/core/test',
        workspaceRoot: '/workspace'
      });

      expect(result.modifiedFiles).toHaveLength(0);
      expect(result.failedOperations).toHaveLength(1);
<<<<<<< HEAD
      expect(result.failedOperations[0].error).toContain('Empty path not allowed');
=======
      expect(result.failedOperations[0].error).toContain('Path cannot be empty');
>>>>>>> 60f2dcf (chore: commit worktree changes from Cursor IDE)
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should reject paths that escape package directory after normalization', async () => {
      // This tests the isPathWithinDirectory check
      const result = await applyFileChanges({
        operations: [
          {
            operation: 'create',
            path: 'foo/../../other-package/evil.ts',
            content: 'escaped'
          }
        ],
        packagePath: 'packages/core/test',
        workspaceRoot: '/workspace'
      });

      expect(result.modifiedFiles).toHaveLength(0);
      expect(result.failedOperations).toHaveLength(1);
<<<<<<< HEAD
      expect(result.failedOperations[0].error).toContain('Path contains ".." (path traversal)');
=======
      expect(result.failedOperations[0].error).toContain('Path escapes package directory');
>>>>>>> 60f2dcf (chore: commit worktree changes from Cursor IDE)
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should continue processing after failed operation', async () => {
      const result = await applyFileChanges({
        operations: [
          {
            operation: 'create',
            path: '../evil.ts',
            content: 'bad'
          },
          {
            operation: 'create',
            path: 'src/good.ts',
            content: 'good'
          }
        ],
        packagePath: 'packages/core/test',
        workspaceRoot: '/workspace'
      });

      expect(result.modifiedFiles).toEqual(['src/good.ts']);
      expect(result.failedOperations).toHaveLength(1);
      expect(result.failedOperations[0].path).toBe('../evil.ts');
      expect(fs.writeFile).toHaveBeenCalledTimes(1);
    });

    it('should handle file system errors gracefully', async () => {
      vi.mocked(fs.writeFile).mockRejectedValueOnce(new Error('Disk full'));

      const result = await applyFileChanges({
        operations: [
          {
            operation: 'create',
            path: 'src/file.ts',
            content: 'content'
          }
        ],
        packagePath: 'packages/core/test',
        workspaceRoot: '/workspace'
      });

      expect(result.modifiedFiles).toHaveLength(0);
      expect(result.failedOperations).toHaveLength(1);
      expect(result.failedOperations[0].error).toBe('Disk full');
    });

<<<<<<< HEAD
    it('should not normalize content before writing', async () => {
      // The implementation writes content as-is, no normalization
=======
    it('should normalize content before writing', async () => {
>>>>>>> 60f2dcf (chore: commit worktree changes from Cursor IDE)
      await applyFileChanges({
        operations: [
          {
            operation: 'create',
            path: 'test.ts',
            content: 'line1\r\nline2\r\nline3'
          }
        ],
        packagePath: 'packages/core/test',
        workspaceRoot: '/workspace'
      });

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
<<<<<<< HEAD
        'line1\r\nline2\r\nline3',
=======
        'line1\nline2\nline3',
>>>>>>> 60f2dcf (chore: commit worktree changes from Cursor IDE)
        'utf-8'
      );
    });

<<<<<<< HEAD
    it('should treat missing files as success when deleting', async () => {
      // Delete operations catch all errors - missing files are considered success
      vi.mocked(fs.access).mockRejectedValueOnce(new Error('ENOENT'));
=======
    it('should handle delete operation errors', async () => {
      vi.mocked(fs.unlink).mockRejectedValueOnce(new Error('File not found'));
>>>>>>> 60f2dcf (chore: commit worktree changes from Cursor IDE)

      const result = await applyFileChanges({
        operations: [
          {
            operation: 'delete',
            path: 'nonexistent.ts'
          }
        ],
        packagePath: 'packages/core/test',
        workspaceRoot: '/workspace'
      });

<<<<<<< HEAD
      // Missing file doesn't add to either array (caught and logged as "already absent")
      expect(result.modifiedFiles).toHaveLength(0);
      expect(result.failedOperations).toHaveLength(0);
=======
      expect(result.modifiedFiles).toHaveLength(0);
      expect(result.failedOperations).toHaveLength(1);
      expect(result.failedOperations[0].error).toBe('File not found');
>>>>>>> 60f2dcf (chore: commit worktree changes from Cursor IDE)
    });
  });

  describe('normalizeContent', () => {
<<<<<<< HEAD
    it('should replace CRLF with LF and add trailing newline', () => {
      const input = 'line1\r\nline2\r\nline3';
      const output = normalizeContent(input);
      expect(output).toBe('line1\nline2\nline3\n');
    });

    it('should handle mixed line endings and add trailing newline', () => {
      const input = 'line1\r\nline2\nline3\r\nline4';
      const output = normalizeContent(input);
      expect(output).toBe('line1\nline2\nline3\nline4\n');
    });

    it('should ensure single trailing newline', () => {
      const input = 'line1\nline2\nline3';
      const output = normalizeContent(input);
      expect(output).toBe('line1\nline2\nline3\n');
=======
    it('should replace CRLF with LF', () => {
      const input = 'line1\r\nline2\r\nline3';
      const output = normalizeContent(input);
      expect(output).toBe('line1\nline2\nline3');
    });

    it('should handle mixed line endings', () => {
      const input = 'line1\r\nline2\nline3\r\nline4';
      const output = normalizeContent(input);
      expect(output).toBe('line1\nline2\nline3\nline4');
    });

    it('should preserve content with only LF', () => {
      const input = 'line1\nline2\nline3';
      const output = normalizeContent(input);
      expect(output).toBe('line1\nline2\nline3');
>>>>>>> 60f2dcf (chore: commit worktree changes from Cursor IDE)
    });

    it('should handle empty content', () => {
      const output = normalizeContent('');
      expect(output).toBe('');
    });

<<<<<<< HEAD
    it('should add trailing newline to single line', () => {
      const input = 'single line';
      const output = normalizeContent(input);
      expect(output).toBe('single line\n');
    });

    it('should ensure single trailing newline when input has multiple', () => {
=======
    it('should handle content without line breaks', () => {
      const input = 'single line';
      const output = normalizeContent(input);
      expect(output).toBe('single line');
    });

    it('should preserve trailing newline', () => {
>>>>>>> 60f2dcf (chore: commit worktree changes from Cursor IDE)
      const input = 'line1\r\nline2\r\n';
      const output = normalizeContent(input);
      expect(output).toBe('line1\nline2\n');
    });
  });

  describe('verifyFileCreated', () => {
    it('should return true when file exists', async () => {
<<<<<<< HEAD
      vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true } as any);
=======
      vi.mocked(fs.access).mockResolvedValue(undefined);
>>>>>>> 60f2dcf (chore: commit worktree changes from Cursor IDE)

      const result = await verifyFileCreated('/workspace/packages/core/test/src/index.ts');

      expect(result).toBe(true);
<<<<<<< HEAD
      expect(fs.stat).toHaveBeenCalledWith('/workspace/packages/core/test/src/index.ts');
    });

    it('should return false when file does not exist', async () => {
      vi.mocked(fs.stat).mockRejectedValue(new Error('ENOENT'));
=======
      expect(fs.access).toHaveBeenCalledWith('/workspace/packages/core/test/src/index.ts');
    });

    it('should return false when file does not exist', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));
>>>>>>> 60f2dcf (chore: commit worktree changes from Cursor IDE)

      const result = await verifyFileCreated('/workspace/packages/core/test/src/missing.ts');

      expect(result).toBe(false);
    });

    it('should verify file content when expected content provided', async () => {
<<<<<<< HEAD
      vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true } as any);
=======
      vi.mocked(fs.access).mockResolvedValue(undefined);
>>>>>>> 60f2dcf (chore: commit worktree changes from Cursor IDE)
      vi.mocked(fs.readFile).mockResolvedValue('export const foo = "bar";');

      const result = await verifyFileCreated(
        '/workspace/packages/core/test/src/index.ts',
        'export const foo = "bar";'
      );

      expect(result).toBe(true);
      expect(fs.readFile).toHaveBeenCalledWith(
        '/workspace/packages/core/test/src/index.ts',
        'utf-8'
      );
    });

    it('should return false when content does not match', async () => {
<<<<<<< HEAD
      vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true } as any);
=======
      vi.mocked(fs.access).mockResolvedValue(undefined);
>>>>>>> 60f2dcf (chore: commit worktree changes from Cursor IDE)
      vi.mocked(fs.readFile).mockResolvedValue('wrong content');

      const result = await verifyFileCreated(
        '/workspace/packages/core/test/src/index.ts',
        'expected content'
      );

      expect(result).toBe(false);
    });

    it('should handle read errors when verifying content', async () => {
<<<<<<< HEAD
      vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true } as any);
=======
      vi.mocked(fs.access).mockResolvedValue(undefined);
>>>>>>> 60f2dcf (chore: commit worktree changes from Cursor IDE)
      vi.mocked(fs.readFile).mockRejectedValue(new Error('Permission denied'));

      const result = await verifyFileCreated(
        '/workspace/packages/core/test/src/index.ts',
        'expected content'
      );

      expect(result).toBe(false);
    });

    it('should skip content check when no expected content provided', async () => {
<<<<<<< HEAD
      vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true } as any);
=======
      vi.mocked(fs.access).mockResolvedValue(undefined);
>>>>>>> 60f2dcf (chore: commit worktree changes from Cursor IDE)

      const result = await verifyFileCreated('/workspace/packages/core/test/src/index.ts');

      expect(result).toBe(true);
      expect(fs.readFile).not.toHaveBeenCalled();
    });
  });
});
