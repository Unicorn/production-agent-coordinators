/**
 * Invalid workflow fixture
 * Workflow with validation errors for testing compiler error handling
 */

import type { WorkflowDefinition } from '@/lib/compiler/types';

// Missing trigger node - should fail validation
export const missingTriggerWorkflow: WorkflowDefinition = {
  id: 'test-invalid-no-trigger',
  name: 'TestInvalidNoTrigger',
  nodes: [
    {
      id: 'activity-orphan',
      type: 'activity',
      position: { x: 200, y: 0 },
      data: {
        label: 'Orphan Activity',
        componentName: 'orphanActivity',
        activityName: 'orphanActivity',
      },
    },
  ],
  edges: [],
  variables: [],
  settings: {
    timeout: '60s',
    taskQueue: 'test-queue',
    description: 'Invalid workflow with no trigger',
    version: '1.0.0',
  },
};

// Cyclic workflow - should fail validation
export const cyclicWorkflow: WorkflowDefinition = {
  id: 'test-invalid-cycle',
  name: 'TestInvalidCycle',
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
      id: 'activity-a',
      type: 'activity',
      position: { x: 200, y: 0 },
      data: {
        label: 'Activity A',
        componentName: 'activityA',
        activityName: 'activityA',
      },
    },
    {
      id: 'activity-b',
      type: 'activity',
      position: { x: 400, y: 0 },
      data: {
        label: 'Activity B',
        componentName: 'activityB',
        activityName: 'activityB',
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'trigger-start', target: 'activity-a' },
    { id: 'e2', source: 'activity-a', target: 'activity-b' },
    { id: 'e3', source: 'activity-b', target: 'activity-a' }, // Creates cycle
  ],
  variables: [],
  settings: {
    timeout: '60s',
    taskQueue: 'test-queue',
    description: 'Invalid workflow with cycle',
    version: '1.0.0',
  },
};

// Disconnected nodes - should fail validation
export const disconnectedWorkflow: WorkflowDefinition = {
  id: 'test-invalid-disconnected',
  name: 'TestInvalidDisconnected',
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
      id: 'activity-connected',
      type: 'activity',
      position: { x: 200, y: 0 },
      data: {
        label: 'Connected Activity',
        componentName: 'connectedActivity',
        activityName: 'connectedActivity',
      },
    },
    {
      id: 'activity-orphan',
      type: 'activity',
      position: { x: 200, y: 200 },
      data: {
        label: 'Orphan Activity',
        componentName: 'orphanActivity',
        activityName: 'orphanActivity',
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'trigger-start', target: 'activity-connected' },
    // activity-orphan has no edges
  ],
  variables: [],
  settings: {
    timeout: '60s',
    taskQueue: 'test-queue',
    description: 'Invalid workflow with disconnected nodes',
    version: '1.0.0',
  },
};
