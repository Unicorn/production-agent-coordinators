import { describe, it, expect } from 'vitest';
import { DevWorkflowCoordinatorInput, DevWorkflowCoordinatorResult } from '../workflow.types';

describe('Workflow Types', () => {
  it('should accept valid coordinator input', () => {
    const input: DevWorkflowCoordinatorInput = {
      featureRequest: 'Add OAuth2 authentication',
      slackChannel: 'C12345',
      slackThreadTs: '1234567890.123456',
      repoPath: '/workspace/my-repo'
    };

    expect(input).toBeDefined();
    expect(input.featureRequest).toBe('Add OAuth2 authentication');
  });

  it('should accept optional baseBranch', () => {
    const input: DevWorkflowCoordinatorInput = {
      featureRequest: 'Add feature',
      slackChannel: 'C12345',
      slackThreadTs: '123',
      repoPath: '/workspace',
      baseBranch: 'develop'
    };

    expect(input.baseBranch).toBe('develop');
  });

  it('should create success result', () => {
    const result: DevWorkflowCoordinatorResult = {
      success: true,
      prUrl: 'https://github.com/user/repo/pull/123',
      prNumber: 123,
      tasksCompleted: 5,
      tasksFailed: 0
    };

    expect(result.success).toBe(true);
    expect(result.prUrl).toBeDefined();
  });

  it('should create failure result', () => {
    const result: DevWorkflowCoordinatorResult = {
      success: false,
      tasksCompleted: 2,
      tasksFailed: 1,
      error: 'Task 3 failed after retries'
    };

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
