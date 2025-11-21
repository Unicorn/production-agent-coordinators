/**
 * Timeout handling integration tests
 * Tests that verify timeout configurations work correctly in compiled workflows
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WorkflowCompiler } from '@/lib/compiler';
import {
  IntegrationTestContext,
  generateWorkflowId,
  testActivities,
  sleep,
} from './test-helpers';
import { timeoutWorkflow, simpleWorkflow } from './fixtures';
import type { WorkflowDefinition } from '@/lib/compiler/types';

describe('Timeout Handling Integration', () => {
  let context: IntegrationTestContext;

  beforeAll(async () => {
    context = new IntegrationTestContext();
    await context.setup();
  }, 30000);

  afterAll(async () => {
    await context.cleanup();
  }, 10000);

  describe('Activity Timeout', () => {
    it('should timeout slow activity when timeout is exceeded', async () => {
      // Create activity that takes longer than timeout
      const slowActivities = {
        ...testActivities,
        slowActivity: async () => {
          // Sleep for 5 seconds (timeout is 2s)
          await sleep(5000);
          return 'Should not reach here';
        },
      };

      // Compile and register workflow with 2s timeout
      await context.compileAndRegister(timeoutWorkflow, {
        activities: slowActivities,
      });

      await context.waitForWorkerReady();

      // Execute workflow - should timeout
      const workflowId = generateWorkflowId('activity-timeout');
      const startTime = Date.now();

      await expect(
        context.executeWorkflow(timeoutWorkflow.name, workflowId, [], {
          timeout: 30000,
        })
      ).rejects.toThrow();

      const executionTime = Date.now() - startTime;

      // Should timeout quickly (around 2-3 seconds, not 5)
      expect(executionTime).toBeLessThan(5000);
      expect(executionTime).toBeGreaterThan(1500); // At least 1.5s for timeout
    }, 60000);

    it('should complete activity that finishes before timeout', async () => {
      // Create fast activity
      const fastActivities = {
        ...testActivities,
        slowActivity: async () => {
          // Sleep for only 1 second (timeout is 2s)
          await sleep(1000);
          return 'Completed before timeout';
        },
      };

      await context.compileAndRegister(timeoutWorkflow, {
        activities: fastActivities,
      });

      await context.waitForWorkerReady();

      // Execute workflow - should complete successfully
      const workflowId = generateWorkflowId('activity-fast');
      const result = await context.executeWorkflow<string>(
        timeoutWorkflow.name,
        workflowId,
        [],
        { timeout: 30000 }
      );

      // Should complete successfully
      expect(result).toBe('Completed before timeout');
    }, 60000);

    it('should apply timeout from activity configuration', async () => {
      const customTimeoutWorkflow: WorkflowDefinition = {
        ...simpleWorkflow,
        id: 'test-custom-timeout',
        name: 'TestCustomTimeoutWorkflow',
        nodes: simpleWorkflow.nodes.map(node =>
          node.id === 'activity-hello'
            ? {
                ...node,
                data: {
                  ...node.data,
                  componentName: 'slowActivity',
                  activityName: 'slowActivity',
                  timeout: '3s', // Custom 3s timeout
                },
              }
            : node
        ),
      };

      const slowActivities = {
        ...testActivities,
        slowActivity: async () => {
          await sleep(5000); // 5 second delay
          return 'Should timeout';
        },
      };

      await context.compileAndRegister(customTimeoutWorkflow, {
        activities: slowActivities,
      });

      await context.waitForWorkerReady();

      const workflowId = generateWorkflowId('custom-timeout');
      const startTime = Date.now();

      await expect(
        context.executeWorkflow(customTimeoutWorkflow.name, workflowId, [], {
          timeout: 30000,
        })
      ).rejects.toThrow();

      const executionTime = Date.now() - startTime;

      // Should timeout around 3s
      expect(executionTime).toBeLessThan(5000);
      expect(executionTime).toBeGreaterThan(2500);
    }, 60000);
  });

  describe('Workflow-Level Timeout', () => {
    it('should timeout entire workflow when workflow timeout is exceeded', async () => {
      const shortTimeoutWorkflow: WorkflowDefinition = {
        ...simpleWorkflow,
        id: 'test-workflow-timeout',
        name: 'TestWorkflowTimeoutWorkflow',
        settings: {
          ...simpleWorkflow.settings,
          timeout: '5s', // Workflow-level 5s timeout
        },
        nodes: simpleWorkflow.nodes.map(node =>
          node.id === 'activity-hello'
            ? {
                ...node,
                data: {
                  ...node.data,
                  componentName: 'slowActivity',
                  activityName: 'slowActivity',
                  timeout: '30s', // Activity timeout is longer
                },
              }
            : node
        ),
      };

      const slowActivities = {
        ...testActivities,
        slowActivity: async () => {
          await sleep(10000); // 10 second delay
          return 'Should not complete';
        },
      };

      await context.compileAndRegister(shortTimeoutWorkflow, {
        activities: slowActivities,
      });

      await context.waitForWorkerReady();

      const workflowId = generateWorkflowId('workflow-timeout');
      const startTime = Date.now();

      await expect(
        context.executeWorkflow(shortTimeoutWorkflow.name, workflowId, [], {
          timeout: 30000,
        })
      ).rejects.toThrow();

      const executionTime = Date.now() - startTime;

      // Should timeout around 5s (workflow timeout), not 10s or 30s
      expect(executionTime).toBeLessThan(10000);
    }, 60000);
  });

  describe('Timeout with Retry', () => {
    it('should retry timed-out activity when retry policy is configured', async () => {
      const timeoutWithRetryWorkflow: WorkflowDefinition = {
        ...timeoutWorkflow,
        id: 'test-timeout-retry',
        name: 'TestTimeoutRetryWorkflow',
        nodes: timeoutWorkflow.nodes.map(node =>
          node.id === 'activity-slow'
            ? {
                ...node,
                data: {
                  ...node.data,
                  timeout: '2s',
                  retryPolicy: {
                    strategy: 'exponential-backoff',
                    maxAttempts: 3,
                    initialInterval: '1s',
                    backoffCoefficient: 2,
                  },
                },
              }
            : node
        ),
      };

      let attemptCount = 0;
      const flakySlowActivities = {
        ...testActivities,
        slowActivity: async () => {
          attemptCount++;
          // First 2 attempts timeout, 3rd succeeds
          if (attemptCount < 3) {
            await sleep(3000); // Exceeds 2s timeout
            return 'Should timeout';
          }
          await sleep(500); // Quick success
          return 'Success on attempt 3';
        },
      };

      await context.compileAndRegister(timeoutWithRetryWorkflow, {
        activities: flakySlowActivities,
      });

      await context.waitForWorkerReady();

      const workflowId = generateWorkflowId('timeout-retry');
      const result = await context.executeWorkflow<string>(
        timeoutWithRetryWorkflow.name,
        workflowId,
        [],
        { timeout: 60000 }
      );

      // Should eventually succeed after retries
      expect(result).toContain('Success');
      expect(attemptCount).toBe(3);
    }, 90000);

    it('should fail after max retries if activity keeps timing out', async () => {
      const alwaysTimeoutWorkflow: WorkflowDefinition = {
        ...timeoutWorkflow,
        id: 'test-always-timeout',
        name: 'TestAlwaysTimeoutWorkflow',
        nodes: timeoutWorkflow.nodes.map(node =>
          node.id === 'activity-slow'
            ? {
                ...node,
                data: {
                  ...node.data,
                  timeout: '2s',
                  retryPolicy: {
                    strategy: 'fail-after-x',
                    maxAttempts: 3,
                    initialInterval: '500ms',
                  },
                },
              }
            : node
        ),
      };

      let attemptCount = 0;
      const alwaysSlowActivities = {
        ...testActivities,
        slowActivity: async () => {
          attemptCount++;
          await sleep(5000); // Always exceeds timeout
          return 'Never completes';
        },
      };

      await context.compileAndRegister(alwaysTimeoutWorkflow, {
        activities: alwaysSlowActivities,
      });

      await context.waitForWorkerReady();

      const workflowId = generateWorkflowId('always-timeout');
      await expect(
        context.executeWorkflow(alwaysTimeoutWorkflow.name, workflowId, [], {
          timeout: 60000,
        })
      ).rejects.toThrow();

      // Should have attempted up to maxAttempts
      expect(attemptCount).toBeLessThanOrEqual(3);
    }, 90000);
  });

  describe('Timeout Events in History', () => {
    it('should record timeout event in workflow history', async () => {
      const slowActivities = {
        ...testActivities,
        slowActivity: async () => {
          await sleep(5000);
          return 'Timeout';
        },
      };

      await context.compileAndRegister(timeoutWorkflow, {
        activities: slowActivities,
      });

      await context.waitForWorkerReady();

      const workflowId = generateWorkflowId('timeout-history');

      try {
        await context.executeWorkflow(timeoutWorkflow.name, workflowId, [], {
          timeout: 30000,
        });
      } catch (error) {
        // Expected to fail
      }

      // Get workflow history
      const history = await context.getWorkflowHistory(workflowId);
      const events = history.events;

      // Should have activity timeout or failure event
      const hasTimeoutEvent = events.some((e: any) =>
        ['ActivityTaskTimedOut', 'ActivityTaskFailed', 'WorkflowExecutionFailed'].includes(
          e.eventType
        )
      );

      expect(hasTimeoutEvent).toBe(true);
    }, 60000);
  });

  describe('Multiple Activities with Different Timeouts', () => {
    it('should handle multiple activities with different timeout configurations', async () => {
      const multiTimeoutWorkflow: WorkflowDefinition = {
        id: 'test-multi-timeout',
        name: 'TestMultiTimeoutWorkflow',
        nodes: [
          {
            id: 'trigger-start',
            type: 'trigger',
            position: { x: 0, y: 0 },
            data: { label: 'Start', config: { type: 'manual' } },
          },
          {
            id: 'activity-fast',
            type: 'activity',
            position: { x: 100, y: 0 },
            data: {
              label: 'Fast Activity',
              componentName: 'fastActivity',
              activityName: 'fastActivity',
              timeout: '5s', // Long timeout
            },
          },
          {
            id: 'activity-medium',
            type: 'activity',
            position: { x: 200, y: 0 },
            data: {
              label: 'Medium Activity',
              componentName: 'mediumActivity',
              activityName: 'mediumActivity',
              timeout: '3s', // Medium timeout
            },
          },
          {
            id: 'activity-strict',
            type: 'activity',
            position: { x: 300, y: 0 },
            data: {
              label: 'Strict Activity',
              componentName: 'strictActivity',
              activityName: 'strictActivity',
              timeout: '1s', // Short timeout
            },
          },
          {
            id: 'end-node',
            type: 'end',
            position: { x: 400, y: 0 },
            data: { label: 'End' },
          },
        ],
        edges: [
          { id: 'e1', source: 'trigger-start', target: 'activity-fast' },
          { id: 'e2', source: 'activity-fast', target: 'activity-medium' },
          { id: 'e3', source: 'activity-medium', target: 'activity-strict' },
          { id: 'e4', source: 'activity-strict', target: 'end-node' },
        ],
        variables: [],
        settings: {
          timeout: '30s',
          taskQueue: 'test-queue',
          description: 'Multi-timeout test',
          version: '1.0.0',
        },
      };

      const multiTimeoutActivities = {
        ...testActivities,
        fastActivity: async () => {
          await sleep(500); // Well under 5s
          return 'fast';
        },
        mediumActivity: async () => {
          await sleep(1000); // Under 3s
          return 'medium';
        },
        strictActivity: async () => {
          await sleep(2000); // Exceeds 1s - should timeout
          return 'strict';
        },
      };

      await context.compileAndRegister(multiTimeoutWorkflow, {
        activities: multiTimeoutActivities,
      });

      await context.waitForWorkerReady();

      const workflowId = generateWorkflowId('multi-timeout');

      // Should fail on strict activity timeout
      await expect(
        context.executeWorkflow(multiTimeoutWorkflow.name, workflowId, [], {
          timeout: 30000,
        })
      ).rejects.toThrow();
    }, 60000);
  });

  describe('Timeout Duration Parsing', () => {
    it('should correctly parse timeout duration strings', async () => {
      const durationTestCases = [
        { timeout: '1s', expectedMs: 1000 },
        { timeout: '30s', expectedMs: 30000 },
        { timeout: '1m', expectedMs: 60000 },
        { timeout: '5m', expectedMs: 300000 },
      ];

      for (const testCase of durationTestCases) {
        const workflow: WorkflowDefinition = {
          ...simpleWorkflow,
          id: `test-duration-${testCase.timeout}`,
          name: `TestDuration${testCase.timeout}Workflow`,
          nodes: simpleWorkflow.nodes.map(node =>
            node.id === 'activity-hello'
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    timeout: testCase.timeout,
                  },
                }
              : node
          ),
        };

        const compiler = new WorkflowCompiler();
        const result = compiler.compile(workflow);

        expect(result.success).toBe(true);
        expect(result.workflowCode).toContain(testCase.timeout);
      }
    });
  });
});
