/**
 * Tests for node-based workflow compiler
 */

import { describe, it, expect } from 'vitest';
import { compileWorkflowFromNodes } from '@/lib/workflow-compiler/node-compiler';
import type { WorkflowDefinition } from '@/types/workflow';

describe('Node Compiler', () => {
  describe('Condition Nodes', () => {
    it('generates if/else branching code', () => {
      const definition: WorkflowDefinition = {
        nodes: [
          {
            id: 'start',
            type: 'trigger',
            position: { x: 0, y: 0 },
            data: { label: 'Start' },
          },
          {
            id: 'check',
            type: 'activity',
            position: { x: 100, y: 0 },
            data: {
              label: 'Check',
              componentName: 'checkValue',
            },
          },
          {
            id: 'condition',
            type: 'condition',
            position: { x: 200, y: 0 },
            data: {
              label: 'Is Valid?',
              config: {
                expression: 'result.success === true',
              },
            },
          },
          {
            id: 'success',
            type: 'activity',
            position: { x: 300, y: -50 },
            data: {
              label: 'Success Path',
              componentName: 'handleSuccess',
            },
          },
          {
            id: 'failure',
            type: 'activity',
            position: { x: 300, y: 50 },
            data: {
              label: 'Failure Path',
              componentName: 'handleFailure',
            },
          },
          {
            id: 'end',
            type: 'trigger',
            position: { x: 400, y: 0 },
            data: { label: 'End' },
          },
        ],
        edges: [
          { id: 'e1', source: 'start', target: 'check' },
          { id: 'e2', source: 'check', target: 'condition' },
          { id: 'e3', source: 'condition', target: 'success', sourceHandle: 'true' },
          { id: 'e4', source: 'condition', target: 'failure', sourceHandle: 'false' },
          { id: 'e5', source: 'success', target: 'end' },
          { id: 'e6', source: 'failure', target: 'end' },
        ],
      };

      const code = compileWorkflowFromNodes(definition);
      
      expect(code).toContain('result.success === true');
      expect(code).toContain('checkValue');
      expect(code).toContain('handleSuccess');
      expect(code).toContain('handleFailure');
    });
  });

  describe('Retry Nodes', () => {
    it('generates retry loop with exponential backoff', () => {
      const definition: WorkflowDefinition = {
        nodes: [
          {
            id: 'start',
            type: 'trigger',
            position: { x: 0, y: 0 },
            data: { label: 'Start' },
          },
          {
            id: 'retry',
            type: 'retry',
            position: { x: 100, y: 0 },
            data: {
              label: 'Retry Build',
              config: {
                maxAttempts: 3,
                retryOn: 'failure',
                backoff: {
                  type: 'exponential',
                  initialInterval: '1s',
                  multiplier: 2,
                },
                scope: 'block',
              },
            },
          },
          {
            id: 'activity',
            type: 'activity',
            position: { x: 200, y: 0 },
            data: {
              label: 'Build',
              componentName: 'runBuild',
            },
          },
          {
            id: 'end',
            type: 'trigger',
            position: { x: 300, y: 0 },
            data: { label: 'End' },
          },
        ],
        edges: [
          { id: 'e1', source: 'start', target: 'retry' },
          { id: 'e2', source: 'retry', target: 'activity' },
          { id: 'e3', source: 'activity', target: 'end' },
        ],
      };

      const code = compileWorkflowFromNodes(definition);
      
      expect(code).toContain('maxAttempts');
      expect(code).toContain('while');
      expect(code.toLowerCase()).toContain('exponential');
      expect(code).toContain('sleep');
    });
  });

  describe('State Variable Nodes', () => {
    it('generates state variable declarations', () => {
      const definition: WorkflowDefinition = {
        nodes: [
          {
            id: 'start',
            type: 'trigger',
            position: { x: 0, y: 0 },
            data: { label: 'Start' },
          },
          {
            id: 'init-counter',
            type: 'state-variable',
            position: { x: 100, y: 0 },
            data: {
              label: 'Initialize Counter',
              config: {
                name: 'counter',
                operation: 'set',
                value: 0,
                scope: 'workflow',
                initialValue: 0,
              },
            },
          },
          {
            id: 'increment',
            type: 'state-variable',
            position: { x: 200, y: 0 },
            data: {
              label: 'Increment',
              config: {
                name: 'counter',
                operation: 'increment',
                scope: 'workflow',
              },
            },
          },
          {
            id: 'end',
            type: 'trigger',
            position: { x: 300, y: 0 },
            data: { label: 'End' },
          },
        ],
        edges: [
          { id: 'e1', source: 'start', target: 'init-counter' },
          { id: 'e2', source: 'init-counter', target: 'increment' },
          { id: 'e3', source: 'increment', target: 'end' },
        ],
      };

      const code = compileWorkflowFromNodes(definition);
      
      expect(code).toContain('let counter');
      expect(code).toContain('counter++');
    });
  });

  describe('Phase Nodes', () => {
    it('generates phase organization code', () => {
      const definition: WorkflowDefinition = {
        nodes: [
          {
            id: 'start',
            type: 'trigger',
            position: { x: 0, y: 0 },
            data: { label: 'Start' },
          },
          {
            id: 'phase-init',
            type: 'phase',
            position: { x: 100, y: 0 },
            data: {
              label: 'INITIALIZE',
              config: {
                name: 'INITIALIZE',
                description: 'Initialize phase',
                sequential: true,
              },
            },
          },
          {
            id: 'activity',
            type: 'activity',
            position: { x: 200, y: 0 },
            data: {
              label: 'Init Activity',
              componentName: 'initialize',
            },
          },
          {
            id: 'end',
            type: 'trigger',
            position: { x: 300, y: 0 },
            data: { label: 'End' },
          },
        ],
        edges: [
          { id: 'e1', source: 'start', target: 'phase-init' },
          { id: 'e2', source: 'phase-init', target: 'activity' },
          { id: 'e3', source: 'activity', target: 'end' },
        ],
      };

      const code = compileWorkflowFromNodes(definition);
      
      expect(code).toContain('INITIALIZE');
      expect(code).toContain('Phase:');
    });
  });

  describe('Child Workflow Nodes', () => {
    it('generates startChild code', () => {
      const definition: WorkflowDefinition = {
        nodes: [
          {
            id: 'start',
            type: 'trigger',
            position: { x: 0, y: 0 },
            data: { label: 'Start' },
          },
          {
            id: 'child',
            type: 'child-workflow',
            position: { x: 100, y: 0 },
            data: {
              label: 'Child Workflow',
              componentName: 'ChildWorkflow',
              config: {
                workflowType: 'ChildWorkflow',
                taskQueue: 'default',
              },
            },
          },
          {
            id: 'end',
            type: 'trigger',
            position: { x: 200, y: 0 },
            data: { label: 'End' },
          },
        ],
        edges: [
          { id: 'e1', source: 'start', target: 'child' },
          { id: 'e2', source: 'child', target: 'end' },
        ],
      };

      const code = compileWorkflowFromNodes(definition);
      
      expect(code).toContain('startChild');
      expect(code).toContain('ChildWorkflowWorkflow');
      expect(code).toContain('taskQueue');
    });

    it('generates executeChild code when specified', () => {
      const definition: WorkflowDefinition = {
        nodes: [
          {
            id: 'start',
            type: 'trigger',
            position: { x: 0, y: 0 },
            data: { label: 'Start' },
          },
          {
            id: 'coordinator',
            type: 'child-workflow',
            position: { x: 100, y: 0 },
            data: {
              label: 'Coordinator',
              componentName: 'CoordinatorWorkflow',
              config: {
                workflowType: 'CoordinatorWorkflow',
                taskQueue: 'engine',
                executionType: 'executeChild',
              },
            },
          },
          {
            id: 'end',
            type: 'trigger',
            position: { x: 200, y: 0 },
            data: { label: 'End' },
          },
        ],
        edges: [
          { id: 'e1', source: 'start', target: 'coordinator' },
          { id: 'e2', source: 'coordinator', target: 'end' },
        ],
      };

      const code = compileWorkflowFromNodes(definition);
      
      expect(code).toContain('executeChild');
      expect(code).toContain('CoordinatorWorkflowWorkflow');
      expect(code).toContain('engine');
    });
  });

  describe('Complex Workflows', () => {
    it('compiles workflow with all node types', () => {
      const definition: WorkflowDefinition = {
        nodes: [
          {
            id: 'start',
            type: 'trigger',
            position: { x: 0, y: 0 },
            data: { label: 'Start' },
          },
          {
            id: 'init-state',
            type: 'state-variable',
            position: { x: 100, y: 0 },
            data: {
              label: 'Init State',
              config: {
                name: 'state',
                operation: 'set',
                value: { count: 0 },
                scope: 'workflow',
              },
            },
          },
          {
            id: 'phase-1',
            type: 'phase',
            position: { x: 200, y: 0 },
            data: {
              label: 'Phase 1',
              config: {
                name: 'Phase 1',
                sequential: true,
              },
            },
          },
          {
            id: 'activity-1',
            type: 'activity',
            position: { x: 300, y: 0 },
            data: {
              label: 'Activity 1',
              componentName: 'activity1',
            },
          },
          {
            id: 'condition',
            type: 'condition',
            position: { x: 400, y: 0 },
            data: {
              label: 'Check',
              config: {
                expression: 'result.success',
              },
            },
          },
          {
            id: 'retry',
            type: 'retry',
            position: { x: 500, y: 0 },
            data: {
              label: 'Retry',
              config: {
                maxAttempts: 3,
                retryOn: 'failure',
              },
            },
          },
          {
            id: 'activity-2',
            type: 'activity',
            position: { x: 600, y: 0 },
            data: {
              label: 'Activity 2',
              componentName: 'activity2',
            },
          },
          {
            id: 'end',
            type: 'trigger',
            position: { x: 700, y: 0 },
            data: { label: 'End' },
          },
        ],
        edges: [
          { id: 'e1', source: 'start', target: 'init-state' },
          { id: 'e2', source: 'init-state', target: 'phase-1' },
          { id: 'e3', source: 'phase-1', target: 'activity-1' },
          { id: 'e4', source: 'activity-1', target: 'condition' },
          { id: 'e5', source: 'condition', target: 'retry', sourceHandle: 'true' },
          { id: 'e6', source: 'retry', target: 'activity-2' },
          { id: 'e7', source: 'activity-2', target: 'end' },
        ],
      };

      const code = compileWorkflowFromNodes(definition);
      
      // Check all node types are represented
      expect(code).toContain('let state');
      expect(code).toContain('Phase 1');
      expect(code).toContain('activity1');
      expect(code).toContain('result.success');
      expect(code).toContain('maxAttempts');
      expect(code).toContain('activity2');
    });
  });
});

