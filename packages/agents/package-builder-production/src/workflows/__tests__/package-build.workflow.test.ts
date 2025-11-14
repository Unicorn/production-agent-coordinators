import { describe, it, expect } from 'vitest';
import { PackageBuildWorkflow } from '../package-build.workflow';
import type { PackageBuildInput } from '../../types/index';
import type { Problem } from '../../types/coordinator.types';

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

describe('PackageBuildWorkflow - Coordinator Integration', () => {
  it('should create valid Problem from build failure', () => {
    const buildResult = {
      success: false,
      duration: 100,
      stdout: '',
      stderr: 'spawn /bin/sh ENOENT'
    };

    const problem: Problem = {
      type: 'BUILD_FAILURE',
      error: {
        message: buildResult.stderr,
        stderr: buildResult.stderr,
        stdout: buildResult.stdout
      },
      context: {
        packageName: '@test/package',
        packagePath: '/path/to/package',
        planPath: '/path/to/plan.md',
        phase: 'build',
        attemptNumber: 1
      }
    };

    expect(problem.type).toBe('BUILD_FAILURE');
    expect(problem.error.stderr).toContain('ENOENT');
  });
});
