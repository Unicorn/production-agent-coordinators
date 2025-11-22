import { describe, it, expect, beforeEach } from 'vitest';
import { parseAgentResponse, validateQualityChecklist, extractFilePaths } from '../response-parser.activities';

describe('Response Parser Activities', () => {
  beforeEach(() => {
    // No mocks needed - pure functions
  });

  describe('parseAgentResponse', () => {
    it('should parse valid JSON response', async () => {
      const response = JSON.stringify({
        files: [
          { operation: 'create', path: 'src/index.ts', content: 'export {}' }
        ],
        summary: 'Created main index file'
      });

      const result = await parseAgentResponse({
        responseText: response,
        packagePath: 'packages/core/test'
      });

      expect(result.files).toHaveLength(1);
      expect(result.files[0].operation).toBe('create');
      expect(result.files[0].path).toBe('src/index.ts');
      expect(result.summary).toBe('Created main index file');
    });

    it('should unwrap markdown code blocks with json tag', async () => {
      const response = '```json\n{"files":[],"summary":"Test"}\n```';

      const result = await parseAgentResponse({
        responseText: response,
        packagePath: 'packages/core/test'
      });

      expect(result.files).toEqual([]);
      expect(result.summary).toBe('Test');
    });

    it('should unwrap markdown code blocks without json tag', async () => {
      const response = '```\n{"files":[],"summary":"Test"}\n```';

      const result = await parseAgentResponse({
        responseText: response,
        packagePath: 'packages/core/test'
      });

      expect(result.files).toEqual([]);
      expect(result.summary).toBe('Test');
    });

    it('should handle extra whitespace in markdown blocks', async () => {
      const response = '  ```json  \n  {"files":[],"summary":"Test"}  \n  ```  ';

      const result = await parseAgentResponse({
        responseText: response,
        packagePath: 'packages/core/test'
      });

      expect(result.summary).toBe('Test');
    });

    it('should preserve extra fields (lenient parsing)', async () => {
      const response = JSON.stringify({
        files: [],
        summary: 'Test',
        extraField: 'preserved',
        anotherField: 123
      });

      const result = await parseAgentResponse({
        responseText: response,
        packagePath: 'packages/core/test'
      });

      expect((result as any).extraField).toBe('preserved');
      expect((result as any).anotherField).toBe(123);
    });

    it('should parse meta-agent questions', async () => {
      const response = JSON.stringify({
        files: [],
        summary: 'Test',
        questions: [
          { question: 'What API format?', options: ['REST', 'GraphQL'] }
        ]
      });

      const result = await parseAgentResponse({
        responseText: response,
        packagePath: 'packages/core/test'
      });

      expect(result.questions).toHaveLength(1);
      expect(result.questions?.[0].question).toBe('What API format?');
    });

    it('should parse meta-agent suggestions', async () => {
      const response = JSON.stringify({
        files: [],
        summary: 'Test',
        suggestions: [
          { suggestion: 'Add error handling', priority: 'high' }
        ]
      });

      const result = await parseAgentResponse({
        responseText: response,
        packagePath: 'packages/core/test'
      });

      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions?.[0].suggestion).toBe('Add error handling');
    });

    it('should throw error when files array is missing', async () => {
      const response = JSON.stringify({
        summary: 'Test'
      });

      await expect(
        parseAgentResponse({
          responseText: response,
          packagePath: 'packages/core/test'
        })
      ).rejects.toThrow('Response missing required "files" array');
    });

    it('should throw error when files is not an array', async () => {
      const response = JSON.stringify({
        files: 'not-an-array',
        summary: 'Test'
      });

      await expect(
        parseAgentResponse({
          responseText: response,
          packagePath: 'packages/core/test'
        })
      ).rejects.toThrow('Response missing required "files" array');
    });

    it('should throw error when summary is missing', async () => {
      const response = JSON.stringify({
        files: []
      });

      await expect(
        parseAgentResponse({
          responseText: response,
          packagePath: 'packages/core/test'
        })
      ).rejects.toThrow('Response missing required "summary" string');
    });

    it('should throw error when summary is not a string', async () => {
      const response = JSON.stringify({
        files: [],
        summary: 123
      });

      await expect(
        parseAgentResponse({
          responseText: response,
          packagePath: 'packages/core/test'
        })
      ).rejects.toThrow('Response missing required "summary" string');
    });

    it('should throw error on invalid JSON', async () => {
      const response = 'This is not JSON';

      await expect(
        parseAgentResponse({
          responseText: response,
          packagePath: 'packages/core/test'
        })
      ).rejects.toThrow();
    });

    it('should throw error on malformed markdown JSON', async () => {
      const response = '```json\n{invalid json}\n```';

      await expect(
        parseAgentResponse({
          responseText: response,
          packagePath: 'packages/core/test'
        })
      ).rejects.toThrow();
    });

    it('should validate file operations', async () => {
      const response = JSON.stringify({
        files: [
          { operation: 'invalid-op', path: 'test.ts', content: 'x' }
        ],
        summary: 'Test'
      });

      await expect(
        parseAgentResponse({
          responseText: response,
          packagePath: 'packages/core/test'
        })
      ).rejects.toThrow('Invalid operation');
    });

    it('should reject path traversal in file paths', async () => {
      const response = JSON.stringify({
        files: [
          { operation: 'create', path: '../../../etc/passwd', content: 'hack' }
        ],
        summary: 'Test'
      });

      await expect(
        parseAgentResponse({
          responseText: response,
          packagePath: 'packages/core/test'
        })
      ).rejects.toThrow('Invalid file path');
    });

    it('should handle create operations with valid content', async () => {
      const response = JSON.stringify({
        files: [
          { operation: 'create', path: 'src/new.ts', content: 'export const x = 1;' }
        ],
        summary: 'Created file'
      });

      const result = await parseAgentResponse({
        responseText: response,
        packagePath: 'packages/core/test'
      });

      expect(result.files[0].content).toBe('export const x = 1;');
    });

    it('should handle update operations', async () => {
      const response = JSON.stringify({
        files: [
          { operation: 'update', path: 'src/existing.ts', content: 'updated content' }
        ],
        summary: 'Updated file'
      });

      const result = await parseAgentResponse({
        responseText: response,
        packagePath: 'packages/core/test'
      });

      expect(result.files[0].operation).toBe('update');
    });

    it('should handle delete operations without content', async () => {
      const response = JSON.stringify({
        files: [
          { operation: 'delete', path: 'src/old.ts' }
        ],
        summary: 'Deleted file'
      });

      const result = await parseAgentResponse({
        responseText: response,
        packagePath: 'packages/core/test'
      });

      expect(result.files[0].operation).toBe('delete');
      expect(result.files[0].content).toBeUndefined();
    });
  });

  describe('validateQualityChecklist', () => {
    it('should pass when all required checklist items are true', () => {
      const response = {
        files: [],
        summary: 'Test',
        qualityChecklist: {
          strictModeEnabled: true,
          noAnyTypes: true,
          testCoverageAbove80: true,
          allPublicFunctionsDocumented: true,
          errorHandlingComplete: true
        }
      };

      const result = validateQualityChecklist(response);

      expect(result.passed).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should fail when required checklist items are missing or false', () => {
      const response = {
        files: [],
        summary: 'Test',
        qualityChecklist: {
          strictModeEnabled: false,
          noAnyTypes: true,
          testCoverageAbove80: false
          // Missing: allPublicFunctionsDocumented, errorHandlingComplete
        }
      };

      const result = validateQualityChecklist(response);

      expect(result.passed).toBe(false);
      expect(result.warnings).toContain('Quality check failed: strictModeEnabled');
      expect(result.warnings).toContain('Quality check failed: testCoverageAbove80');
      expect(result.warnings).toContain('Quality check failed: allPublicFunctionsDocumented');
      expect(result.warnings).toContain('Quality check failed: errorHandlingComplete');
    });

    it('should fail when quality checklist is missing', () => {
      const response = {
        files: [],
        summary: 'Test'
      };

      const result = validateQualityChecklist(response);

      expect(result.passed).toBe(false);
      expect(result.warnings).toContain('No quality checklist provided');
    });

    it('should fail when partial checklist missing required fields', () => {
      const response = {
        files: [],
        summary: 'Test',
        qualityChecklist: {
          hasTests: true  // This is not a required check
        }
      };

      const result = validateQualityChecklist(response);

      // Should fail because all required checks are missing
      expect(result.passed).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings).toContain('Quality check failed: strictModeEnabled');
    });
  });

  describe('extractFilePaths', () => {
    it('should extract created file paths', () => {
      const response = {
        files: [
          { operation: 'create', path: 'src/a.ts', content: 'x' },
          { operation: 'create', path: 'src/b.ts', content: 'y' }
        ],
        summary: 'Created files'
      };

      const result = extractFilePaths(response);

      expect(result.created).toEqual(['src/a.ts', 'src/b.ts']);
      expect(result.updated).toEqual([]);
      expect(result.deleted).toEqual([]);
    });

    it('should extract updated file paths', () => {
      const response = {
        files: [
          { operation: 'update', path: 'src/existing.ts', content: 'updated' }
        ],
        summary: 'Updated file'
      };

      const result = extractFilePaths(response);

      expect(result.created).toEqual([]);
      expect(result.updated).toEqual(['src/existing.ts']);
      expect(result.deleted).toEqual([]);
    });

    it('should extract deleted file paths', () => {
      const response = {
        files: [
          { operation: 'delete', path: 'src/old.ts' }
        ],
        summary: 'Deleted file'
      };

      const result = extractFilePaths(response);

      expect(result.created).toEqual([]);
      expect(result.updated).toEqual([]);
      expect(result.deleted).toEqual(['src/old.ts']);
    });

    it('should handle mixed operations', () => {
      const response = {
        files: [
          { operation: 'create', path: 'src/new.ts', content: 'x' },
          { operation: 'update', path: 'src/existing.ts', content: 'y' },
          { operation: 'delete', path: 'src/old.ts' }
        ],
        summary: 'Mixed operations'
      };

      const result = extractFilePaths(response);

      expect(result.created).toEqual(['src/new.ts']);
      expect(result.updated).toEqual(['src/existing.ts']);
      expect(result.deleted).toEqual(['src/old.ts']);
    });

    it('should return empty arrays when no files', () => {
      const response = {
        files: [],
        summary: 'No files'
      };

      const result = extractFilePaths(response);

      expect(result.created).toEqual([]);
      expect(result.updated).toEqual([]);
      expect(result.deleted).toEqual([]);
    });
  });
});
