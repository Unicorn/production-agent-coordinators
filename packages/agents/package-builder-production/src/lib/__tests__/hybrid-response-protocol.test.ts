/**
 * Tests for Hybrid Response Protocol
 *
 * These tests validate the parser and file operations for the hybrid
 * JSON + content block format used by AI agents.
 */

import { vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  parseHybridResponse,
  extractContentBlocks,
  applyFileOperations,
  validateOperationsHaveContent,
  hasContentRequiringActions,
  generateProtocolInstructions,
  createContentBreak,
  FileOperation,
  CONTENT_BREAK_PREFIX,
  CONTENT_BREAK_SUFFIX
} from '../hybrid-response-protocol.js';

describe('hybrid-response-protocol', () => {
  // =========================================================================
  // parseHybridResponse Tests
  // =========================================================================

  describe('parseHybridResponse', () => {
    it('should parse a simple response with one file', () => {
      const response = `
{
  "command": "APPLY_CODE_CHANGES",
  "files": [
    { "index": 0, "path": "src/index.ts", "action": "CREATE_OR_OVERWRITE" }
  ]
}

##---Content-Break-0---##
export const hello = "world";
`;

      const result = parseHybridResponse(response);

      expect(result.json).toEqual({
        command: 'APPLY_CODE_CHANGES',
        files: [
          { index: 0, path: 'src/index.ts', action: 'CREATE_OR_OVERWRITE' }
        ]
      });
      expect(result.contentBlocks.size).toBe(1);
      expect(result.contentBlocks.get(0)).toBe('export const hello = "world";');
      expect(result.warnings).toHaveLength(0);
    });

    it('should parse response with multiple files', () => {
      const response = `
{
  "command": "APPLY_CODE_CHANGES",
  "files": [
    { "index": 0, "path": "src/index.ts", "action": "CREATE_OR_OVERWRITE" },
    { "index": 1, "path": "src/utils.ts", "action": "INSERT_AT", "line": 10 }
  ]
}

##---Content-Break-0---##
// index.ts content
export const x = 1;

##---Content-Break-1---##
// utils.ts content to insert
function helper() {
  return true;
}
`;

      const result = parseHybridResponse(response);

      expect(result.json.files).toHaveLength(2);
      expect(result.contentBlocks.size).toBe(2);
      expect(result.contentBlocks.get(0)).toContain('export const x = 1');
      expect(result.contentBlocks.get(1)).toContain('function helper()');
    });

    it('should parse response with DELETE action (no content block)', () => {
      const response = `
{
  "command": "APPLY_CODE_CHANGES",
  "files": [
    { "index": 0, "path": "src/index.ts", "action": "CREATE_OR_OVERWRITE" },
    { "index": 1, "path": "old-file.ts", "action": "DELETE" }
  ]
}

##---Content-Break-0---##
export const newContent = true;
`;

      const result = parseHybridResponse(response);

      expect(result.json.files).toHaveLength(2);
      expect(result.contentBlocks.size).toBe(1);
      expect(result.contentBlocks.has(0)).toBe(true);
      expect(result.contentBlocks.has(1)).toBe(false);
    });

    it('should parse JSON-only response (no content blocks)', () => {
      const response = `
{
  "command": "RUN_LINT_CHECK"
}
`;

      const result = parseHybridResponse(response);

      expect(result.json).toEqual({ command: 'RUN_LINT_CHECK' });
      expect(result.contentBlocks.size).toBe(0);
    });

    it('should handle markdown-wrapped JSON', () => {
      const response = `
\`\`\`json
{
  "command": "VALIDATE_PACKAGE_JSON"
}
\`\`\`
`;

      const result = parseHybridResponse(response);

      expect(result.json).toEqual({ command: 'VALIDATE_PACKAGE_JSON' });
    });

    it('should throw on invalid JSON', () => {
      const response = `{ invalid json }`;

      expect(() => parseHybridResponse(response)).toThrow('Failed to parse JSON');
    });

    it('should use jsonRepairFn when provided and JSON is invalid', () => {
      const response = `{ "command": "TEST", }`;  // Trailing comma - invalid

      const mockRepair = vi.fn().mockReturnValue('{ "command": "TEST" }');

      const result = parseHybridResponse(response, {
        attemptJsonRepair: true,
        jsonRepairFn: mockRepair
      });

      expect(mockRepair).toHaveBeenCalled();
      expect(result.json).toEqual({ command: 'TEST' });
      expect(result.warnings).toContain('JSON was malformed and required repair');
    });

    it('should preserve multi-line content in blocks', () => {
      const multiLineContent = `function example() {
  const a = 1;
  const b = 2;
  return a + b;
}`;

      const response = `
{
  "command": "APPLY_CODE_CHANGES",
  "files": [{ "index": 0, "path": "test.ts", "action": "CREATE_OR_OVERWRITE" }]
}

##---Content-Break-0---##
${multiLineContent}
`;

      const result = parseHybridResponse(response);

      expect(result.contentBlocks.get(0)).toBe(multiLineContent);
    });
  });

  // =========================================================================
  // extractContentBlocks Tests
  // =========================================================================

  describe('extractContentBlocks', () => {
    it('should extract single content block', () => {
      const content = `
##---Content-Break-0---##
Hello World
`;

      const blocks = extractContentBlocks(content);

      expect(blocks.size).toBe(1);
      expect(blocks.get(0)).toBe('Hello World');
    });

    it('should extract multiple content blocks', () => {
      const content = `
##---Content-Break-0---##
First block

##---Content-Break-1---##
Second block

##---Content-Break-2---##
Third block
`;

      const blocks = extractContentBlocks(content);

      expect(blocks.size).toBe(3);
      expect(blocks.get(0)).toBe('First block');
      expect(blocks.get(1)).toBe('Second block');
      expect(blocks.get(2)).toBe('Third block');
    });

    it('should handle non-sequential indices', () => {
      const content = `
##---Content-Break-0---##
Zero

##---Content-Break-5---##
Five

##---Content-Break-2---##
Two
`;

      const blocks = extractContentBlocks(content);

      expect(blocks.size).toBe(3);
      expect(blocks.get(0)).toBe('Zero');
      expect(blocks.get(5)).toBe('Five');
      expect(blocks.get(2)).toBe('Two');
    });

    it('should return empty map for empty input', () => {
      const blocks = extractContentBlocks('');

      expect(blocks.size).toBe(0);
    });

    it('should return empty map for whitespace-only input', () => {
      const blocks = extractContentBlocks('   \n\n   ');

      expect(blocks.size).toBe(0);
    });
  });

  // =========================================================================
  // applyFileOperations Tests
  // =========================================================================

  describe('applyFileOperations', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hybrid-protocol-test-'));
    });

    afterEach(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('should CREATE_OR_OVERWRITE a new file', async () => {
      const operations: FileOperation[] = [
        { index: 0, path: 'test.ts', action: 'CREATE_OR_OVERWRITE' }
      ];
      const contentBlocks = new Map([[0, 'export const x = 1;']]);

      const result = await applyFileOperations(operations, contentBlocks, {
        basePath: tempDir
      });

      expect(result.filesModified).toContain('test.ts');
      expect(result.errors).toHaveLength(0);

      const content = await fs.readFile(path.join(tempDir, 'test.ts'), 'utf-8');
      expect(content).toBe('export const x = 1;');
    });

    it('should CREATE_OR_OVERWRITE and create parent directories', async () => {
      const operations: FileOperation[] = [
        { index: 0, path: 'src/nested/deep/file.ts', action: 'CREATE_OR_OVERWRITE' }
      ];
      const contentBlocks = new Map([[0, 'nested content']]);

      const result = await applyFileOperations(operations, contentBlocks, {
        basePath: tempDir,
        createDirectories: true
      });

      expect(result.filesModified).toContain('src/nested/deep/file.ts');

      const content = await fs.readFile(path.join(tempDir, 'src/nested/deep/file.ts'), 'utf-8');
      expect(content).toBe('nested content');
    });

    it('should INSERT_AT a specific line', async () => {
      // Create existing file
      await fs.writeFile(path.join(tempDir, 'existing.ts'), 'line0\nline1\nline2\nline3', 'utf-8');

      const operations: FileOperation[] = [
        { index: 0, path: 'existing.ts', action: 'INSERT_AT', line: 2 }
      ];
      const contentBlocks = new Map([[0, 'inserted']]);

      const result = await applyFileOperations(operations, contentBlocks, {
        basePath: tempDir
      });

      expect(result.filesModified).toContain('existing.ts');

      const content = await fs.readFile(path.join(tempDir, 'existing.ts'), 'utf-8');
      const lines = content.split('\n');
      expect(lines[2]).toBe('inserted');
      expect(lines).toHaveLength(5);
    });

    it('should REPLACE_LINES in range', async () => {
      // Create existing file
      await fs.writeFile(path.join(tempDir, 'replace.ts'), 'line0\nline1\nline2\nline3\nline4', 'utf-8');

      const operations: FileOperation[] = [
        { index: 0, path: 'replace.ts', action: 'REPLACE_LINES', startLine: 1, endLine: 3 }
      ];
      const contentBlocks = new Map([[0, 'replaced content']]);

      const result = await applyFileOperations(operations, contentBlocks, {
        basePath: tempDir
      });

      expect(result.filesModified).toContain('replace.ts');

      const content = await fs.readFile(path.join(tempDir, 'replace.ts'), 'utf-8');
      const lines = content.split('\n');
      expect(lines).toEqual(['line0', 'replaced content', 'line4']);
    });

    it('should APPEND to existing file', async () => {
      // Create existing file
      await fs.writeFile(path.join(tempDir, 'append.ts'), 'existing content', 'utf-8');

      const operations: FileOperation[] = [
        { index: 0, path: 'append.ts', action: 'APPEND' }
      ];
      const contentBlocks = new Map([[0, 'appended']]);

      const result = await applyFileOperations(operations, contentBlocks, {
        basePath: tempDir
      });

      expect(result.filesModified).toContain('append.ts');

      const content = await fs.readFile(path.join(tempDir, 'append.ts'), 'utf-8');
      expect(content).toBe('existing content\nappended');
    });

    it('should APPEND to non-existing file (creates it)', async () => {
      const operations: FileOperation[] = [
        { index: 0, path: 'new-append.ts', action: 'APPEND' }
      ];
      const contentBlocks = new Map([[0, 'new content']]);

      const result = await applyFileOperations(operations, contentBlocks, {
        basePath: tempDir
      });

      expect(result.filesModified).toContain('new-append.ts');

      const content = await fs.readFile(path.join(tempDir, 'new-append.ts'), 'utf-8');
      expect(content).toBe('new content');
    });

    it('should DELETE existing file', async () => {
      // Create file to delete
      await fs.writeFile(path.join(tempDir, 'to-delete.ts'), 'delete me', 'utf-8');

      const operations: FileOperation[] = [
        { index: 0, path: 'to-delete.ts', action: 'DELETE' }
      ];

      const result = await applyFileOperations(operations, new Map(), {
        basePath: tempDir
      });

      expect(result.filesDeleted).toContain('to-delete.ts');

      // Verify file no longer exists
      await expect(fs.access(path.join(tempDir, 'to-delete.ts'))).rejects.toThrow();
    });

    it('should warn when DELETE target does not exist', async () => {
      const operations: FileOperation[] = [
        { index: 0, path: 'non-existent.ts', action: 'DELETE' }
      ];

      const result = await applyFileOperations(operations, new Map(), {
        basePath: tempDir
      });

      expect(result.warnings.some(w => w.includes('non-existent.ts'))).toBe(true);
    });

    it('should error when content block is missing', async () => {
      const operations: FileOperation[] = [
        { index: 0, path: 'test.ts', action: 'CREATE_OR_OVERWRITE' }
      ];
      const contentBlocks = new Map<number, string>(); // Empty - no content!

      const result = await applyFileOperations(operations, contentBlocks, {
        basePath: tempDir
      });

      expect(result.errors.some(e => e.includes('Missing content block'))).toBe(true);
    });

    it('should handle multiple operations in one call', async () => {
      const operations: FileOperation[] = [
        { index: 0, path: 'file1.ts', action: 'CREATE_OR_OVERWRITE' },
        { index: 1, path: 'file2.ts', action: 'CREATE_OR_OVERWRITE' },
        { index: 2, path: 'file3.ts', action: 'CREATE_OR_OVERWRITE' }
      ];
      const contentBlocks = new Map([
        [0, 'content 1'],
        [1, 'content 2'],
        [2, 'content 3']
      ]);

      const result = await applyFileOperations(operations, contentBlocks, {
        basePath: tempDir
      });

      expect(result.filesModified).toHaveLength(3);
      expect(result.errors).toHaveLength(0);
    });
  });

  // =========================================================================
  // Validation Function Tests
  // =========================================================================

  describe('validateOperationsHaveContent', () => {
    it('should return empty array when all operations have content', () => {
      const operations: FileOperation[] = [
        { index: 0, path: 'a.ts', action: 'CREATE_OR_OVERWRITE' },
        { index: 1, path: 'b.ts', action: 'INSERT_AT', line: 5 }
      ];
      const contentBlocks = new Map([[0, 'a'], [1, 'b']]);

      const errors = validateOperationsHaveContent(operations, contentBlocks);

      expect(errors).toHaveLength(0);
    });

    it('should return errors for missing content blocks', () => {
      const operations: FileOperation[] = [
        { index: 0, path: 'a.ts', action: 'CREATE_OR_OVERWRITE' },
        { index: 1, path: 'b.ts', action: 'INSERT_AT', line: 5 }
      ];
      const contentBlocks = new Map([[0, 'a']]); // Missing index 1

      const errors = validateOperationsHaveContent(operations, contentBlocks);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('index 1');
    });

    it('should not require content for DELETE operations', () => {
      const operations: FileOperation[] = [
        { index: 0, path: 'a.ts', action: 'CREATE_OR_OVERWRITE' },
        { index: 1, path: 'b.ts', action: 'DELETE' }
      ];
      const contentBlocks = new Map([[0, 'a']]); // No content for DELETE is OK

      const errors = validateOperationsHaveContent(operations, contentBlocks);

      expect(errors).toHaveLength(0);
    });
  });

  describe('hasContentRequiringActions', () => {
    it('should return true when there are content-requiring actions', () => {
      const operations: FileOperation[] = [
        { index: 0, path: 'a.ts', action: 'CREATE_OR_OVERWRITE' }
      ];

      expect(hasContentRequiringActions(operations)).toBe(true);
    });

    it('should return false when all actions are DELETE', () => {
      const operations: FileOperation[] = [
        { index: 0, path: 'a.ts', action: 'DELETE' },
        { index: 1, path: 'b.ts', action: 'DELETE' }
      ];

      expect(hasContentRequiringActions(operations)).toBe(false);
    });

    it('should return false for empty operations', () => {
      expect(hasContentRequiringActions([])).toBe(false);
    });
  });

  // =========================================================================
  // Helper Function Tests
  // =========================================================================

  describe('generateProtocolInstructions', () => {
    it('should generate instructions with examples by default', () => {
      const instructions = generateProtocolInstructions();

      expect(instructions).toContain('CREATE_OR_OVERWRITE');
      expect(instructions).toContain('INSERT_AT');
      expect(instructions).toContain('REPLACE_LINES');
      expect(instructions).toContain('APPEND');
      expect(instructions).toContain('DELETE');
      expect(instructions).toContain('Example Response');
    });

    it('should omit examples when includeExamples is false', () => {
      const instructions = generateProtocolInstructions({ includeExamples: false });

      expect(instructions).not.toContain('Example Response');
    });

    it('should filter actions when actionsToInclude is specified', () => {
      // When filtering actions, also exclude examples since the example always shows all actions
      const instructions = generateProtocolInstructions({
        actionsToInclude: ['CREATE_OR_OVERWRITE', 'DELETE'],
        includeExamples: false
      });

      expect(instructions).toContain('CREATE_OR_OVERWRITE');
      expect(instructions).toContain('DELETE');
      // Without the example, these should not appear in the action descriptions
      expect(instructions).not.toContain('`INSERT_AT`');
      expect(instructions).not.toContain('`REPLACE_LINES`');
      expect(instructions).not.toContain('`APPEND`');
    });
  });

  describe('createContentBreak', () => {
    it('should create valid content break markers', () => {
      expect(createContentBreak(0)).toBe('##---Content-Break-0---##');
      expect(createContentBreak(5)).toBe('##---Content-Break-5---##');
      expect(createContentBreak(99)).toBe('##---Content-Break-99---##');
    });

    it('should use correct prefix and suffix', () => {
      const marker = createContentBreak(0);
      expect(marker.startsWith(CONTENT_BREAK_PREFIX)).toBe(true);
      expect(marker.endsWith(CONTENT_BREAK_SUFFIX)).toBe(true);
    });
  });

  // =========================================================================
  // Integration Tests
  // =========================================================================

  describe('integration: full workflow', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hybrid-integration-'));
    });

    afterEach(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('should parse and apply a complete AI response', async () => {
      // Simulate a full AI response
      const aiResponse = `
{
  "command": "APPLY_CODE_CHANGES",
  "files": [
    { "index": 0, "path": "package.json", "action": "CREATE_OR_OVERWRITE" },
    { "index": 1, "path": "src/index.ts", "action": "CREATE_OR_OVERWRITE" },
    { "index": 2, "path": "src/utils.ts", "action": "CREATE_OR_OVERWRITE" }
  ]
}

##---Content-Break-0---##
{
  "name": "test-package",
  "version": "1.0.0"
}

##---Content-Break-1---##
export * from './utils';
export const VERSION = '1.0.0';

##---Content-Break-2---##
export function helper(x: number): number {
  return x * 2;
}
`;

      // Parse the response
      const parsed = parseHybridResponse<{ command: string; files: FileOperation[] }>(aiResponse);

      expect(parsed.json.command).toBe('APPLY_CODE_CHANGES');
      expect(parsed.json.files).toHaveLength(3);
      expect(parsed.contentBlocks.size).toBe(3);

      // Validate operations have content
      const validationErrors = validateOperationsHaveContent(parsed.json.files, parsed.contentBlocks);
      expect(validationErrors).toHaveLength(0);

      // Apply operations
      const result = await applyFileOperations(parsed.json.files, parsed.contentBlocks, {
        basePath: tempDir
      });

      expect(result.filesModified).toHaveLength(3);
      expect(result.errors).toHaveLength(0);

      // Verify files were created correctly
      const packageJson = JSON.parse(await fs.readFile(path.join(tempDir, 'package.json'), 'utf-8'));
      expect(packageJson.name).toBe('test-package');

      const indexContent = await fs.readFile(path.join(tempDir, 'src/index.ts'), 'utf-8');
      expect(indexContent).toContain("export const VERSION = '1.0.0'");

      const utilsContent = await fs.readFile(path.join(tempDir, 'src/utils.ts'), 'utf-8');
      expect(utilsContent).toContain('function helper');
    });
  });
});
