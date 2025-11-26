/**
 * Unit tests for UI model to WorkflowDefinition mapping
 */

import { describe, it, expect } from 'vitest';
import type { WorkflowDefinition } from '@/lib/compiler/types';

/**
 * Convert database workflow to WorkflowDefinition
 * This mirrors the convertToWorkflowDefinition function from compiler router
 */
function convertToWorkflowDefinition(data: {
  id: string;
  name: string;
  definition?: unknown;
  execution_timeout_seconds?: number | null;
  description?: string | null;
  version?: string;
}): WorkflowDefinition {
  // If definition is stored as JSON
  if (data.definition && typeof data.definition === 'object') {
    const def = data.definition as Record<string, unknown>;
    return {
      id: data.id,
      name: data.name,
      nodes: (def.nodes as WorkflowDefinition['nodes']) || [],
      edges: (def.edges as WorkflowDefinition['edges']) || [],
      variables: (def.variables as WorkflowDefinition['variables']) || [],
      settings: {
        timeout: data.execution_timeout_seconds ? `${data.execution_timeout_seconds}s` : undefined,
        description: data.description || undefined,
        version: data.version || '1.0.0',
        ...(def.settings as Record<string, unknown>),
      },
    };
  }

  // Default fallback
  return {
    id: data.id,
    name: data.name,
    nodes: [],
    edges: [],
    variables: [],
    settings: {
      description: data.description || undefined,
      version: data.version || '1.0.0',
    },
  };
}

describe('UI Model to WorkflowDefinition Mapping', () => {
  describe('Simple Workflow Mapping', () => {
    it('maps simple UI config to WorkflowDefinition', () => {
      const uiConfig = {
        id: 'wf-1',
        name: 'SimpleWorkflow',
        definition: {
          nodes: [
            {
              id: 'trigger-1',
              type: 'trigger',
              position: { x: 0, y: 0 },
              data: { label: 'Start' },
            },
            {
              id: 'activity-1',
              type: 'activity',
              position: { x: 200, y: 0 },
              data: {
                label: 'Do Something',
                componentName: 'doSomething',
              },
            },
          ],
          edges: [
            { id: 'e1', source: 'trigger-1', target: 'activity-1' },
          ],
        },
        description: 'A simple workflow',
        version: '1.0.0',
      };

      const workflow = convertToWorkflowDefinition(uiConfig);

      expect(workflow.id).toBe('wf-1');
      expect(workflow.name).toBe('SimpleWorkflow');
      expect(workflow.nodes).toHaveLength(2);
      expect(workflow.edges).toHaveLength(1);
      expect(workflow.settings.description).toBe('A simple workflow');
      expect(workflow.settings.version).toBe('1.0.0');
    });
  });

  describe('Timeout Workflow Mapping', () => {
    it('maps timeout configuration from UI to WorkflowDefinition', () => {
      const uiConfig = {
        id: 'wf-2',
        name: 'TimeoutWorkflow',
        definition: {
          nodes: [
            {
              id: 'trigger-1',
              type: 'trigger',
              position: { x: 0, y: 0 },
              data: { label: 'Start' },
            },
            {
              id: 'activity-1',
              type: 'activity',
              position: { x: 200, y: 0 },
              data: {
                label: 'Slow Activity',
                componentName: 'slowActivity',
                timeout: '5s',
              },
            },
          ],
          edges: [
            { id: 'e1', source: 'trigger-1', target: 'activity-1' },
          ],
        },
        execution_timeout_seconds: 60,
        description: 'Workflow with timeout',
      };

      const workflow = convertToWorkflowDefinition(uiConfig);

      expect(workflow.settings.timeout).toBe('60s');
      expect(workflow.nodes[1].data.timeout).toBe('5s');
    });
  });

  describe('Retry Workflow Mapping', () => {
    it('maps retry policy configuration from UI to WorkflowDefinition', () => {
      const uiConfig = {
        id: 'wf-3',
        name: 'RetryWorkflow',
        definition: {
          nodes: [
            {
              id: 'trigger-1',
              type: 'trigger',
              position: { x: 0, y: 0 },
              data: { label: 'Start' },
            },
            {
              id: 'activity-1',
              type: 'activity',
              position: { x: 200, y: 0 },
              data: {
                label: 'Flaky Activity',
                componentName: 'flakyActivity',
                retryPolicy: {
                  strategy: 'exponential-backoff',
                  maxAttempts: 3,
                  initialInterval: '1s',
                  maxInterval: '5s',
                  backoffCoefficient: 2,
                },
              },
            },
          ],
          edges: [
            { id: 'e1', source: 'trigger-1', target: 'activity-1' },
          ],
        },
        description: 'Workflow with retry',
      };

      const workflow = convertToWorkflowDefinition(uiConfig);

      expect(workflow.nodes[1].data.retryPolicy).toBeDefined();
      expect(workflow.nodes[1].data.retryPolicy?.strategy).toBe('exponential-backoff');
      expect(workflow.nodes[1].data.retryPolicy?.maxAttempts).toBe(3);
    });
  });

  describe('Default Values', () => {
    it('applies default version when not provided', () => {
      const uiConfig = {
        id: 'wf-4',
        name: 'DefaultWorkflow',
        definition: {
          nodes: [],
          edges: [],
        },
      };

      const workflow = convertToWorkflowDefinition(uiConfig);

      expect(workflow.settings.version).toBe('1.0.0');
    });

    it('handles missing definition gracefully', () => {
      const uiConfig = {
        id: 'wf-5',
        name: 'EmptyWorkflow',
      };

      const workflow = convertToWorkflowDefinition(uiConfig);

      expect(workflow.nodes).toEqual([]);
      expect(workflow.edges).toEqual([]);
      expect(workflow.variables).toEqual([]);
    });

    it('handles null execution_timeout_seconds', () => {
      const uiConfig = {
        id: 'wf-6',
        name: 'NoTimeoutWorkflow',
        definition: {
          nodes: [],
          edges: [],
        },
        execution_timeout_seconds: null,
      };

      const workflow = convertToWorkflowDefinition(uiConfig);

      expect(workflow.settings.timeout).toBeUndefined();
    });
  });

  describe('Settings Merging', () => {
    it('merges settings from definition with database fields', () => {
      const uiConfig = {
        id: 'wf-7',
        name: 'MergedWorkflow',
        definition: {
          nodes: [],
          edges: [],
          settings: {
            taskQueue: 'custom-queue',
            description: 'From definition',
          },
        },
        description: 'From database',
        version: '2.0.0',
      };

      const workflow = convertToWorkflowDefinition(uiConfig);

      // Database description should be overridden by definition settings if present
      // But version from database should be used
      expect(workflow.settings.taskQueue).toBe('custom-queue');
      expect(workflow.settings.version).toBe('2.0.0');
    });
  });
});

