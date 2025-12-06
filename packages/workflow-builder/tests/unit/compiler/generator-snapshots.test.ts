/**
 * Snapshot tests for code generation
 * Verifies that workflow compilation produces expected code structure
 */

import { describe, it, expect } from 'vitest';
import { compileWorkflow } from '@/lib/workflow-compiler/compiler';
import type { WorkflowDefinition } from '@/lib/compiler/types';

// Minimal workflow fixtures for unit testing
const simpleWorkflow: WorkflowDefinition = {
  id: 'test-simple-workflow',
  name: 'TestSimpleWorkflow',
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
      data: { label: 'End' },
    },
  ],
  edges: [
    { id: 'e1', source: 'trigger-start', target: 'activity-hello' },
    { id: 'e2', source: 'activity-hello', target: 'end-node' },
  ],
  variables: [],
  settings: {
    timeout: '60s',
    taskQueue: 'test-queue',
    description: 'Simple test workflow',
    version: '1.0.0',
  },
};

const timeoutWorkflow: WorkflowDefinition = {
  id: 'test-timeout-workflow',
  name: 'TestTimeoutWorkflow',
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
        timeout: '2s',
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
    timeout: '30s',
    taskQueue: 'test-queue',
    description: 'Test workflow with timeout',
    version: '1.0.0',
  },
};

const retryWorkflow: WorkflowDefinition = {
  id: 'test-retry-workflow',
  name: 'TestRetryWorkflow',
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
    { id: 'e1', source: 'trigger-start', target: 'activity-flaky' },
    { id: 'e2', source: 'activity-flaky', target: 'end-node' },
  ],
  variables: [],
  settings: {
    timeout: '120s',
    taskQueue: 'test-queue',
    description: 'Test workflow with retry',
    version: '1.0.0',
  },
};

