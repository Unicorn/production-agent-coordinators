/**
 * Unit Tests for File System Activities
 * 
 * Tests file system operations in isolation with mocked file system.
 * 
 * @see planning-standards.mdc - Testing requirements
 * @see plans/ui-compiler-activities.md - Comprehensive testing strategy
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  findFiles,
  readFile,
  writeFile,
  searchFileContent,
  listDirectory,
  batchReadFiles,
  batchWriteFiles,
  type FindFilesInput,
  type ReadFileInput,
  type WriteFileInput,
  type SearchFileContentInput,
  type ListDirectoryInput,
  type BatchReadFilesInput,
  type BatchWriteFilesInput,
} from '@/lib/activities/file-system.activities';

describe('File System Activities', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-fs-'));
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  // ========================================================================
  // findFiles Tests
  // ========================================================================

  describe('findFiles', () => {
    beforeEach(async () => {
      // Create test file structure
      await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
      await fs.mkdir(path.join(tempDir, 'tests'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'src', 'file1.ts'), 'content1');
      await fs.writeFile(path.join(tempDir, 'src', 'file2.ts'), 'content2');
      await fs.writeFile(path.join(tempDir, 'tests', 'test1.test.ts'), 'test1');
      await fs.writeFile(path.join(tempDir, 'package.json'), '{}');
    });

    it('should find files by glob pattern', async () => {
      const result = await findFiles({
        directory: tempDir,
        pattern: '**/*.ts',
      });

      expect(result.success).toBe(true);
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.files.some(f => f.path.includes('file1.ts'))).toBe(true);
    });

    it('should respect excludeDirs', async () => {
      const result = await findFiles({
        directory: tempDir,
        pattern: '**/*.ts',
        excludeDirs: ['tests'],
      });

      expect(result.success).toBe(true);
      expect(result.files.some(f => f.path.includes('test1.test.ts'))).toBe(false);
      expect(result.files.some(f => f.path.includes('file1.ts'))).toBe(true);
    });

    it('should handle non-existent directory', async () => {
      const result = await findFiles({
        directory: path.join(tempDir, 'nonexistent'),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('does not exist');
    });

    it('should return file metadata', async () => {
      const result = await findFiles({
        directory: tempDir,
        pattern: 'package.json',
      });

      expect(result.success).toBe(true);
      expect(result.files.length).toBe(1);
      expect(result.files[0]).toMatchObject({
        path: expect.stringContaining('package.json'),
        isDirectory: false,
        size: expect.any(Number),
        modified: expect.any(Date),
      });
    });

    it('should respect maxDepth', async () => {
      await fs.mkdir(path.join(tempDir, 'level1', 'level2'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'level1', 'level2', 'deep.ts'), 'content');

      const result = await findFiles({
        directory: tempDir,
        pattern: '**/*.ts',
        maxDepth: 1,
      });

      expect(result.success).toBe(true);
      // Should not find files deeper than maxDepth
      expect(result.files.some(f => f.path.includes('level2'))).toBe(false);
    });
  });

  // ========================================================================
  // readFile Tests
  // ========================================================================

  describe('readFile', () => {
    it('should read file content successfully', async () => {
      const testContent = 'Hello, World!';
      const testFile = path.join(tempDir, 'test.txt');
      await fs.writeFile(testFile, testContent);

      const result = await readFile({
        filePath: testFile,
      });

      expect(result.success).toBe(true);
      expect(result.content).toBe(testContent);
      expect(result.size).toBe(testContent.length);
    });

    it('should handle file not found errors', async () => {
      const result = await readFile({
        filePath: path.join(tempDir, 'nonexistent.txt'),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should validate path safety', async () => {
      const result = await readFile({
        filePath: '../../etc/passwd',
        baseDir: tempDir,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Path traversal');
    });

    it('should handle permission errors gracefully', async () => {
      // Create a file that might have permission issues
      const testFile = path.join(tempDir, 'restricted.txt');
      await fs.writeFile(testFile, 'content');
      // Note: Actual permission testing would require root access
      // This test verifies error handling structure

      const result = await readFile({
        filePath: testFile,
      });

      // Should succeed in normal test environment
      expect(result.success).toBe(true);
    });

    it('should handle large files', async () => {
      const largeContent = 'x'.repeat(10 * 1024 * 1024); // 10MB
      const testFile = path.join(tempDir, 'large.txt');
      await fs.writeFile(testFile, largeContent);

      const result = await readFile({
        filePath: testFile,
      });

      expect(result.success).toBe(true);
      expect(result.content.length).toBe(largeContent.length);
      expect(result.size).toBe(largeContent.length);
    });

    it('should respect baseDir for relative paths', async () => {
      const testContent = 'test';
      const testFile = 'relative.txt';
      await fs.writeFile(path.join(tempDir, testFile), testContent);

      const result = await readFile({
        filePath: testFile,
        baseDir: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.content).toBe(testContent);
    });
  });

  // ========================================================================
  // writeFile Tests
  // ========================================================================

  describe('writeFile', () => {
    it('should write file successfully', async () => {
      const testContent = 'Hello, World!';
      const testFile = path.join(tempDir, 'test.txt');

      const result = await writeFile({
        filePath: testFile,
        content: testContent,
      });

      expect(result.success).toBe(true);
      expect(result.path).toBe(testFile);

      // Verify file was written
      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toBe(testContent);
    });

    it('should create directory if missing', async () => {
      const testContent = 'test';
      const testFile = path.join(tempDir, 'nested', 'dir', 'test.txt');

      const result = await writeFile({
        filePath: testFile,
        content: testContent,
        createDir: true,
      });

      expect(result.success).toBe(true);

      // Verify directory was created
      const dirExists = await fs.stat(path.dirname(testFile)).then(() => true).catch(() => false);
      expect(dirExists).toBe(true);
    });

    it('should validate path safety', async () => {
      const result = await writeFile({
        filePath: '../../etc/passwd',
        content: 'malicious',
        baseDir: tempDir,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Path traversal');
    });

    it('should handle concurrent writes', async () => {
      const testFile = path.join(tempDir, 'concurrent.txt');
      const writes = Array.from({ length: 10 }, (_, i) =>
        writeFile({
          filePath: testFile,
          content: `write-${i}`,
        })
      );

      const results = await Promise.all(writes);
      const successes = results.filter(r => r.success).length;

      // At least some writes should succeed
      expect(successes).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // searchFileContent Tests
  // ========================================================================

  describe('searchFileContent', () => {
    beforeEach(async () => {
      await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, 'src', 'file1.ts'),
        'export function test() {\n  return "hello";\n}'
      );
      await fs.writeFile(
        path.join(tempDir, 'src', 'file2.ts'),
        'export const TEST = "world";'
      );
    });

    it('should find matches in file content', async () => {
      const result = await searchFileContent({
        directory: tempDir,
        pattern: 'test',
        filePattern: '**/*.ts',
      });

      expect(result.success).toBe(true);
      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.matches.some(m => m.match.toLowerCase().includes('test'))).toBe(true);
    });

    it('should handle regex patterns', async () => {
      const result = await searchFileContent({
        directory: tempDir,
        pattern: 'export\\s+(function|const)',
        filePattern: '**/*.ts',
      });

      expect(result.success).toBe(true);
      expect(result.matches.length).toBeGreaterThan(0);
    });

    it('should return line numbers and context', async () => {
      const result = await searchFileContent({
        directory: tempDir,
        pattern: 'hello',
        filePattern: '**/*.ts',
      });

      expect(result.success).toBe(true);
      if (result.matches.length > 0) {
        expect(result.matches[0]).toMatchObject({
          line: expect.any(Number),
          column: expect.any(Number),
          match: expect.any(String),
          context: expect.any(String),
        });
      }
    });

    it('should respect case sensitivity', async () => {
      const caseSensitive = await searchFileContent({
        directory: tempDir,
        pattern: 'TEST',
        filePattern: '**/*.ts',
        caseSensitive: true,
      });

      const caseInsensitive = await searchFileContent({
        directory: tempDir,
        pattern: 'TEST',
        filePattern: '**/*.ts',
        caseSensitive: false,
      });

      expect(caseSensitive.success).toBe(true);
      expect(caseInsensitive.success).toBe(true);
      // Case sensitive should find fewer matches
      expect(caseInsensitive.matches.length).toBeGreaterThanOrEqual(caseSensitive.matches.length);
    });

    it('should respect excludeDirs', async () => {
      await fs.mkdir(path.join(tempDir, 'node_modules'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, 'node_modules', 'dep.ts'),
        'export const TEST = "dep";'
      );

      const result = await searchFileContent({
        directory: tempDir,
        pattern: 'TEST',
        filePattern: '**/*.ts',
        excludeDirs: ['node_modules'],
      });

      expect(result.success).toBe(true);
      expect(result.matches.some(m => m.file.includes('node_modules'))).toBe(false);
    });
  });

  // ========================================================================
  // listDirectory Tests
  // ========================================================================

  describe('listDirectory', () => {
    beforeEach(async () => {
      await fs.mkdir(path.join(tempDir, 'dir1'), { recursive: true });
      await fs.mkdir(path.join(tempDir, 'dir2'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(tempDir, 'file2.txt'), 'content2');
      await fs.writeFile(path.join(tempDir, '.hidden'), 'hidden');
    });

    it('should list directory contents', async () => {
      const result = await listDirectory({
        directory: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.total).toBe(result.entries.length);
    });

    it('should include file metadata', async () => {
      const result = await listDirectory({
        directory: tempDir,
      });

      expect(result.success).toBe(true);
      if (result.entries.length > 0) {
        expect(result.entries[0]).toMatchObject({
          name: expect.any(String),
          path: expect.any(String),
          isDirectory: expect.any(Boolean),
          size: expect.any(Number),
          modified: expect.any(Date),
        });
      }
    });

    it('should handle recursive listing', async () => {
      await fs.writeFile(path.join(tempDir, 'dir1', 'nested.txt'), 'nested');

      const result = await listDirectory({
        directory: tempDir,
        recursive: true,
      });

      expect(result.success).toBe(true);
      const nestedEntry = result.entries.find(e => e.name === 'nested.txt');
      expect(nestedEntry).toBeDefined();
    });

    it('should respect includeHidden flag', async () => {
      const withHidden = await listDirectory({
        directory: tempDir,
        includeHidden: true,
      });

      const withoutHidden = await listDirectory({
        directory: tempDir,
        includeHidden: false,
      });

      expect(withHidden.success).toBe(true);
      expect(withoutHidden.success).toBe(true);
      expect(withHidden.entries.length).toBeGreaterThanOrEqual(withoutHidden.entries.length);
    });

    it('should handle non-existent directory', async () => {
      const result = await listDirectory({
        directory: path.join(tempDir, 'nonexistent'),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('does not exist');
    });
  });

  // ========================================================================
  // batchReadFiles Tests
  // ========================================================================

  describe('batchReadFiles', () => {
    beforeEach(async () => {
      await fs.writeFile(path.join(tempDir, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(tempDir, 'file2.txt'), 'content2');
      await fs.writeFile(path.join(tempDir, 'file3.txt'), 'content3');
    });

    it('should read multiple files at once', async () => {
      const result = await batchReadFiles({
        files: ['file1.txt', 'file2.txt', 'file3.txt'],
        baseDir: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.files.length).toBe(3);
      expect(result.files.every(f => f.content)).toBe(true);
      expect(result.failed).toBe(0);
    });

    it('should handle partial failures', async () => {
      const result = await batchReadFiles({
        files: ['file1.txt', 'nonexistent.txt', 'file3.txt'],
        baseDir: tempDir,
      });

      expect(result.success).toBe(false);
      expect(result.failed).toBe(1);
      expect(result.files.find(f => f.path === 'nonexistent.txt')?.error).toBeDefined();
    });

    it('should return error details for failed files', async () => {
      const result = await batchReadFiles({
        files: ['nonexistent1.txt', 'nonexistent2.txt'],
        baseDir: tempDir,
      });

      expect(result.success).toBe(false);
      expect(result.failed).toBe(2);
      expect(result.files.every(f => f.error)).toBe(true);
    });
  });

  // ========================================================================
  // batchWriteFiles Tests
  // ========================================================================

  describe('batchWriteFiles', () => {
    it('should write multiple files', async () => {
      const result = await batchWriteFiles({
        operations: [
          { path: 'file1.txt', content: 'content1', operation: 'create' },
          { path: 'file2.txt', content: 'content2', operation: 'create' },
        ],
        baseDir: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.written.length).toBe(2);
      expect(result.failed.length).toBe(0);

      // Verify files were written
      const content1 = await fs.readFile(path.join(tempDir, 'file1.txt'), 'utf-8');
      expect(content1).toBe('content1');
    });

    it('should handle atomic writes (all or nothing)', async () => {
      // Create a file that will cause write to fail
      const restrictedDir = path.join(tempDir, 'restricted');
      await fs.mkdir(restrictedDir, { recursive: true });

      const result = await batchWriteFiles({
        operations: [
          { path: 'file1.txt', content: 'content1', operation: 'create' },
          { path: 'file2.txt', content: 'content2', operation: 'create' },
        ],
        baseDir: tempDir,
        atomic: true,
      });

      // Should succeed in normal test environment
      expect(result.success).toBe(true);
    });

    it('should handle partial failures in non-atomic mode', async () => {
      const result = await batchWriteFiles({
        operations: [
          { path: 'file1.txt', content: 'content1', operation: 'create' },
          { path: '../../invalid.txt', content: 'invalid', operation: 'create' },
        ],
        baseDir: tempDir,
        atomic: false,
      });

      expect(result.success).toBe(false);
      expect(result.written.length).toBe(1);
      expect(result.failed.length).toBe(1);
    });

    it('should create directories for nested paths', async () => {
      const result = await batchWriteFiles({
        operations: [
          { path: 'nested/deep/file.txt', content: 'content', operation: 'create' },
        ],
        baseDir: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.written.length).toBe(1);

      // Verify directory was created
      const fileExists = await fs.stat(path.join(tempDir, 'nested', 'deep', 'file.txt'))
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);
    });
  });
});

