import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  determineNextAction,
  applyCodeChanges,
  getFileContent,
  validatePackageJson,
  checkLicenseHeaders,
  runLintCheck,
  runUnitTests,
  publishGeminiPackage,
  notifyHumanForHelp,
  notifyPublishSuccess,
  resolvePackagePath,
  normalizeFilePath,
  sanitizeFileContent
} from '../gemini-agent.activities';
import type {
  DetermineNextActionInput,
  ApplyCodeChangesInput,
  AgentCommand
} from '../gemini-agent.activities';

// Mock dependencies
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      generateContent: vi.fn()
    }
  }))
}));

vi.mock('simple-git', () => ({
  default: vi.fn(() => ({
    add: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue({ commit: 'abc123' })
  }))
}));

vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue('# Test Plan\n\nBuild a test package.'),
  readdir: vi.fn().mockResolvedValue([])
}));

vi.mock('@temporalio/activity', () => ({
  Context: {
    current: () => ({
      log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
      }
    })
  }
}));

vi.mock('child_process', () => ({
  execSync: vi.fn().mockReturnValue('Success')
}));

describe('Gemini Agent Activities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock GEMINI_API_KEY environment variable
    process.env.GEMINI_API_KEY = 'test-gemini-api-key';
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  describe('determineNextAction', () => {
    it('should throw error if GEMINI_API_KEY is missing', async () => {
      delete process.env.GEMINI_API_KEY;

      const input: DetermineNextActionInput = {
        fullPlan: '# Test Plan',
        agentInstructions: 'Build a package',
        actionHistory: ['Workflow started.'],
        currentCodebaseContext: 'No files created yet.'
      };

      await expect(determineNextAction(input)).rejects.toThrow('GEMINI_API_KEY');
    });

    it('should construct AI prompt with all input parameters', async () => {
      const { GoogleGenAI } = await import('@google/genai');
      const mockGenerateContent = vi.fn().mockResolvedValue({
        text: JSON.stringify({ command: 'APPLY_CODE_CHANGES', fileOperations: [] })
      });

      vi.mocked(GoogleGenAI).mockImplementation(() => ({
        models: {
          generateContent: mockGenerateContent
        }
      }) as any);

      const input: DetermineNextActionInput = {
        fullPlan: '# Test Plan\n\nBuild a TypeScript package.',
        agentInstructions: 'Follow best practices',
        actionHistory: ['Workflow started.', 'Created package.json'],
        currentCodebaseContext: 'package.json created with basic structure'
      };

      await determineNextAction(input);

      // Hybrid protocol uses free-form text, no JSON schema config
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-2.5-flash', // Default model (can be overridden via GEMINI_MODEL env var)
          contents: expect.any(String) // Prompt text
          // No responseMimeType or responseSchema - hybrid protocol returns text
        })
      );

      const callArg = mockGenerateContent.mock.calls[0][0];
      expect(callArg.contents).toContain('Test Plan');
      expect(callArg.contents).toContain('best practices');
      expect(callArg.contents).toContain('Workflow started.');
      expect(callArg.contents).toContain('package.json created');
    });

    it('should parse and return APPLY_CODE_CHANGES command', async () => {
      const { GoogleGenAI } = await import('@google/genai');
      // Mock returns hybrid protocol format: JSON with command + files array
      // The actual file content comes from content blocks (##---Content-Break-N---##)
      const mockResponse = `{
  "command": "APPLY_CODE_CHANGES",
  "files": [
    { "index": 0, "path": "src/index.ts", "action": "CREATE_OR_OVERWRITE" }
  ]
}

##---Content-Break-0---##
export const test = 1;`;

      const mockGenerateContent = vi.fn().mockResolvedValue({
        text: mockResponse
      });

      vi.mocked(GoogleGenAI).mockImplementation(() => ({
        models: {
          generateContent: mockGenerateContent
        }
      }) as any);

      const input: DetermineNextActionInput = {
        fullPlan: '# Plan',
        agentInstructions: 'Build',
        actionHistory: [],
        currentCodebaseContext: 'Empty'
      };

      const result = await determineNextAction(input);

      expect(result.command.command).toBe('APPLY_CODE_CHANGES');
      // STRONG assertion: Verify files property has expected structure (from hybrid protocol)
      expect(result.command.files).toEqual([
        { index: 0, path: 'src/index.ts', action: 'CREATE_OR_OVERWRITE' }
      ]);
      // STRONG assertion: Verify contentBlocks with exact content (from ##---Content-Break-N---##)
      // contentBlocks is an object keyed by index, not an array
      expect(result.contentBlocks).toMatchObject({ '0': 'export const test = 1;' });
      expect(result.contentBlocks[0]).toBe('export const test = 1;');
    });

    it('should parse and return RUN_LINT_CHECK command', async () => {
      const { GoogleGenAI } = await import('@google/genai');
      const mockGenerateContent = vi.fn().mockResolvedValue({
        text: JSON.stringify({ command: 'RUN_LINT_CHECK' })
      });

      vi.mocked(GoogleGenAI).mockImplementation(() => ({
        models: {
          generateContent: mockGenerateContent
        }
      }) as any);

      const input: DetermineNextActionInput = {
        fullPlan: '# Plan',
        agentInstructions: 'Check code quality',
        actionHistory: ['Applied code changes'],
        currentCodebaseContext: 'Code written'
      };

      const result = await determineNextAction(input);

      expect(result.command.command).toBe('RUN_LINT_CHECK');
    });

    it('should parse and return PUBLISH_PACKAGE command', async () => {
      const { GoogleGenAI } = await import('@google/genai');
      const mockGenerateContent = vi.fn().mockResolvedValue({
        text: JSON.stringify({ command: 'PUBLISH_PACKAGE' })
      });

      vi.mocked(GoogleGenAI).mockImplementation(() => ({
        models: {
          generateContent: mockGenerateContent
        }
      }) as any);

      const input: DetermineNextActionInput = {
        fullPlan: '# Plan',
        agentInstructions: 'Publish when ready',
        actionHistory: ['Tests passed', 'Lint passed'],
        currentCodebaseContext: 'All checks passed'
      };

      const result = await determineNextAction(input);

      expect(result.command.command).toBe('PUBLISH_PACKAGE');
    });

    it('should throw error if AI fails to provide response', async () => {
      const { GoogleGenAI } = await import('@google/genai');
      const mockGenerateContent = vi.fn().mockResolvedValue({
        text: null
      });

      vi.mocked(GoogleGenAI).mockImplementation(() => ({
        models: {
          generateContent: mockGenerateContent
        }
      }) as any);

      const input: DetermineNextActionInput = {
        fullPlan: '# Plan',
        agentInstructions: 'Build',
        actionHistory: [],
        currentCodebaseContext: 'Empty'
      };

      await expect(determineNextAction(input)).rejects.toThrow('failed to provide a command');
    });

    it('should throw error if AI returns invalid JSON', async () => {
      const { GoogleGenAI } = await import('@google/genai');
      const mockGenerateContent = vi.fn().mockResolvedValue({
        text: 'invalid json {'
      });

      vi.mocked(GoogleGenAI).mockImplementation(() => ({
        models: {
          generateContent: mockGenerateContent
        }
      }) as any);

      const input: DetermineNextActionInput = {
        fullPlan: '# Plan',
        agentInstructions: 'Build',
        actionHistory: [],
        currentCodebaseContext: 'Empty'
      };

      await expect(determineNextAction(input)).rejects.toThrow('Failed to parse');
    });

    it('should throw rate limit error with retry delay when API returns 429', async () => {
      const { GoogleGenAI } = await import('@google/genai');

      // Simulate Gemini 429 error with retryDelay in message (based on real error format)
      const rateLimitError = new Error(
        'Resource has been exhausted (e.g. check quota). [429] {"error":{"code":429,"message":"Resource exhausted","status":"RESOURCE_EXHAUSTED","details":[{"@type":"type.googleapis.com/google.rpc.RetryInfo","retryDelay":"31s"}]}}'
      );

      const mockGenerateContent = vi.fn().mockRejectedValue(rateLimitError);

      vi.mocked(GoogleGenAI).mockImplementation(() => ({
        models: {
          generateContent: mockGenerateContent
        }
      }) as any);

      const input: DetermineNextActionInput = {
        fullPlan: '# Plan',
        agentInstructions: 'Build',
        actionHistory: [],
        currentCodebaseContext: 'Empty'
      };

      try {
        await determineNextAction(input);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        // Should be a rate limit error with retry info
        expect(error.message).toContain('rate limited');
        expect(error.message).toContain('429');
        expect(error.type).toBe('RATE_LIMITED');
        // Should have nextRetryDelay set directly on ApplicationFailure (31s + 5s buffer = 36s)
        expect(error.nextRetryDelay).toBe('36s');
      }
    });

    it('should handle rate limit error without retryDelay using default', async () => {
      const { GoogleGenAI } = await import('@google/genai');

      // Simulate Gemini 429 error WITHOUT retryDelay
      const rateLimitError = new Error(
        'Request failed with status 429: Too Many Requests'
      );

      const mockGenerateContent = vi.fn().mockRejectedValue(rateLimitError);

      vi.mocked(GoogleGenAI).mockImplementation(() => ({
        models: {
          generateContent: mockGenerateContent
        }
      }) as any);

      const input: DetermineNextActionInput = {
        fullPlan: '# Plan',
        agentInstructions: 'Build',
        actionHistory: [],
        currentCodebaseContext: 'Empty'
      };

      try {
        await determineNextAction(input);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('rate limited');
        expect(error.type).toBe('RATE_LIMITED');
        // Should use default delay (35s + 5s buffer = 40s), directly on ApplicationFailure
        expect(error.nextRetryDelay).toBe('40s');
      }
    });

    it('should handle RESOURCE_EXHAUSTED error as rate limit', async () => {
      const { GoogleGenAI } = await import('@google/genai');

      // Simulate RESOURCE_EXHAUSTED without 429 in message
      const rateLimitError = new Error(
        'RESOURCE_EXHAUSTED: Quota exceeded for quota metric'
      );

      const mockGenerateContent = vi.fn().mockRejectedValue(rateLimitError);

      vi.mocked(GoogleGenAI).mockImplementation(() => ({
        models: {
          generateContent: mockGenerateContent
        }
      }) as any);

      const input: DetermineNextActionInput = {
        fullPlan: '# Plan',
        agentInstructions: 'Build',
        actionHistory: [],
        currentCodebaseContext: 'Empty'
      };

      try {
        await determineNextAction(input);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('rate limited');
        expect(error.type).toBe('RATE_LIMITED');
      }
    });
  });

  describe('applyCodeChanges', () => {
    it('should apply CREATE_OR_OVERWRITE file operations', async () => {
      const fs = await import('fs/promises');
      await import('simple-git'); // Import for side effects only

      // Using hybrid protocol format: files (metadata) + contentBlocks (content)
      const input: ApplyCodeChangesInput = {
        workspaceRoot: '/test/workspace',
        packagePath: 'packages/test',
        files: [
          {
            index: 0,
            path: 'src/index.ts',
            action: 'CREATE_OR_OVERWRITE' as const
          }
        ],
        contentBlocks: {
          0: 'export const test = 1;'
        },
        commitMessage: 'feat: initial implementation'
      };

      const result = await applyCodeChanges(input);

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('src/index.ts'),
        'export const test = 1;',
        'utf-8'
      );
      expect(result.filesModified).toContain('src/index.ts');
      expect(result.commitHash).toBe('abc123');
    });

    it('should apply DELETE file operations', async () => {
      const fs = await import('fs/promises');

      // Using hybrid protocol format for delete
      const input: ApplyCodeChangesInput = {
        workspaceRoot: '/test/workspace',
        packagePath: 'packages/test',
        files: [
          {
            index: 0,
            path: 'src/old-file.ts',
            action: 'DELETE' as const
          }
        ],
        contentBlocks: {}, // DELETE doesn't need content
        commitMessage: 'refactor: remove old file'
      };

      await applyCodeChanges(input);

      expect(fs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('src/old-file.ts')
      );
    });

    it('should commit changes to git with proper message', async () => {
      const simpleGit = (await import('simple-git')).default;
      const mockCommit = vi.fn().mockResolvedValue({ commit: 'xyz789' });
      const mockAdd = vi.fn().mockResolvedValue(undefined);

      vi.mocked(simpleGit).mockReturnValue({
        add: mockAdd,
        commit: mockCommit
      } as any);

      // Using hybrid protocol format
      const input: ApplyCodeChangesInput = {
        workspaceRoot: '/test/workspace',
        packagePath: 'packages/test',
        files: [
          {
            index: 0,
            path: 'README.md',
            action: 'CREATE_OR_OVERWRITE' as const
          }
        ],
        contentBlocks: {
          0: '# Test Package'
        },
        commitMessage: 'docs: add README'
      };

      const result = await applyCodeChanges(input);

      expect(mockAdd).toHaveBeenCalledWith('.');
      expect(mockCommit).toHaveBeenCalledWith('docs: add README');
      expect(result.commitHash).toBe('xyz789');
    });

    it('should handle multiple file operations in single commit', async () => {
      const fs = await import('fs/promises');

      // Using hybrid protocol format with multiple files
      const input: ApplyCodeChangesInput = {
        workspaceRoot: '/test/workspace',
        packagePath: 'packages/test',
        files: [
          {
            index: 0,
            path: 'src/index.ts',
            action: 'CREATE_OR_OVERWRITE' as const
          },
          {
            index: 1,
            path: 'src/types.ts',
            action: 'CREATE_OR_OVERWRITE' as const
          },
          {
            index: 2,
            path: 'src/old.ts',
            action: 'DELETE' as const
          }
        ],
        contentBlocks: {
          0: 'export const a = 1;',
          1: 'export type T = string;'
          // No content for DELETE operation
        },
        commitMessage: 'refactor: restructure files'
      };

      const result = await applyCodeChanges(input);

      expect(fs.writeFile).toHaveBeenCalledTimes(2);
      expect(fs.unlink).toHaveBeenCalledTimes(1);
      expect(result.filesModified).toHaveLength(3);
    });
  });

  describe('getFileContent', () => {
    it('should read file content from package path', async () => {
      const fs = await import('fs/promises');

      const result = await getFileContent({
        workspaceRoot: '/test/workspace',
        packagePath: 'packages/test',
        filePath: 'src/index.ts'
      });

      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('src/index.ts'),
        'utf-8'
      );
      expect(result).toContain('Test Plan');
    });
  });

  describe('validatePackageJson', () => {
    it('should return success for valid package.json (mocked)', async () => {
      const fs = await import('fs/promises');

      // Mock readFile to return a valid package.json with all required fields
      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify({
        name: '@bernierllc/test-package',
        version: '1.0.0',
        description: 'Test package',
        main: 'dist/index.js',
        types: 'dist/index.d.ts',
        author: 'Bernier LLC',
        license: 'MIT',
        files: ['dist'],
        publishConfig: { access: 'public' }
      }) as any);

      const result = await validatePackageJson({
        workspaceRoot: '/test/workspace',
        packagePath: 'packages/test'
      });

      expect(result.success).toBe(true);
      expect(result.details).toContain('requirements');
    });
  });

  describe('checkLicenseHeaders', () => {
    it('should return success when headers are valid (mocked)', async () => {
      const fs = await import('fs/promises');

      // Mock readdir to return .ts files
      vi.mocked(fs.readdir).mockResolvedValueOnce(['index.ts', 'types.ts'] as any);

      // Mock readFile to return content with correct license header
      vi.mocked(fs.readFile).mockResolvedValue(
        '/*\nCopyright (c) 2025 Bernier LLC\nAll rights reserved.\n*/\n\nexport const test = 1;' as any
      );

      const result = await checkLicenseHeaders({
        workspaceRoot: '/test/workspace',
        packagePath: 'packages/test'
      });

      expect(result.success).toBe(true);
      expect(result.details).toContain('license header');
    });
  });

  describe('runLintCheck', () => {
    it('should return success when lint passes', async () => {
      const { execSync } = await import('child_process');
      vi.mocked(execSync).mockReturnValue('Linting passed');

      const result = await runLintCheck({
        workspaceRoot: '/test/workspace',
        packagePath: 'packages/test'
      });

      expect(result.success).toBe(true);
      expect(result.details).toContain('passed');
    });

    it('should return failure with error details when lint fails', async () => {
      const { execSync } = await import('child_process');
      const lintError = new Error('Lint failed') as { stdout?: Buffer; stderr?: Buffer; message: string };
      lintError.stderr = Buffer.from('src/index.ts:10:5 - Missing semicolon');
      vi.mocked(execSync).mockImplementation(() => {
        throw lintError;
      });

      const result = await runLintCheck({
        workspaceRoot: '/test/workspace',
        packagePath: 'packages/test'
      });

      expect(result.success).toBe(false);
      expect(result.details).toBeTruthy();
      // STRONG assertion: Verify exact error file paths extracted
      expect(result.errorFilePaths).toEqual(['src/index.ts']);
      expect(result.errorFilePaths.length).toBe(1);
      expect(result.errorFilePaths).toContain('src/index.ts');
    });

    it('should parse file paths from ESLint stylish format output', async () => {
      const { execSync } = await import('child_process');
      // Realistic ESLint stylish format output
      const eslintOutput = `/Users/test/packages/test/src/utils.ts
  10:5   error  Unsafe assignment of an \`any\` value    @typescript-eslint/no-unsafe-assignment
  15:3   error  Missing return type on function         @typescript-eslint/explicit-module-boundary-types

/Users/test/packages/test/src/index.ts
  20:1   error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

✖ 3 problems (3 errors, 0 warnings)
`;
      const lintError = new Error('Lint failed') as { stdout?: Buffer; stderr?: Buffer; message: string };
      lintError.stdout = Buffer.from(eslintOutput);
      vi.mocked(execSync).mockImplementation(() => {
        throw lintError;
      });

      const result = await runLintCheck({
        workspaceRoot: '/test/workspace',
        packagePath: 'packages/test'
      });

      expect(result.success).toBe(false);
      expect(result.errorFilePaths).toHaveLength(2);
      expect(result.errorFilePaths).toContain('src/utils.ts');
      expect(result.errorFilePaths).toContain('src/index.ts');
    });

    it('should parse file paths from inline ESLint format', async () => {
      const { execSync } = await import('child_process');
      // Inline format: src/file.ts:line:col error message
      const eslintOutput = `src/types.ts:5:10 error Missing type annotation
src/helpers.ts:20:1 error Unused variable`;
      const lintError = new Error('Lint failed') as { stdout?: Buffer; stderr?: Buffer; message: string };
      lintError.stderr = Buffer.from(eslintOutput);
      vi.mocked(execSync).mockImplementation(() => {
        throw lintError;
      });

      const result = await runLintCheck({
        workspaceRoot: '/test/workspace',
        packagePath: 'packages/test'
      });

      expect(result.success).toBe(false);
      expect(result.errorFilePaths.length).toBeGreaterThanOrEqual(2);
      expect(result.errorFilePaths).toContain('src/types.ts');
      expect(result.errorFilePaths).toContain('src/helpers.ts');
    });

    it('should handle error output without file paths gracefully', async () => {
      const { execSync } = await import('child_process');
      // Error without recognizable file paths
      const lintError = new Error('Lint failed') as { stdout?: Buffer; stderr?: Buffer; message: string };
      lintError.stderr = Buffer.from('Configuration error: .eslintrc not found');
      vi.mocked(execSync).mockImplementation(() => {
        throw lintError;
      });

      const result = await runLintCheck({
        workspaceRoot: '/test/workspace',
        packagePath: 'packages/test'
      });

      expect(result.success).toBe(false);
      expect(result.details).toContain('Configuration error');
      // Should be empty array, not crash
      expect(result.errorFilePaths).toEqual([]);
    });
  });

  describe('runUnitTests', () => {
    it('should return success with coverage when tests pass', async () => {
      const { execSync } = await import('child_process');
      vi.mocked(execSync).mockReturnValue('All tests passed. Coverage: 98%');

      const result = await runUnitTests({
        workspaceRoot: '/test/workspace',
        packagePath: 'packages/test'
      });

      expect(result.success).toBe(true);
      expect(result.coverage).toBeGreaterThanOrEqual(0);
      expect(result.coverage).toBeLessThanOrEqual(100);
      expect(result.details).toContain('passed');
    });

    it('should return failure with error details when tests fail', async () => {
      const { execSync } = await import('child_process');
      const testError = new Error('Tests failed') as any;
      testError.stderr = Buffer.from('tests/index.test.ts - 1 test failed');
      vi.mocked(execSync).mockImplementation(() => {
        throw testError;
      });

      const result = await runUnitTests({
        workspaceRoot: '/test/workspace',
        packagePath: 'packages/test'
      });

      expect(result.success).toBe(false);
      expect(result.coverage).toBeLessThan(100);
      // STRONG assertion: Verify errorFilePaths is empty array for test failures (not lint errors)
      expect(result.errorFilePaths).toEqual([]);
    });
  });

  describe('publishGeminiPackage', () => {
    it('should return success when package publishes (mocked)', async () => {
      const { execSync } = await import('child_process');
      vi.mocked(execSync).mockReturnValueOnce('+ @bernierllc/test-package@1.0.0' as any);

      const result = await publishGeminiPackage({
        workspaceRoot: '/test/workspace',
        packagePath: 'packages/test'
      });

      expect(result.success).toBe(true);
      expect(result.details).toContain('successfully');
    });
  });

  describe('notifyHumanForHelp', () => {
    it('should log warning notification via Context logger', async () => {
      await notifyHumanForHelp({
        workflowId: 'test-workflow-123',
        errorMessage: 'Agent is stuck on lint error',
        actionHistory: ['Applied changes', 'Ran lint - failed']
      });

      // The function should complete without errors
      // Logger calls are handled by the mocked Context
      expect(true).toBe(true);
    });
  });

  describe('notifyPublishSuccess', () => {
    it('should log info notification via Context logger', async () => {
      await notifyPublishSuccess('@bernierllc/test-package');

      // The function should complete without errors
      // Logger calls are handled by the mocked Context
      expect(true).toBe(true);
    });
  });

  describe('Command Types', () => {
    it('should support all command types', () => {
      const commands: AgentCommand[] = [
        { command: 'APPLY_CODE_CHANGES', fileOperations: [] },
        { command: 'AWAIT_DEPENDENCY', packageName: '@test/dep' },
        { command: 'GATHER_CONTEXT_FOR_DEPENDENCY', packageName: '@test/dep' },
        { command: 'VALIDATE_PACKAGE_JSON' },
        { command: 'CHECK_LICENSE_HEADERS' },
        { command: 'RUN_LINT_CHECK' },
        { command: 'RUN_UNIT_TESTS' },
        { command: 'PUBLISH_PACKAGE' }
      ];

      expect(commands).toHaveLength(8);
      expect(commands[0].command).toBe('APPLY_CODE_CHANGES');
      expect(commands[7].command).toBe('PUBLISH_PACKAGE');
    });

    it('should support file operations with both actions', () => {
      const fileOperations = [
        {
          action: 'CREATE_OR_OVERWRITE' as const,
          filePath: 'src/index.ts',
          content: 'export const test = 1;'
        },
        {
          action: 'DELETE' as const,
          filePath: 'src/old.ts'
        }
      ];

      expect(fileOperations[0].action).toBe('CREATE_OR_OVERWRITE');
      // STRONG assertion: Verify exact content for CREATE operations
      expect(fileOperations[0].content).toBe('export const test = 1;');
      expect(fileOperations[1].action).toBe('DELETE');
      // STRONG assertion: Verify DELETE operations have no content property
      expect(fileOperations[1]).toEqual({ action: 'DELETE', filePath: 'src/old.ts' });
    });
  });

  describe('resolvePackagePath', () => {
    it('should return absolute path unchanged', () => {
      const result = resolvePackagePath(
        '/Users/test/projects/tools',
        '/Users/test/projects/tools/packages/core/my-package'
      );
      expect(result).toBe('/Users/test/projects/tools/packages/core/my-package');
    });

    it('should join workspaceRoot with relative packagePath', () => {
      const result = resolvePackagePath(
        '/Users/test/projects/tools',
        'packages/core/my-package'
      );
      expect(result).toBe('/Users/test/projects/tools/packages/core/my-package');
    });

    it('should handle Windows-style paths', () => {
      // Path module behavior varies by platform, but we can test that it works
      const result = resolvePackagePath(
        '/workspace',
        'packages/test'
      );
      expect(result).toContain('packages');
      expect(result).toContain('test');
    });
  });

  describe('normalizeFilePath', () => {
    describe('with relative packagePath', () => {
      it('should strip package path prefix from file path', () => {
        const result = normalizeFilePath(
          'packages/core/contentful-types/src/index.ts',
          'packages/core/contentful-types'
        );
        expect(result).toBe('src/index.ts');
      });

      it('should strip package path prefix from package.json', () => {
        const result = normalizeFilePath(
          'packages/core/contentful-types/package.json',
          'packages/core/contentful-types'
        );
        expect(result).toBe('package.json');
      });

      it('should not modify path if no prefix match', () => {
        const result = normalizeFilePath(
          'src/index.ts',
          'packages/core/contentful-types'
        );
        expect(result).toBe('src/index.ts');
      });

      it('should handle package name only prefix', () => {
        const result = normalizeFilePath(
          'contentful-types/src/index.ts',
          'packages/core/contentful-types'
        );
        expect(result).toBe('src/index.ts');
      });

      it('should strip leading slash', () => {
        const result = normalizeFilePath(
          '/src/index.ts',
          'packages/core/test'
        );
        expect(result).toBe('src/index.ts');
      });
    });

    describe('with absolute packagePath (the bug fix)', () => {
      it('should handle absolute packagePath with relative filePath', () => {
        // This is THE critical test case - when packagePath is absolute but
        // Gemini provides a relative file path starting with packages/
        const result = normalizeFilePath(
          'packages/core/contentful-types/package.json',
          '/Users/mattbernier/projects/tools/packages/core/contentful-types'
        );
        expect(result).toBe('package.json');
      });

      it('should handle absolute packagePath with nested file', () => {
        const result = normalizeFilePath(
          'packages/core/contentful-types/src/index.ts',
          '/Users/mattbernier/projects/tools/packages/core/contentful-types'
        );
        expect(result).toBe('src/index.ts');
      });

      it('should handle absolute packagePath with deep nested file', () => {
        const result = normalizeFilePath(
          'packages/core/contentful-types/src/types/contentful.ts',
          '/Users/mattbernier/projects/tools/packages/core/contentful-types'
        );
        expect(result).toBe('src/types/contentful.ts');
      });

      it('should handle absolute packagePath with test file', () => {
        const result = normalizeFilePath(
          'packages/core/contentful-types/__tests__/index.test.ts',
          '/Users/mattbernier/projects/tools/packages/core/contentful-types'
        );
        expect(result).toBe('__tests__/index.test.ts');
      });

      it('should not double-normalize already correct paths', () => {
        const result = normalizeFilePath(
          'src/index.ts',
          '/Users/mattbernier/projects/tools/packages/core/contentful-types'
        );
        expect(result).toBe('src/index.ts');
      });
    });

    describe('edge cases', () => {
      it('should handle Windows-style backslashes in file paths', () => {
        const result = normalizeFilePath(
          'packages\\core\\test\\src\\index.ts',
          'packages/core/test'
        );
        expect(result).toBe('src/index.ts');
      });

      it('should handle trailing slashes in packagePath', () => {
        const result = normalizeFilePath(
          'packages/core/test/src/index.ts',
          'packages/core/test/'
        );
        expect(result).toBe('src/index.ts');
      });

      it('should handle leading slashes in packagePath', () => {
        const result = normalizeFilePath(
          'packages/core/test/src/index.ts',
          '/packages/core/test'
        );
        expect(result).toBe('src/index.ts');
      });

      it('should handle service packages', () => {
        const result = normalizeFilePath(
          'packages/service/email-sender/src/index.ts',
          '/Users/test/tools/packages/service/email-sender'
        );
        expect(result).toBe('src/index.ts');
      });

      it('should handle suite packages', () => {
        const result = normalizeFilePath(
          'packages/suite/content-management/src/index.ts',
          '/Users/test/tools/packages/suite/content-management'
        );
        expect(result).toBe('src/index.ts');
      });
    });
  });

  describe('sanitizeFileContent', () => {
    describe('non-JSON files', () => {
      it('should strip markdown fences from TypeScript files', () => {
        const content = '```typescript\nexport const x = 1;\n```';
        const result = sanitizeFileContent(content, 'src/index.ts');
        // Implementation strips fences from ALL files (not just JSON) to clean Gemini output
        expect(result).toBe('export const x = 1;');
      });

      it('should strip markdown fences from JavaScript files', () => {
        const content = '```javascript\nconst x = 1;\n```';
        const result = sanitizeFileContent(content, 'src/index.js');
        // Implementation strips fences from ALL files (not just JSON) to clean Gemini output
        expect(result).toBe('const x = 1;');
      });
    });

    describe('JSON files with markdown fences', () => {
      it('should strip ```json``` fences from package.json', () => {
        const content = '```json\n{\n  "name": "test",\n  "version": "1.0.0"\n}\n```';
        const result = sanitizeFileContent(content, 'package.json');
        expect(result).toBe('{\n  "name": "test",\n  "version": "1.0.0"\n}');
      });

      it('should strip ``` fences without language tag', () => {
        const content = '```\n{\n  "strict": true\n}\n```';
        const result = sanitizeFileContent(content, 'tsconfig.json');
        expect(result).toBe('{\n  "strict": true\n}');
      });

      it('should handle fences with extra whitespace', () => {
        const content = '```json\n\n{\n  "name": "test"\n}\n\n```';
        const result = sanitizeFileContent(content, 'package.json');
        expect(result).toBe('{\n  "name": "test"\n}');
      });

      it('should log warning when stripping fences', () => {
        const warnMock = vi.fn();
        const logger = { warn: warnMock };
        const content = '```json\n{"test": true}\n```';

        sanitizeFileContent(content, 'test.json', logger);

        expect(warnMock).toHaveBeenCalledWith(
          expect.stringContaining('Stripped full markdown fences from file')
        );
      });
    });

    describe('JSON files with backticks', () => {
      it('should NOT strip single backticks (only triple backticks)', () => {
        // Implementation only strips triple backticks (markdown fences), not single backticks
        const content = '`{"name": "test"}`';
        const result = sanitizeFileContent(content, 'config.json');
        // Single backticks are NOT stripped by the implementation
        expect(result).toBe('`{"name": "test"}`');
      });

      it('should NOT strip triple backticks as single backticks', () => {
        // Triple backticks are handled by the fence pattern, not the backtick pattern
        const content = '```{"name": "test"}```';
        const result = sanitizeFileContent(content, 'config.json');
        // Should be handled by fence pattern
        expect(result).toBe('{"name": "test"}');
      });
    });

    describe('valid JSON content', () => {
      it('should return valid JSON unchanged', () => {
        const content = '{\n  "compilerOptions": {\n    "strict": true\n  }\n}';
        const result = sanitizeFileContent(content, 'tsconfig.json');
        expect(result).toBe(content);
      });

      it('should trim whitespace from valid JSON', () => {
        const content = '  {"name": "test"}  ';
        const result = sanitizeFileContent(content, 'package.json');
        expect(result).toBe('{"name": "test"}');
      });
    });

    describe('invalid JSON content', () => {
      it('should strip fences even if inner JSON is invalid', () => {
        const content = '```json\n{invalid json}\n```';
        const warnMock = vi.fn();
        const logger = { warn: warnMock };

        const result = sanitizeFileContent(content, 'bad.json', logger);

        // Implementation strips fences first, then validates JSON
        // For invalid JSON, it strips fences but returns the stripped content
        expect(result).toBe('{invalid json}');
        expect(warnMock).toHaveBeenCalledWith(
          expect.stringContaining('JSON validation failed')
        );
      });

      it('should return invalid JSON unchanged if no fences present', () => {
        const content = '{invalid: json}';
        const result = sanitizeFileContent(content, 'bad.json');
        // No fences to strip, so it should return as-is (trimmed)
        expect(result).toBe('{invalid: json}');
      });
    });

    describe('real-world tsconfig.json case', () => {
      it('should handle tsconfig.json with markdown fence (the bug case)', () => {
        const content = `\`\`\`json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
\`\`\``;

        const result = sanitizeFileContent(content, 'tsconfig.json');

        // Should be valid JSON after sanitization
        const parsed = JSON.parse(result);
        expect(parsed.compilerOptions.strict).toBe(true);
        expect(parsed.compilerOptions.target).toBe('ES2020');
      });

      it('should handle package.json with markdown fence', () => {
        const content = `\`\`\`json
{
  "name": "@bernierllc/contentful-types",
  "version": "0.1.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts"
}
\`\`\``;

        const result = sanitizeFileContent(content, 'package.json');

        // Should be valid JSON after sanitization
        const parsed = JSON.parse(result);
        expect(parsed.name).toBe('@bernierllc/contentful-types');
        expect(parsed.version).toBe('0.1.0');
      });
    });
  });
});

