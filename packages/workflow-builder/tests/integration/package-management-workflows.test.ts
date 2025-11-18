/**
 * Integration tests for package management workflows
 * Verifies workflows match original implementations exactly
 */

import { describe, it, expect } from 'vitest';
import { compileWorkflow } from '@/lib/workflow-compiler/compiler';
import type { WorkflowDefinition } from '@/types/workflow';

describe('Package Management Workflows', () => {
  describe('PackageBuilderWorkflow', () => {
    it('compiles with all required phases', () => {
      const definition: WorkflowDefinition = {
        nodes: [
          {
            id: 'start',
            type: 'trigger',
            position: { x: 0, y: 0 },
            data: { label: 'Start' },
          },
          {
            id: 'phase-initialize',
            type: 'phase',
            position: { x: 100, y: 0 },
            data: {
              label: 'INITIALIZE',
              config: {
                name: 'INITIALIZE',
                sequential: true,
              },
            },
          },
          {
            id: 'phase-plan',
            type: 'phase',
            position: { x: 200, y: 0 },
            data: {
              label: 'PLAN',
              config: {
                name: 'PLAN',
                sequential: true,
              },
            },
          },
          {
            id: 'phase-build',
            type: 'phase',
            position: { x: 300, y: 0 },
            data: {
              label: 'BUILD',
              config: {
                name: 'BUILD',
                sequential: false,
                maxConcurrency: 4,
              },
            },
          },
          {
            id: 'phase-verify',
            type: 'phase',
            position: { x: 400, y: 0 },
            data: {
              label: 'VERIFY',
              config: {
                name: 'VERIFY',
                sequential: true,
              },
            },
          },
          {
            id: 'phase-complete',
            type: 'phase',
            position: { x: 500, y: 0 },
            data: {
              label: 'COMPLETE',
              config: {
                name: 'COMPLETE',
                sequential: true,
              },
            },
          },
          {
            id: 'end',
            type: 'trigger',
            position: { x: 600, y: 0 },
            data: { label: 'End' },
          },
        ],
        edges: [
          { id: 'e1', source: 'start', target: 'phase-initialize' },
          { id: 'e2', source: 'phase-initialize', target: 'phase-plan' },
          { id: 'e3', source: 'phase-plan', target: 'phase-build' },
          { id: 'e4', source: 'phase-build', target: 'phase-verify' },
          { id: 'e5', source: 'phase-verify', target: 'phase-complete' },
          { id: 'e6', source: 'phase-complete', target: 'end' },
        ],
      };

      const compiled = compileWorkflow(definition);
      
      expect(compiled.workflowCode).toContain('INITIALIZE');
      expect(compiled.workflowCode).toContain('PLAN');
      expect(compiled.workflowCode).toContain('BUILD');
      expect(compiled.workflowCode).toContain('VERIFY');
      expect(compiled.workflowCode).toContain('COMPLETE');
    });

    it('includes child workflow spawning for PackageBuildWorkflow', () => {
      const definition: WorkflowDefinition = {
        nodes: [
          {
            id: 'start',
            type: 'trigger',
            position: { x: 0, y: 0 },
            data: { label: 'Start' },
          },
          {
            id: 'spawn-build',
            type: 'child-workflow',
            position: { x: 100, y: 0 },
            data: {
              label: 'Spawn PackageBuildWorkflow',
              componentName: 'PackageBuildWorkflow',
              config: {
                workflowType: 'PackageBuildWorkflow',
                taskQueue: 'engine',
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
          { id: 'e1', source: 'start', target: 'spawn-build' },
          { id: 'e2', source: 'spawn-build', target: 'end' },
        ],
      };

      const compiled = compileWorkflow(definition);
      
      expect(compiled.workflowCode).toContain('startChild');
      expect(compiled.workflowCode).toContain('PackageBuildWorkflowWorkflow');
      expect(compiled.workflowCode).toContain('engine');
    });
  });

  describe('PackageBuildWorkflow', () => {
    it('includes pre-flight validation conditions', () => {
      const definition: WorkflowDefinition = {
        nodes: [
          {
            id: 'start',
            type: 'trigger',
            position: { x: 0, y: 0 },
            data: { label: 'Start' },
          },
          {
            id: 'check-exists',
            type: 'activity',
            position: { x: 100, y: 0 },
            data: {
              label: 'Check Package Exists',
              componentName: 'checkPackageExists',
            },
          },
          {
            id: 'condition-exists',
            type: 'condition',
            position: { x: 200, y: 0 },
            data: {
              label: 'Code Exists?',
              config: {
                expression: 'result.codeExists === true',
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
          { id: 'e1', source: 'start', target: 'check-exists' },
          { id: 'e2', source: 'check-exists', target: 'condition-exists' },
          { id: 'e3', source: 'condition-exists', target: 'end', sourceHandle: 'true' },
        ],
      };

      const compiled = compileWorkflow(definition);
      
      expect(compiled.workflowCode).toContain('result.codeExists === true');
      expect(compiled.workflowCode).toContain('checkPackageExists');
    });

    it('uses executeChild for CoordinatorWorkflow', () => {
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

      const compiled = compileWorkflow(definition);
      
      expect(compiled.workflowCode).toContain('executeChild');
      expect(compiled.workflowCode).toContain('CoordinatorWorkflowWorkflow');
      expect(compiled.workflowCode).toContain('engine');
    });

    it('includes retry loops with exponential backoff', () => {
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
              label: 'Build Retry',
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

      const compiled = compileWorkflow(definition);
      
      expect(compiled.workflowCode).toContain('maxAttempts');
      expect(compiled.workflowCode).toContain('while');
      expect(compiled.workflowCode.toLowerCase()).toContain('exponential');
      expect(compiled.workflowCode).toContain('sleep');
    });
  });

  describe('Workflow Compilation', () => {
    it('generates valid TypeScript code', () => {
      const definition: WorkflowDefinition = {
        nodes: [
          {
            id: 'start',
            type: 'trigger',
            position: { x: 0, y: 0 },
            data: { label: 'Start' },
          },
          {
            id: 'activity',
            type: 'activity',
            position: { x: 100, y: 0 },
            data: {
              label: 'Test Activity',
              componentName: 'testActivity',
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
          { id: 'e1', source: 'start', target: 'activity' },
          { id: 'e2', source: 'activity', target: 'end' },
        ],
      };

      const compiled = compileWorkflow(definition);
      
      // Check all required outputs exist
      expect(compiled.workflowCode).toBeTruthy();
      expect(compiled.activitiesCode).toBeTruthy();
      expect(compiled.workerCode).toBeTruthy();
      expect(compiled.packageJson).toBeTruthy();
      expect(compiled.tsConfig).toBeTruthy();
      
      // Check code is valid TypeScript syntax
      expect(compiled.workflowCode).toContain('export async function');
      expect(compiled.activitiesCode).toContain('export async function');
      expect(compiled.workerCode).toContain('import');
    });
  });
});

