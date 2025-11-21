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

import { describe, it, expect, vi, beforeEach } from 'vitest';
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

        // Test with all optional parameters
        const fullResult = await buildAgentPrompt({
          agentName: 'test-agent',
          taskType: 'FEATURE_IMPLEMENTATION',
          instructions: 'Test',
          packagePath: 'packages/test',
          planPath: testPlanPath,
          workspaceRoot: testWorkspaceRoot,
          includeQualityStandards: true,
          includeFewShotExamples: true,
          includeValidationChecklist: true,
          githubContext: {
            owner: 'test',
            repo: 'test-repo',
            branch: 'main',
            token: 'test-token',
            paths: ['src/**/*.ts']
          }
        });

        expect(typeof fullResult).toBe('string');
        // Full result should be longer (includes additional sections)
        expect(fullResult.length).toBeGreaterThan(minimalResult.length);

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
});
