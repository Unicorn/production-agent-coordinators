/**
 * Retry workflow fixture
 * Workflow with retry configuration for testing retry behavior
 */

import type { WorkflowDefinition } from '@/lib/compiler/types';

export const retryWorkflow: WorkflowDefinition = {
  id: 'test-retry-workflow',
  name: 'TestRetryWorkflow',
  nodes: [
    {
      id: 'trigger-start',
      type: 'trigger',
      position: { x: 0, y: 0 },
      data: {
        label: 'Start',
        config: {
          type: 'manual',
        },
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
      data: {
        label: 'End',
      },
    },
  ],
  edges: [
    {
      id: 'e1',
      source: 'trigger-start',
      target: 'activity-flaky',
    },
    {
      id: 'e2',
      source: 'activity-flaky',
      target: 'end-node',
    },
  ],
  variables: [],
  settings: {
    timeout: '120s',
    taskQueue: 'test-queue',
    description: 'Test workflow with retry configuration',
    version: '1.0.0',
  },
};