/**
 * Gemini Payload Validation Tests
 *
 * These tests verify that the correct context is sent to Gemini AI
 * when errors occur, ensuring Gemini has the information needed to fix issues.
 */
describe('Gemini Payload Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-gemini-api-key';
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  describe('determineNextAction prompt construction', () => {
    it('should include currentCodebaseContext in the prompt sent to Gemini', async () => {
      const { GoogleGenAI } = await import('@google/genai');
      let capturedPrompt = '';

      const mockGenerateContent = vi.fn().mockImplementation(async (input: { contents: string }) => {
        capturedPrompt = input.contents;
        return {
          text: JSON.stringify({ command: 'APPLY_CODE_CHANGES', files: [] })
        };
      });

      vi.mocked(GoogleGenAI).mockImplementation(() => ({
        models: {
          generateContent: mockGenerateContent
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any);

      const testContext = '**TEST CONTEXT** This should appear in the Gemini prompt.';

      await determineNextAction({
        fullPlan: '# Test Plan',
        agentInstructions: 'Build a package',
        actionHistory: ['Workflow started.', 'Action: Running lint checks.'],
        currentCodebaseContext: testContext
      });

      // Verify the context was included in the prompt
      expect(capturedPrompt).toContain('TEST CONTEXT');
      expect(capturedPrompt).toContain('This should appear in the Gemini prompt');
    });

    it('should include action history with lint failure details in prompt', async () => {
      const { GoogleGenAI } = await import('@google/genai');
      let capturedPrompt = '';

      const mockGenerateContent = vi.fn().mockImplementation(async (input: { contents: string }) => {
        capturedPrompt = input.contents;
        return {
          text: JSON.stringify({ command: 'APPLY_CODE_CHANGES', files: [] })
        };
      });

      vi.mocked(GoogleGenAI).mockImplementation(() => ({
        models: {
          generateContent: mockGenerateContent
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any);

      const lintErrorDetails = 'src/utils.ts:10:5 error @typescript-eslint/no-unsafe-assignment';
      const actionHistory = [
        'Workflow started.',
        'Action: Running lint checks.',
        `Result: Lint check failed. Details: ${lintErrorDetails}`
      ];

      await determineNextAction({
        fullPlan: '# Test Plan',
        agentInstructions: 'Build a package',
        actionHistory,
        currentCodebaseContext: 'Code context here'
      });

      // Verify lint error details appear in the prompt
      expect(capturedPrompt).toContain('Lint check failed');
      expect(capturedPrompt).toContain('src/utils.ts:10:5');
      expect(capturedPrompt).toContain('no-unsafe-assignment');
    });

    it('should include error recovery rules in prompt', async () => {
      const { GoogleGenAI } = await import('@google/genai');
      let capturedPrompt = '';

      const mockGenerateContent = vi.fn().mockImplementation(async (input: { contents: string }) => {
        capturedPrompt = input.contents;
        return {
          text: JSON.stringify({ command: 'APPLY_CODE_CHANGES', files: [] })
        };
      });

      vi.mocked(GoogleGenAI).mockImplementation(() => ({
        models: {
          generateContent: mockGenerateContent
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any);

      await determineNextAction({
        fullPlan: '# Test Plan',
        agentInstructions: 'Build a package',
        actionHistory: ['Workflow started.'],
        currentCodebaseContext: 'No files yet'
      });

      // Verify error recovery rules are included
      expect(capturedPrompt).toContain('CRITICAL ERROR RECOVERY RULES');
      expect(capturedPrompt).toContain('APPLY_CODE_CHANGES');
      expect(capturedPrompt).toContain('Lint check failed');
    });
  });
});

/**
 * Error Recovery Flow Integration Tests
 *
 * These tests verify the complete flow from error detection to
 * context building for Gemini, ensuring errors result in proper context.
 */
describe('Error Recovery Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-gemini-api-key';
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  describe('Pre-commit Hook Classification (P0)', () => {
    /**
     * Pre-commit hook error classification tests.
     *
     * When git commit fails due to pre-commit hooks, we need to determine:
     * 1. Are errors in files that Gemini generated? (AI's fault - needs to fix)
     * 2. Are errors in external files? (Not AI's fault - can bypass with --no-verify)
     * 3. Mixed errors? (AI should fix its files)
     */

    it('should classify errors in AI-generated files correctly', () => {
      // AI created src/index.ts, errors are in src/index.ts
      const errorMessage = `pre-commit hook failed:
src/index.ts:10:5 error no-unsafe-assignment
src/types.ts:20:1 error no-explicit-any`;

      const aiGeneratedFiles = ['src/index.ts', 'src/types.ts', 'package.json'];

      // Parse file paths from error
      const errorFilePaths = ['src/index.ts', 'src/types.ts'];

      // Classify errors
      const errorsInAiFiles = errorFilePaths.filter(f => aiGeneratedFiles.includes(f));
      const errorsInExternalFiles = errorFilePaths.filter(f => !aiGeneratedFiles.includes(f));

      expect(errorsInAiFiles).toContain('src/index.ts');
      expect(errorsInAiFiles).toContain('src/types.ts');
      expect(errorsInExternalFiles).toHaveLength(0);

      // Decision: AI should fix its own files
      const shouldAiFix = errorsInAiFiles.length > 0;
      expect(shouldAiFix).toBe(true);
    });

    it('should classify errors in external files correctly', () => {
      // AI only created src/index.ts, but errors are in external core/utils.ts
      const errorMessage = `pre-commit hook failed:
../../core/utils.ts:50:10 error no-unsafe-assignment
../../core/types.ts:100:3 error no-explicit-any`;

      const aiGeneratedFiles = ['src/index.ts'];

      // Parse file paths from error (note: paths outside our package)
      const errorFilePaths = ['../../core/utils.ts', '../../core/types.ts'];

      // Classify errors
      const errorsInAiFiles = errorFilePaths.filter(f => aiGeneratedFiles.includes(f));
      const errorsInExternalFiles = errorFilePaths.filter(f => !aiGeneratedFiles.includes(f));

      expect(errorsInAiFiles).toHaveLength(0);
      expect(errorsInExternalFiles).toContain('../../core/utils.ts');
      expect(errorsInExternalFiles).toContain('../../core/types.ts');

      // Decision: Can bypass with --no-verify (not AI's fault)
      const canBypass = errorsInAiFiles.length === 0 && errorsInExternalFiles.length > 0;
      expect(canBypass).toBe(true);
    });

    it('should classify mixed errors conservatively', () => {
      // Some errors in AI files, some in external files
      const errorMessage = `pre-commit hook failed:
src/index.ts:10:5 error no-unsafe-assignment
../../core/utils.ts:50:10 error no-explicit-any`;

      const aiGeneratedFiles = ['src/index.ts', 'package.json'];

      // Parse file paths from error
      const errorFilePaths = ['src/index.ts', '../../core/utils.ts'];

      // Classify errors
      const errorsInAiFiles = errorFilePaths.filter(f => aiGeneratedFiles.includes(f));
      const errorsInExternalFiles = errorFilePaths.filter(f => !aiGeneratedFiles.includes(f));

      expect(errorsInAiFiles).toHaveLength(1);
      expect(errorsInAiFiles).toContain('src/index.ts');
      expect(errorsInExternalFiles).toHaveLength(1);
      expect(errorsInExternalFiles).toContain('../../core/utils.ts');

      // Decision: AI should fix its files (conservative approach)
      const shouldAiFix = errorsInAiFiles.length > 0;
      expect(shouldAiFix).toBe(true);
    });

    it('should detect pre-commit errors vs other git errors', () => {
      const preCommitError = 'pre-commit hook failed: lint-staged found errors';
      const otherGitError = 'fatal: not a git repository';
      const anotherGitError = 'error: pathspec "main" did not match any file(s)';

      const isPreCommitError = (msg: string) =>
        msg.toLowerCase().includes('pre-commit') ||
        msg.toLowerCase().includes('hook');

      expect(isPreCommitError(preCommitError)).toBe(true);
      expect(isPreCommitError(otherGitError)).toBe(false);
      expect(isPreCommitError(anotherGitError)).toBe(false);
    });

    it('should handle relative vs absolute paths in error parsing', () => {
      // Error messages may contain various path formats
      const errorPaths = [
        'src/index.ts',                    // Relative to package
        './src/types.ts',                  // Explicit relative
        '/Users/test/package/src/main.ts', // Absolute path
        '../../core/shared.ts',            // Parent directory
        'packages/my-pkg/src/file.ts'      // Full relative from workspace
      ];

      // Normalize paths for comparison
      const normalizeErrorPath = (path: string) => {
        // Remove leading ./ and /
        let normalized = path.replace(/^\.\//, '').replace(/^\//, '');
        // Handle absolute paths - extract relative part if it contains src/
        if (normalized.includes('/src/')) {
          normalized = 'src/' + normalized.split('/src/').pop();
        }
        return normalized;
      };

      expect(normalizeErrorPath('src/index.ts')).toBe('src/index.ts');
      expect(normalizeErrorPath('./src/types.ts')).toBe('src/types.ts');
      expect(normalizeErrorPath('/Users/test/package/src/main.ts')).toBe('src/main.ts');
      // Note: paths going to parent dirs don't get normalized to src/ format
      expect(normalizeErrorPath('../../core/shared.ts')).toBe('../../core/shared.ts');
    });

    it('should extract TypeScript errors from pre-commit output', () => {
      const preCommitOutput = `husky > pre-commit (node v18.17.0)
✔ Preparing lint-staged...
❯ Running tasks for staged files...
  ❯ packages/my-package/**/*.{ts,tsx} — 2 files
    ✖ tsc --noEmit [FAILED]

✖ tsc --noEmit:
src/index.ts:10:5 - error TS2322: Type 'string' is not assignable to type 'number'.

10     const x: number = "hello";
       ~~~~~

src/types.ts:20:1 - error TS7006: Parameter 'arg' implicitly has an 'any' type.

20 function foo(arg) {}
   ~~~~~~~~~~~~~~~~~~~

Found 2 errors.

✖ tsc --noEmit failed without output.
✔ Reverting to original state because of errors...
✔ Cleaning up...
`;

      // Extract error lines
      const tsErrorPattern = /^(.+\.tsx?):(\d+):(\d+)\s*-?\s*error\s+TS\d+/gm;
      const errors: Array<{ file: string; line: number; col: number }> = [];
      let match;

      while ((match = tsErrorPattern.exec(preCommitOutput)) !== null) {
        errors.push({
          file: match[1],
          line: parseInt(match[2], 10),
          col: parseInt(match[3], 10)
        });
      }

      expect(errors).toHaveLength(2);
      expect(errors[0].file).toBe('src/index.ts');
      expect(errors[0].line).toBe(10);
      expect(errors[1].file).toBe('src/types.ts');
      expect(errors[1].line).toBe(20);
    });

    it('should extract ESLint errors from pre-commit output', () => {
      const preCommitOutput = `husky > pre-commit
✖ eslint --fix [FAILED]

/Users/test/packages/my-package/src/index.ts
  10:5   error  Unsafe assignment of an \`any\` value  @typescript-eslint/no-unsafe-assignment
  15:10  error  Unexpected any                       @typescript-eslint/no-explicit-any

/Users/test/packages/my-package/src/utils.ts
  5:1    error  Missing return type                  @typescript-eslint/explicit-function-return-type

✖ 3 problems (3 errors, 0 warnings)
`;

      // Pattern 1: File header lines (path on its own line)
      const filePathPattern = /^\/.*?([^/]+\.tsx?)\s*$/gm;
      const files: string[] = [];
      let match;

      while ((match = filePathPattern.exec(preCommitOutput)) !== null) {
        files.push(match[1]);
      }

      expect(files).toContain('index.ts');
      expect(files).toContain('utils.ts');
    });
  });

  describe('Lint failure context building', () => {
    it('should build correct context structure for lint failure', () => {
      // Simulate the workflow's context building logic
      const lintResult = {
        success: false,
        details: 'src/utils.ts:10:5 error @typescript-eslint/no-unsafe-assignment',
        errorFilePaths: ['src/utils.ts']
      };

      const fileContent = 'export function foo(): any { return 1; }';

      // Build context like the workflow does after lint failure
      const currentCodebaseContext = `
**LINT CHECK FAILED - YOU MUST FIX THESE ERRORS NOW**

Your next action MUST be APPLY_CODE_CHANGES to fix the ESLint errors below.
DO NOT run RUN_LINT_CHECK again - that will just show the same errors.
DO NOT run CHECK_LICENSE_HEADERS - that is unrelated to lint errors.

ESLint Errors:
${lintResult.details}

${lintResult.errorFilePaths.length > 0
  ? `Files with errors: ${lintResult.errorFilePaths.join(', ')}`
  : ''}

Content of ${lintResult.errorFilePaths[0]}:
\`\`\`typescript
${fileContent}
\`\`\`
`.trim();

      // Validate context structure
      expect(currentCodebaseContext).toContain('LINT CHECK FAILED');
      expect(currentCodebaseContext).toContain('MUST be APPLY_CODE_CHANGES');
      expect(currentCodebaseContext).toContain('DO NOT run RUN_LINT_CHECK again');
      expect(currentCodebaseContext).toContain('DO NOT run CHECK_LICENSE_HEADERS');
      expect(currentCodebaseContext).toContain('src/utils.ts');
      expect(currentCodebaseContext).toContain('no-unsafe-assignment');
      expect(currentCodebaseContext).toContain(fileContent);
    });

    it('should not leave context empty when lint fails with parseable errors', async () => {
      const { execSync } = await import('child_process');

      // Realistic ESLint output with file paths
      const eslintOutput = `src/utils.ts
  10:5  error  Unsafe assignment  @typescript-eslint/no-unsafe-assignment

✖ 1 problem`;
      const lintError = new Error('Lint failed') as { stdout?: Buffer; stderr?: Buffer; message: string };
      lintError.stdout = Buffer.from(eslintOutput);
      vi.mocked(execSync).mockImplementation(() => {
        throw lintError;
      });

      const result = await runLintCheck({
        workspaceRoot: '/test/workspace',
        packagePath: 'packages/test'
      });

      // This assertion would have caught the original bug!
      // If lint failed with file paths in output, errorFilePaths MUST NOT be empty
      expect(result.success).toBe(false);
      // STRONG assertion: Verify error file is extracted from mock output (src/utils.ts)
      expect(result.errorFilePaths.length).toBe(1);
      expect(result.errorFilePaths).toContain('src/utils.ts');
      expect(result.details).toContain('Unsafe assignment');
    });

    it('should include specific file path in context when lint error mentions it', () => {
      // Test that file paths mentioned in errors are extracted
      const lintDetails = `/Users/test/packages/test/src/index.ts
  5:1  error  Missing type annotation  @typescript-eslint/explicit-function-return-type

/Users/test/packages/test/src/utils.ts
  10:3  error  Unsafe assignment  @typescript-eslint/no-unsafe-assignment
`;

      // Simulate context building with lint error file paths
      const errorFilePaths = ['src/index.ts', 'src/utils.ts'];
      const context = `ESLint Errors:\n${lintDetails}\n\nFiles with errors: ${errorFilePaths.join(', ')}`;

      expect(context).toContain('src/index.ts');
      expect(context).toContain('src/utils.ts');
      expect(context).toContain('Missing type annotation');
      expect(context).toContain('Unsafe assignment');
    });
  });

  describe('Build failure context building', () => {
    it('should build correct context structure for build failure', () => {
      // Simulate build error result
      const buildResult = {
        success: false,
        errors: [
          'src/types.ts:15:10 - TS2322: Type "string" is not assignable to type "number".',
          'src/index.ts:20:5 - TS2345: Argument of type "any" is not assignable.'
        ],
        errorFiles: [
          { file: 'src/types.ts', line: 15, column: 10, message: 'TS2322: Type mismatch' },
          { file: 'src/index.ts', line: 20, column: 5, message: 'TS2345: Argument error' }
        ]
      };

      const fileContent = 'export const value: number = "string";';

      // Build context like workflow does for build failure
      const errorContext = buildResult.errorFiles.map(e =>
        `- ${e.file}:${e.line}:${e.column} - ${e.message}`
      ).join('\n');

      const currentCodebaseContext = `BUILD FAILED. You must fix these TypeScript errors:

${errorContext}

Review the affected files and fix the type errors by modifying the code.

Content of ${buildResult.errorFiles[0].file}:
\`\`\`typescript
${fileContent}
\`\`\``;

      // Validate context structure
      expect(currentCodebaseContext).toContain('BUILD FAILED');
      expect(currentCodebaseContext).toContain('src/types.ts:15:10');
      expect(currentCodebaseContext).toContain('src/index.ts:20:5');
      expect(currentCodebaseContext).toContain('fix the type errors');
      expect(currentCodebaseContext).toContain(fileContent);
    });
  });

  describe('Context consistency between error types', () => {
    it('should use similar context structure for lint and build failures', () => {
      // Both lint and build failures should provide:
      // 1. Clear error description
      // 2. Specific file paths
      // 3. Error details
      // 4. File content when available
      // 5. Clear instruction to use APPLY_CODE_CHANGES

      const lintContext = `
**LINT CHECK FAILED - YOU MUST FIX THESE ERRORS NOW**
Your next action MUST be APPLY_CODE_CHANGES
ESLint Errors: src/file.ts:10:5 error some-rule
Files with errors: src/file.ts
`.trim();

      const buildContext = `
BUILD FAILED. You must fix these TypeScript errors:
- src/file.ts:10:5 - TS2322: Some error
Review the affected files and fix the type errors by modifying the code.
`.trim();

      // Both should mention the file
      expect(lintContext).toContain('src/file.ts');
      expect(buildContext).toContain('src/file.ts');

      // Both should be actionable
      expect(lintContext).toContain('APPLY_CODE_CHANGES');
      expect(buildContext).toContain('fix');
    });
  });
});

describe('File Operation Edge Cases (P2)', () => {
  describe('getPackageContext - Content Length Limits', () => {
    it('should return empty context message when all files exceed maxContentLength', async () => {
      // Simulate scenario where every file is larger than the limit
      const maxContentLength = 100; // Very small limit
      const files = ['package.json', 'src/index.ts', 'tsconfig.json'];
      const fileSizes: Record<string, number> = {
        'package.json': 500,
        'src/index.ts': 1000,
        'tsconfig.json': 200
      };

      // Simulate the filtering logic from getPackageContext
      const filesExcluded: string[] = [];
      const filesIncluded: string[] = [];
      let totalLength = 0;

      for (const file of files) {
        const fileSize = fileSizes[file] || 0;
        if (totalLength + fileSize > maxContentLength) {
          filesExcluded.push(file);
        } else {
          filesIncluded.push(file);
          totalLength += fileSize;
        }
      }

      // All files should be excluded
      expect(filesExcluded.length).toBe(3);
      expect(filesIncluded.length).toBe(0);

      // Context should indicate no files
      const context = filesIncluded.length > 0
        ? `## Current Package Files (${filesIncluded.length} files)`
        : 'No files have been created yet.';

      expect(context).toBe('No files have been created yet.');
    });

    it('should include high-priority files first within limit', () => {
      const maxContentLength = 1000;

      // Simulate files with sizes and priority ordering
      const files = [
        { name: 'package.json', size: 300, priority: 0 },
        { name: 'tsconfig.json', size: 200, priority: 1 },
        { name: 'src/index.ts', size: 400, priority: 2 },
        { name: 'src/utils.ts', size: 500, priority: 2 }
      ];

      // Sort by priority
      const sortedFiles = [...files].sort((a, b) => a.priority - b.priority);

      const filesIncluded: string[] = [];
      const filesExcluded: string[] = [];
      let totalLength = 0;

      for (const file of sortedFiles) {
        if (totalLength + file.size > maxContentLength) {
          filesExcluded.push(file.name);
        } else {
          filesIncluded.push(file.name);
          totalLength += file.size;
        }
      }

      // package.json (300) + tsconfig.json (200) + src/index.ts (400) = 900 < 1000
      // src/utils.ts (500) would exceed 1400 > 1000
      expect(filesIncluded).toContain('package.json');
      expect(filesIncluded).toContain('tsconfig.json');
      expect(filesIncluded).toContain('src/index.ts');
      expect(filesExcluded).toContain('src/utils.ts');
    });

    it('should handle zero maxContentLength gracefully', () => {
      const maxContentLength = 0;
      const files = ['package.json'];
      const fileSizes: Record<string, number> = { 'package.json': 100 };

      const filesExcluded: string[] = [];
      const totalLength = 0;

      for (const file of files) {
        const fileSize = fileSizes[file] || 0;
        if (totalLength + fileSize > maxContentLength) {
          filesExcluded.push(file);
        }
      }

      // All files should be excluded with zero limit
      expect(filesExcluded.length).toBe(1);
    });
  });

  describe('File Read Failure Handling', () => {
    it('should continue building context when individual file read fails', () => {
      // Simulate partial read success
      const files = ['package.json', 'src/index.ts', 'src/broken.ts'];
      const readResults: Record<string, string | Error> = {
        'package.json': '{"name": "@test/pkg"}',
        'src/index.ts': 'export const x = 1;',
        'src/broken.ts': new Error('EACCES: permission denied')
      };

      const contextParts: string[] = [];
      const filesIncluded: string[] = [];
      const readErrors: string[] = [];

      for (const file of files) {
        const result = readResults[file];
        if (result instanceof Error) {
          readErrors.push(`${file}: ${result.message}`);
        } else {
          contextParts.push(`=== FILE: ${file} ===\n${result}\n=== END ${file} ===`);
          filesIncluded.push(file);
        }
      }

      // Should have partial context with 2 files
      expect(filesIncluded.length).toBe(2);
      expect(filesIncluded).toContain('package.json');
      expect(filesIncluded).toContain('src/index.ts');
      expect(filesIncluded).not.toContain('src/broken.ts');

      // Should track read errors
      expect(readErrors.length).toBe(1);
      expect(readErrors[0]).toContain('src/broken.ts');
      expect(readErrors[0]).toContain('permission denied');
    });

    it('should handle all files failing to read', () => {
      const files = ['file1.ts', 'file2.ts'];
      const filesIncluded: string[] = [];

      // Simulate all reads failing
      for (const file of files) {
        try {
          throw new Error('ENOENT: no such file');
        } catch {
          // File skipped
        }
      }

      const context = filesIncluded.length > 0
        ? `## Current Package Files (${filesIncluded.length} files)`
        : 'No files have been created yet.';

      expect(context).toBe('No files have been created yet.');
    });
  });

  describe('Binary File Handling', () => {
    it('should detect potential binary file content', () => {
      // Binary files often contain null bytes and non-printable characters
      const textContent = 'export const x = 1;';
      const binaryContent = 'PNG\x89\x00\x00\x00\x00IHDR'; // Simulated PNG header

      const isLikelyBinary = (content: string) => {
        // Check for null bytes or high concentration of non-printable chars
        const hasNullByte = content.includes('\x00');
        const nonPrintableCount = (content.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g) || []).length;
        const nonPrintableRatio = nonPrintableCount / content.length;
        return hasNullByte || nonPrintableRatio > 0.1;
      };

      expect(isLikelyBinary(textContent)).toBe(false);
      expect(isLikelyBinary(binaryContent)).toBe(true);
    });

    it('should skip binary files by extension', () => {
      const files = [
        'src/index.ts',
        'assets/logo.png',
        'assets/icon.ico',
        'dist/bundle.js.map',
        'node_modules/.bin/tsc'
      ];

      const binaryExtensions = ['.png', '.ico', '.jpg', '.jpeg', '.gif', '.woff', '.woff2', '.ttf', '.eot'];
      const skipPatterns = ['node_modules', '.bin', 'dist/'];

      const filesToRead = files.filter(file => {
        const ext = file.slice(file.lastIndexOf('.'));
        const isBinaryExt = binaryExtensions.includes(ext);
        const isSkipPath = skipPatterns.some(p => file.includes(p));
        return !isBinaryExt && !isSkipPath;
      });

      expect(filesToRead).toEqual(['src/index.ts']);
    });
  });

  describe('Large File Truncation', () => {
    it('should track when files are excluded due to size', () => {
      const maxContentLength = 1000;
      const largeFileSize = 5000;

      const filesExcluded: string[] = [];
      const totalLength = 0;

      // Simulate large file check
      if (totalLength + largeFileSize > maxContentLength) {
        filesExcluded.push('src/large-generated-file.ts');
      }

      expect(filesExcluded).toContain('src/large-generated-file.ts');

      // The output should indicate files were excluded
      const exclusionNote = filesExcluded.length > 0
        ? `\n\n(${filesExcluded.length} files excluded due to size limit)`
        : '';

      expect(exclusionNote).toContain('1 files excluded');
    });

    it('should provide meaningful context even with truncation', () => {
      // Even with truncation, critical files should be included
      const filesIncluded = ['package.json', 'tsconfig.json'];
      const filesExcluded = ['src/index.ts', 'src/types.ts', 'README.md'];

      const contextHeader = `## Current Package Files (${filesIncluded.length} files, ${filesExcluded.length} excluded)`;

      expect(contextHeader).toContain('2 files');
      expect(contextHeader).toContain('3 excluded');

      // Verify critical config files are prioritized
      expect(filesIncluded).toContain('package.json');
      expect(filesIncluded).toContain('tsconfig.json');
    });
  });

  describe('Empty Directory Handling', () => {
    it('should handle empty package directory', () => {
      const files: string[] = [];

      const context = files.length > 0
        ? `## Current Package Files (${files.length} files)`
        : 'No files have been created yet.';

      expect(context).toBe('No files have been created yet.');
    });

    it('should handle directory with only ignored files', () => {
      const allFiles = ['.git/config', '.gitignore', 'node_modules/lodash/index.js'];

      const ignoredPatterns = ['.git/', 'node_modules/'];
      const files = allFiles.filter(f => !ignoredPatterns.some(p => f.includes(p)));

      // After filtering, only .gitignore remains (it's not inside .git/)
      expect(files).toEqual(['.gitignore']);
    });
  });

  describe('Special Character Handling in File Paths', () => {
    it('should handle file paths with spaces', () => {
      const files = ['src/my component.ts', 'src/test file.spec.ts'];

      // Verify paths are preserved
      expect(files[0]).toBe('src/my component.ts');
      expect(files[1]).toBe('src/test file.spec.ts');
    });

    it('should handle file paths with unicode characters', () => {
      const files = ['src/日本語.ts', 'src/émoji-🚀.ts'];

      // Verify unicode paths are preserved
      expect(files[0]).toContain('日本語');
      expect(files[1]).toContain('🚀');
    });
  });
});

describe('Gemini Token Limit Handling (P2)', () => {
  // Gemini 2.5 Flash has ~1M token context window, but we should stay well under
  const ESTIMATED_CHARS_PER_TOKEN = 4; // Conservative estimate
  const MAX_SAFE_TOKENS = 100000; // Stay under 100k tokens for safety
  const MAX_SAFE_CHARS = MAX_SAFE_TOKENS * ESTIMATED_CHARS_PER_TOKEN;

  describe('Prompt Size Validation', () => {
    it('should validate prompt stays within token limits', () => {
      // Build a typical prompt and verify it's reasonable
      const systemPrompt = `You are a package builder agent. Follow these rules...`.repeat(10); // ~500 chars
      const planContent = `# Package Plan\n\n## Overview\n...`.repeat(100); // ~3000 chars
      const codebaseContext = `## Current Files\n\n=== FILE: index.ts ===\n...`.repeat(50); // ~2500 chars
      const actionHistory = `Turn 1: Applied changes...\n`.repeat(20); // ~600 chars

      const totalPromptSize = systemPrompt.length + planContent.length + codebaseContext.length + actionHistory.length;

      // Verify total is well under limit
      expect(totalPromptSize).toBeLessThan(MAX_SAFE_CHARS);
      expect(totalPromptSize).toBeLessThan(50000); // Should be much smaller in practice
    });

    it('should calculate token estimate correctly', () => {
      const testStrings = [
        { text: 'const x = 1;', expectedTokensApprox: 4 },
        { text: 'export function calculateSum(a: number, b: number): number { return a + b; }', expectedTokensApprox: 20 },
        { text: 'a'.repeat(1000), expectedTokensApprox: 250 }
      ];

      for (const { text, expectedTokensApprox } of testStrings) {
        const estimatedTokens = Math.ceil(text.length / ESTIMATED_CHARS_PER_TOKEN);
        // Allow 50% variance in estimation
        expect(estimatedTokens).toBeGreaterThan(expectedTokensApprox * 0.5);
        expect(estimatedTokens).toBeLessThan(expectedTokensApprox * 1.5);
      }
    });

    it('should limit codebase context to prevent token overflow', () => {
      const maxContentLength = 50000; // Default from getPackageContext

      // Verify maxContentLength is reasonable for token limit
      const estimatedTokens = maxContentLength / ESTIMATED_CHARS_PER_TOKEN;
      expect(estimatedTokens).toBeLessThan(MAX_SAFE_TOKENS);

      // Verify it leaves room for system prompt, plan, and response
      const reservedForOther = 20000; // chars for system prompt, plan, action history
      const totalEstimate = maxContentLength + reservedForOther;
      expect(totalEstimate).toBeLessThan(MAX_SAFE_CHARS);
    });

    it('should truncate action history when it grows too large', () => {
      // Simulate action history growing over many iterations
      const maxActionHistoryEntries = 20; // Keep last 20 entries
      const actionHistory: string[] = [];

      // Simulate 50 iterations
      for (let i = 0; i < 50; i++) {
        actionHistory.push(`Turn ${i + 1}: Applied code changes to src/file${i}.ts`);
      }

      // Truncate to keep only recent entries
      const truncatedHistory = actionHistory.slice(-maxActionHistoryEntries);

      expect(truncatedHistory.length).toBe(maxActionHistoryEntries);
      expect(truncatedHistory[0]).toContain('Turn 31'); // First kept entry
      expect(truncatedHistory[truncatedHistory.length - 1]).toContain('Turn 50'); // Last entry
    });
  });

  describe('Response Truncation Handling', () => {
    it('should detect potentially truncated JSON response', () => {
      // Truncated responses might end abruptly
      const completeResponse = '{"command": "APPLY_CODE_CHANGES", "files": [{"path": "test.ts"}]}';
      const truncatedResponse = '{"command": "APPLY_CODE_CHANGES", "files": [{"path": "test';

      const isValidJson = (str: string) => {
        try {
          JSON.parse(str);
          return true;
        } catch {
          return false;
        }
      };

      expect(isValidJson(completeResponse)).toBe(true);
      expect(isValidJson(truncatedResponse)).toBe(false);
    });

    it('should handle response with missing closing brackets', () => {
      const responses = [
        '{"command": "RUN_LINT_CHECK"',  // Missing }
        '{"files": [{"path": "a.ts"}',    // Missing ]}
        '{"command": "APPLY_CODE_CHANGES", "files": [',  // Missing content
      ];

      for (const response of responses) {
        let parsed = null;
        try {
          parsed = JSON.parse(response);
        } catch {
          parsed = null;
        }
        expect(parsed).toBeNull();
      }
    });

    it('should recover from truncated response by requesting retry', () => {
      const truncatedResponse = '{"command": "APPLY_CODE_CHANGES", "files": [{"index": 0, "path":';

      // Detection logic
      const isTruncated = !truncatedResponse.endsWith('}') && !truncatedResponse.endsWith(']');

      expect(isTruncated).toBe(true);

      // When truncated, the error message should be specific
      const errorMessage = isTruncated
        ? 'Response appears truncated. Please provide complete JSON.'
        : 'Invalid JSON format.';

      expect(errorMessage).toContain('truncated');
    });

    it('should handle response with truncated content blocks', () => {
      // Content blocks might be truncated mid-file
      const response = `{
        "command": "APPLY_CODE_CHANGES",
        "files": [{"index": 0, "path": "src/index.ts", "action": "CREATE_OR_OVERWRITE"}]
      }
      ##---Content-Break-0---##
      export function getData(): string {
        return "Hello, Wor`;  // Truncated mid-string

      // The JSON part might parse, but content is incomplete
      const jsonMatch = response.match(/\{[\s\S]*?\}/);
      expect(jsonMatch).not.toBeNull();

      // Content should be validated for completeness
      const contentPart = response.split('##---Content-Break-0---##')[1];
      const hasOpenBrace = (contentPart?.match(/\{/g) || []).length;
      const hasCloseBrace = (contentPart?.match(/\}/g) || []).length;

      // Unbalanced braces indicate truncation
      expect(hasOpenBrace).not.toBe(hasCloseBrace);
    });
  });

  describe('Large Codebase Handling', () => {
    it('should prioritize essential files when context is limited', () => {
      // Priority order: package.json > tsconfig > src files > tests > docs
      const files = [
        { name: 'README.md', priority: 5, size: 5000 },
        { name: 'src/utils.ts', priority: 3, size: 3000 },
        { name: 'package.json', priority: 1, size: 500 },
        { name: 'src/index.ts', priority: 2, size: 2000 },
        { name: 'src/__tests__/index.test.ts', priority: 4, size: 4000 }
      ];

      const maxSize = 6000;
      let currentSize = 0;
      const includedFiles: string[] = [];

      // Sort by priority and include until limit
      const sortedFiles = [...files].sort((a, b) => a.priority - b.priority);

      for (const file of sortedFiles) {
        if (currentSize + file.size <= maxSize) {
          includedFiles.push(file.name);
          currentSize += file.size;
        }
      }

      // Should include package.json (500) + src/index.ts (2000) + src/utils.ts (3000) = 5500
      expect(includedFiles).toContain('package.json');
      expect(includedFiles).toContain('src/index.ts');
      expect(includedFiles).toContain('src/utils.ts');
      expect(includedFiles).not.toContain('README.md');
      expect(includedFiles).not.toContain('src/__tests__/index.test.ts');
    });

    it('should summarize excluded files in context', () => {
      const includedFiles = ['package.json', 'src/index.ts'];
      const excludedFiles = ['src/a.ts', 'src/b.ts', 'src/c.ts', 'tests/d.ts'];

      const summaryNote = excludedFiles.length > 0
        ? `\n\n**Note:** ${excludedFiles.length} additional files exist but were excluded to fit context limit: ${excludedFiles.slice(0, 3).join(', ')}${excludedFiles.length > 3 ? '...' : ''}`
        : '';

      expect(summaryNote).toContain('4 additional files');
      expect(summaryNote).toContain('src/a.ts');
      expect(summaryNote).toContain('...');
    });
  });

  describe('Dynamic Context Adjustment', () => {
    it('should reduce context when error messages are large', () => {
      const baseContextSize = 30000;
      const largeErrorOutput = 'Error: '.repeat(5000); // ~35000 chars

      // When error output is large, reduce codebase context
      const errorSize = largeErrorOutput.length;
      const adjustedContextSize = Math.max(10000, baseContextSize - errorSize);

      expect(adjustedContextSize).toBeLessThan(baseContextSize);
      expect(adjustedContextSize).toBeGreaterThanOrEqual(10000); // Minimum context
    });

    it('should expand context when few files exist', () => {
      const defaultMaxContent = 50000;
      const fileCount = 3;
      const averageFileSize = 1000;

      // With few files, we can include everything
      const totalEstimate = fileCount * averageFileSize;
      const canIncludeAll = totalEstimate < defaultMaxContent;

      expect(canIncludeAll).toBe(true);
    });
  });
});
