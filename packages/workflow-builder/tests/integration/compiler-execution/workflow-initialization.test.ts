/**
 * Workflow Initialization Tests
 * Verifies that all workflow types initialize correctly in Temporal
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  IntegrationTestContext,
  generateWorkflowId,
} from './test-helpers';
import {
  simpleWorkflow,
  timeoutWorkflow,
  timeoutRetryWorkflow,
  alwaysTimeoutWorkflow,
  multiTimeoutWorkflow,
  noRetryWorkflow,
  keepTryingWorkflow,
  maxIntervalWorkflow,
  cancelWorkflow,
  concurrentWorkflow0,
  concurrentWorkflow1,
  concurrentWorkflow2,
  concurrentWorkflow3,
  concurrentWorkflow4,
} from './fixtures';

describe('Workflow Initialization', () => {
  let context: IntegrationTestContext;

  beforeEach(async () => {
    context = new IntegrationTestContext();
    await context.setup();
  });

  afterEach(async () => {
    await context.cleanup();
  });

  /**
   * Test helper: Verify workflow initializes and can be started
   */
  async function testWorkflowInitialization(
    workflow: any,
    expectedName: string,
    shouldComplete: boolean = true
  ) {
    // Compile and register
    const { workflowCode } = await context.compileAndRegister(workflow);

    // Assert: Generated code contains export async function with correct name
    expect(workflowCode).toContain(`export async function ${expectedName}`);
    expect(workflowCode).toContain('(input: any): Promise<any>');

    // Wait for worker to be ready
    await context.waitForWorkerReady(5000);

    // Start workflow with unique ID
    const workflowId = generateWorkflowId(`init-${expectedName.toLowerCase()}`);
    const taskQueue = workflow.settings.taskQueue || 'test-queue';

    try {
      // Start workflow - should not throw "no such function" error
      const result = await context.executeWorkflow(
        expectedName,
        workflowId,
        [{ test: 'data' }],
        {
          taskQueue,
          timeout: shouldComplete ? 30000 : 10000,
        }
      );

      if (shouldComplete) {
        // Workflow should complete successfully
        expect(result).toBeDefined();
      }
    } catch (error: any) {
      // Should NOT be a "no such function" error
      const errorMessage = error?.message || String(error);
      const isNoSuchFunctionError = 
        errorMessage.includes('no such function is exported') ||
        errorMessage.includes('no such function is exported by the workflow bundle');
      
      if (isNoSuchFunctionError) {
        // This is the exact error we're trying to prevent
        console.error(`❌ Workflow "${expectedName}" failed with initialization error:`);
        console.error(`   Error: ${errorMessage}`);
        console.error(`   Generated code contains: ${workflowCode.includes(`export async function ${expectedName}`) ? 'YES' : 'NO'}`);
        throw new Error(`Workflow "${expectedName}" failed to initialize: ${errorMessage}`);
      }

      // If workflow is designed to fail/timeout, that's OK
      if (!shouldComplete) {
        // Expected failure/timeout - verify it's not an initialization error
        expect(isNoSuchFunctionError).toBe(false);
        return;
      }

      // Otherwise, re-throw to fail the test
      throw error;
    }
  }

  describe('Basic Workflows', () => {
    it('initializes TestSimpleWorkflow', async () => {
      await testWorkflowInitialization(simpleWorkflow, 'TestSimpleWorkflow', true);
    });

    it('initializes TestTimeoutWorkflow', async () => {
      await testWorkflowInitialization(timeoutWorkflow, 'TestTimeoutWorkflow', false);
    });
  });

  describe('Timeout and Retry Combinations', () => {
    it('initializes TestTimeoutRetryWorkflow', async () => {
      await testWorkflowInitialization(timeoutRetryWorkflow, 'TestTimeoutRetryWorkflow', false);
    });

    it('initializes TestAlwaysTimeoutWorkflow', async () => {
      await testWorkflowInitialization(alwaysTimeoutWorkflow, 'TestAlwaysTimeoutWorkflow', false);
    });

    it('initializes TestMultiTimeoutWorkflow', async () => {
      await testWorkflowInitialization(multiTimeoutWorkflow, 'TestMultiTimeoutWorkflow', false);
    });
  });

  describe('Retry Policy Variations', () => {
    it('initializes TestNoRetryWorkflow', async () => {
      await testWorkflowInitialization(noRetryWorkflow, 'TestNoRetryWorkflow', false);
    });

    it('initializes TestKeepTryingWorkflow', async () => {
      await testWorkflowInitialization(keepTryingWorkflow, 'TestKeepTryingWorkflow', false);
    });

    it('initializes TestMaxIntervalWorkflow', async () => {
      await testWorkflowInitialization(maxIntervalWorkflow, 'TestMaxIntervalWorkflow', false);
    });
  });

  describe('Cancellation and Concurrency', () => {
    it('initializes TestCancelWorkflow', async () => {
      await testWorkflowInitialization(cancelWorkflow, 'TestCancelWorkflow', false);
    });

    it('initializes TestConcurrentWorkflow0', async () => {
      await testWorkflowInitialization(concurrentWorkflow0, 'TestConcurrentWorkflow0', true);
    });

    it('initializes TestConcurrentWorkflow1', async () => {
      await testWorkflowInitialization(concurrentWorkflow1, 'TestConcurrentWorkflow1', true);
    });

    it('initializes TestConcurrentWorkflow2', async () => {
      await testWorkflowInitialization(concurrentWorkflow2, 'TestConcurrentWorkflow2', true);
    });

    it('initializes TestConcurrentWorkflow3', async () => {
      await testWorkflowInitialization(concurrentWorkflow3, 'TestConcurrentWorkflow3', true);
    });

    it('initializes TestConcurrentWorkflow4', async () => {
      await testWorkflowInitialization(concurrentWorkflow4, 'TestConcurrentWorkflow4', true);
    });
  });

  describe('Workflow Name Matching', () => {
    it('ensures workflow.name matches exported function name', async () => {
      const workflows = [
        simpleWorkflow,
        timeoutWorkflow,
        timeoutRetryWorkflow,
        cancelWorkflow,
      ];

      for (const workflow of workflows) {
        const { workflowCode } = await context.compileAndRegister(workflow);
        
        // The exported function name should exactly match workflow.name
        expect(workflowCode).toContain(`export async function ${workflow.name}`);
        
        // Verify the name passed to start() would match
        const workflowId = generateWorkflowId('name-test');
        const client = context.getClient();
        
        // This should not throw "no such function" error
        try {
          const handle = await client.start(workflow.name, {
            taskQueue: workflow.settings.taskQueue || 'test-queue',
            workflowId,
            args: [{ test: 'data' }],
          });
          
          // Cancel immediately to avoid leaving running workflows
          await handle.cancel();
        } catch (error: any) {
          const errorMessage = error?.message || String(error);
          expect(errorMessage).not.toContain('no such function');
        }
      }
    });
  });
});

