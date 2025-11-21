/**
 * Multi-activity workflow fixture
 * Workflow with 5 sequential activities for testing linear execution
 */

import type { WorkflowDefinition } from '@/lib/compiler/types';

export const multiActivityWorkflow: WorkflowDefinition = {
  id: 'test-multi-activity-workflow',
  name: 'TestMultiActivityWorkflow',
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
      id: 'activity-1',
      type: 'activity',
      position: { x: 100, y: 0 },
      data: {
        label: 'Step 1',
        componentName: 'stepOne',
        activityName: 'stepOne',
        timeout: '30s',
      },
    },
    {
      id: 'activity-2',
      type: 'activity',
      position: { x: 200, y: 0 },
      data: {
        label: 'Step 2',
        componentName: 'stepTwo',
        activityName: 'stepTwo',
        timeout: '30s',
      },
    },
    {
      id: 'activity-3',
      type: 'activity',
      position: { x: 300, y: 0 },
      data: {
        label: 'Step 3',
        componentName: 'stepThree',
        activityName: 'stepThree',
        timeout: '30s',
      },
    },
    {
      id: 'activity-4',
      type: 'activity',
      position: { x: 400, y: 0 },
      data: {
        label: 'Step 4',
        componentName: 'stepFour',
        activityName: 'stepFour',
        timeout: '30s',
      },
    },
    {
      id: 'activity-5',
      type: 'activity',
      position: { x: 500, y: 0 },
      data: {
        label: 'Step 5',
        componentName: 'stepFive',
        activityName: 'stepFive',
        timeout: '30s',
      },
    },
    {
      id: 'end-node',
      type: 'end',
      position: { x: 600, y: 0 },
      data: {
        label: 'End',
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'trigger-start', target: 'activity-1' },
    { id: 'e2', source: 'activity-1', target: 'activity-2' },
    { id: 'e3', source: 'activity-2', target: 'activity-3' },
    { id: 'e4', source: 'activity-3', target: 'activity-4' },
    { id: 'e5', source: 'activity-4', target: 'activity-5' },
    { id: 'e6', source: 'activity-5', target: 'end-node' },
  ],
  variables: [],
  settings: {
    timeout: '180s',
    taskQueue: 'test-queue',
    description: 'Test workflow with 5 sequential activities',
    version: '1.0.0',
  },
};
