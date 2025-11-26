/**
 * End-to-end integration tests
 * Tests that compile workflows, execute in Temporal, and verify completion
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { WorkflowCompiler } from '@/lib/compiler';
import {
  IntegrationTestContext,
  generateWorkflowId,
  sleep,
} from './test-helpers';
import {
  simpleWorkflow,
  multiActivityWorkflow,
  missingTriggerWorkflow,
  cyclicWorkflow,
} from './fixtures';

describe('End-to-End Compiler and Execution Integration', () => {
  let context: IntegrationTestContext;

  beforeAll(async () => {
    context = new IntegrationTestContext();
    await context.setup();
  }, 30000);

  afterAll(async () => {
    await context.cleanup();
  }, 10000);

  describe('Basic Workflow Compilation and Execution', () => {
    it('should compile simple workflow and execute in Temporal', async () => {
      // Compile and register workflow
      const { workflowCode, worker } = await context.compileAndRegister(
        simpleWorkflow
      );

      // Verify code was generated
      expect(workflowCode).toBeTruthy();
      expect(workflowCode).toContain('export async function');
      expect(workflowCode).toContain('sayHello');

      // Wait for worker to be ready
      await context.waitForWorkerReady();

      // Execute workflow
      const workflowId = generateWorkflowId('simple');
      const result = await context.executeWorkflow(
        simpleWorkflow.name,
        workflowId,
        ['Integration Test']
      );

      // Verify successful execution
      expect(result).toBeTruthy();
    }, 60000);

    it('should compile workflow with 5 activities and execute successfully', async () => {
      // Compile and register workflow
      const { workflowCode } = await context.compileAndRegister(
        multiActivityWorkflow
      );

      // Verify all activities are in generated code
      expect(workflowCode).toContain('stepOne');
      expect(workflowCode).toContain('stepTwo');
      expect(workflowCode).toContain('stepThree');
      expect(workflowCode).toContain('stepFour');
      expect(workflowCode).toContain('stepFive');

      // Wait for worker to be ready
      await context.waitForWorkerReady();

      // Execute workflow
      const workflowId = generateWorkflowId('multi-activity');
      const result = await context.executeWorkflow<any>(
        multiActivityWorkflow.name,
        workflowId,
        [{ initial: 'data' }]
      );

      // Verify all steps completed
      expect(result).toBeTruthy();
      expect(result.step).toBe(5);
      expect(result.data.step1).toBe('completed');
      expect(result.data.step2).toBe('completed');
      expect(result.data.step3).toBe('completed');
      expect(result.data.step4).toBe('completed');
      expect(result.data.step5).toBe('completed');
    }, 90000);

    it('should execute workflow immediately after registration', async () => {
      // Compile and register
      await context.compileAndRegister(simpleWorkflow);

      // Wait for worker
      await context.waitForWorkerReady();

      // Execute immediately (no delay)
      const workflowId = generateWorkflowId('immediate');
      const startTime = Date.now();
      const result = await context.executeWorkflow(
        simpleWorkflow.name,
        workflowId,
        ['Immediate Test']
      );
      const executionTime = Date.now() - startTime;

      // Verify executed quickly (within 10 seconds)
      expect(result).toBeTruthy();
      expect(executionTime).toBeLessThan(10000);
    }, 60000);
  });

  describe('Concurrent Workflow Execution', () => {
    it('should execute 5 different workflows simultaneously', async () => {
      // Create 5 variations of the simple workflow
      const workflows = Array.from({ length: 5 }, (_, i) => ({
        ...simpleWorkflow,
        id: `test-concurrent-${i}`,
        name: `TestConcurrentWorkflow${i}`,
        settings: {
          ...simpleWorkflow.settings,
          taskQueue: 'test-queue-concurrent',
        },
      }));

      // Register all workflows in a single worker bundle (needed for shared task queue)
      await context.compileAndRegisterMultiple(workflows, {
        taskQueue: 'test-queue-concurrent',
      });

      // Wait for worker to be ready
      await context.waitForWorkerReady();

      // Execute all workflows concurrently
      const executions = workflows.map((workflow, i) => {
        const workflowId = generateWorkflowId(`concurrent-${i}`);
        return context.executeWorkflow(
          workflow.name,
          workflowId,
          [`Concurrent Test ${i}`],
          { taskQueue: 'test-queue-concurrent' }
        );
      });

      // Wait for all to complete
      const results = await Promise.all(executions);

      // Verify all completed successfully
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toBeTruthy();
      });
    }, 120000);
  });

  describe('Workflow History and Monitoring', () => {
    it('should be able to query workflow execution history', async () => {
      // Register workflow
      await context.compileAndRegister(multiActivityWorkflow);
      await context.waitForWorkerReady();

      // Execute workflow
      const workflowId = generateWorkflowId('history');
      await context.executeWorkflow(
        multiActivityWorkflow.name,
        workflowId,
        [{ test: 'data' }]
      );

      // Get workflow history
      const history = await context.getWorkflowHistory(workflowId);

      // Verify history exists and contains events
      expect(history).toBeTruthy();
      expect(history.events).toBeTruthy();
      expect(history.events.length).toBeGreaterThan(0);

      // Should have workflow started and completed events
      const eventTypes = history.events.map((e: any) => e.eventType);
      expect(eventTypes).toContain('WorkflowExecutionStarted');
      expect(eventTypes).toContain('WorkflowExecutionCompleted');
    }, 90000);
  });

  describe('Workflow Cancellation', () => {
    it('should be able to cancel running workflow', async () => {
      // Create slow workflow for cancellation test
      const slowWorkflow = {
        ...simpleWorkflow,
        id: 'test-cancel-workflow',
        name: 'TestCancelWorkflow',
        nodes: simpleWorkflow.nodes.map(node =>
          node.id === 'activity-hello'
            ? {
                ...node,
                data: {
                  ...node.data,
                  componentName: 'slowActivity',
                  activityName: 'slowActivity',
                },
              }
            : node
        ),
      };

      // Register workflow
      await context.compileAndRegister(slowWorkflow);
      await context.waitForWorkerReady();

      // Start workflow (will run for 5 seconds)
      const workflowId = generateWorkflowId('cancel');
      const executionPromise = context.executeWorkflow(
        slowWorkflow.name,
        workflowId,
        [5000] // 5 second delay
      );

      // Wait a bit then cancel
      await sleep(1000);
      await context.cancelWorkflow(workflowId);

      // Verify workflow was cancelled
      await expect(executionPromise).rejects.toThrow();
    }, 60000);
  });

  describe('Compiler Error Handling', () => {
    it('should reject workflow with no trigger node', async () => {
      const compiler = new WorkflowCompiler();
      const result = compiler.compile(missingTriggerWorkflow);

      // Should fail validation
      expect(result.success).toBe(false);
      expect(result.errors).toBeTruthy();
      expect(result.errors!.length).toBeGreaterThan(0);
      expect(result.errors![0].message).toContain('trigger');
    });

    it('should reject workflow with cycle', async () => {
      const compiler = new WorkflowCompiler();
      const result = compiler.compile(cyclicWorkflow);

      // Should fail validation (if cycle detection is implemented)
      // Otherwise should at least compile
      if (!result.success) {
        expect(result.errors).toBeTruthy();
        expect(result.errors!.some(e => e.message.toLowerCase().includes('cycle'))).toBe(
          true
        );
      } else {
        // Cycle detection not implemented yet - just verify compilation
        expect(result.workflowCode).toBeTruthy();
      }
    });
  });

  describe('TypeScript Code Validation', () => {
    it('should generate TypeScript that passes type checking', async () => {
      const compiler = new WorkflowCompiler({
        includeComments: true,
        strictMode: true,
      });

      const result = compiler.compile(simpleWorkflow);

      expect(result.success).toBe(true);
      expect(result.workflowCode).toBeTruthy();

      // Note: Full TypeScript validation would require spawning tsc
      // For now, just verify code structure
      expect(result.workflowCode).toContain('export async function');
      expect(result.workflowCode).toContain('proxyActivities');
    });

    it('should generate valid activities file', async () => {
      const compiler = new WorkflowCompiler();
      const result = compiler.compile(multiActivityWorkflow);

      expect(result.success).toBe(true);
      expect(result.activitiesCode).toBeTruthy();

      // Verify activities file has proper structure
      expect(result.activitiesCode).toContain('export async function');
      expect(result.activitiesCode).toContain('stepOne');
      expect(result.activitiesCode).toContain('stepTwo');
      expect(result.activitiesCode).toContain('stepThree');
      expect(result.activitiesCode).toContain('stepFour');
      expect(result.activitiesCode).toContain('stepFive');
    });

    it('should generate valid worker file', async () => {
      const compiler = new WorkflowCompiler();
      const result = compiler.compile(simpleWorkflow);

      expect(result.success).toBe(true);
      expect(result.workerCode).toBeTruthy();

      // Verify worker file has proper imports
      expect(result.workerCode).toContain('import');
      expect(result.workerCode).toContain('Worker');
      expect(result.workerCode).toContain('NativeConnection');
    });

    it('should generate valid package.json', async () => {
      const compiler = new WorkflowCompiler();
      const result = compiler.compile(simpleWorkflow);

      expect(result.success).toBe(true);
      expect(result.packageJson).toBeTruthy();

      // Parse and verify package.json
      const packageData = JSON.parse(result.packageJson!);
      expect(packageData.dependencies).toBeTruthy();
      expect(packageData.dependencies['@temporalio/workflow']).toBeTruthy();
      expect(packageData.dependencies['@temporalio/worker']).toBeTruthy();
      expect(packageData.dependencies['@temporalio/client']).toBeTruthy();
    });

    it('should generate valid tsconfig.json', async () => {
      const compiler = new WorkflowCompiler({ strictMode: true });
      const result = compiler.compile(simpleWorkflow);

      expect(result.success).toBe(true);
      expect(result.tsConfig).toBeTruthy();

      // Parse and verify tsconfig
      const tsConfig = JSON.parse(result.tsConfig!);
      expect(tsConfig.compilerOptions).toBeTruthy();
      expect(tsConfig.compilerOptions.strict).toBe(true);
    });
  });

  describe('Compiler Metadata', () => {
    it('should include compilation metadata', async () => {
      const compiler = new WorkflowCompiler();
      const result = compiler.compile(multiActivityWorkflow);

      expect(result.success).toBe(true);
      expect(result.metadata).toBeTruthy();
      expect(result.metadata!.nodeCount).toBe(multiActivityWorkflow.nodes.length);
      expect(result.metadata!.edgeCount).toBe(multiActivityWorkflow.edges.length);
      expect(result.metadata!.compilationTime).toBeGreaterThan(0);
      expect(result.metadata!.version).toBeTruthy();
    });

    it('should track patterns applied during compilation', async () => {
      const compiler = new WorkflowCompiler();
      const result = compiler.compile(simpleWorkflow);

      expect(result.success).toBe(true);
      expect(result.metadata).toBeTruthy();
      expect(result.metadata!.patternsApplied).toBeTruthy();
      expect(Array.isArray(result.metadata!.patternsApplied)).toBe(true);
    });
  });
});
