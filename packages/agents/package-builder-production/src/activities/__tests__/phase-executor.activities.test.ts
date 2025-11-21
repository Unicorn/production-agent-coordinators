import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  executePlanningPhase,
  executeFoundationPhase,
  executeTypesPhase,
  executeCoreImplementationPhase,
  executeEntryPointPhase,
  executeUtilitiesPhase,
  executeErrorHandlingPhase,
  executeTestingPhase,
  executeDocumentationPhase,
  executeExamplesPhase,
  executeIntegrationReviewPhase,
  executeCriticalFixesPhase,
  executeBuildValidationPhase,
  executeFinalPolishPhase
} from '../phase-executor.activities.js';
import type { GenerationContext } from '../../types/index.js';
import * as agentExecution from '../agent-execution.activities.js';
import * as responseParser from '../response-parser.activities.js';
import * as fileOperations from '../file-operations.activities.js';
import * as promptBuilder from '../prompt-builder.activities.js';

describe('Phase Executor Activities', () => {
  let mockContext: GenerationContext;

  // Mock the dependencies
  const mockBuildAgentPrompt = vi.spyOn(promptBuilder, 'buildAgentPrompt');
  const mockExecuteAgentWithClaude = vi.spyOn(agentExecution, 'executeAgentWithClaude');
  const mockParseAgentResponse = vi.spyOn(responseParser, 'parseAgentResponse');
  const mockApplyFileChanges = vi.spyOn(fileOperations, 'applyFileChanges');

  beforeEach(() => {
    mockContext = {
      sessionId: 'test-session-123',
      branch: 'feat/package-generation-test',
      packageName: '@bernierllc/test-package',
      packageCategory: 'core',
      packagePath: 'packages/core/test-package',
      planPath: 'plans/packages/core/test-package.md',
      workspaceRoot: '/test/workspace',
      currentPhase: 'PLANNING',
      currentStepNumber: 0,
      completedSteps: [],
      requirements: {
        testCoverageTarget: 90,
        loggerIntegration: 'planned',
        neverhubIntegration: 'planned',
        docsSuiteIntegration: 'planned',
        meceValidated: false,
        planApproved: false
      }
    };

    // Reset all mocks
    mockBuildAgentPrompt.mockReset();
    mockExecuteAgentWithClaude.mockReset();
    mockParseAgentResponse.mockReset();
    mockApplyFileChanges.mockReset();

    // Default mock implementations
    mockBuildAgentPrompt.mockResolvedValue('Mock prompt');

    mockExecuteAgentWithClaude.mockResolvedValue(JSON.stringify({
      files: [],
      summary: 'Mock response'
    }));

    mockParseAgentResponse.mockResolvedValue({
      files: [],
      summary: 'Mock response'
    });

    mockApplyFileChanges.mockResolvedValue({
      modifiedFiles: [],
      failedOperations: []
    });
  });

  describe('executePlanningPhase', () => {
    it('should execute planning phase successfully', async () => {
      const mockFiles = [
        { path: 'plan.md', operation: 'create' as const, content: 'Plan content' }
      ];

      mockParseAgentResponse.mockResolvedValue({
        files: mockFiles,
        summary: 'Created package plan'
      });

      mockApplyFileChanges.mockResolvedValue({
        modifiedFiles: ['plan.md'],
        failedOperations: []
      });

      const result = await executePlanningPhase(mockContext);

      expect(result.success).toBe(true);
      expect(result.phase).toBe('PLANNING');
      expect(result.steps.length).toBeGreaterThan(0);
      expect(mockExecuteAgentWithClaude).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockExecuteAgentWithClaude.mockRejectedValue(new Error('API error'));

      const result = await executePlanningPhase(mockContext);

      expect(result.success).toBe(false);
      expect(result.phase).toBe('PLANNING');
      expect(result.error).toContain('API error');
    });
  });

  describe('executeFoundationPhase', () => {
    it('should generate configuration files', async () => {
      const mockFiles = [
        { path: 'package.json', operation: 'create' as const, content: '{}' },
        { path: 'tsconfig.json', operation: 'create' as const, content: '{}' }
      ];

      mockParseAgentResponse.mockResolvedValue({
        files: mockFiles,
        summary: 'Created configuration files'
      });

      mockApplyFileChanges.mockResolvedValue({
        modifiedFiles: ['package.json', 'tsconfig.json'],
        failedOperations: []
      });

      const result = await executeFoundationPhase(mockContext);

      expect(result.success).toBe(true);
      expect(result.phase).toBe('FOUNDATION');
      expect(result.filesModified).toContain('package.json');
      expect(mockExecuteAgentWithClaude).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-sonnet-4-5-20250929',
          temperature: 0.2,
          maxTokens: 3000
        })
      );
    });
  });

  describe('executeTypesPhase', () => {
    it('should generate type definitions', async () => {
      const mockFiles = [
        { path: 'src/types/index.ts', operation: 'create' as const, content: 'export type Foo = string;' }
      ];

      mockParseAgentResponse.mockResolvedValue({
        files: mockFiles,
        summary: 'Created type definitions'
      });

      mockApplyFileChanges.mockResolvedValue({
        modifiedFiles: ['src/types/index.ts'],
        failedOperations: []
      });

      const result = await executeTypesPhase(mockContext);

      expect(result.success).toBe(true);
      expect(result.phase).toBe('TYPES');
      expect(result.filesModified).toContain('src/types/index.ts');
      expect(mockExecuteAgentWithClaude).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.2,
          maxTokens: 4000
        })
      );
    });
  });

  describe('executeCoreImplementationPhase', () => {
    it('should generate core implementation files', async () => {
      const mockFiles = [
        { path: 'src/core/main.ts', operation: 'create' as const, content: 'export function main() {}' }
      ];

      mockParseAgentResponse.mockResolvedValue({
        files: mockFiles,
        summary: 'Implemented core functionality'
      });

      mockApplyFileChanges.mockResolvedValue({
        modifiedFiles: ['src/core/main.ts'],
        failedOperations: []
      });

      const result = await executeCoreImplementationPhase(mockContext);

      expect(result.success).toBe(true);
      expect(result.phase).toBe('CORE_IMPLEMENTATION');
      expect(mockExecuteAgentWithClaude).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.3,
          maxTokens: 8000 // Largest token budget
        })
      );
    });
  });

  describe('executeEntryPointPhase', () => {
    it('should generate entry point barrel file', async () => {
      const mockFiles = [
        { path: 'src/index.ts', operation: 'create' as const, content: 'export * from "./core/main.js";' }
      ];

      mockParseAgentResponse.mockResolvedValue({
        files: mockFiles,
        summary: 'Created entry point'
      });

      mockApplyFileChanges.mockResolvedValue({
        modifiedFiles: ['src/index.ts'],
        failedOperations: []
      });

      const result = await executeEntryPointPhase(mockContext);

      expect(result.success).toBe(true);
      expect(result.phase).toBe('ENTRY_POINT');
      expect(mockExecuteAgentWithClaude).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.2,
          maxTokens: 2000
        })
      );
    });
  });

  describe('executeUtilitiesPhase', () => {
    it('should generate utility functions', async () => {
      const mockFiles = [
        { path: 'src/utils/helpers.ts', operation: 'create' as const, content: 'export function helper() {}' }
      ];

      mockParseAgentResponse.mockResolvedValue({
        files: mockFiles,
        summary: 'Created utility functions'
      });

      mockApplyFileChanges.mockResolvedValue({
        modifiedFiles: ['src/utils/helpers.ts'],
        failedOperations: []
      });

      const result = await executeUtilitiesPhase(mockContext);

      expect(result.success).toBe(true);
      expect(result.phase).toBe('UTILITIES');
      expect(mockExecuteAgentWithClaude).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.3,
          maxTokens: 4000
        })
      );
    });
  });

  describe('executeErrorHandlingPhase', () => {
    it('should generate error classes and handlers', async () => {
      const mockFiles = [
        { path: 'src/errors/index.ts', operation: 'create' as const, content: 'export class CustomError extends Error {}' }
      ];

      mockParseAgentResponse.mockResolvedValue({
        files: mockFiles,
        summary: 'Created error handling'
      });

      mockApplyFileChanges.mockResolvedValue({
        modifiedFiles: ['src/errors/index.ts'],
        failedOperations: []
      });

      const result = await executeErrorHandlingPhase(mockContext);

      expect(result.success).toBe(true);
      expect(result.phase).toBe('ERROR_HANDLING');
      expect(mockExecuteAgentWithClaude).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.3,
          maxTokens: 3000
        })
      );
    });
  });

  describe('executeTestingPhase', () => {
    it('should generate test files', async () => {
      const mockFiles = [
        { path: 'src/__tests__/main.test.ts', operation: 'create' as const, content: 'describe("test", () => {});' }
      ];

      mockParseAgentResponse.mockResolvedValue({
        files: mockFiles,
        summary: 'Created test files'
      });

      mockApplyFileChanges.mockResolvedValue({
        modifiedFiles: ['src/__tests__/main.test.ts'],
        failedOperations: []
      });

      const result = await executeTestingPhase(mockContext);

      expect(result.success).toBe(true);
      expect(result.phase).toBe('TESTING');
      expect(mockExecuteAgentWithClaude).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.3,
          maxTokens: 6000
        })
      );
    });
  });

  describe('executeDocumentationPhase', () => {
    it('should generate documentation', async () => {
      const mockFiles = [
        { path: 'README.md', operation: 'create' as const, content: '# Test Package' }
      ];

      mockParseAgentResponse.mockResolvedValue({
        files: mockFiles,
        summary: 'Created documentation'
      });

      mockApplyFileChanges.mockResolvedValue({
        modifiedFiles: ['README.md'],
        failedOperations: []
      });

      const result = await executeDocumentationPhase(mockContext);

      expect(result.success).toBe(true);
      expect(result.phase).toBe('DOCUMENTATION');
      expect(mockExecuteAgentWithClaude).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.4, // Creative work
          maxTokens: 3000
        })
      );
    });
  });

  describe('executeExamplesPhase', () => {
    it('should generate example files', async () => {
      const mockFiles = [
        { path: 'examples/basic.ts', operation: 'create' as const, content: 'import { main } from "../src";' }
      ];

      mockParseAgentResponse.mockResolvedValue({
        files: mockFiles,
        summary: 'Created examples'
      });

      mockApplyFileChanges.mockResolvedValue({
        modifiedFiles: ['examples/basic.ts'],
        failedOperations: []
      });

      const result = await executeExamplesPhase(mockContext);

      expect(result.success).toBe(true);
      expect(result.phase).toBe('EXAMPLES');
      expect(mockExecuteAgentWithClaude).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.4, // Creative work
          maxTokens: 4000
        })
      );
    });
  });

  describe('executeIntegrationReviewPhase', () => {
    it('should review integration points', async () => {
      const mockFiles = [
        { path: 'INTEGRATION_REVIEW.md', operation: 'create' as const, content: '# Integration Review' }
      ];

      mockParseAgentResponse.mockResolvedValue({
        files: mockFiles,
        summary: 'Reviewed integrations',
        suggestions: [
          {
            type: 'OPTIMIZATION',
            description: 'Consider caching',
            priority: 'medium' as const,
            autoExecute: false
          }
        ]
      });

      mockApplyFileChanges.mockResolvedValue({
        modifiedFiles: ['INTEGRATION_REVIEW.md'],
        failedOperations: []
      });

      const result = await executeIntegrationReviewPhase(mockContext);

      expect(result.success).toBe(true);
      expect(result.phase).toBe('INTEGRATION_REVIEW');
      expect(mockExecuteAgentWithClaude).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.3,
          maxTokens: 4000
        })
      );
    });
  });

  describe('executeCriticalFixesPhase', () => {
    it('should apply critical fixes', async () => {
      const mockFiles = [
        { path: 'src/core/main.ts', operation: 'update' as const, content: 'export function main() { /* fixed */ }' }
      ];

      mockParseAgentResponse.mockResolvedValue({
        files: mockFiles,
        summary: 'Applied critical fixes'
      });

      mockApplyFileChanges.mockResolvedValue({
        modifiedFiles: ['src/core/main.ts'],
        failedOperations: []
      });

      const result = await executeCriticalFixesPhase(mockContext);

      expect(result.success).toBe(true);
      expect(result.phase).toBe('CRITICAL_FIXES');
      expect(mockExecuteAgentWithClaude).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.3,
          maxTokens: 5000
        })
      );
    });
  });

  describe('executeBuildValidationPhase', () => {
    it('should validate build and run tests', async () => {
      const mockFiles = [
        { path: 'BUILD_VALIDATION.md', operation: 'create' as const, content: '# Build passed' }
      ];

      mockParseAgentResponse.mockResolvedValue({
        files: mockFiles,
        summary: 'Build validation passed'
      });

      mockApplyFileChanges.mockResolvedValue({
        modifiedFiles: ['BUILD_VALIDATION.md'],
        failedOperations: []
      });

      const result = await executeBuildValidationPhase(mockContext);

      expect(result.success).toBe(true);
      expect(result.phase).toBe('BUILD_VALIDATION');
      expect(mockExecuteAgentWithClaude).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.3,
          maxTokens: 4000
        })
      );
    });
  });

  describe('executeFinalPolishPhase', () => {
    it('should perform final quality pass', async () => {
      const mockFiles = [
        { path: 'src/index.ts', operation: 'update' as const, content: '// Polished export' }
      ];

      mockParseAgentResponse.mockResolvedValue({
        files: mockFiles,
        summary: 'Final polish complete',
        qualityChecklist: {
          strictModeEnabled: true,
          noAnyTypes: true,
          testCoverageAbove80: true,
          allPublicFunctionsDocumented: true,
          errorHandlingComplete: true
        }
      });

      mockApplyFileChanges.mockResolvedValue({
        modifiedFiles: ['src/index.ts'],
        failedOperations: []
      });

      const result = await executeFinalPolishPhase(mockContext);

      expect(result.success).toBe(true);
      expect(result.phase).toBe('FINAL_POLISH');
      expect(mockExecuteAgentWithClaude).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.3,
          maxTokens: 3000
        })
      );
    });
  });

  describe('Error handling across all phases', () => {
    it('should handle Claude API failures gracefully', async () => {
      mockExecuteAgentWithClaude.mockRejectedValue(new Error('Rate limit exceeded'));

      const phases = [
        executeTypesPhase,
        executeCoreImplementationPhase,
        executeEntryPointPhase,
        executeUtilitiesPhase,
        executeErrorHandlingPhase,
        executeTestingPhase,
        executeDocumentationPhase,
        executeExamplesPhase,
        executeIntegrationReviewPhase,
        executeCriticalFixesPhase,
        executeBuildValidationPhase,
        executeFinalPolishPhase
      ];

      for (const phaseExecutor of phases) {
        const result = await phaseExecutor(mockContext);
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }
    });

    it('should handle file operation failures', async () => {
      mockParseAgentResponse.mockResolvedValue({
        files: [{ path: 'test.ts', operation: 'create' as const, content: 'test' }],
        summary: 'Test'
      });

      mockApplyFileChanges.mockResolvedValue({
        modifiedFiles: [],
        failedOperations: [
          { path: 'test.ts', operation: 'create', error: 'Permission denied' }
        ]
      });

      const result = await executeTypesPhase(mockContext);

      expect(result.success).toBe(true); // Phase succeeds even with partial failures
      expect(result.filesModified).toEqual([]);
    });
  });
});
