import { describe, it, expect } from 'vitest';
import type {
  Package,
  OrchestratorState,
  OrchestratorInput,
  BuildResult,
} from '../index';

describe('Types', () => {
  it('should define Package type correctly', () => {
    const pkg: Package = {
      name: '@bernierllc/test-package',
      priority: 100,
      dependencies: ['@bernierllc/dep1'],
    };

    expect(pkg.name).toBe('@bernierllc/test-package');
    expect(pkg.priority).toBe(100);
    expect(pkg.dependencies).toHaveLength(1);
  });

  it('should define OrchestratorState type correctly', () => {
    const state: OrchestratorState = {
      internalQueue: [],
      activeBuilds: new Map(),
      failedRetries: new Map(),
      isPaused: false,
      isDraining: false,
      maxConcurrent: 4,
    };

    expect(state.maxConcurrent).toBe(4);
    expect(state.isPaused).toBe(false);
  });

  it('should define OrchestratorInput type correctly', () => {
    const input: OrchestratorInput = {
      maxConcurrent: 4,
      workspaceRoot: '/workspace',
      config: {
        registry: 'https://registry.npmjs.org',
      },
    };

    expect(input.maxConcurrent).toBe(4);
    expect(input.workspaceRoot).toBe('/workspace');
  });

  it('should define BuildResult type correctly', () => {
    const result: BuildResult = {
      success: true,
      packageName: '@bernierllc/test',
    };

    expect(result.success).toBe(true);
    expect(result.packageName).toBe('@bernierllc/test');
  });
});
