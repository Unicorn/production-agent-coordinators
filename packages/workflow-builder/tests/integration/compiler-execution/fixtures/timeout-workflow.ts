/**
 * Timeout workflow fixture
 * Workflow with timeout configuration for testing timeout handling
 */

import type { WorkflowDefinition } from '@/lib/compiler/types';

export const timeoutWorkflow: WorkflowDefinition = {
  id: 'test-timeout-workflow',
  name: 'TestTimeoutWorkflow',
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
      id: 'activity-slow',
      type: 'activity',
      position: { x: 200, y: 0 },
      data: {
        label: 'Slow Activity',
        componentName: 'slowActivity',
        activityName: 'slowActivity',
        timeout: '2s', // Short timeout for testing
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
      target: 'activity-slow',
    },
    {
      id: 'e2',
      source: 'activity-slow',
      target: 'end-node',
    },
  ],
  variables: [],
  settings: {
    timeout: '30s',
    taskQueue: 'test-queue',
    description: 'Test workflow with timeout configuration',
    version: '1.0.0',
  },
};
