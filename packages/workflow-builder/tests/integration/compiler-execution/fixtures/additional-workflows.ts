/**
 * Additional workflow fixtures for Phase 2 testing
 */

import type { WorkflowDefinition } from '@/lib/compiler/types';

/**
 * Workflow with timeout and retry combined
 */
export const timeoutRetryWorkflow: WorkflowDefinition = {
  id: 'test-timeout-retry-workflow',
  name: 'TestTimeoutRetryWorkflow',
  nodes: [
    {
      id: 'trigger-start',
      type: 'trigger',
      position: { x: 0, y: 0 },
      data: {
        label: 'Start',
        config: { type: 'manual' },
      },
    },
    {
      id: 'activity-slow-flaky',
      type: 'activity',
      position: { x: 200, y: 0 },
      data: {
        label: 'Slow Flaky Activity',
        componentName: 'slowActivity',
        activityName: 'slowActivity',
        timeout: '2s',
        retryPolicy: {
          strategy: 'exponential-backoff',
          maxAttempts: 3,
          initialInterval: '1s',
          maxInterval: '5s',
          backoffCoefficient: 2,
        },
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
    { id: 'e1', source: 'trigger-start', target: 'activity-slow-flaky' },
    { id: 'e2', source: 'activity-slow-flaky', target: 'end-node' },
  ],
  variables: [],
  settings: {
    timeout: '60s',
    taskQueue: 'test-queue',
    description: 'Workflow with timeout and retry',
    version: '1.0.0',
  },
};

/**
 * Workflow that always times out
 */
export const alwaysTimeoutWorkflow: WorkflowDefinition = {
  id: 'test-always-timeout-workflow',
  name: 'TestAlwaysTimeoutWorkflow',
  nodes: [
    {
      id: 'trigger-start',
      type: 'trigger',
      position: { x: 0, y: 0 },
      data: {
        label: 'Start',
        config: { type: 'manual' },
      },
    },
    {
      id: 'activity-very-slow',
      type: 'activity',
      position: { x: 200, y: 0 },
      data: {
        label: 'Very Slow Activity',
        componentName: 'slowActivity',
        activityName: 'slowActivity',
        timeout: '1s', // Very short timeout
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
    { id: 'e1', source: 'trigger-start', target: 'activity-very-slow' },
    { id: 'e2', source: 'activity-very-slow', target: 'end-node' },
  ],
  variables: [],
  settings: {
    timeout: '30s',
    taskQueue: 'test-queue',
    description: 'Workflow that always times out',
    version: '1.0.0',
  },
};

/**
 * Workflow with multiple activities having different timeouts
 */
export const multiTimeoutWorkflow: WorkflowDefinition = {
  id: 'test-multi-timeout-workflow',
  name: 'TestMultiTimeoutWorkflow',
  nodes: [
    {
      id: 'trigger-start',
      type: 'trigger',
      position: { x: 0, y: 0 },
      data: {
        label: 'Start',
        config: { type: 'manual' },
      },
    },
    {
      id: 'activity-fast',
      type: 'activity',
      position: { x: 200, y: 0 },
      data: {
        label: 'Fast Activity',
        componentName: 'sayHello',
        activityName: 'sayHello',
        timeout: '30s', // Long timeout
      },
    },
    {
      id: 'activity-medium',
      type: 'activity',
      position: { x: 400, y: 0 },
      data: {
        label: 'Medium Activity',
        componentName: 'stepOne',
        activityName: 'stepOne',
        timeout: '10s',
      },
    },
    {
      id: 'activity-slow',
      type: 'activity',
      position: { x: 600, y: 0 },
      data: {
        label: 'Slow Activity',
        componentName: 'slowActivity',
        activityName: 'slowActivity',
        timeout: '2s', // Short timeout
      },
    },
    {
      id: 'end-node',
      type: 'end',
      position: { x: 800, y: 0 },
      data: { label: 'End' },
    },
  ],
  edges: [
    { id: 'e1', source: 'trigger-start', target: 'activity-fast' },
    { id: 'e2', source: 'activity-fast', target: 'activity-medium' },
    { id: 'e3', source: 'activity-medium', target: 'activity-slow' },
    { id: 'e4', source: 'activity-slow', target: 'end-node' },
  ],
  variables: [],
  settings: {
    timeout: '120s',
    taskQueue: 'test-queue',
    description: 'Workflow with multiple timeout configurations',
    version: '1.0.0',
  },
};

/**
 * Workflow with no retry policy (none strategy)
 */
export const noRetryWorkflow: WorkflowDefinition = {
  id: 'test-no-retry-workflow',
  name: 'TestNoRetryWorkflow',
  nodes: [
    {
      id: 'trigger-start',
      type: 'trigger',
      position: { x: 0, y: 0 },
      data: {
        label: 'Start',
        config: { type: 'manual' },
      },
    },
    {
      id: 'activity-flaky',
      type: 'activity',
      position: { x: 200, y: 0 },
      data: {
        label: 'Flaky Activity',
        componentName: 'flakyActivity',
        activityName: 'flakyActivity',
        timeout: '10s',
        retryPolicy: {
          strategy: 'none',
        },
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
    { id: 'e1', source: 'trigger-start', target: 'activity-flaky' },
    { id: 'e2', source: 'activity-flaky', target: 'end-node' },
  ],
  variables: [],
  settings: {
    timeout: '30s',
    taskQueue: 'test-queue',
    description: 'Workflow with no retry policy',
    version: '1.0.0',
  },
};

/**
 * Workflow with keep-trying retry strategy
 */
export const keepTryingWorkflow: WorkflowDefinition = {
  id: 'test-keep-trying-workflow',
  name: 'TestKeepTryingWorkflow',
  nodes: [
    {
      id: 'trigger-start',
      type: 'trigger',
      position: { x: 0, y: 0 },
      data: {
        label: 'Start',
        config: { type: 'manual' },
      },
    },
    {
      id: 'activity-flaky',
      type: 'activity',
      position: { x: 200, y: 0 },
      data: {
        label: 'Flaky Activity',
        componentName: 'flakyActivity',
        activityName: 'flakyActivity',
        timeout: '10s',
        retryPolicy: {
          strategy: 'keep-trying',
          initialInterval: '1s',
          maxInterval: '10s',
          backoffCoefficient: 2,
        },
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
    { id: 'e1', source: 'trigger-start', target: 'activity-flaky' },
    { id: 'e2', source: 'activity-flaky', target: 'end-node' },
  ],
  variables: [],
  settings: {
    timeout: '60s',
    taskQueue: 'test-queue',
    description: 'Workflow with keep-trying retry strategy',
    version: '1.0.0',
  },
};

/**
 * Workflow with maxInterval retry configuration
 */
export const maxIntervalWorkflow: WorkflowDefinition = {
  id: 'test-max-interval-workflow',
  name: 'TestMaxIntervalWorkflow',
  nodes: [
    {
      id: 'trigger-start',
      type: 'trigger',
      position: { x: 0, y: 0 },
      data: {
        label: 'Start',
        config: { type: 'manual' },
      },
    },
    {
      id: 'activity-flaky',
      type: 'activity',
      position: { x: 200, y: 0 },
      data: {
        label: 'Flaky Activity',
        componentName: 'flakyActivity',
        activityName: 'flakyActivity',
        timeout: '10s',
        retryPolicy: {
          strategy: 'exponential-backoff',
          maxAttempts: 5,
          initialInterval: '1s',
          maxInterval: '3s', // Explicit maxInterval
          backoffCoefficient: 2,
        },
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
    { id: 'e1', source: 'trigger-start', target: 'activity-flaky' },
    { id: 'e2', source: 'activity-flaky', target: 'end-node' },
  ],
  variables: [],
  settings: {
    timeout: '120s',
    taskQueue: 'test-queue',
    description: 'Workflow with maxInterval retry configuration',
    version: '1.0.0',
  },
};

/**
 * Workflow for cancellation testing
 */
export const cancelWorkflow: WorkflowDefinition = {
  id: 'test-cancel-workflow',
  name: 'TestCancelWorkflow',
  nodes: [
    {
      id: 'trigger-start',
      type: 'trigger',
      position: { x: 0, y: 0 },
      data: {
        label: 'Start',
        config: { type: 'manual' },
      },
    },
    {
      id: 'activity-slow',
      type: 'activity',
      position: { x: 200, y: 0 },
      data: {
        label: 'Slow Activity',
        componentName: 'slowActivity',
        activityName: 'slowActivity',
        timeout: '30s', // Long timeout to allow cancellation
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
    { id: 'e1', source: 'trigger-start', target: 'activity-slow' },
    { id: 'e2', source: 'activity-slow', target: 'end-node' },
  ],
  variables: [],
  settings: {
    timeout: '60s',
    taskQueue: 'test-queue',
    description: 'Workflow for cancellation testing',
    version: '1.0.0',
  },
};

/**
 * Generate concurrent workflow fixtures (TestConcurrentWorkflow0-4)
 */
export function createConcurrentWorkflow(index: number): WorkflowDefinition {
  return {
    id: `test-concurrent-workflow-${index}`,
    name: `TestConcurrentWorkflow${index}`,
    nodes: [
      {
        id: 'trigger-start',
        type: 'trigger',
        position: { x: 0, y: 0 },
        data: {
          label: 'Start',
          config: { type: 'manual' },
        },
      },
      {
        id: 'activity-step',
        type: 'activity',
        position: { x: 200, y: 0 },
        data: {
          label: `Activity ${index}`,
          componentName: 'stepOne',
          activityName: 'stepOne',
          timeout: '10s',
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
      { id: 'e1', source: 'trigger-start', target: 'activity-step' },
      { id: 'e2', source: 'activity-step', target: 'end-node' },
    ],
    variables: [],
    settings: {
      timeout: '30s',
      taskQueue: 'test-queue-concurrent',
      description: `Concurrent workflow ${index} for testing`,
      version: '1.0.0',
    },
  };
}

export const concurrentWorkflow0 = createConcurrentWorkflow(0);
export const concurrentWorkflow1 = createConcurrentWorkflow(1);
export const concurrentWorkflow2 = createConcurrentWorkflow(2);
export const concurrentWorkflow3 = createConcurrentWorkflow(3);
export const concurrentWorkflow4 = createConcurrentWorkflow(4);

