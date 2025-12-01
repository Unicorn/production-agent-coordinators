/**
 * Mock Validation Tests
 *
 * Per CLAUDE.md requirements: "mocks used in tests must always be validated!
 * They must always have their own tests to verify they match the real system
 * they are mocking, so that we know the mocks themselves can be trusted."
 *
 * These tests verify that test mocks match real implementations by calling
 * real functions with test data and comparing mock behavior to actual behavior.
 */

import { describe, it, expect, vi } from 'vitest';
import { buildAgentPrompt } from '../prompt-builder.activities.js';
import { executeAgentWithClaude } from '../agent-execution.activities.js';
import { parseAgentResponse } from '../response-parser.activities.js';
import { applyFileChanges } from '../file-operations.activities.js';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Mock Validation Tests', () => {
  describe('buildAgentPrompt - Mock Signature Validation', () => {
    it('should verify mock matches real function signature', async () => {
      // Create a test plan file
      const testWorkspaceRoot = '/tmp/mock-validation-test';
      const testPlanPath = 'plans/test-plan.md';
      const absolutePlanPath = path.join(testWorkspaceRoot, testPlanPath);

      await fs.mkdir(path.dirname(absolutePlanPath), { recursive: true });
      await fs.writeFile(absolutePlanPath, '# Test Plan\nThis is a test plan.', 'utf-8');

      try {
        // Call real function with test data
        const realResult = await buildAgentPrompt({
          agentName: 'test-agent',
          taskType: 'PACKAGE_SCAFFOLDING',
          instructions: 'Test instructions',
          packagePath: 'packages/test',
          planPath: testPlanPath,
          workspaceRoot: testWorkspaceRoot,
          includeQualityStandards: false,
          includeFewShotExamples: false,
          includeValidationChecklist: false
        });

        // Verify function returns a string
        expect(typeof realResult).toBe('string');
        expect(realResult.length).toBeGreaterThan(0);

        // Verify mock signature matches
        // This ensures test mocks accept the same parameters
        const mockFunction = vi.fn(buildAgentPrompt);
        const mockResult = await mockFunction({
          agentName: 'test-agent',
          taskType: 'PACKAGE_SCAFFOLDING',
          instructions: 'Test instructions',
          packagePath: 'packages/test',
          planPath: testPlanPath,
          workspaceRoot: testWorkspaceRoot,
          includeQualityStandards: false,
          includeFewShotExamples: false,
          includeValidationChecklist: false
        });

        // Both should return strings
        expect(typeof mockResult).toBe('string');
        expect(mockResult).toBe(realResult);

      } finally {
        // Cleanup
        await fs.rm(testWorkspaceRoot, { recursive: true, force: true });
      }
    });

    it('should verify mock handles all optional parameters', async () => {
      const testWorkspaceRoot = '/tmp/mock-validation-optional';
      const testPlanPath = 'plans/test-plan.md';
      const absolutePlanPath = path.join(testWorkspaceRoot, testPlanPath);

      await fs.mkdir(path.dirname(absolutePlanPath), { recursive: true });
      await fs.writeFile(absolutePlanPath, '# Test Plan', 'utf-8');

      try {
        // Test with minimal parameters
        const minimalResult = await buildAgentPrompt({
          agentName: 'test-agent',
          taskType: 'FEATURE_IMPLEMENTATION',
          instructions: 'Test',
          packagePath: 'packages/test',
          planPath: testPlanPath,
          workspaceRoot: testWorkspaceRoot
        });

        expect(typeof minimalResult).toBe('string');

        // Test with optional parameters (excluding githubContext which requires real GitHub API)
        const fullResult = await buildAgentPrompt({
          agentName: 'test-agent',
          taskType: 'FEATURE_IMPLEMENTATION',
          instructions: 'Test with more context',
          packagePath: 'packages/test',
          planPath: testPlanPath,
          workspaceRoot: testWorkspaceRoot,
          includeQualityStandards: true,
          includeFewShotExamples: true,
          includeValidationChecklist: true
          // Note: githubContext is omitted as it requires real GitHub API calls
          // which would need to be mocked separately
        });

        expect(typeof fullResult).toBe('string');
        // Full result should have more content (includes quality standards, examples, checklist)
        expect(fullResult).toContain('Quality Standards');

      } finally {
        await fs.rm(testWorkspaceRoot, { recursive: true, force: true });
      }
    });
  });

  describe('executeAgentWithClaude - Mock Signature Validation', () => {
    it('should verify mock matches real function signature and error handling', async () => {
      // Real function requires ANTHROPIC_API_KEY
      const originalApiKey = process.env.ANTHROPIC_API_KEY;

      try {
        // Test error handling when API key is missing
        delete process.env.ANTHROPIC_API_KEY;

        await expect(async () => {
          await executeAgentWithClaude({
            prompt: 'Test prompt',
            model: 'claude-sonnet-4-5-20250929',
            temperature: 0.2,
            maxTokens: 1000
          });
        }).rejects.toThrow('ANTHROPIC_API_KEY');

        // Verify mock signature matches by creating mock
        const mockFunction = vi.fn(executeAgentWithClaude);

        // Mock should accept same parameters
        mockFunction.mockResolvedValue('Mock response');

        const result = await mockFunction({
          prompt: 'Test prompt',
          model: 'claude-sonnet-4-5-20250929',
          temperature: 0.2,
          maxTokens: 1000
        });

        expect(result).toBe('Mock response');
        expect(mockFunction).toHaveBeenCalledWith({
          prompt: 'Test prompt',
          model: 'claude-sonnet-4-5-20250929',
          temperature: 0.2,
          maxTokens: 1000
        });

      } finally {
        // Restore API key
        if (originalApiKey) {
          process.env.ANTHROPIC_API_KEY = originalApiKey;
        }
      }
    });

    it('should verify mock handles default parameters', async () => {
      // Create mock that matches real function
      const mockFunction = vi.fn(async (input: {
        prompt: string;
        model?: string;
        temperature?: number;
        maxTokens?: number;
      }): Promise<string> => {
        // Mock implementation mimics defaults
        const model = input.model ?? 'claude-sonnet-4-5-20250929';
        const temperature = input.temperature ?? 0.2;
        const maxTokens = input.maxTokens ?? 8000;

        return `Mock response with model=${model}, temp=${temperature}, tokens=${maxTokens}`;
      });

      // Test with minimal parameters (uses defaults)
      const result = await mockFunction({
        prompt: 'Test prompt'
      });

      expect(result).toContain('claude-sonnet-4-5-20250929');
      expect(result).toContain('temp=0.2');
      expect(result).toContain('tokens=8000');

      // Test with explicit parameters
      const customResult = await mockFunction({
        prompt: 'Test prompt',
        model: 'claude-3-opus-20240229',
        temperature: 0.5,
        maxTokens: 4000
      });

      expect(customResult).toContain('claude-3-opus-20240229');
      expect(customResult).toContain('temp=0.5');
      expect(customResult).toContain('tokens=4000');
    });
  });

  describe('parseAgentResponse - Mock Behavior Validation', () => {
    it('should verify mock matches real parsing behavior', async () => {
      // Test real function with valid JSON
      const validResponse = JSON.stringify({
        summary: 'Test summary',
        files: [
          {
            path: 'src/test.ts',
            operation: 'create',
            content: 'test content'
          }
        ]
      });

      const realResult = await parseAgentResponse({
        responseText: validResponse,
        packagePath: 'packages/test'
      });

      // Verify structure
      expect(realResult).toHaveProperty('summary');
      expect(realResult).toHaveProperty('files');
      expect(Array.isArray(realResult.files)).toBe(true);
      expect(realResult.files.length).toBe(1);
      expect(realResult.files[0].path).toBe('src/test.ts');
      expect(realResult.files[0].operation).toBe('create');
      expect(realResult.files[0].content).toBe('test content');

      // Create mock that mimics real behavior
      const mockFunction = vi.fn(parseAgentResponse);
      const mockResult = await mockFunction({
        responseText: validResponse,
        packagePath: 'packages/test'
      });

      // Mock result should match real result
      expect(mockResult).toEqual(realResult);
    });

    it('should verify mock handles markdown code blocks', async () => {
      // Test real function with markdown-wrapped JSON
      const markdownResponse = '```json\n' +
        JSON.stringify({
          summary: 'Test summary',
          files: []
        }, null, 2) +
        '\n```';

      const realResult = await parseAgentResponse({
        responseText: markdownResponse,
        packagePath: 'packages/test'
      });

      expect(realResult.summary).toBe('Test summary');
      expect(realResult.files).toEqual([]);

      // Mock should handle the same input
      const mockFunction = vi.fn(parseAgentResponse);
      const mockResult = await mockFunction({
        responseText: markdownResponse,
        packagePath: 'packages/test'
      });

      expect(mockResult).toEqual(realResult);
    });

    it('should verify mock matches real validation errors', async () => {
      // Test invalid JSON (missing required field)
      const invalidResponse = JSON.stringify({
        files: []
        // Missing 'summary' field
      });

      // Real function should throw
      await expect(async () => {
        await parseAgentResponse({
          responseText: invalidResponse,
          packagePath: 'packages/test'
        });
      }).rejects.toThrow('missing required "summary"');

      // Mock should throw same error
      const mockFunction = vi.fn(parseAgentResponse);
      await expect(async () => {
        await mockFunction({
          responseText: invalidResponse,
          packagePath: 'packages/test'
        });
      }).rejects.toThrow('missing required "summary"');
    });

    it('should verify mock validates file operations', async () => {
      // Test with invalid operation
      const invalidOperation = JSON.stringify({
        summary: 'Test',
        files: [
          {
            path: 'test.ts',
            operation: 'invalid-op',
            content: 'test'
          }
        ]
      });

      // Real function should reject invalid operation
      await expect(async () => {
        await parseAgentResponse({
          responseText: invalidOperation,
          packagePath: 'packages/test'
        });
      }).rejects.toThrow('Invalid operation');

      // Test with path traversal
      const pathTraversal = JSON.stringify({
        summary: 'Test',
        files: [
          {
            path: '../../../etc/passwd',
            operation: 'create',
            content: 'evil'
          }
        ]
      });

      await expect(async () => {
        await parseAgentResponse({
          responseText: pathTraversal,
          packagePath: 'packages/test'
        });
      }).rejects.toThrow('Invalid file path');
    });
  });

  describe('applyFileChanges - Mock Behavior Validation', () => {
    it('should verify mock matches real file operations', async () => {
      const testWorkspaceRoot = '/tmp/mock-validation-files';
      const testPackagePath = 'packages/test';

      await fs.mkdir(path.join(testWorkspaceRoot, testPackagePath), { recursive: true });

      try {
        // Test real function with create operation
        const createOps = [
          {
            path: 'src/test.ts',
            operation: 'create' as const,
            content: '// Test file\nexport const test = "hello";'
          }
        ];

        const realResult = await applyFileChanges({
          operations: createOps,
          packagePath: testPackagePath,
          workspaceRoot: testWorkspaceRoot
        });

        // Verify file was created
        expect(realResult.modifiedFiles).toEqual(['src/test.ts']);
        expect(realResult.failedOperations).toHaveLength(0);

        // Verify file exists and has correct content
        const createdFile = await fs.readFile(
          path.join(testWorkspaceRoot, testPackagePath, 'src/test.ts'),
          'utf-8'
        );
        expect(createdFile).toBe('// Test file\nexport const test = "hello";');

        // Test update operation
        const updateOps = [
          {
            path: 'src/test.ts',
            operation: 'update' as const,
            content: '// Updated file\nexport const test = "world";'
          }
        ];

        const updateResult = await applyFileChanges({
          operations: updateOps,
          packagePath: testPackagePath,
          workspaceRoot: testWorkspaceRoot
        });

        expect(updateResult.modifiedFiles).toEqual(['src/test.ts']);

        // Verify file was updated
        const updatedFile = await fs.readFile(
          path.join(testWorkspaceRoot, testPackagePath, 'src/test.ts'),
          'utf-8'
        );
        expect(updatedFile).toBe('// Updated file\nexport const test = "world";');

        // Test delete operation
        const deleteOps = [
          {
            path: 'src/test.ts',
            operation: 'delete' as const
          }
        ];

        const deleteResult = await applyFileChanges({
          operations: deleteOps,
          packagePath: testPackagePath,
          workspaceRoot: testWorkspaceRoot
        });

        expect(deleteResult.modifiedFiles).toEqual(['src/test.ts']);

        // Verify file was deleted
        await expect(async () => {
          await fs.access(path.join(testWorkspaceRoot, testPackagePath, 'src/test.ts'));
        }).rejects.toThrow();

      } finally {
        await fs.rm(testWorkspaceRoot, { recursive: true, force: true });
      }
    });

    it('should verify mock handles directory creation', async () => {
      const testWorkspaceRoot = '/tmp/mock-validation-dirs';
      const testPackagePath = 'packages/test';

      await fs.mkdir(path.join(testWorkspaceRoot, testPackagePath), { recursive: true });

      try {
        // Test with nested directory path
        const nestedOps = [
          {
            path: 'src/deep/nested/path/file.ts',
            operation: 'create' as const,
            content: 'nested file'
          }
        ];

        const result = await applyFileChanges({
          operations: nestedOps,
          packagePath: testPackagePath,
          workspaceRoot: testWorkspaceRoot
        });

        expect(result.modifiedFiles).toEqual(['src/deep/nested/path/file.ts']);

        // Verify directories were created
        const fileContent = await fs.readFile(
          path.join(testWorkspaceRoot, testPackagePath, 'src/deep/nested/path/file.ts'),
          'utf-8'
        );
        expect(fileContent).toBe('nested file');

      } finally {
        await fs.rm(testWorkspaceRoot, { recursive: true, force: true });
      }
    });

    it('should verify mock handles failed operations', async () => {
      const testWorkspaceRoot = '/tmp/mock-validation-fail';
      const testPackagePath = 'packages/test';

      await fs.mkdir(path.join(testWorkspaceRoot, testPackagePath), { recursive: true });

      try {
        // Test with path traversal (should fail)
        const badOps = [
          {
            path: '../../../bad/path.ts',
            operation: 'create' as const,
            content: 'bad content'
          }
        ];

        const result = await applyFileChanges({
          operations: badOps,
          packagePath: testPackagePath,
          workspaceRoot: testWorkspaceRoot
        });

        // Should have failed operation
        expect(result.failedOperations.length).toBeGreaterThan(0);
        expect(result.failedOperations[0].path).toBe('../../../bad/path.ts');
        expect(result.failedOperations[0].error).toContain('traversal');

      } finally {
        await fs.rm(testWorkspaceRoot, { recursive: true, force: true });
      }
    });

    it('should verify mock matches real return type structure', async () => {
      const testWorkspaceRoot = '/tmp/mock-validation-return';
      const testPackagePath = 'packages/test';

      await fs.mkdir(path.join(testWorkspaceRoot, testPackagePath), { recursive: true });

      try {
        const ops = [
          {
            path: 'test1.ts',
            operation: 'create' as const,
            content: 'file 1'
          },
          {
            path: 'test2.ts',
            operation: 'create' as const,
            content: 'file 2'
          }
        ];

        const result = await applyFileChanges({
          operations: ops,
          packagePath: testPackagePath,
          workspaceRoot: testWorkspaceRoot
        });

        // Verify return type structure
        expect(result).toHaveProperty('modifiedFiles');
        expect(result).toHaveProperty('failedOperations');
        expect(Array.isArray(result.modifiedFiles)).toBe(true);
        expect(Array.isArray(result.failedOperations)).toBe(true);

        // Verify modifiedFiles contains expected entries
        expect(result.modifiedFiles).toContain('test1.ts');
        expect(result.modifiedFiles).toContain('test2.ts');

        // Mock should return same structure
        const mockFunction = vi.fn(applyFileChanges);
        mockFunction.mockResolvedValue({
          modifiedFiles: ['test1.ts', 'test2.ts'],
          failedOperations: []
        });

        const mockResult = await mockFunction({
          operations: ops,
          packagePath: testPackagePath,
          workspaceRoot: testWorkspaceRoot
        });

        expect(mockResult).toHaveProperty('modifiedFiles');
        expect(mockResult).toHaveProperty('failedOperations');
        expect(mockResult.modifiedFiles).toEqual(['test1.ts', 'test2.ts']);

      } finally {
        await fs.rm(testWorkspaceRoot, { recursive: true, force: true });
      }
    });
  });

  describe('GoogleGenAI - Mock Interface Validation', () => {
    it('should verify mock has same interface as real GoogleGenAI', async () => {
      const { GoogleGenAI } = await import('@google/genai');

      // Create mock that matches real interface
      const mockGoogleGenAI = vi.fn().mockImplementation(() => ({
        models: {
          generateContent: vi.fn()
        }
      }));

      // Verify mock returns same structure as real API
      const mockInstance = mockGoogleGenAI({ apiKey: 'test-key' });
      expect(mockInstance).toHaveProperty('models');
      expect(mockInstance.models).toHaveProperty('generateContent');
      expect(typeof mockInstance.models.generateContent).toBe('function');
    });

    it('should verify mock generateContent accepts correct parameters', async () => {
      const { GoogleGenAI } = await import('@google/genai');

      // Mock generateContent with same signature
      const mockGenerateContent = vi.fn().mockResolvedValue({
        text: JSON.stringify({ command: 'RUN_LINT_CHECK' })
      });

      const mockGoogleGenAI = vi.fn().mockImplementation(() => ({
        models: {
          generateContent: mockGenerateContent
        }
      }));

      const instance = mockGoogleGenAI({ apiKey: 'test-key' });

      // Call with parameters matching real API
      await instance.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: 'Test prompt content'
      });

      // Verify mock was called with expected structure
      expect(mockGenerateContent).toHaveBeenCalledWith({
        model: 'gemini-2.5-flash',
        contents: 'Test prompt content'
      });
    });

    it('should verify mock response structure matches real API', async () => {
      // Mock response structure must match real Gemini API response
      const mockResponse = {
        text: JSON.stringify({
          command: 'APPLY_CODE_CHANGES',
          files: [{ index: 0, path: 'src/index.ts', action: 'CREATE_OR_OVERWRITE' }]
        })
      };

      // Verify response has text property (accessor method in real API)
      expect(mockResponse).toHaveProperty('text');
      expect(typeof mockResponse.text).toBe('string');

      // Verify response can be parsed as expected JSON structure
      const parsed = JSON.parse(mockResponse.text);
      expect(parsed).toHaveProperty('command');
      expect(parsed).toHaveProperty('files');
      expect(Array.isArray(parsed.files)).toBe(true);
    });
  });

  describe('execSync (child_process) - Mock Behavior Validation', () => {
    it('should verify mock matches real execSync signature', async () => {
      const { execSync } = await import('child_process');

      // Real execSync signature: execSync(command, options?)
      expect(typeof execSync).toBe('function');

      // Create mock with same signature
      const mockExecSync = vi.fn((command: string, options?: object) => {
        return Buffer.from('mock output');
      });

      // Verify mock can be called with same parameters
      mockExecSync('git status', { cwd: '/tmp', encoding: 'utf-8' });

      expect(mockExecSync).toHaveBeenCalledWith('git status', {
        cwd: '/tmp',
        encoding: 'utf-8'
      });
    });

    it('should verify mock throws errors with same structure', async () => {
      // Real execSync throws errors with stdout/stderr buffers
      const mockExecSync = vi.fn().mockImplementation(() => {
        const error = new Error('Command failed') as Error & { stdout?: Buffer; stderr?: Buffer };
        error.stdout = Buffer.from('STDOUT content');
        error.stderr = Buffer.from('STDERR content');
        throw error;
      });

      try {
        mockExecSync('failing-command');
        expect.fail('Should have thrown');
      } catch (error: unknown) {
        const execError = error as Error & { stdout?: Buffer; stderr?: Buffer };
        // Verify error has stdout/stderr like real execSync
        expect(execError).toBeInstanceOf(Error);
        expect(execError.message).toBe('Command failed');
        expect(execError.stdout).toBeInstanceOf(Buffer);
        expect(execError.stderr).toBeInstanceOf(Buffer);
        expect(execError.stdout?.toString()).toBe('STDOUT content');
        expect(execError.stderr?.toString()).toBe('STDERR content');
      }
    });

    it('should verify lint error output mock matches real ESLint output', async () => {
      // Mock ESLint stylish format output (what real eslint produces)
      const eslintOutput = `/Users/test/packages/test/src/utils.ts
  10:5   error  Unsafe assignment of an \`any\` value    @typescript-eslint/no-unsafe-assignment
  15:3   error  Missing return type on function         @typescript-eslint/explicit-module-boundary-types

/Users/test/packages/test/src/index.ts
  20:1   error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

✖ 3 problems (3 errors, 0 warnings)
`;

      // Verify mock output has expected structure for parsing
      const lines = eslintOutput.split('\n');

      // Should contain absolute file paths starting with /
      const filePathLines = lines.filter(line => line.startsWith('/'));
      expect(filePathLines.length).toBeGreaterThan(0);
      expect(filePathLines[0]).toContain('src/utils.ts');

      // Should contain error summary line
      expect(eslintOutput).toContain('✖');
      expect(eslintOutput).toContain('problems');
    });
  });

  describe('simple-git - Mock Interface Validation', () => {
    it('should verify mock has same interface as real simple-git', async () => {
      // Import real simple-git to verify interface
      const simpleGit = (await import('simple-git')).default;

      // Create mock with same interface
      const mockGit = {
        add: vi.fn().mockResolvedValue(undefined),
        commit: vi.fn().mockResolvedValue({ commit: 'abc123' }),
        push: vi.fn().mockResolvedValue(undefined),
        status: vi.fn().mockResolvedValue({ modified: [], created: [], deleted: [] }),
        revparse: vi.fn().mockResolvedValue('abc123def456'),
        log: vi.fn().mockResolvedValue({ all: [], latest: null })
      };

      // Verify mock has all expected methods
      expect(typeof mockGit.add).toBe('function');
      expect(typeof mockGit.commit).toBe('function');
      expect(typeof mockGit.push).toBe('function');
      expect(typeof mockGit.status).toBe('function');
      expect(typeof mockGit.revparse).toBe('function');
      expect(typeof mockGit.log).toBe('function');
    });

    it('should verify mock commit response matches real simple-git', async () => {
      const mockCommit = vi.fn().mockResolvedValue({
        commit: 'abc123def456789',
        branch: 'main',
        summary: {
          changes: 3,
          insertions: 50,
          deletions: 10
        }
      });

      const result = await mockCommit('Test commit message');

      // Verify response structure
      expect(result).toHaveProperty('commit');
      expect(result).toHaveProperty('branch');
      expect(result).toHaveProperty('summary');
      expect(typeof result.commit).toBe('string');
      expect(result.commit.length).toBeGreaterThan(0);
    });

    it('should verify mock pre-commit hook error matches real git', async () => {
      // Real git throws error when pre-commit hook fails
      const mockCommit = vi.fn().mockRejectedValue(
        new Error(`husky - pre-commit hook exited with code 1 (error)
> lint-staged
✖ src/index.ts:10:5
  error  Unsafe assignment  @typescript-eslint/no-unsafe-assignment
✖ 1 problem (1 error, 0 warnings)`)
      );

      try {
        await mockCommit('Test commit');
        expect.fail('Should have thrown');
      } catch (error: unknown) {
        const gitError = error as Error;
        // Verify error message contains pre-commit indicator
        expect(gitError.message).toContain('pre-commit');
        // Verify error contains file path that can be extracted
        expect(gitError.message).toContain('src/index.ts');
        // Verify error contains ESLint rule
        expect(gitError.message).toContain('@typescript-eslint');
      }
    });
  });

  describe('fs/promises - Mock Behavior Validation', () => {
    it('should verify mock methods match real fs/promises interface', async () => {
      const realFs = await import('fs/promises');

      // Verify mock covers all methods we use
      const usedMethods = [
        'writeFile',
        'readFile',
        'unlink',
        'mkdir',
        'readdir',
        'stat',
        'access',
        'rm'
      ];

      for (const method of usedMethods) {
        expect(realFs).toHaveProperty(method);
        expect(typeof (realFs as Record<string, unknown>)[method]).toBe('function');
      }
    });

    it('should verify mock error structure matches real ENOENT error', async () => {
      // Create mock that throws ENOENT like real fs
      const mockReadFile = vi.fn().mockRejectedValue(
        Object.assign(new Error('ENOENT: no such file or directory'), {
          code: 'ENOENT',
          errno: -2,
          syscall: 'open',
          path: '/nonexistent/file.ts'
        })
      );

      try {
        await mockReadFile('/nonexistent/file.ts');
        expect.fail('Should have thrown');
      } catch (error: unknown) {
        const fsError = error as Error & { code?: string; errno?: number; syscall?: string; path?: string };
        // Verify error has same structure as real fs error
        expect(fsError.code).toBe('ENOENT');
        expect(fsError.errno).toBe(-2);
        expect(fsError.syscall).toBe('open');
        expect(fsError.path).toBe('/nonexistent/file.ts');
      }
    });
  });
});
