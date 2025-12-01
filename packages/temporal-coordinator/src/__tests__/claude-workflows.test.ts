import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import * as path from 'path';

// Import the workflow (type only - workflow runs in sandbox)
import type { ClaudeAuditedBuildWorkflowInput, ClaudeAuditedBuildWorkflowResult } from '../claude-workflows';

// Mock the entire claude-activities module to inject our controlled mocks directly
// Note: selectRepairModel is a pure function defined in the workflow, not mocked
vi.mock('../claude-activities', () => ({
  executeClaudeAgent: vi.fn(),
  setupClaudeWorkspace: vi.fn(),
  runClaudeComplianceChecks: vi.fn(),
  logClaudeAuditEntry: vi.fn(),
}));

// Import the mocked activities. This will now contain the vi.fn() instances
import * as claudeActivities from '../claude-activities';

describe('ClaudeAuditedBuildWorkflow', () => {
  let testEnv: TestWorkflowEnvironment;
  let worker: Worker;
  let workerRunPromise: Promise<void>;

  const MOCK_WORKING_DIR = '/tmp/claude-builds/claude-build-mock-uuid';
  const MOCK_SPEC_CONTENT = '## PACKAGE SPEC\nTest package spec content.';
  const MOCK_REQUIREMENTS_CONTENT = '## BernierLLC STRICT PUBLISHING CONSTRAINTS\nTest requirements.';
  const MOCK_SESSION_ID = 'session-mock-12345';

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create test environment
    testEnv = await TestWorkflowEnvironment.createTimeSkipping();

    // Set default mock implementations for Claude activities
    claudeActivities.setupClaudeWorkspace.mockResolvedValue(MOCK_WORKING_DIR);
    claudeActivities.logClaudeAuditEntry.mockResolvedValue(undefined);
    claudeActivities.executeClaudeAgent.mockResolvedValue({
      success: true,
      result: 'Code generated successfully',
      cost_usd: 0.05,
      duration_ms: 5000,
      session_id: MOCK_SESSION_ID,
      num_turns: 3,
    });
    claudeActivities.runClaudeComplianceChecks.mockResolvedValue({
      success: true,
      output: 'All checks passed.',
      commandsRun: ['npm install', 'npm run build', 'npm run lint', 'npm test'],
    });

    worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue: 'test-claude-task-queue',
      workflowsPath: path.join(__dirname, '../../dist/claude-workflows.js'),
      activities: {
        executeClaudeAgent: claudeActivities.executeClaudeAgent,
        setupClaudeWorkspace: claudeActivities.setupClaudeWorkspace,
        runClaudeComplianceChecks: claudeActivities.runClaudeComplianceChecks,
        logClaudeAuditEntry: claudeActivities.logClaudeAuditEntry,
      },
    });

    // Start the worker in the background
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

  it('should successfully build a package with no errors', async () => {
    const input: ClaudeAuditedBuildWorkflowInput = {
      specFileContent: MOCK_SPEC_CONTENT,
      requirementsFileContent: MOCK_REQUIREMENTS_CONTENT,
    };

    const result = await testEnv.client.workflow.execute<
      (input: ClaudeAuditedBuildWorkflowInput) => Promise<ClaudeAuditedBuildWorkflowResult>
    >('ClaudeAuditedBuildWorkflow', {
      taskQueue: 'test-claude-task-queue',
      workflowId: 'test-claude-workflow-success',
      args: [input],
    });

    expect(result.success).toBe(true);
    expect(result.workspacePath).toBe(MOCK_WORKING_DIR);
    expect(result.totalCost).toBeGreaterThan(0);
    expect(result.sessionId).toBe(MOCK_SESSION_ID);
    expect(result.repairAttempts).toBe(0);

    expect(claudeActivities.setupClaudeWorkspace).toHaveBeenCalledOnce();
    expect(claudeActivities.executeClaudeAgent).toHaveBeenCalledTimes(2); // Scaffold + Implement
    expect(claudeActivities.runClaudeComplianceChecks).toHaveBeenCalledOnce();
    // Audit entries: workspace_setup + scaffold + implement + validation_initial = 4
    expect(claudeActivities.logClaudeAuditEntry).toHaveBeenCalledTimes(4);
  });

  it('should maintain session continuity between scaffold and implement phases', async () => {
    const firstSessionId = 'session-scaffold-123';
    const secondSessionId = 'session-implement-456';

    claudeActivities.executeClaudeAgent
      .mockResolvedValueOnce({
        success: true,
        result: 'Scaffolded',
        cost_usd: 0.03,
        duration_ms: 3000,
        session_id: firstSessionId,
        num_turns: 2,
      })
      .mockResolvedValueOnce({
        success: true,
        result: 'Implemented',
        cost_usd: 0.07,
        duration_ms: 7000,
        session_id: secondSessionId,
        num_turns: 4,
      });

    const input: ClaudeAuditedBuildWorkflowInput = {
      specFileContent: MOCK_SPEC_CONTENT,
      requirementsFileContent: MOCK_REQUIREMENTS_CONTENT,
    };

    const result = await testEnv.client.workflow.execute<
      (input: ClaudeAuditedBuildWorkflowInput) => Promise<ClaudeAuditedBuildWorkflowResult>
    >('ClaudeAuditedBuildWorkflow', {
      taskQueue: 'test-claude-task-queue',
      workflowId: 'test-claude-session-continuity',
      args: [input],
    });

    // Verify the second call (implement) used sessionId from first call (scaffold)
    const implementCall = claudeActivities.executeClaudeAgent.mock.calls[1];
    expect(implementCall[0].sessionId).toBe(firstSessionId);

    // Final result should have the latest session ID
    expect(result.sessionId).toBe(secondSessionId);
    expect(result.totalCost).toBe(0.10); // 0.03 + 0.07
  });

  it('should self-correct and pass after initial compliance check failure', async () => {
    // Initial failure, then success on retry
    claudeActivities.runClaudeComplianceChecks
      .mockResolvedValueOnce({
        success: false,
        output: 'Build failed: lint errors',
        commandsRun: ['npm install', 'npm run build', 'npm run lint'],
        failedCommand: 'npm run lint',
        errorType: 'ESLINT_ERROR',
      })
      .mockResolvedValueOnce({
        success: true,
        output: 'All checks passed after fix',
        commandsRun: ['npm install', 'npm run build', 'npm run lint', 'npm test'],
      });

    // Note: selectRepairModel is a pure function in the workflow that returns 'haiku' for ESLINT_ERROR

    claudeActivities.executeClaudeAgent
      .mockResolvedValueOnce({
        success: true,
        result: 'Scaffolded',
        cost_usd: 0.03,
        duration_ms: 3000,
        session_id: 'session-1',
      })
      .mockResolvedValueOnce({
        success: true,
        result: 'Implemented',
        cost_usd: 0.07,
        duration_ms: 7000,
        session_id: 'session-2',
      })
      .mockResolvedValueOnce({
        success: true,
        result: 'Fixed lint errors',
        cost_usd: 0.01, // Haiku is cheap
        duration_ms: 1000,
        session_id: 'session-3',
      });

    const input: ClaudeAuditedBuildWorkflowInput = {
      specFileContent: MOCK_SPEC_CONTENT,
      requirementsFileContent: MOCK_REQUIREMENTS_CONTENT,
    };

    const result = await testEnv.client.workflow.execute<
      (input: ClaudeAuditedBuildWorkflowInput) => Promise<ClaudeAuditedBuildWorkflowResult>
    >('ClaudeAuditedBuildWorkflow', {
      taskQueue: 'test-claude-task-queue',
      workflowId: 'test-claude-self-correct',
      args: [input],
    });

    expect(result.success).toBe(true);
    expect(result.repairAttempts).toBe(1);
    expect(result.totalCost).toBeCloseTo(0.11); // 0.03 + 0.07 + 0.01

    expect(claudeActivities.executeClaudeAgent).toHaveBeenCalledTimes(3); // Scaffold, Implement, Fix
    expect(claudeActivities.runClaudeComplianceChecks).toHaveBeenCalledTimes(2); // Initial + retry

    // Verify repair call used haiku model (for ESLint errors)
    const repairCall = claudeActivities.executeClaudeAgent.mock.calls[2];
    expect(repairCall[0].model).toBe('haiku');

    // Audit entries: workspace_setup + scaffold + implement + validation_initial + repair_1 + validation_attempt_2 = 6
    expect(claudeActivities.logClaudeAuditEntry).toHaveBeenCalledTimes(6);
  });

  it('should use opus model for cross-file architectural issues', async () => {
    claudeActivities.runClaudeComplianceChecks
      .mockResolvedValueOnce({
        success: false,
        output: 'Build failed: circular dependency detected between modules',
        commandsRun: ['npm install', 'npm run build'],
        failedCommand: 'npm run build',
        errorType: 'TSC_ERROR',
      })
      .mockResolvedValueOnce({
        success: true,
        output: 'All checks passed',
        commandsRun: ['npm install', 'npm run build', 'npm run lint', 'npm test'],
      });

    // Note: selectRepairModel is a pure function in the workflow that returns 'opus' for cross-file issues

    claudeActivities.executeClaudeAgent
      .mockResolvedValueOnce({ success: true, result: 'Scaffolded', cost_usd: 0.03, duration_ms: 3000, session_id: 's1' })
      .mockResolvedValueOnce({ success: true, result: 'Implemented', cost_usd: 0.07, duration_ms: 7000, session_id: 's2' })
      .mockResolvedValueOnce({ success: true, result: 'Fixed architecture', cost_usd: 0.50, duration_ms: 30000, session_id: 's3' }); // Opus is expensive

    const input: ClaudeAuditedBuildWorkflowInput = {
      specFileContent: MOCK_SPEC_CONTENT,
      requirementsFileContent: MOCK_REQUIREMENTS_CONTENT,
    };

    const result = await testEnv.client.workflow.execute<
      (input: ClaudeAuditedBuildWorkflowInput) => Promise<ClaudeAuditedBuildWorkflowResult>
    >('ClaudeAuditedBuildWorkflow', {
      taskQueue: 'test-claude-task-queue',
      workflowId: 'test-claude-opus-repair',
      args: [input],
    });

    expect(result.success).toBe(true);
    expect(result.totalCost).toBe(0.60); // Opus repair is expensive

    // Verify repair used opus model
    const repairCall = claudeActivities.executeClaudeAgent.mock.calls[2];
    expect(repairCall[0].model).toBe('opus');

    // Verify opus instruction includes extended thinking trigger
    expect(repairCall[0].instruction).toContain('THINK HARD');
  });

  it('should fail if max repair attempts are exceeded', async () => {
    // Always return failure for compliance checks
    claudeActivities.runClaudeComplianceChecks.mockResolvedValue({
      success: false,
      output: 'Still failing',
      commandsRun: ['npm install', 'npm run build'],
      failedCommand: 'npm run build',
      errorType: 'TSC_ERROR',
    });

    claudeActivities.executeClaudeAgent.mockResolvedValue({
      success: true,
      result: 'Operation completed',
      cost_usd: 0.05,
      duration_ms: 5000,
      session_id: 'session-loop',
    });

    const input: ClaudeAuditedBuildWorkflowInput = {
      specFileContent: MOCK_SPEC_CONTENT,
      requirementsFileContent: MOCK_REQUIREMENTS_CONTENT,
    };

    try {
      await testEnv.client.workflow.execute<
        (input: ClaudeAuditedBuildWorkflowInput) => Promise<ClaudeAuditedBuildWorkflowResult>
      >('ClaudeAuditedBuildWorkflow', {
        taskQueue: 'test-claude-task-queue',
        workflowId: 'test-claude-max-retries',
        args: [input],
      });
      expect.fail('Expected workflow to throw');
    } catch (error: unknown) {
      const errorObj = error as { cause?: { message?: string }; message?: string };
      expect(errorObj.cause?.message || errorObj.message).toContain('Failed to meet publishing requirements after 3 repair attempts');
    }

    expect(claudeActivities.setupClaudeWorkspace).toHaveBeenCalledOnce();
    // Scaffold + Implement + 2 Fix attempts (3rd attempt exits before repair) = 4
    expect(claudeActivities.executeClaudeAgent).toHaveBeenCalledTimes(4);
    // 3 checks in the loop
    expect(claudeActivities.runClaudeComplianceChecks).toHaveBeenCalledTimes(3);
  });

  it('should include architecture planning phase when enabled', async () => {
    claudeActivities.executeClaudeAgent
      .mockResolvedValueOnce({ success: true, result: 'Architecture planned', cost_usd: 0.80, duration_ms: 60000, session_id: 'opus-session' })
      .mockResolvedValueOnce({ success: true, result: 'Scaffolded', cost_usd: 0.03, duration_ms: 3000, session_id: 'scaffold-session' })
      .mockResolvedValueOnce({ success: true, result: 'Implemented', cost_usd: 0.07, duration_ms: 7000, session_id: 'impl-session' });

    const input: ClaudeAuditedBuildWorkflowInput = {
      specFileContent: MOCK_SPEC_CONTENT,
      requirementsFileContent: MOCK_REQUIREMENTS_CONTENT,
      useArchitecturePlanning: true, // Enable Opus architecture planning
    };

    const result = await testEnv.client.workflow.execute<
      (input: ClaudeAuditedBuildWorkflowInput) => Promise<ClaudeAuditedBuildWorkflowResult>
    >('ClaudeAuditedBuildWorkflow', {
      taskQueue: 'test-claude-task-queue',
      workflowId: 'test-claude-architecture-planning',
      args: [input],
    });

    expect(result.success).toBe(true);
    expect(result.totalCost).toBeCloseTo(0.90); // Opus planning is expensive

    // Should be 3 agent calls: architecture + scaffold + implement
    expect(claudeActivities.executeClaudeAgent).toHaveBeenCalledTimes(3);

    // First call should be architecture planning with opus
    const architectureCall = claudeActivities.executeClaudeAgent.mock.calls[0];
    expect(architectureCall[0].model).toBe('opus');
    expect(architectureCall[0].permissionMode).toBe('plan'); // Read-only
    expect(architectureCall[0].instruction).toContain('THINK HARD');

    // Second call (scaffold) should resume the opus session
    const scaffoldCall = claudeActivities.executeClaudeAgent.mock.calls[1];
    expect(scaffoldCall[0].sessionId).toBe('opus-session');

    // Audit entries: workspace_setup + architecture_planning + scaffold + implement + validation = 5
    expect(claudeActivities.logClaudeAuditEntry).toHaveBeenCalledTimes(5);
  });
});

