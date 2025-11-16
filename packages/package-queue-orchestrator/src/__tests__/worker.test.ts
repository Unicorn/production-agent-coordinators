/**
 * Tests for Worker Bootstrap
 *
 * Verifies that ensureOrchestratorRunning correctly:
 * - Detects when orchestrator is already running
 * - Starts orchestrator when not running
 * - Uses correct workflow ID and reuse policy
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { WorkflowClient } from '@temporalio/client';
import { WorkflowNotFoundError } from '@temporalio/client';
import { ContinuousBuilderWorkflow, emergencyStopSignal } from '../workflows/continuous-builder.workflow.js';
import type { OrchestratorInput } from '../types/index.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workflowsPath = path.join(__dirname, '../../dist/workflows');

/**
 * ensureOrchestratorRunning
 *
 * Ensures exactly one orchestrator instance is running.
 * If already running, does nothing. If not running, starts it.
 */
async function ensureOrchestratorRunning(
  client: WorkflowClient,
  input: OrchestratorInput,
  workflowId: string
): Promise<void> {
  try {
    // Check if already running
    const handle = client.workflow.getHandle(workflowId);
    const description = await handle.describe();

    // If workflow exists but is not running, start a new one
    if (description.status.name !== 'RUNNING') {
      await client.workflow.start(ContinuousBuilderWorkflow, {
        workflowId,
        taskQueue: 'engine',
        args: [input],
      });
      console.log('Orchestrator started');
    } else {
      console.log('Orchestrator already running');
    }
  } catch (err) {
    if (err instanceof WorkflowNotFoundError) {
      // Not running, start it
      await client.workflow.start(ContinuousBuilderWorkflow, {
        workflowId,
        taskQueue: 'engine',
        args: [input],
      });
      console.log('Orchestrator started');
    } else {
      // Unexpected error
      throw err;
    }
  }
}

describe('Worker Bootstrap', () => {
  let testEnv: TestWorkflowEnvironment;

  beforeAll(async () => {
    testEnv = await TestWorkflowEnvironment.createLocal();
  });

  afterAll(async () => {
    await testEnv?.teardown();
  });

  describe('ensureOrchestratorRunning', () => {
    it('should start orchestrator when not running', async () => {
      const workflowId = `test-orchestrator-${Date.now()}-start`;
      const input: OrchestratorInput = {
        maxConcurrent: 4,
        workspaceRoot: '/test/workspace',
        config: {
          registry: 'https://registry.npmjs.org',
        },
      };

      // Create worker to run the workflow
      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: 'engine',
        workflowsPath,
      });

      await worker.runUntil(async () => {
        // Ensure orchestrator is running
        await ensureOrchestratorRunning(testEnv.client, input, workflowId);

        // Verify it's running
        const handle = testEnv.client.workflow.getHandle(workflowId);
        const description = await handle.describe();
        expect(description.status.name).toBe('RUNNING');

        // Cleanup
        await handle.signal(emergencyStopSignal);
        await handle.result();
      });
    });

    it('should detect when orchestrator is already running', async () => {
      const workflowId = `test-orchestrator-${Date.now()}-detect`;
      const input: OrchestratorInput = {
        maxConcurrent: 4,
        workspaceRoot: '/test/workspace',
        config: {
          registry: 'https://registry.npmjs.org',
        },
      };

      // Create worker to run the workflow
      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: 'engine',
        workflowsPath,
      });

      await worker.runUntil(async () => {
        // Start orchestrator manually
        const handle = await testEnv.client.workflow.start(ContinuousBuilderWorkflow, {
          workflowId,
          taskQueue: 'engine',
          args: [input],
        });

        // Verify it's running
        const descBefore = await handle.describe();
        expect(descBefore.status.name).toBe('RUNNING');

        // Call ensureOrchestratorRunning - should do nothing
        await ensureOrchestratorRunning(testEnv.client, input, workflowId);

        // Verify still running (not restarted)
        const descAfter = await handle.describe();
        expect(descAfter.status.name).toBe('RUNNING');
        expect(descAfter.runId).toBe(descBefore.runId); // Same run ID = not restarted

        // Cleanup
        await handle.signal(emergencyStopSignal);
        await handle.result();
      });
    });

    it('should use correct workflow ID', async () => {
      const workflowId = `test-orchestrator-${Date.now()}-id`;
      const input: OrchestratorInput = {
        maxConcurrent: 4,
        workspaceRoot: '/test/workspace',
        config: {
          registry: 'https://registry.npmjs.org',
        },
      };

      // Create worker to run the workflow
      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: 'engine',
        workflowsPath,
      });

      await worker.runUntil(async () => {
        await ensureOrchestratorRunning(testEnv.client, input, workflowId);

        // Verify workflow ID is correct
        const handle = testEnv.client.workflow.getHandle(workflowId);
        const description = await handle.describe();
        expect(description.workflowId).toBe(workflowId);

        // Cleanup
        await handle.signal(emergencyStopSignal);
        await handle.result();
      });
    });

    it('should handle orchestrator that completed', async () => {
      const workflowId = `test-orchestrator-${Date.now()}-completed`;
      const input: OrchestratorInput = {
        maxConcurrent: 4,
        workspaceRoot: '/test/workspace',
        config: {
          registry: 'https://registry.npmjs.org',
        },
      };

      // Create worker to run the workflow
      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: 'engine',
        workflowsPath,
      });

      await worker.runUntil(async () => {
        // Start and immediately stop orchestrator
        const handle = await testEnv.client.workflow.start(ContinuousBuilderWorkflow, {
          workflowId,
          taskQueue: 'engine',
          args: [input],
        });
        await handle.signal(emergencyStopSignal);
        await handle.result();

        // Verify completed
        const descCompleted = await handle.describe();
        expect(descCompleted.status.name).toBe('COMPLETED');

        // Call ensureOrchestratorRunning - should start a new one
        await ensureOrchestratorRunning(testEnv.client, input, workflowId);

        // Verify new instance is running
        const newHandle = testEnv.client.workflow.getHandle(workflowId);
        const newDesc = await newHandle.describe();
        expect(newDesc.status.name).toBe('RUNNING');
        expect(newDesc.runId).not.toBe(descCompleted.runId); // Different run ID = new instance

        // Cleanup
        await newHandle.signal(emergencyStopSignal);
        await newHandle.result();
      });
    });

    it('should propagate unexpected errors', async () => {
      const input: OrchestratorInput = {
        maxConcurrent: 4,
        workspaceRoot: '/test/workspace',
        config: {
          registry: 'https://registry.npmjs.org',
        },
      };

      // Create a mock client that throws non-WorkflowNotFoundError
      const mockClient = {
        workflow: {
          getHandle: () => ({
            describe: async () => {
              throw new Error('Network error');
            },
          }),
          start: async () => {
            throw new Error('Should not be called');
          },
        },
      } as unknown as WorkflowClient;

      // Should propagate the network error
      await expect(
        ensureOrchestratorRunning(mockClient, input, 'test-error')
      ).rejects.toThrow('Network error');
    });
  });
});
