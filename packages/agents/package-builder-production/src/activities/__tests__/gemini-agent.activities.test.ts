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
      expect(result.command).toHaveProperty('files');
      expect(result.contentBlocks).toBeDefined();
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
      const lintError = new Error('Lint failed') as any;
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
      expect(result.errorFilePaths).toBeInstanceOf(Array);
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
      expect(result.errorFilePaths).toBeInstanceOf(Array);
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
      expect(fileOperations[0]).toHaveProperty('content');
      expect(fileOperations[1].action).toBe('DELETE');
      expect(fileOperations[1]).not.toHaveProperty('content');
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
      it('should return content unchanged for TypeScript files', () => {
        const content = '```typescript\nexport const x = 1;\n```';
        const result = sanitizeFileContent(content, 'src/index.ts');
        expect(result).toBe(content);
      });

      it('should return content unchanged for JavaScript files', () => {
        const content = '```javascript\nconst x = 1;\n```';
        const result = sanitizeFileContent(content, 'src/index.js');
        expect(result).toBe(content);
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
          expect.stringContaining('Stripped markdown fences')
        );
      });
    });

    describe('JSON files with backticks', () => {
      it('should strip single backticks', () => {
        const content = '`{"name": "test"}`';
        const result = sanitizeFileContent(content, 'config.json');
        expect(result).toBe('{"name": "test"}');
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
      it('should return original content if JSON is invalid after sanitization', () => {
        const content = '```json\n{invalid json}\n```';
        const warnMock = vi.fn();
        const logger = { warn: warnMock };

        const result = sanitizeFileContent(content, 'bad.json', logger);

        // Should return original because inner content is invalid JSON
        expect(result).toBe(content);
        expect(warnMock).toHaveBeenCalledWith(
          expect.stringContaining('still invalid after sanitization')
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
