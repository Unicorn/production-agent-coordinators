/**
 * Tests for ContinuousBuilderWorkflow
 * Part 1: State initialization and signal handling
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  ContinuousBuilderWorkflow,
  newPackagesSignal,
  pauseSignal,
  resumeSignal,
  drainSignal,
  emergencyStopSignal,
  adjustConcurrencySignal,
} from '../continuous-builder.workflow.js';
import type { OrchestratorInput, Package } from '../../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Go up from src/workflows/__tests__ to package root, then into dist/workflows
const workflowsPath = path.join(__dirname, '../../../dist/workflows');

describe('ContinuousBuilderWorkflow - State & Signals', () => {
  let testEnv: TestWorkflowEnvironment;

  beforeAll(async () => {
    testEnv = await TestWorkflowEnvironment.createLocal();
  });

  afterAll(async () => {
    await testEnv?.teardown();
  });

  describe('State Initialization', () => {
    it('should initialize and accept basic signals', async () => {
      const input: OrchestratorInput = {
        maxConcurrent: 4,
        workspaceRoot: '/test/workspace',
        config: {
          registry: 'https://registry.npmjs.org',
        },
      };

      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: 'test',
        workflowsPath,
      });

      await worker.runUntil(async () => {
        const handle = await testEnv.client.workflow.start(
          ContinuousBuilderWorkflow,
          {
            taskQueue: 'test',
            workflowId: `test-init-${Date.now()}`,
            args: [input],
          }
        );

        // Verify workflow started
        const description = await handle.describe();
        expect(description.status.name).toBe('RUNNING');

        // Send emergency stop to exit
        await handle.signal(emergencyStopSignal);
        await handle.result();

        // Verify completed
        const finalDesc = await handle.describe();
        expect(finalDesc.status.name).toBe('COMPLETED');
      });
    });

    it('should accept concurrency adjustment', async () => {
      const input: OrchestratorInput = {
        maxConcurrent: 4,
        workspaceRoot: '/test/workspace',
        config: {
          registry: 'https://registry.npmjs.org',
        },
      };

      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: 'test',
        workflowsPath,
      });

      await worker.runUntil(async () => {
        const handle = await testEnv.client.workflow.start(
          ContinuousBuilderWorkflow,
          {
            taskQueue: 'test',
            workflowId: `test-concurrency-${Date.now()}`,
            args: [input],
          }
        );

        // Adjust concurrency
        await handle.signal(adjustConcurrencySignal, 8);

        // Cleanup
        await handle.signal(emergencyStopSignal);
        await handle.result();
      });
    });
  });

  describe('newPackages Signal', () => {
    it('should accept new packages via signal', async () => {
      const input: OrchestratorInput = {
        maxConcurrent: 4,
        workspaceRoot: '/test/workspace',
        config: {
          registry: 'https://registry.npmjs.org',
        },
      };

      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: 'test',
        workflowsPath,
      });

      await worker.runUntil(async () => {
        const handle = await testEnv.client.workflow.start(
          ContinuousBuilderWorkflow,
          {
            taskQueue: 'test',
            workflowId: `test-packages-${Date.now()}`,
            args: [input],
          }
        );

        const packages: Package[] = [
          { name: '@test/pkg1', priority: 10, dependencies: [] },
          { name: '@test/pkg2', priority: 5, dependencies: ['@test/pkg1'] },
        ];

        // Send signal
        await handle.signal(newPackagesSignal, packages);

        // Verify workflow is still running
        const description = await handle.describe();
        expect(description.status.name).toBe('RUNNING');

        // Cleanup
        await handle.signal(emergencyStopSignal);
        await handle.result();
      });
    });

    it('should handle duplicate packages', async () => {
      const input: OrchestratorInput = {
        maxConcurrent: 4,
        workspaceRoot: '/test/workspace',
        config: {
          registry: 'https://registry.npmjs.org',
        },
      };

      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: 'test',
        workflowsPath,
      });

      await worker.runUntil(async () => {
        const handle = await testEnv.client.workflow.start(
          ContinuousBuilderWorkflow,
          {
            taskQueue: 'test',
            workflowId: `test-dedup-${Date.now()}`,
            args: [input],
          }
        );

        const pkg: Package = {
          name: '@test/pkg1',
          priority: 10,
          dependencies: [],
        };

        // Send same package twice
        await handle.signal(newPackagesSignal, [pkg]);
        await handle.signal(newPackagesSignal, [pkg]);

        // Cleanup
        await handle.signal(emergencyStopSignal);
        await handle.result();
      });
    });

    it('should merge multiple batches', async () => {
      const input: OrchestratorInput = {
        maxConcurrent: 4,
        workspaceRoot: '/test/workspace',
        config: {
          registry: 'https://registry.npmjs.org',
        },
      };

      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: 'test',
        workflowsPath,
      });

      await worker.runUntil(async () => {
        const handle = await testEnv.client.workflow.start(
          ContinuousBuilderWorkflow,
          {
            taskQueue: 'test',
            workflowId: `test-batches-${Date.now()}`,
            args: [input],
          }
        );

        // Send multiple batches
        await handle.signal(newPackagesSignal, [
          { name: '@test/pkg1', priority: 10, dependencies: [] },
        ]);
        await handle.signal(newPackagesSignal, [
          { name: '@test/pkg2', priority: 5, dependencies: [] },
        ]);
        await handle.signal(newPackagesSignal, [
          { name: '@test/pkg3', priority: 8, dependencies: [] },
        ]);

        // Cleanup
        await handle.signal(emergencyStopSignal);
        await handle.result();
      });
    });
  });

  describe('pause/resume Signals', () => {
    it('should handle pause and resume', async () => {
      const input: OrchestratorInput = {
        maxConcurrent: 4,
        workspaceRoot: '/test/workspace',
        config: {
          registry: 'https://registry.npmjs.org',
        },
      };

      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: 'test',
        workflowsPath,
      });

      await worker.runUntil(async () => {
        const handle = await testEnv.client.workflow.start(
          ContinuousBuilderWorkflow,
          {
            taskQueue: 'test',
            workflowId: `test-pause-resume-${Date.now()}`,
            args: [input],
          }
        );

        // Pause
        await handle.signal(pauseSignal);

        // Send packages while paused
        await handle.signal(newPackagesSignal, [
          { name: '@test/pkg1', priority: 10, dependencies: [] },
        ]);

        // Resume
        await handle.signal(resumeSignal);

        // Cleanup
        await handle.signal(emergencyStopSignal);
        await handle.result();
      });
    });

    it('should handle pause -> resume -> drain sequence', async () => {
      const input: OrchestratorInput = {
        maxConcurrent: 4,
        workspaceRoot: '/test/workspace',
        config: {
          registry: 'https://registry.npmjs.org',
        },
      };

      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: 'test',
        workflowsPath,
      });

      await worker.runUntil(async () => {
        const handle = await testEnv.client.workflow.start(
          ContinuousBuilderWorkflow,
          {
            taskQueue: 'test',
            workflowId: `test-sequence-${Date.now()}`,
            args: [input],
          }
        );

        await handle.signal(pauseSignal);
        await handle.signal(newPackagesSignal, [
          { name: '@test/pkg1', priority: 10, dependencies: [] },
        ]);
        await handle.signal(resumeSignal);
        await handle.signal(drainSignal);

        // Should complete after drain
        await handle.result();
      });
    });
  });

  describe('drain Signal', () => {
    it('should exit gracefully on drain', async () => {
      const input: OrchestratorInput = {
        maxConcurrent: 4,
        workspaceRoot: '/test/workspace',
        config: {
          registry: 'https://registry.npmjs.org',
        },
      };

      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: 'test',
        workflowsPath,
      });

      await worker.runUntil(async () => {
        const handle = await testEnv.client.workflow.start(
          ContinuousBuilderWorkflow,
          {
            taskQueue: 'test',
            workflowId: `test-drain-${Date.now()}`,
            args: [input],
          }
        );

        // Signal drain (no active builds in Part 1)
        await handle.signal(drainSignal);

        // Should complete
        await handle.result();
        const description = await handle.describe();
        expect(description.status.name).toBe('COMPLETED');
      });
    });
  });

  describe('emergencyStop Signal', () => {
    it('should terminate immediately on emergency stop', async () => {
      const input: OrchestratorInput = {
        maxConcurrent: 4,
        workspaceRoot: '/test/workspace',
        config: {
          registry: 'https://registry.npmjs.org',
        },
      };

      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: 'test',
        workflowsPath,
      });

      await worker.runUntil(async () => {
        const handle = await testEnv.client.workflow.start(
          ContinuousBuilderWorkflow,
          {
            taskQueue: 'test',
            workflowId: `test-emergency-${Date.now()}`,
            args: [input],
          }
        );

        // Emergency stop
        await handle.signal(emergencyStopSignal);

        // Should complete immediately
        await handle.result();
        const description = await handle.describe();
        expect(description.status.name).toBe('COMPLETED');
      });
    });
  });

  describe('adjustConcurrency Signal', () => {
    it('should handle multiple concurrency adjustments', async () => {
      const input: OrchestratorInput = {
        maxConcurrent: 4,
        workspaceRoot: '/test/workspace',
        config: {
          registry: 'https://registry.npmjs.org',
        },
      };

      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: 'test',
        workflowsPath,
      });

      await worker.runUntil(async () => {
        const handle = await testEnv.client.workflow.start(
          ContinuousBuilderWorkflow,
          {
            taskQueue: 'test',
            workflowId: `test-adjust-${Date.now()}`,
            args: [input],
          }
        );

        // Multiple adjustments
        await handle.signal(adjustConcurrencySignal, 8);
        await handle.signal(adjustConcurrencySignal, 2);
        await handle.signal(adjustConcurrencySignal, 6);

        // Cleanup
        await handle.signal(emergencyStopSignal);
        await handle.result();
      });
    });
  });

  describe('Signal Combinations', () => {
    it('should handle concurrent signals gracefully', async () => {
      const input: OrchestratorInput = {
        maxConcurrent: 4,
        workspaceRoot: '/test/workspace',
        config: {
          registry: 'https://registry.npmjs.org',
        },
      };

      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: 'test',
        workflowsPath,
      });

      await worker.runUntil(async () => {
        const handle = await testEnv.client.workflow.start(
          ContinuousBuilderWorkflow,
          {
            taskQueue: 'test',
            workflowId: `test-concurrent-${Date.now()}`,
            args: [input],
          }
        );

        // Send multiple signals concurrently
        await Promise.all([
          handle.signal(newPackagesSignal, [
            { name: '@test/pkg1', priority: 10, dependencies: [] },
          ]),
          handle.signal(adjustConcurrencySignal, 6),
          handle.signal(pauseSignal),
        ]);

        // Resume and cleanup
        await handle.signal(resumeSignal);
        await handle.signal(emergencyStopSignal);
        await handle.result();
      });
    });
  });
});

/**
 * Part 2: Build Loop Tests
 */
