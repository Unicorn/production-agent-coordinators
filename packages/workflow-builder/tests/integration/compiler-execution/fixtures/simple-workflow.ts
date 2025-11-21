/**
 * Simple workflow fixture
 * Single activity workflow for basic testing
 */

import type { WorkflowDefinition } from '@/lib/compiler/types';

export const simpleWorkflow: WorkflowDefinition = {
  id: 'test-simple-workflow',
  name: 'TestSimpleWorkflow',
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
      id: 'activity-hello',
      type: 'activity',
      position: { x: 200, y: 0 },
      data: {
        label: 'Say Hello',
        componentName: 'sayHello',
        activityName: 'sayHello',
        timeout: '30s',
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
      target: 'activity-hello',
    },
    {
      id: 'e2',
      source: 'activity-hello',
      target: 'end-node',
    },
  ],
  variables: [],
  settings: {
    timeout: '60s',
    taskQueue: 'test-queue',
    description: 'Simple test workflow with one activity',
    version: '1.0.0',
  },
};
