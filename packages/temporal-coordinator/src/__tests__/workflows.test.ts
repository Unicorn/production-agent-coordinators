import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import * as path from 'path';

// Import the workflow
import { AuditedBuildWorkflow } from '../workflows';

// Mock the entire activities module to inject our controlled mocks directly
vi.mock('../activities', () => ({
  setupWorkspace: vi.fn(),
  logAuditEntry: vi.fn(),
  executeGeminiAgent: vi.fn(),
  runComplianceChecks: vi.fn(),
}));

// Import the mocked activities. This will now contain the vi.fn() instances
import * as activities from '../activities';

describe('AuditedBuildWorkflow', () => {
  let testEnv: TestWorkflowEnvironment;
  let worker: Worker;

  const MOCK_WORKING_DIR = '/tmp/test-builds/build-workflow-mock-uuid';
  const MOCK_SPEC_CONTENT = '## PACKAGE SPEC\nTest package spec content.';
  const MOCK_REQUIREMENTS_CONTENT = '## BernierLLC STRICT PUBLISHING CONSTRAINTS\nTest requirements.';

    let workerRunPromise: Promise<void>;

  beforeEach(async () => {
    vi.clearAllMocks(); // Clear mocks for all functions

    // Await the creation of testEnv
    testEnv = await TestWorkflowEnvironment.createTimeSkipping();

    // Reset and set default mock implementations for activities
    activities.setupWorkspace.mockResolvedValue(MOCK_WORKING_DIR);
    activities.logAuditEntry.mockResolvedValue(undefined); // No return expected
    activities.executeGeminiAgent.mockResolvedValue({ success: true, agentResponse: { message: 'Code generated' } });
    activities.runComplianceChecks.mockResolvedValue({ success: true, output: 'All checks passed.' });

    worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue: 'test-build-task-queue',
      workflowsPath: path.join(__dirname, '../../dist/workflows.js'), // Correct path to compiled workflows.js
      activities: {
        setupWorkspace: activities.setupWorkspace,
        logAuditEntry: activities.logAuditEntry,
        executeGeminiAgent: activities.executeGeminiAgent,
        runComplianceChecks: activities.runComplianceChecks,
      },
    });
    // Start the worker in the background
    workerRunPromise = worker.run();
  });

  afterEach(async () => {
    if (worker) {
      // Shutdown the worker and wait for its run promise to complete
      worker.shutdown();
      await workerRunPromise;
    }
    if (testEnv) {
      await testEnv.teardown();
    }
    vi.restoreAllMocks();
  });

  it('should successfully build a package with no errors', async () => {
    const result = await testEnv.client.workflow.execute(AuditedBuildWorkflow, {
      taskQueue: 'test-build-task-queue',
      workflowId: 'test-workflow-success',
      args: [MOCK_SPEC_CONTENT, MOCK_REQUIREMENTS_CONTENT],
    });

    expect(result).toContain('Core Package Verified Green');
    expect(activities.setupWorkspace).toHaveBeenCalledOnce();
    expect(activities.executeGeminiAgent).toHaveBeenCalledTimes(2); // Scaffolding + Implementation
    expect(activities.runComplianceChecks).toHaveBeenCalledOnce();
    expect(activities.logAuditEntry).toHaveBeenCalledTimes(4); // Workflow start + scaffolding + implementation + initial verification
  });

  it('should self-correct and pass after initial compliance check failure', async () => {
    // Initial failure, then success on retry
    activities.runComplianceChecks
      .mockResolvedValueOnce({ success: false, output: 'Build failed: lint errors' })
      .mockResolvedValueOnce({ success: true, output: 'All checks passed after fix' });

    // Ensure the default mock for executeGeminiAgent is set to always succeed for generic operations
    activities.executeGeminiAgent
      .mockResolvedValueOnce({ success: true, agentResponse: { message: 'Scaffolded' } }) // Scaffolding
      .mockResolvedValueOnce({ success: true, agentResponse: { message: 'Implemented' } }) // Implementation
      .mockResolvedValueOnce({ success: true, agentResponse: { message: 'Fixed errors' } }); // Fix attempt

    const result = await testEnv.client.workflow.execute(AuditedBuildWorkflow, {
      taskQueue: 'test-build-task-queue',
      workflowId: 'test-workflow-self-correct',
      args: [MOCK_SPEC_CONTENT, MOCK_REQUIREMENTS_CONTENT],
    });

    expect(result).toContain('Core Package Verified Green');
    expect(activities.setupWorkspace).toHaveBeenCalledOnce();
    expect(activities.executeGeminiAgent).toHaveBeenCalledTimes(3); // Scaffold, Implement, Fix
    expect(activities.runComplianceChecks).toHaveBeenCalledTimes(2); // Initial check, then retry
    expect(activities.logAuditEntry).toHaveBeenCalledTimes(5); // Start, scaffold, implement, init_verify (fail), repair_attempt_2 (pass)
  });

  it('should fail if max repair attempts are exceeded', async () => {
    // Always return failure for compliance checks
    activities.runComplianceChecks.mockResolvedValue({ success: false, output: 'Still failing' });

    // Ensure the default mock for executeGeminiAgent is set to always succeed for generic operations
    activities.executeGeminiAgent
      .mockResolvedValue({ success: true, agentResponse: { message: 'Operation' } }); // Any agent operation

    try {
      await testEnv.client.workflow.execute(AuditedBuildWorkflow, {
        taskQueue: 'test-build-task-queue',
        workflowId: 'test-workflow-max-retries',
        args: [MOCK_SPEC_CONTENT, MOCK_REQUIREMENTS_CONTENT],
      });
      // Should not reach here
      expect.fail('Expected workflow to throw');
    } catch (error: any) {
      // The error is wrapped by Temporal - check the cause
      expect(error.cause?.message || error.message).toContain('Failed to meet publishing requirements after 3 attempts');
    }

    expect(activities.setupWorkspace).toHaveBeenCalledOnce();
    expect(activities.executeGeminiAgent).toHaveBeenCalledTimes(1 + 1 + 3); // Scaffold, Implement, 3 Fix attempts
    expect(activities.runComplianceChecks).toHaveBeenCalledTimes(3); // 3 checks in the loop
    expect(activities.logAuditEntry).toHaveBeenCalledTimes(1 + 2 + 3); // Start, scaffold, implement, 3 verification entries
  });
});