describe('ClaudeSimpleBuildWorkflow', () => {
  let testEnv: TestWorkflowEnvironment;
  let worker: Worker;
  let workerRunPromise: Promise<void>;

  beforeEach(async () => {
    vi.clearAllMocks();
    testEnv = await TestWorkflowEnvironment.createTimeSkipping();

    claudeActivities.setupClaudeWorkspace.mockResolvedValue('/tmp/claude-builds/simple-build');
    claudeActivities.logClaudeAuditEntry.mockResolvedValue(undefined);
    claudeActivities.executeClaudeAgent.mockResolvedValue({
      success: true,
      result: 'Done',
      cost_usd: 0.05,
      duration_ms: 5000,
      session_id: 'simple-session',
    });
    claudeActivities.runClaudeComplianceChecks.mockResolvedValue({
      success: true,
      output: 'All checks passed.',
      commandsRun: ['npm install', 'npm run build', 'npm run lint', 'npm test'],
    });

    worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue: 'test-claude-simple-task-queue',
      workflowsPath: path.join(__dirname, '../../dist/claude-workflows.js'),
      activities: {
        executeClaudeAgent: claudeActivities.executeClaudeAgent,
        setupClaudeWorkspace: claudeActivities.setupClaudeWorkspace,
        runClaudeComplianceChecks: claudeActivities.runClaudeComplianceChecks,
        logClaudeAuditEntry: claudeActivities.logClaudeAuditEntry,
      },
    });

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

  it('should use sonnet throughout and skip architecture planning', async () => {
    const result = await testEnv.client.workflow.execute<
      (spec: string, reqs: string) => Promise<ClaudeAuditedBuildWorkflowResult>
    >('ClaudeSimpleBuildWorkflow', {
      taskQueue: 'test-claude-simple-task-queue',
      workflowId: 'test-claude-simple',
      args: ['spec content', 'requirements content'],
    });

    expect(result.success).toBe(true);

    // Should only be 2 calls: scaffold + implement (no architecture planning)
    expect(claudeActivities.executeClaudeAgent).toHaveBeenCalledTimes(2);

    // Both calls should use sonnet
    const scaffoldCall = claudeActivities.executeClaudeAgent.mock.calls[0];
    const implementCall = claudeActivities.executeClaudeAgent.mock.calls[1];
    expect(scaffoldCall[0].model).toBe('sonnet');
    expect(implementCall[0].model).toBe('sonnet');
  });
});
