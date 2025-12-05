/**
 * Integration Tests for PackageBuildWorkflow
 * 
 * Uses Temporal's TestWorkflowEnvironment to test actual workflow execution
 * with mocked activities. This follows Temporal's recommended testing approach.
 * 
 * @see https://docs.temporal.io/typescript/testing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { PackageBuildInput } from '../../types/index.js';

// Get the directory of the current file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock all activity modules
vi.mock('../../activities/cli-agent.activities', () => ({
  setupCLIWorkspace: vi.fn(),
  selectCLIProvider: vi.fn(),
  readPlanFileContent: vi.fn(),
  readRequirementsContent: vi.fn(),
  checkCLICreditsForExecution: vi.fn(),
  selectClaudeModel: vi.fn(),
  executeGeminiCLI: vi.fn(),
  executeClaudeCLI: vi.fn(),
  validateCLIResult: vi.fn(),
  requestTaskBreakdown: vi.fn(),
  executeAgentActivityRequest: vi.fn(),
  executeTaskWithCLI: vi.fn(),
  runTaskValidations: vi.fn(),
  executeFixWithCLI: vi.fn(),
}));

vi.mock('../../activities/build.activities', () => ({
  checkPackageExists: vi.fn(),
  checkNpmPublished: vi.fn(),
  checkIfUpgradePlan: vi.fn(),
  auditPackageState: vi.fn(),
  auditPackageUpgrade: vi.fn(),
  runBuild: vi.fn(),
  runTests: vi.fn(),
  runQualityChecks: vi.fn(),
  publishPackage: vi.fn(),
  commitChanges: vi.fn(),
  pushChanges: vi.fn(),
}));

vi.mock('../../activities/resume-detector.activities', () => ({
  detectResumePoint: vi.fn(),
}));

vi.mock('../../activities/agent.activities', () => ({
  verifyDependencies: vi.fn(),
  spawnFixAgent: vi.fn(),
}));

vi.mock('../../activities/report.activities', () => ({
  writePackageBuildReport: vi.fn(),
}));

// Import mocked activities
import * as cliActivities from '../../activities/cli-agent.activities.js';
import * as buildActivities from '../../activities/build.activities.js';
import * as resumeActivities from '../../activities/resume-detector.activities.js';
import * as agentActivities from '../../activities/agent.activities.js';
import * as reportActivities from '../../activities/report.activities.js';

describe('PackageBuildWorkflow - Integration Tests', () => {
  let testEnv: TestWorkflowEnvironment;
  let worker: Worker;
  let workerRunPromise: Promise<void>;

  const MOCK_WORKING_DIR = '/tmp/test-package-build';
  const MOCK_PLAN_CONTENT = `# Test Package Plan

## Package Overview
- Name: @test/simple-package
- Description: A simple test package
- Version: 0.1.0

## Architecture
- Single entry point: src/index.ts
- Export a simple function: \`greet(name: string): string\`

## Implementation
Create a simple greeting function that returns "Hello, {name}!"`;

  const MOCK_REQUIREMENTS_CONTENT = `# BernierLLC Package Requirements

## TypeScript Configuration
- Strict mode enabled
- ES2020 target
- Generate .d.ts files

## Quality Gates
- ESLint with zero warnings
- Jest with 80%+ coverage`;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create test environment with time skipping for faster tests
    testEnv = await TestWorkflowEnvironment.createTimeSkipping();

    // Set up default mock implementations
    // CLI Activities
    (cliActivities.setupCLIWorkspace as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_WORKING_DIR);
    (cliActivities.selectCLIProvider as ReturnType<typeof vi.fn>).mockResolvedValue({ name: 'claude' as const });
    (cliActivities.readPlanFileContent as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_PLAN_CONTENT);
    (cliActivities.readRequirementsContent as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_REQUIREMENTS_CONTENT);
    (cliActivities.checkCLICreditsForExecution as ReturnType<typeof vi.fn>).mockResolvedValue({
      gemini: { available: true, credits: 100 },
      claude: { available: true, credits: 100 },
    });
    (cliActivities.selectClaudeModel as ReturnType<typeof vi.fn>).mockResolvedValue({
      model: 'sonnet',
      permissionMode: 'acceptEdits',
    });
    
    // Mock task breakdown for scaffold phase
    (cliActivities.requestTaskBreakdown as ReturnType<typeof vi.fn>).mockResolvedValue({
      outline: [
        {
          phase_id: 'P1',
          title: 'Scaffolding',
          description: 'Initial package setup',
          exit_criteria: ['package.json created', 'tsconfig.json created'],
        },
      ],
      tasks: [
        {
          id: 'T1',
          title: 'Create package.json',
          description: 'Create package.json with basic configuration',
          acceptance_criteria: ['package.json exists', 'Contains name and version'],
          quality_gates: ['lint_run'],
          validation_steps: ['file_exists:package.json'],
          dependencies: [],
        },
      ],
      more_tasks: false,
      completed_task_id: null,
      activities: [],
    });

    // Mock new task activity loop activities
    (cliActivities.executeTaskWithCLI as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      logFilePath: '/tmp/test-package-build/.claude/logs/test-workflow-task-T1-0.jsonl',
      sessionId: 'test-session-123',
      taskComplete: true,
      cost_usd: 0.05,
      duration_ms: 2000,
    });

    (cliActivities.runTaskValidations as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      validationErrorsFilePath: '/tmp/test-package-build/.claude/validation-errors/test-workflow-task-T1-errors.json',
      allPassed: true,
      errors: [],
    });

    (cliActivities.executeFixWithCLI as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      logFilePath: '/tmp/test-package-build/.claude/logs/test-workflow-fix-T1-0.jsonl',
      sessionId: 'test-session-123',
      fixed: true,
      cost_usd: 0.02,
      duration_ms: 1000,
    });

    // Keep old mocks for backward compatibility (if still used)
    (cliActivities.executeClaudeCLI as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      result: 'package.json created successfully',
      cost_usd: 0.05,
      duration_ms: 2000,
      session_id: 'test-session-123',
    });

    (cliActivities.validateCLIResult as ReturnType<typeof vi.fn>).mockImplementation((result) => result);

    // Build Activities
    (buildActivities.checkPackageExists as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    (buildActivities.checkNpmPublished as ReturnType<typeof vi.fn>).mockResolvedValue({ published: false });
    (buildActivities.checkIfUpgradePlan as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    (buildActivities.auditPackageState as ReturnType<typeof vi.fn>).mockResolvedValue({
      completionPercentage: 0,
      findings: [],
      nextSteps: [],
      status: 'incomplete',
    });
    (buildActivities.runBuild as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      duration: 1000,
      stdout: 'Build successful',
      stderr: '',
    });
    (buildActivities.runTests as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      duration: 2000,
      coverage: 85,
      stdout: 'Tests passed',
      stderr: '',
    });
    (buildActivities.runQualityChecks as ReturnType<typeof vi.fn>).mockResolvedValue({
      passed: true,
      duration: 500,
      failures: [],
      lintScore: 100,
    });
    (buildActivities.publishPackage as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      duration: 3000,
      version: '0.1.0',
      stdout: 'Published successfully',
      stderr: '',
    });
    (buildActivities.commitChanges as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      commitHash: 'abc123',
    });
    (buildActivities.pushChanges as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
    });

    // Resume Activities
    (resumeActivities.detectResumePoint as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    // Agent Activities
    (agentActivities.verifyDependencies as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      missing: [],
      outdated: [],
    });
    (agentActivities.spawnFixAgent as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      fixed: [],
    });

    // Report Activities
    (reportActivities.writePackageBuildReport as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    // Create worker with mocked activities
    // workflowsPath should point to ONLY workflows, not activities
    // Use the workflows/index.ts file which only exports workflows
    const workflowsPath = path.resolve(__dirname, '../index.ts');
    
    worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue: 'test-package-build-queue',
      workflowsPath,
      activities: {
        // CLI Activities
        setupCLIWorkspace: cliActivities.setupCLIWorkspace,
        selectCLIProvider: cliActivities.selectCLIProvider,
        readPlanFileContent: cliActivities.readPlanFileContent,
        readRequirementsContent: cliActivities.readRequirementsContent,
        checkCLICreditsForExecution: cliActivities.checkCLICreditsForExecution,
        selectClaudeModel: cliActivities.selectClaudeModel,
        executeGeminiCLI: cliActivities.executeGeminiCLI,
        executeClaudeCLI: cliActivities.executeClaudeCLI,
        validateCLIResult: cliActivities.validateCLIResult,
        requestTaskBreakdown: cliActivities.requestTaskBreakdown,
        executeAgentActivityRequest: cliActivities.executeAgentActivityRequest,
        executeTaskWithCLI: cliActivities.executeTaskWithCLI,
        runTaskValidations: cliActivities.runTaskValidations,
        executeFixWithCLI: cliActivities.executeFixWithCLI,
        // Build Activities
        checkPackageExists: buildActivities.checkPackageExists,
        checkNpmPublished: buildActivities.checkNpmPublished,
        checkIfUpgradePlan: buildActivities.checkIfUpgradePlan,
        auditPackageState: buildActivities.auditPackageState,
        auditPackageUpgrade: buildActivities.auditPackageUpgrade,
        runBuild: buildActivities.runBuild,
        runTests: buildActivities.runTests,
        runQualityChecks: buildActivities.runQualityChecks,
        publishPackage: buildActivities.publishPackage,
        commitChanges: buildActivities.commitChanges,
        pushChanges: buildActivities.pushChanges,
        // Resume Activities
        detectResumePoint: resumeActivities.detectResumePoint,
        // Agent Activities
        verifyDependencies: agentActivities.verifyDependencies,
        spawnFixAgent: agentActivities.spawnFixAgent,
        // Report Activities
        writePackageBuildReport: reportActivities.writePackageBuildReport,
        // MCP Activities (no-op for tests)
        updateMCPPackageStatus: async () => {},
      },
    });

    // Start worker in background
    workerRunPromise = worker.run();
  });

  afterEach(async () => {
    if (worker) {
      worker.shutdown();
      await workerRunPromise;
    }
    if (testEnv) {
      await testEnv.teardown();
    }
    vi.restoreAllMocks();
  });

  it('should execute workflow with minimal input and complete successfully', async () => {
    const input: PackageBuildInput = {
      packageName: '@test/simple-package',
      packagePath: 'packages/test/simple-package',
      planPath: 'plans/test/simple-package.md',
      category: 'test',
      dependencies: [],
      workspaceRoot: '/tmp',
      config: {},
    };

    // Import workflow function for execution (must be imported, not string)
    const { PackageBuildWorkflow } = await import('../../index.js');
    
    // Execute workflow
    const result = await testEnv.client.workflow.execute(PackageBuildWorkflow, {
      taskQueue: 'test-package-build-queue',
      workflowId: `test-workflow-1-${Date.now()}`,
      args: [input],
    });

    // Verify result
    expect(result).toBeDefined();
    if (!result.success) {
      console.error('Workflow failed:', result.report?.status, result.report?.error);
      console.error('Full result:', JSON.stringify(result, null, 2));
    }
    expect(result.success).toBe(true);
    expect(result.packageName).toBe('@test/simple-package');

    // Verify activities were called
    expect(cliActivities.setupCLIWorkspace).toHaveBeenCalled();
    expect(cliActivities.readPlanFileContent).toHaveBeenCalled();
    expect(cliActivities.readRequirementsContent).toHaveBeenCalled();
    expect(cliActivities.requestTaskBreakdown).toHaveBeenCalled();
  }, 30000); // 30 second timeout

  it('should handle task breakdown with multiple tasks', async () => {
    // Mock task breakdown with multiple tasks
    (cliActivities.requestTaskBreakdown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      outline: [
        {
          phase_id: 'P1',
          title: 'Scaffolding',
          description: 'Initial package setup',
          exit_criteria: ['All files created'],
        },
      ],
      tasks: [
        {
          id: 'T1',
          title: 'Create package.json',
          description: 'Create package.json',
          acceptance_criteria: ['package.json exists'],
          quality_gates: [],
          validation_steps: ['file_exists:package.json'],
          dependencies: [],
        },
        {
          id: 'T2',
          title: 'Create tsconfig.json',
          description: 'Create tsconfig.json',
          acceptance_criteria: ['tsconfig.json exists'],
          quality_gates: [],
          validation_steps: ['file_exists:tsconfig.json'],
          dependencies: ['T1'],
        },
      ],
      more_tasks: false,
      completed_task_id: null,
      activities: [],
    });

    const input: PackageBuildInput = {
      packageName: '@test/multi-task-package',
      packagePath: 'packages/test/multi-task-package',
      planPath: 'plans/test/multi-task-package.md',
      category: 'test',
      dependencies: [],
      workspaceRoot: '/tmp',
      config: {},
    };

    const { PackageBuildWorkflow } = await import('../../index.js');
    
    const result = await testEnv.client.workflow.execute(PackageBuildWorkflow, {
      taskQueue: 'test-package-build-queue',
      workflowId: `test-workflow-2-${Date.now()}`,
      args: [input],
    });

    expect(result.success).toBe(true);
    // Verify new task activity loop activities were called
    expect(cliActivities.executeTaskWithCLI).toHaveBeenCalled();
    expect(cliActivities.runTaskValidations).toHaveBeenCalled();
    const taskCallCount = (cliActivities.executeTaskWithCLI as ReturnType<typeof vi.fn>).mock.calls.length;
    const validationCallCount = (cliActivities.runTaskValidations as ReturnType<typeof vi.fn>).mock.calls.length;
    // Verify multiple task calls were made (one per task in scaffold phase)
    // Note: The workflow may also call CLI for implement phase, so we check >= 2
    expect(taskCallCount).toBeGreaterThanOrEqual(2);
    // Verify validations were run for each task
    expect(validationCallCount).toBeGreaterThanOrEqual(2);
  }, 30000);
});

