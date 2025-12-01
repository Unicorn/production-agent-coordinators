/**
 * Integration Tests for File System Activities
 * 
 * Tests file system operations with real file system in isolated temp directories.
 * 
 * @see planning-standards.mdc - Testing requirements
 * @see plans/ui-compiler-activities.md - Comprehensive testing strategy
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
} from '@/lib/activities/file-system.activities';

describe('File System Activities Integration', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-fs-integration-'));
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Real File Operations', () => {
    it('should perform real file read/write operations', async () => {
      const testContent = 'Integration test content';
      const testFile = path.join(tempDir, 'test.txt');

      // Write file
      const writeResult = await writeFile({
        filePath: testFile,
        content: testContent,
      });

      expect(writeResult.success).toBe(true);

      // Read file
      const readResult = await readFile({
        filePath: testFile,
      });

      expect(readResult.success).toBe(true);
      expect(readResult.content).toBe(testContent);
    });

    it('should handle real directory operations', async () => {
      // Create nested directory structure
      await fs.mkdir(path.join(tempDir, 'level1', 'level2', 'level3'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'level1', 'level2', 'level3', 'deep.txt'), 'deep');

      const result = await listDirectory({
        directory: tempDir,
        recursive: true,
      });

      expect(result.success).toBe(true);
      expect(result.entries.length).toBeGreaterThan(0);
      
      // Find the deep file
      const deepFile = result.entries.find(e => e.name === 'deep.txt');
      expect(deepFile).toBeDefined();
    });

    it('should handle real file search operations', async () => {
      // Create test files with specific content
      await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, 'src', 'file1.ts'),
        'export function findMe() { return "found"; }'
      );
      await fs.writeFile(
        path.join(tempDir, 'src', 'file2.ts'),
        'export const other = "not found";'
      );

      const result = await searchFileContent({
        directory: tempDir,
        pattern: 'findMe',
        filePattern: '**/*.ts',
      });

      expect(result.success).toBe(true);
      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.matches.some(m => m.match.includes('findMe'))).toBe(true);
    });
  });

  describe('Real Batch Operations', () => {
    it('should perform real batch file reads', async () => {
      // Create multiple test files
      const files = ['file1.txt', 'file2.txt', 'file3.txt'];
      for (const file of files) {
        await fs.writeFile(path.join(tempDir, file), `content-${file}`);
      }

      const result = await batchReadFiles({
        files,
        baseDir: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.files.length).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.files.every(f => f.content)).toBe(true);
    });

    it('should perform real batch file writes', async () => {
      const result = await batchWriteFiles({
        operations: [
          { path: 'dir1/file1.txt', content: 'content1', operation: 'create' },
          { path: 'dir2/file2.txt', content: 'content2', operation: 'create' },
        ],
        baseDir: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.written.length).toBe(2);

      // Verify files were actually written
      const content1 = await fs.readFile(path.join(tempDir, 'dir1', 'file1.txt'), 'utf-8');
      const content2 = await fs.readFile(path.join(tempDir, 'dir2', 'file2.txt'), 'utf-8');
      expect(content1).toBe('content1');
      expect(content2).toBe('content2');
    });

    it('should handle atomic batch writes correctly', async () => {
      const result = await batchWriteFiles({
        operations: [
          { path: 'file1.txt', content: 'content1', operation: 'create' },
          { path: 'file2.txt', content: 'content2', operation: 'create' },
          { path: 'file3.txt', content: 'content3', operation: 'create' },
        ],
        baseDir: tempDir,
        atomic: true,
      });

      expect(result.success).toBe(true);
      expect(result.written.length).toBe(3);
      expect(result.failed.length).toBe(0);

      // Verify all files exist
      for (const file of result.written) {
        const exists = await fs.stat(path.join(tempDir, file))
          .then(() => true)
          .catch(() => false);
        expect(exists).toBe(true);
      }
    });
  });

  describe('Real Error Scenarios', () => {
    it('should handle real file not found errors', async () => {
      const result = await readFile({
        filePath: path.join(tempDir, 'nonexistent.txt'),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle real path traversal attempts', async () => {
      const result = await readFile({
        filePath: '../../etc/passwd',
        baseDir: tempDir,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Path traversal');
    });

    it('should handle real directory not found errors', async () => {
      const result = await listDirectory({
        directory: path.join(tempDir, 'nonexistent'),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('does not exist');
    });
  });

  describe('Real Performance', () => {
    it('should handle large directory trees efficiently', async () => {
      // Create a large directory tree
      const dirs = Array.from({ length: 10 }, (_, i) => `dir${i}`);
      const filesPerDir = 20;

      for (const dir of dirs) {
        const dirPath = path.join(tempDir, dir);
        await fs.mkdir(dirPath, { recursive: true });
        for (let i = 0; i < filesPerDir; i++) {
          await fs.writeFile(path.join(dirPath, `file${i}.txt`), `content-${i}`);
        }
      }

      const startTime = Date.now();
      const result = await findFiles({
        directory: tempDir,
        pattern: '**/*.txt',
      });
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.files.length).toBe(dirs.length * filesPerDir);
      // Should complete in reasonable time (< 5 seconds for 200 files)
      expect(duration).toBeLessThan(5000);
    });

    it('should handle large files efficiently', async () => {
      // Create a 5MB file
      const largeContent = 'x'.repeat(5 * 1024 * 1024);
      const testFile = path.join(tempDir, 'large.txt');
      await fs.writeFile(testFile, largeContent);

      const startTime = Date.now();
      const result = await readFile({
        filePath: testFile,
      });
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.content.length).toBe(largeContent.length);
      // Should complete in reasonable time (< 2 seconds for 5MB)
      expect(duration).toBeLessThan(2000);
    });
  });

  describe('Real Concurrent Operations', () => {
    it('should handle concurrent file reads', async () => {
      // Create multiple test files
      const files = Array.from({ length: 10 }, (_, i) => {
        const fileName = `file${i}.txt`;
        fs.writeFile(path.join(tempDir, fileName), `content-${i}`);
        return fileName;
      });
      await Promise.all(files);

      // Read all files concurrently
      const readPromises = files.map(file =>
        readFile({
          filePath: file,
          baseDir: tempDir,
        })
      );

      const results = await Promise.all(readPromises);

      expect(results.every(r => r.success)).toBe(true);
      expect(results.length).toBe(10);
    });

    it('should handle concurrent file writes safely', async () => {
      const writePromises = Array.from({ length: 10 }, (_, i) =>
        writeFile({
          filePath: path.join(tempDir, `concurrent${i}.txt`),
          content: `content-${i}`,
        })
      );

      const results = await Promise.all(writePromises);

      // All writes should succeed (different files)
      expect(results.every(r => r.success)).toBe(true);
      expect(results.length).toBe(10);

      // Verify all files exist
      for (let i = 0; i < 10; i++) {
        const exists = await fs.stat(path.join(tempDir, `concurrent${i}.txt`))
          .then(() => true)
          .catch(() => false);
        expect(exists).toBe(true);
      }
    });
  });
});