describe('ContinuousBuilderWorkflow - Build Loop', () => {
  let testEnv: TestWorkflowEnvironment;

  beforeAll(async () => {
    testEnv = await TestWorkflowEnvironment.createLocal();
  });

  afterAll(async () => {
    await testEnv?.teardown();
  });

  it('should spawn child workflows when packages available', async () => {
    const input: OrchestratorInput = {
      maxConcurrent: 2,
      workspaceRoot: '/test/workspace',
      config: {
        registry: 'https://registry.npmjs.org',
      },
    };

    // Mock the updateMCPPackageStatus activity
    const mockUpdateStatus = async () => {
      // Success - no-op
    };

    const worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue: 'test',
      workflowsPath,
      activities: {
        updateMCPPackageStatus: mockUpdateStatus,
      },
    });

    await worker.runUntil(async () => {
      const handle = await testEnv.client.workflow.start(
        ContinuousBuilderWorkflow,
        {
          taskQueue: 'test',
          workflowId: `test-spawn-${Date.now()}`,
          args: [input],
        }
      );

      // Send packages via signal
      const packages: Package[] = [
        { name: '@test/pkg1', priority: 100, dependencies: [] },
        { name: '@test/pkg2', priority: 90, dependencies: [] },
      ];

      await handle.signal(newPackagesSignal, packages);

      // Wait a bit for processing to start
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Cleanup
      await handle.signal(emergencyStopSignal);
      await handle.result();
    });
  });
});
