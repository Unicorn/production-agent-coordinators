import { describe, it, expect } from 'vitest';
import type { PackageWorkflowInput, DiscoveryResult, PlanningResult, MeceValidationResult } from '../index';

describe('Type Definitions', () => {
  describe('PackageWorkflowInput', () => {
    it('should accept package name', () => {
      const input: PackageWorkflowInput = {
        packageName: '@bernierllc/openai-client',
        config: {
          workspaceRoot: '/path/to/workspace',
          npmRegistry: 'https://registry.npmjs.org/',
          npmToken: 'test-token',
          maxConcurrentBuilds: 4,
          temporal: {
            address: 'localhost:7233',
            namespace: 'default',
            taskQueue: 'queue'
          },
          testing: {
            enableCoverage: true,
            minCoveragePercent: 80,
            failOnError: true
          },
          publishing: {
            dryRun: false,
            requireTests: true,
            requireCleanWorkingDirectory: true
          }
        }
      };
      expect(input.packageName).toBe('@bernierllc/openai-client');
    });

    it('should accept package idea', () => {
      const input: PackageWorkflowInput = {
        packageIdea: 'create streaming OpenAI client',
        config: {} as any
      };
      expect(input.packageIdea).toBeDefined();
    });

    it('should accept plan file path', () => {
      const input: PackageWorkflowInput = {
        planFilePath: 'plans/packages/core/openai-client.md',
        config: {} as any
      };
      expect(input.planFilePath).toBeDefined();
    });

    it('should accept update prompt', () => {
      const input: PackageWorkflowInput = {
        updatePrompt: 'add streaming support',
        config: {} as any
      };
      expect(input.updatePrompt).toBeDefined();
    });
  });

  describe('DiscoveryResult', () => {
    it('should have required fields', () => {
      const result: DiscoveryResult = {
        packageName: '@bernierllc/openai-client',
        packagePath: 'packages/core/openai-client',
        version: '1.0.3',
        dependencies: ['@bernierllc/logger'],
        isPublished: true,
        npmVersion: '1.0.3',
        worktreePath: '/path/to/worktree'
      };
      expect(result.packageName).toBeDefined();
      expect(result.worktreePath).toBeDefined();
    });
  });
});
