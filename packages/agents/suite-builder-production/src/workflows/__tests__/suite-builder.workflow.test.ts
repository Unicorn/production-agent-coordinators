import { describe, it, expect } from 'vitest';
import type { PackageWorkflowInput } from '../../types/index';

describe('SuiteBuilderWorkflow', () => {
  describe('Input Validation', () => {
    it('should accept minimal packageName input', () => {
      const input: PackageWorkflowInput = {
        packageName: '@bernierllc/test-package',
        config: {
          workspaceRoot: '/test/workspace',
          npmRegistry: 'https://registry.npmjs.org/',
          npmToken: 'test-token',
          maxConcurrentBuilds: 4,
          temporal: {
            address: 'localhost:7233',
            namespace: 'default',
            taskQueue: 'test-queue'
          },
          testing: {
            enableCoverage: true,
            minCoveragePercent: 80,
            failOnError: true
          },
          publishing: {
            dryRun: true,
            requireTests: true,
            requireCleanWorkingDirectory: true
          }
        }
      };

      expect(input.packageName).toBe('@bernierllc/test-package');
      expect(input.config.workspaceRoot).toBe('/test/workspace');
    });

    it('should accept packageIdea input', () => {
      const input: PackageWorkflowInput = {
        packageIdea: 'Create a streaming OpenAI client',
        config: {
          workspaceRoot: '/test/workspace',
          npmRegistry: 'https://registry.npmjs.org/',
          npmToken: 'test-token',
          maxConcurrentBuilds: 4,
          temporal: {
            address: 'localhost:7233',
            namespace: 'default',
            taskQueue: 'test-queue'
          },
          testing: {
            enableCoverage: true,
            minCoveragePercent: 80,
            failOnError: true
          },
          publishing: {
            dryRun: true,
            requireTests: true,
            requireCleanWorkingDirectory: true
          }
        }
      };

      expect(input.packageIdea).toBe('Create a streaming OpenAI client');
      expect(input.config.workspaceRoot).toBe('/test/workspace');
    });

    it('should accept planFilePath input', () => {
      const input: PackageWorkflowInput = {
        planFilePath: 'plans/packages/core/openai-client.md',
        config: {
          workspaceRoot: '/test/workspace',
          npmRegistry: 'https://registry.npmjs.org/',
          npmToken: 'test-token',
          maxConcurrentBuilds: 4,
          temporal: {
            address: 'localhost:7233',
            namespace: 'default',
            taskQueue: 'test-queue'
          },
          testing: {
            enableCoverage: true,
            minCoveragePercent: 80,
            failOnError: true
          },
          publishing: {
            dryRun: true,
            requireTests: true,
            requireCleanWorkingDirectory: true
          }
        }
      };

      expect(input.planFilePath).toBe('plans/packages/core/openai-client.md');
      expect(input.config.workspaceRoot).toBe('/test/workspace');
    });

    it('should accept updatePrompt input', () => {
      const input: PackageWorkflowInput = {
        updatePrompt: 'Add streaming support to OpenAI client',
        config: {
          workspaceRoot: '/test/workspace',
          npmRegistry: 'https://registry.npmjs.org/',
          npmToken: 'test-token',
          maxConcurrentBuilds: 4,
          temporal: {
            address: 'localhost:7233',
            namespace: 'default',
            taskQueue: 'test-queue'
          },
          testing: {
            enableCoverage: true,
            minCoveragePercent: 80,
            failOnError: true
          },
          publishing: {
            dryRun: true,
            requireTests: true,
            requireCleanWorkingDirectory: true
          }
        }
      };

      expect(input.updatePrompt).toBe('Add streaming support to OpenAI client');
      expect(input.config.workspaceRoot).toBe('/test/workspace');
    });
  });
});
