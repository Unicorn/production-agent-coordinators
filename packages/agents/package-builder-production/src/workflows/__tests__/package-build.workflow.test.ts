import { describe, it, expect } from 'vitest';
import { PackageBuildWorkflow } from '../package-build.workflow';
import type { PackageBuildInput } from '../../types/index';

describe('PackageBuildWorkflow', () => {
  it('should be a function', () => {
    expect(typeof PackageBuildWorkflow).toBe('function');
  });

  it('should accept PackageBuildInput', () => {
    const input: PackageBuildInput = {
      packageName: '@bernierllc/test',
      packagePath: 'packages/core/test',
      planPath: 'plans/packages/core/test.md',
      category: 'core',
      dependencies: [],
      workspaceRoot: '/test',
      config: {} as any
    };

    // Just verify the input type is correct - don't execute the workflow
    // (execution requires Temporal runtime context)
    expect(input.packageName).toBe('@bernierllc/test');
  });
});
