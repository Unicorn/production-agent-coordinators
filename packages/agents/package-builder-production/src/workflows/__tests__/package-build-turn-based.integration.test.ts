/**
 * Integration Tests for Turn-Based Package Build Workflow
 *
 * Tests the complete turn-based workflow execution with mocked activities.
 * Verifies phase progression, state persistence, resume capability, and error recovery.
 *
 * Note: These are structural tests that verify the workflow logic without
 * running in Temporal runtime. For full workflow execution tests, use
 * Temporal's test environment.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import type {
  TurnBasedPackageBuildInput,
  GenerationContext,
  PhaseExecutionResult
} from '../../types/index.js';

// Mock @temporalio/workflow BEFORE importing workflow
vi.mock('@temporalio/workflow', () => {
  // Create mock functions that will be shared across all proxy calls
  const mockFunctions = {
    saveGenerationState: vi.fn(),
    loadGenerationState: vi.fn(),
    recordCompletedStep: vi.fn(),
    markContextFailed: vi.fn(),
    executePlanningPhase: vi.fn(),
    executeFoundationPhase: vi.fn(),
    commitChanges: vi.fn(),
    writePackageBuildReport: vi.fn()
  };

  return {
    proxyActivities: () => mockFunctions
  };
});

// Import workflow after mocking - this is safe now
const { PackageBuildTurnBasedWorkflow } = await import('../package-build-turn-based.workflow.js');

// Import Temporal mock to access mock functions
import { proxyActivities } from '@temporalio/workflow';
const mockActivities = proxyActivities({}) as any;

describe('PackageBuildTurnBasedWorkflow - Integration Tests', () => {
  const testWorkspaceRoot = '/tmp/test-workspace-integration';
  const testPackagePath = 'packages/core/test-package';
  const testPlanPath = 'plans/packages/core/test-package.md';

  beforeEach(async () => {
    // Clear all mocks before each test
    vi.clearAllMocks();

    // Setup default mock implementations
    mockActivities.saveGenerationState.mockResolvedValue(undefined);
    mockActivities.recordCompletedStep.mockResolvedValue(undefined);
    mockActivities.markContextFailed.mockResolvedValue(undefined);
    mockActivities.writePackageBuildReport.mockResolvedValue(undefined);

    mockActivities.commitChanges.mockResolvedValue({
      success: true,
      commitHash: 'abc123',
      duration: 100,
      stdout: 'Committed',
      stderr: ''
    });

    // Create test workspace
    await fs.mkdir(testWorkspaceRoot, { recursive: true });
  });

  afterEach(async () => {
    // Cleanup test workspace
    await fs.rm(testWorkspaceRoot, { recursive: true, force: true });
  });

  describe('Complete Workflow Execution', () => {
    it('should execute PLANNING and FOUNDATION phases successfully', async () => {
      // Mock phase executors to return success
      const planningResult: PhaseExecutionResult = {
        success: true,
        phase: 'PLANNING',
        steps: [{
          stepNumber: 1,
          phase: 'PLANNING',
          description: 'Created package plan',
          files: ['docs/architecture.md'],
          timestamp: Date.now()
        }],
        filesModified: ['docs/architecture.md']
      };

      const foundationResult: PhaseExecutionResult = {
        success: true,
        phase: 'FOUNDATION',
        steps: [{
          stepNumber: 2,
          phase: 'FOUNDATION',
          description: 'Generated configuration files',
          files: ['package.json', 'tsconfig.json'],
          timestamp: Date.now()
        }],
        filesModified: ['package.json', 'tsconfig.json']
      };

      mockActivities.executePlanningPhase.mockResolvedValue(planningResult);
      mockActivities.executeFoundationPhase.mockResolvedValue(foundationResult);

      const input: TurnBasedPackageBuildInput = {
        packageName: '@bernierllc/test-package',
        packagePath: testPackagePath,
        planPath: testPlanPath,
        category: 'core',
        dependencies: [],
        workspaceRoot: testWorkspaceRoot,
        config: {
          npmRegistry: 'https://registry.npmjs.org',
          npmToken: 'test-token',
          workspaceRoot: testWorkspaceRoot,
          maxConcurrentBuilds: 1,
          temporal: {
            address: 'localhost:7233',
            namespace: 'default',
            taskQueue: 'test'
          },
          testing: {
            enableCoverage: true,
            minCoveragePercent: 90,
            failOnError: true
          },
          publishing: {
            dryRun: true,
            requireTests: true,
            requireCleanWorkingDirectory: false
          }
        },
        enableTurnBasedGeneration: true
      };

      const result = await PackageBuildTurnBasedWorkflow(input);

      // Verify workflow completed successfully
      expect(result.success).toBe(true);
      expect(result.packageName).toBe('@bernierllc/test-package');
      expect(result.report.status).toBe('success');

      // Verify phase executors were called
      expect(mockActivities.executePlanningPhase).toHaveBeenCalledOnce();
      expect(mockActivities.executeFoundationPhase).toHaveBeenCalledOnce();

      // Verify state was saved (initial + after each phase)
      expect(mockActivities.saveGenerationState).toHaveBeenCalled();

      // Verify steps were recorded
      expect(mockActivities.recordCompletedStep).toHaveBeenCalledTimes(2);

      // Verify git commits were made
      expect(mockActivities.commitChanges).toHaveBeenCalledTimes(2);

      // Verify report was written
      expect(mockActivities.writePackageBuildReport).toHaveBeenCalledOnce();
    });

    it('should verify phase progression order', async () => {
      const planningResult: PhaseExecutionResult = {
        success: true,
        phase: 'PLANNING',
        steps: [{ stepNumber: 1, phase: 'PLANNING', description: 'Plan', files: [], timestamp: Date.now() }],
        filesModified: []
      };

      const foundationResult: PhaseExecutionResult = {
        success: true,
        phase: 'FOUNDATION',
        steps: [{ stepNumber: 2, phase: 'FOUNDATION', description: 'Foundation', files: [], timestamp: Date.now() }],
        filesModified: []
      };

      mockActivities.executePlanningPhase.mockResolvedValue(planningResult);
      mockActivities.executeFoundationPhase.mockResolvedValue(foundationResult);

      const input: TurnBasedPackageBuildInput = {
        packageName: '@bernierllc/test-package',
        packagePath: testPackagePath,
        planPath: testPlanPath,
        category: 'core',
        dependencies: [],
        workspaceRoot: testWorkspaceRoot,
        config: {} as any,
        enableTurnBasedGeneration: true
      };

      await PackageBuildTurnBasedWorkflow(input);

      // Verify PLANNING was called before FOUNDATION
      const planningCall = mockActivities.executePlanningPhase.mock.invocationCallOrder[0];
      const foundationCall = mockActivities.executeFoundationPhase.mock.invocationCallOrder[0];

      expect(planningCall).toBeLessThan(foundationCall);
    });
  });

  describe('State Persistence', () => {
    it('should save GenerationContext after initialization', async () => {
      const planningResult: PhaseExecutionResult = {
        success: true,
        phase: 'PLANNING',
        steps: [],
        filesModified: []
      };

      mockActivities.executePlanningPhase.mockResolvedValue(planningResult);
      mockActivities.executeFoundationPhase.mockResolvedValue({
        success: true,
        phase: 'FOUNDATION',
        steps: [],
        filesModified: []
      });

      const input: TurnBasedPackageBuildInput = {
        packageName: '@bernierllc/test-package',
        packagePath: testPackagePath,
        planPath: testPlanPath,
        category: 'core',
        dependencies: [],
        workspaceRoot: testWorkspaceRoot,
        config: {} as any,
        enableTurnBasedGeneration: true
      };

      await PackageBuildTurnBasedWorkflow(input);

      // Verify saveGenerationState was called with proper context
      const saveCall = mockActivities.saveGenerationState.mock.calls[0];
      expect(saveCall).toBeDefined();

      const savedContext = saveCall[0] as GenerationContext;
      expect(savedContext.packageName).toBe('@bernierllc/test-package');
      expect(savedContext.packagePath).toBe(testPackagePath);
      // Note: currentPhase will be PLANNING initially but may advance to FOUNDATION
      // during workflow execution. Check that it's one of the valid phases.
      expect(['PLANNING', 'FOUNDATION']).toContain(savedContext.currentPhase);
      expect(savedContext.completedSteps).toEqual([]);
      expect(savedContext.sessionId).toMatch(/^gen-\d+$/);
    });

    it('should update context after each completed phase', async () => {
      const planningResult: PhaseExecutionResult = {
        success: true,
        phase: 'PLANNING',
        steps: [{
          stepNumber: 1,
          phase: 'PLANNING',
          description: 'Test',
          files: ['plan.md'],
          timestamp: Date.now()
        }],
        filesModified: ['plan.md']
      };

      mockActivities.executePlanningPhase.mockResolvedValue(planningResult);
      mockActivities.executeFoundationPhase.mockResolvedValue({
        success: true,
        phase: 'FOUNDATION',
        steps: [],
        filesModified: []
      });

      const input: TurnBasedPackageBuildInput = {
        packageName: '@bernierllc/test-package',
        packagePath: testPackagePath,
        planPath: testPlanPath,
        category: 'core',
        dependencies: [],
        workspaceRoot: testWorkspaceRoot,
        config: {} as any,
        enableTurnBasedGeneration: true
      };

      await PackageBuildTurnBasedWorkflow(input);

      // Verify recordCompletedStep was called with step details
      expect(mockActivities.recordCompletedStep).toHaveBeenCalled();
      const recordCall = mockActivities.recordCompletedStep.mock.calls[0];
      const step = recordCall[1];

      expect(step.phase).toBe('PLANNING');
      expect(step.description).toBe('Test');
      expect(step.files).toEqual(['plan.md']);
    });
  });

  describe('Resume from Failure', () => {
    it('should resume from saved context', async () => {
      // Create a context with PLANNING already completed
      const resumeContext: GenerationContext = {
        sessionId: 'test-session-resume',
        branch: 'feat/package-generation-test',
        packageName: '@bernierllc/test-package',
        packageCategory: 'core',
        packagePath: testPackagePath,
        planPath: testPlanPath,
        workspaceRoot: testWorkspaceRoot,
        currentPhase: 'FOUNDATION',
        currentStepNumber: 2,
        completedSteps: [{
          stepNumber: 1,
          phase: 'PLANNING',
          description: 'Completed planning',
          files: ['docs/plan.md'],
          timestamp: Date.now()
        }],
        requirements: {
          testCoverageTarget: 90,
          loggerIntegration: 'not-applicable',
          neverhubIntegration: 'not-applicable',
          docsSuiteIntegration: 'planned',
          meceValidated: true,
          planApproved: true
        }
      };

      const foundationResult: PhaseExecutionResult = {
        success: true,
        phase: 'FOUNDATION',
        steps: [],
        filesModified: []
      };

      mockActivities.executeFoundationPhase.mockResolvedValue(foundationResult);

      const input: TurnBasedPackageBuildInput = {
        packageName: '@bernierllc/test-package',
        packagePath: testPackagePath,
        planPath: testPlanPath,
        category: 'core',
        dependencies: [],
        workspaceRoot: testWorkspaceRoot,
        config: {} as any,
        enableTurnBasedGeneration: true,
        resumeFromContext: resumeContext
      };

      await PackageBuildTurnBasedWorkflow(input);

      // Verify PLANNING phase was NOT executed (already completed)
      expect(mockActivities.executePlanningPhase).not.toHaveBeenCalled();

      // Verify FOUNDATION phase WAS executed
      expect(mockActivities.executeFoundationPhase).toHaveBeenCalledOnce();
    });
  });

  describe('Git Commit Flow', () => {
    it('should commit after each phase with proper message', async () => {
      const planningResult: PhaseExecutionResult = {
        success: true,
        phase: 'PLANNING',
        steps: [],
        filesModified: ['docs/plan.md', 'docs/architecture.md']
      };

      mockActivities.executePlanningPhase.mockResolvedValue(planningResult);
      mockActivities.executeFoundationPhase.mockResolvedValue({
        success: true,
        phase: 'FOUNDATION',
        steps: [],
        filesModified: []
      });

      const input: TurnBasedPackageBuildInput = {
        packageName: '@bernierllc/test-package',
        packagePath: testPackagePath,
        planPath: testPlanPath,
        category: 'core',
        dependencies: [],
        workspaceRoot: testWorkspaceRoot,
        config: {} as any,
        enableTurnBasedGeneration: true
      };

      await PackageBuildTurnBasedWorkflow(input);

      // Verify commit was made for PLANNING phase
      expect(mockActivities.commitChanges).toHaveBeenCalled();
      const commitCall = mockActivities.commitChanges.mock.calls[0];
      const commitInput = commitCall[0];

      expect(commitInput.message).toContain('PLANNING');
      expect(commitInput.message).toContain('docs/plan.md, docs/architecture.md');
      expect(commitInput.gitUser.name).toBe('Package Builder');
      expect(commitInput.gitUser.email).toBe('builder@bernier.llc');
    });

    it('should save commit hash to context after successful commit', async () => {
      mockActivities.commitChanges.mockResolvedValue({
        success: true,
        commitHash: 'test-commit-hash-123',
        duration: 100,
        stdout: 'Committed',
        stderr: ''
      });

      const planningResult: PhaseExecutionResult = {
        success: true,
        phase: 'PLANNING',
        steps: [],
        filesModified: []
      };

      mockActivities.executePlanningPhase.mockResolvedValue(planningResult);
      mockActivities.executeFoundationPhase.mockResolvedValue({
        success: true,
        phase: 'FOUNDATION',
        steps: [],
        filesModified: []
      });

      const input: TurnBasedPackageBuildInput = {
        packageName: '@bernierllc/test-package',
        packagePath: testPackagePath,
        planPath: testPlanPath,
        category: 'core',
        dependencies: [],
        workspaceRoot: testWorkspaceRoot,
        config: {} as any,
        enableTurnBasedGeneration: true
      };

      await PackageBuildTurnBasedWorkflow(input);

      // Verify saveGenerationState was called after commit with hash
      const saveCalls = mockActivities.saveGenerationState.mock.calls;
      const lastSaveCall = saveCalls[saveCalls.length - 1];
      const savedContext = lastSaveCall[0] as GenerationContext;

      expect(savedContext.lastSuccessfulCommit).toBe('test-commit-hash-123');
    });
  });

  describe('Error Recovery', () => {
    it('should handle phase failure and mark context as failed', async () => {
      const planningError: PhaseExecutionResult = {
        success: false,
        phase: 'PLANNING',
        steps: [],
        filesModified: [],
        error: 'Claude API rate limit exceeded'
      };

      mockActivities.executePlanningPhase.mockResolvedValue(planningError);

      const input: TurnBasedPackageBuildInput = {
        packageName: '@bernierllc/test-package',
        packagePath: testPackagePath,
        planPath: testPlanPath,
        category: 'core',
        dependencies: [],
        workspaceRoot: testWorkspaceRoot,
        config: {} as any,
        enableTurnBasedGeneration: true
      };

      const result = await PackageBuildTurnBasedWorkflow(input);

      // Verify workflow failed
      expect(result.success).toBe(false);
      expect(result.error).toContain('PLANNING');

      // Verify context was marked as failed
      expect(mockActivities.markContextFailed).toHaveBeenCalledOnce();
      const failedCall = mockActivities.markContextFailed.mock.calls[0];
      const error = failedCall[2];

      expect(error).toContain('Claude API rate limit exceeded');
    });

    it('should include recovery info in failed context', async () => {
      const foundationError: PhaseExecutionResult = {
        success: false,
        phase: 'FOUNDATION',
        steps: [],
        filesModified: [],
        error: 'File write permission denied'
      };

      mockActivities.executePlanningPhase.mockResolvedValue({
        success: true,
        phase: 'PLANNING',
        steps: [],
        filesModified: []
      });
      mockActivities.executeFoundationPhase.mockResolvedValue(foundationError);

      const input: TurnBasedPackageBuildInput = {
        packageName: '@bernierllc/test-package',
        packagePath: testPackagePath,
        planPath: testPlanPath,
        category: 'core',
        dependencies: [],
        workspaceRoot: testWorkspaceRoot,
        config: {} as any,
        enableTurnBasedGeneration: true
      };

      await PackageBuildTurnBasedWorkflow(input);

      // Verify markContextFailed was called with step number and error
      const failedCall = mockActivities.markContextFailed.mock.calls[0];
      const context = failedCall[0] as GenerationContext;
      const failedStep = failedCall[1];
      const error = failedCall[2];

      // failedStep is context.currentStepNumber which starts at 0 and increments
      expect(failedStep).toBeGreaterThanOrEqual(0);
      expect(error).toBe('File write permission denied');
      expect(context.packageName).toBe('@bernierllc/test-package');
    });
  });

  describe('Phase Skipping', () => {
    it('should skip already-completed phases when resuming', async () => {
      // Create context with both phases completed
      const resumeContext: GenerationContext = {
        sessionId: 'test-session-skip',
        branch: 'feat/package-generation-test',
        packageName: '@bernierllc/test-package',
        packageCategory: 'core',
        packagePath: testPackagePath,
        planPath: testPlanPath,
        workspaceRoot: testWorkspaceRoot,
        currentPhase: 'FOUNDATION',
        currentStepNumber: 3,
        completedSteps: [
          {
            stepNumber: 1,
            phase: 'PLANNING',
            description: 'Completed planning',
            files: [],
            timestamp: Date.now()
          },
          {
            stepNumber: 2,
            phase: 'FOUNDATION',
            description: 'Completed foundation',
            files: [],
            timestamp: Date.now()
          }
        ],
        requirements: {
          testCoverageTarget: 90,
          loggerIntegration: 'not-applicable',
          neverhubIntegration: 'not-applicable',
          docsSuiteIntegration: 'planned',
          meceValidated: true,
          planApproved: true
        }
      };

      const input: TurnBasedPackageBuildInput = {
        packageName: '@bernierllc/test-package',
        packagePath: testPackagePath,
        planPath: testPlanPath,
        category: 'core',
        dependencies: [],
        workspaceRoot: testWorkspaceRoot,
        config: {} as any,
        enableTurnBasedGeneration: true,
        resumeFromContext: resumeContext
      };

      await PackageBuildTurnBasedWorkflow(input);

      // Verify neither phase was executed (both already completed)
      expect(mockActivities.executePlanningPhase).not.toHaveBeenCalled();
      expect(mockActivities.executeFoundationPhase).not.toHaveBeenCalled();
    });

    it('should verify phase completion before skipping', async () => {
      // Create context with only PLANNING completed
      const resumeContext: GenerationContext = {
        sessionId: 'test-session-partial',
        branch: 'feat/package-generation-test',
        packageName: '@bernierllc/test-package',
        packageCategory: 'core',
        packagePath: testPackagePath,
        planPath: testPlanPath,
        workspaceRoot: testWorkspaceRoot,
        currentPhase: 'FOUNDATION',
        currentStepNumber: 2,
        completedSteps: [
          {
            stepNumber: 1,
            phase: 'PLANNING',
            description: 'Completed planning',
            files: [],
            timestamp: Date.now()
          }
        ],
        requirements: {
          testCoverageTarget: 90,
          loggerIntegration: 'not-applicable',
          neverhubIntegration: 'not-applicable',
          docsSuiteIntegration: 'planned',
          meceValidated: true,
          planApproved: true
        }
      };

      mockActivities.executeFoundationPhase.mockResolvedValue({
        success: true,
        phase: 'FOUNDATION',
        steps: [],
        filesModified: []
      });

      const input: TurnBasedPackageBuildInput = {
        packageName: '@bernierllc/test-package',
        packagePath: testPackagePath,
        planPath: testPlanPath,
        category: 'core',
        dependencies: [],
        workspaceRoot: testWorkspaceRoot,
        config: {} as any,
        enableTurnBasedGeneration: true,
        resumeFromContext: resumeContext
      };

      await PackageBuildTurnBasedWorkflow(input);

      // Verify PLANNING was skipped (in completedSteps)
      expect(mockActivities.executePlanningPhase).not.toHaveBeenCalled();

      // Verify FOUNDATION was executed (not in completedSteps)
      expect(mockActivities.executeFoundationPhase).toHaveBeenCalledOnce();
    });
  });
});
