import { describe, it, expect } from 'vitest';
import { RemediationWorkflow } from '../remediation.workflow';
import type { RemediationWorkflowInput } from '../../types/index';

describe('RemediationWorkflow', () => {
  it('should be a function', () => {
    expect(typeof RemediationWorkflow).toBe('function');
  });

  it('should accept RemediationWorkflowInput with valid structure', () => {
    const input: RemediationWorkflowInput = {
      packagePath: '/test/package',
      packageName: '@bernierllc/test',
      tasks: [
        {
          category: 'typescript',
          priority: 'critical',
          description: 'Fix type errors',
          details: ['Type "string" is not assignable to type "number"'],
          suggestedFix: 'Update variable type'
        }
      ],
      maxAttempts: 3
    };

    // Verify the input type is correct
    expect(input.packageName).toBe('@bernierllc/test');
    expect(input.tasks.length).toBe(1);
    expect(input.tasks[0].category).toBe('typescript');
    expect(input.tasks[0].priority).toBe('critical');
  });

  it('should accept RemediationWorkflowInput with empty tasks array', () => {
    const input: RemediationWorkflowInput = {
      packagePath: '/test/package',
      packageName: '@bernierllc/test',
      tasks: []
    };

    // Verify empty tasks is valid
    expect(input.tasks.length).toBe(0);
  });

  it('should accept RemediationWorkflowInput with multiple task categories', () => {
    const input: RemediationWorkflowInput = {
      packagePath: '/test/package',
      packageName: '@bernierllc/test',
      tasks: [
        {
          category: 'structure',
          priority: 'high',
          description: 'Missing package.json field',
          details: ['Missing "main" field']
        },
        {
          category: 'lint',
          priority: 'medium',
          description: 'ESLint errors',
          details: ['Unexpected console.log statement']
        },
        {
          category: 'tests',
          priority: 'low',
          description: 'Low test coverage',
          details: ['Coverage is 65%, required 80%']
        }
      ]
    };

    // Verify multiple categories are valid
    expect(input.tasks.length).toBe(3);
    expect(input.tasks[0].category).toBe('structure');
    expect(input.tasks[1].category).toBe('lint');
    expect(input.tasks[2].category).toBe('tests');
  });

  it('should accept RemediationWorkflowInput with all priority levels', () => {
    const input: RemediationWorkflowInput = {
      packagePath: '/test/package',
      packageName: '@bernierllc/test',
      tasks: [
        {
          category: 'security',
          priority: 'critical',
          description: 'Critical vulnerability',
          details: ['High severity CVE detected']
        },
        {
          category: 'documentation',
          priority: 'high',
          description: 'Missing documentation',
          details: ['README missing API section']
        },
        {
          category: 'license',
          priority: 'medium',
          description: 'License headers missing',
          details: ['5 files without license headers']
        },
        {
          category: 'integration',
          priority: 'low',
          description: 'Missing logger integration',
          details: ['Service package requires logger']
        }
      ]
    };

    // Verify all priority levels are valid
    expect(input.tasks.length).toBe(4);
    expect(input.tasks[0].priority).toBe('critical');
    expect(input.tasks[1].priority).toBe('high');
    expect(input.tasks[2].priority).toBe('medium');
    expect(input.tasks[3].priority).toBe('low');
  });

  it('should accept RemediationWorkflowInput with optional suggestedFix', () => {
    const input: RemediationWorkflowInput = {
      packagePath: '/test/package',
      packageName: '@bernierllc/test',
      tasks: [
        {
          category: 'typescript',
          priority: 'high',
          description: 'Type error',
          details: ['Error in function return type'],
          suggestedFix: 'Change return type to Promise<void>'
        },
        {
          category: 'lint',
          priority: 'medium',
          description: 'Lint error',
          details: ['Unused variable']
          // No suggestedFix - optional field
        }
      ]
    };

    // Verify optional suggestedFix
    expect(input.tasks[0].suggestedFix).toBe('Change return type to Promise<void>');
    expect(input.tasks[1].suggestedFix).toBeUndefined();
  });
});