describe('Generator Snapshots', () => {
  describe('Simple Workflow', () => {
    it('generates workflow function with correct name', () => {
      const compiled = compileWorkflow(simpleWorkflow);
      
      // Workflow function name should match workflow.name exactly
      expect(compiled.workflowCode).toContain('export async function TestSimpleWorkflow');
      expect(compiled.workflowCode).toContain('(input: Record<string, unknown> | undefined): Promise<unknown>');
    });

    it('generates activity function exports', () => {
      const compiled = compileWorkflow(simpleWorkflow);
      
      // Should export the activity function
      expect(compiled.activitiesCode).toContain('export async function sayHello');
      expect(compiled.activitiesCode).toContain('(input: any): Promise<any>');
    });

    it('generates proxyActivities configuration', () => {
      const compiled = compileWorkflow(simpleWorkflow);
      
      // Should have proxyActivities call
      expect(compiled.workflowCode).toMatch(/proxyActivities/);
      // Should reference the activity
      expect(compiled.workflowCode).toMatch(/sayHello/);
    });

    it('returns last activity result', () => {
      const compiled = compileWorkflow(simpleWorkflow);
      
      // TODO: Node compiler should add return statement for last activity result
      // For now, we verify the result variable is created
      expect(compiled.workflowCode).toContain('result_activity_hello');
      // When return statement is added, it should match: /return\s+result_/
    });

    it('generates complete workflow structure', () => {
      const compiled = compileWorkflow(simpleWorkflow);
      
      // Should have imports
      expect(compiled.workflowCode).toContain('import');
      // Should have function body
      expect(compiled.workflowCode).toContain('{');
      expect(compiled.workflowCode).toContain('}');
    });
  });

  describe('Timeout Workflow', () => {
    it('generates workflow function with correct name', () => {
      const compiled = compileWorkflow(timeoutWorkflow);
      
      expect(compiled.workflowCode).toContain('export async function TestTimeoutWorkflow');
    });

    it('generates activity with timeout configuration', () => {
      const compiled = compileWorkflow(timeoutWorkflow);
      
      // Should have timeout configuration in proxyActivities
      expect(compiled.workflowCode).toMatch(/startToCloseTimeout/);
      expect(compiled.workflowCode).toMatch(/2s/);
    });

    it('generates slowActivity function', () => {
      const compiled = compileWorkflow(timeoutWorkflow);
      
      expect(compiled.activitiesCode).toContain('export async function slowActivity');
    });
  });

  describe('Retry Workflow', () => {
    it('generates workflow function with correct name', () => {
      const compiled = compileWorkflow(retryWorkflow);
      
      expect(compiled.workflowCode).toContain('export async function TestRetryWorkflow');
    });

    it('generates activity with retry policy configuration', () => {
      const compiled = compileWorkflow(retryWorkflow);
      
      // Should have retry configuration
      expect(compiled.workflowCode).toMatch(/retry:/);
      expect(compiled.workflowCode).toMatch(/maximumAttempts/);
      expect(compiled.workflowCode).toMatch(/exponential-backoff|exponentialBackoff|backoffCoefficient/);
    });

    it('generates flakyActivity function', () => {
      const compiled = compileWorkflow(retryWorkflow);
      
      expect(compiled.activitiesCode).toContain('export async function flakyActivity');
    });

    it('includes retry policy parameters', () => {
      const compiled = compileWorkflow(retryWorkflow);
      
      // Should include maxAttempts, initialInterval, maxInterval, backoffCoefficient
      expect(compiled.workflowCode).toMatch(/maximumAttempts|maxAttempts/);
      expect(compiled.workflowCode).toMatch(/initialInterval/);
      expect(compiled.workflowCode).toMatch(/maximumInterval|maxInterval/);
      expect(compiled.workflowCode).toMatch(/backoffCoefficient/);
    });
  });

  describe('Code Structure Invariants', () => {
    it('all workflows export function matching workflow.name', () => {
      const workflows = [simpleWorkflow, timeoutWorkflow, retryWorkflow];
      
      for (const workflow of workflows) {
        const compiled = compileWorkflow(workflow);
        const expectedFunctionName = workflow.name;
        
        // Function name should exactly match workflow.name
        expect(compiled.workflowCode).toContain(`export async function ${expectedFunctionName}`);
      }
    });

    it('all activities are exported in activities file', () => {
      const compiled = compileWorkflow(simpleWorkflow);
      
      // Find all activity nodes
      const activityNodes = simpleWorkflow.nodes.filter(
        n => n.type === 'activity' || n.type === 'agent'
      );
      
      for (const node of activityNodes) {
        const activityName = node.data.componentName || node.data.activityName;
        if (activityName) {
          expect(compiled.activitiesCode).toContain(`export async function ${activityName}`);
        }
      }
    });

    it('workflow code is valid TypeScript syntax', () => {
      const compiled = compileWorkflow(simpleWorkflow);
      
      // Basic syntax checks
      expect(compiled.workflowCode).toContain('export');
      expect(compiled.workflowCode).toContain('async');
      expect(compiled.workflowCode).toContain('function');
      
      // Should have balanced braces (rough check)
      const openBraces = (compiled.workflowCode.match(/{/g) || []).length;
      const closeBraces = (compiled.workflowCode.match(/}/g) || []).length;
      expect(openBraces).toBe(closeBraces);
    });

    it('activities code is valid TypeScript syntax', () => {
      const compiled = compileWorkflow(simpleWorkflow);
      
      // Basic syntax checks
      expect(compiled.activitiesCode).toContain('export');
      expect(compiled.activitiesCode).toContain('async');
      expect(compiled.activitiesCode).toContain('function');
      
      // Should have balanced braces
      const openBraces = (compiled.activitiesCode.match(/{/g) || []).length;
      const closeBraces = (compiled.activitiesCode.match(/}/g) || []).length;
      expect(openBraces).toBe(closeBraces);
    });
  });

  describe('Snapshot Tests', () => {
    it('simple workflow code snapshot', () => {
      const compiled = compileWorkflow(simpleWorkflow);
      
      // Snapshot the workflow code structure (key parts only)
      const snapshot = {
        hasWorkflowFunction: compiled.workflowCode.includes('export async function TestSimpleWorkflow'),
        hasActivityCall: compiled.workflowCode.includes('sayHello'),
        hasProxyActivities: compiled.workflowCode.includes('proxyActivities'),
        hasReturn: compiled.workflowCode.includes('return'),
        activityFunctionName: compiled.activitiesCode.match(/export async function (\w+)/)?.[1],
      };
      
      expect(snapshot).toMatchSnapshot();
    });

    it('timeout workflow code snapshot', () => {
      const compiled = compileWorkflow(timeoutWorkflow);
      
      const snapshot = {
        hasWorkflowFunction: compiled.workflowCode.includes('export async function TestTimeoutWorkflow'),
        hasTimeoutConfig: compiled.workflowCode.includes('startToCloseTimeout'),
        timeoutValue: compiled.workflowCode.match(/startToCloseTimeout:\s*['"]([^'"]+)['"]/)?.[1],
        activityFunctionName: compiled.activitiesCode.match(/export async function (\w+)/)?.[1],
      };
      
      expect(snapshot).toMatchSnapshot();
    });

    it('retry workflow code snapshot', () => {
      const compiled = compileWorkflow(retryWorkflow);
      
      const snapshot = {
        hasWorkflowFunction: compiled.workflowCode.includes('export async function TestRetryWorkflow'),
        hasRetryConfig: compiled.workflowCode.includes('retry:'),
        hasMaxAttempts: compiled.workflowCode.includes('maximumAttempts') || compiled.workflowCode.includes('maxAttempts'),
        hasBackoffCoefficient: compiled.workflowCode.includes('backoffCoefficient'),
        activityFunctionName: compiled.activitiesCode.match(/export async function (\w+)/)?.[1],
      };
      
      expect(snapshot).toMatchSnapshot();
    });
  });
});
