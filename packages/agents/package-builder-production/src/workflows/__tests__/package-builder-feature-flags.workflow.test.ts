import { describe, it, expect } from 'vitest';
import type { PackageBuilderInput, BuildConfig } from '../../types/index';

describe('PackageBuilderWorkflow - Feature Flags', () => {
  describe('BuildConfig feature flag structure', () => {
    it('should accept config with feature flags', () => {
      const config: BuildConfig = {
        npmRegistry: 'https://registry.npmjs.org',
        npmToken: 'test-token',
        workspaceRoot: '/test',
        maxConcurrentBuilds: 4,
        temporal: {
          address: 'localhost:7233',
          namespace: 'default',
          taskQueue: 'engine'
        },
        testing: {
          enableCoverage: true,
          minCoveragePercent: 80,
          failOnError: true
        },
        publishing: {
          dryRun: false,
          requireTests: true,
          requireCleanWorkingDirectory: false
        },
        features: {
          enableTurnBasedGeneration: true
        }
      };

      expect(config.features?.enableTurnBasedGeneration).toBe(true);
    });

    it('should accept config without feature flags', () => {
      const config: BuildConfig = {
        npmRegistry: 'https://registry.npmjs.org',
        npmToken: 'test-token',
        workspaceRoot: '/test',
        maxConcurrentBuilds: 4,
        temporal: {
          address: 'localhost:7233',
          namespace: 'default',
          taskQueue: 'engine'
        },
        testing: {
          enableCoverage: true,
          minCoveragePercent: 80,
          failOnError: true
        },
        publishing: {
          dryRun: false,
          requireTests: true,
          requireCleanWorkingDirectory: false
        }
      };

      expect(config.features).toBeUndefined();
    });

    it('should accept config with feature flags disabled', () => {
      const config: BuildConfig = {
        npmRegistry: 'https://registry.npmjs.org',
        npmToken: 'test-token',
        workspaceRoot: '/test',
        maxConcurrentBuilds: 4,
        temporal: {
          address: 'localhost:7233',
          namespace: 'default',
          taskQueue: 'engine'
        },
        testing: {
          enableCoverage: true,
          minCoveragePercent: 80,
          failOnError: true
        },
        publishing: {
          dryRun: false,
          requireTests: true,
          requireCleanWorkingDirectory: false
        },
        features: {
          enableTurnBasedGeneration: false
        }
      };

      expect(config.features?.enableTurnBasedGeneration).toBe(false);
    });
  });

  describe('PackageBuilderInput with feature flags', () => {
    it('should accept input with turn-based generation enabled', () => {
      const input: PackageBuilderInput = {
        buildId: 'test-build',
        workspaceRoot: '/test',
        planPath: 'test.md',
        config: {
          npmRegistry: 'https://registry.npmjs.org',
          npmToken: 'test-token',
          workspaceRoot: '/test',
          maxConcurrentBuilds: 4,
          temporal: {
            address: 'localhost:7233',
            namespace: 'default',
            taskQueue: 'engine'
          },
          testing: {
            enableCoverage: true,
            minCoveragePercent: 80,
            failOnError: true
          },
          publishing: {
            dryRun: false,
            requireTests: true,
            requireCleanWorkingDirectory: false
          },
          features: {
            enableTurnBasedGeneration: true
          }
        }
      };

      expect(input.config.features?.enableTurnBasedGeneration).toBe(true);
    });

    it('should default to original workflow when feature flag not set', () => {
      const input: PackageBuilderInput = {
        buildId: 'test-build',
        workspaceRoot: '/test',
        planPath: 'test.md',
        config: {
          npmRegistry: 'https://registry.npmjs.org',
          npmToken: 'test-token',
          workspaceRoot: '/test',
          maxConcurrentBuilds: 4,
          temporal: {
            address: 'localhost:7233',
            namespace: 'default',
            taskQueue: 'engine'
          },
          testing: {
            enableCoverage: true,
            minCoveragePercent: 80,
            failOnError: true
          },
          publishing: {
            dryRun: false,
            requireTests: true,
            requireCleanWorkingDirectory: false
          }
        }
      };

      // When feature flag is not set, it should be undefined
      expect(input.config.features?.enableTurnBasedGeneration).toBeUndefined();

      // Workflow should default to false when undefined
      const enableTurnBased = input.config.features?.enableTurnBasedGeneration ?? false;
      expect(enableTurnBased).toBe(false);
    });
  });

  describe('Feature flag routing logic', () => {
    it('should select turn-based workflow when flag is true', () => {
      const enableTurnBased = true;

      // This simulates the workflow selection logic
      const workflowName = enableTurnBased
        ? 'PackageBuildTurnBasedWorkflow'
        : 'PackageBuildWorkflow';

      expect(workflowName).toBe('PackageBuildTurnBasedWorkflow');
    });

    it('should select original workflow when flag is false', () => {
      const enableTurnBased = false;

      const workflowName = enableTurnBased
        ? 'PackageBuildTurnBasedWorkflow'
        : 'PackageBuildWorkflow';

      expect(workflowName).toBe('PackageBuildWorkflow');
    });

    it('should select original workflow when flag is undefined', () => {
      const enableTurnBased = undefined;

      // Using nullish coalescing to default to false
      const workflowName = (enableTurnBased ?? false)
        ? 'PackageBuildTurnBasedWorkflow'
        : 'PackageBuildWorkflow';

      expect(workflowName).toBe('PackageBuildWorkflow');
    });

    it('should handle nested optional chaining correctly', () => {
      const config1 = { features: { enableTurnBasedGeneration: true } };
      const config2 = { features: { enableTurnBasedGeneration: false } };
      const config3 = { features: {} };
      const config4 = {};

      expect(config1.features?.enableTurnBasedGeneration ?? false).toBe(true);
      expect(config2.features?.enableTurnBasedGeneration ?? false).toBe(false);
      expect((config3 as any).features?.enableTurnBasedGeneration ?? false).toBe(false);
      expect((config4 as any).features?.enableTurnBasedGeneration ?? false).toBe(false);
    });
  });

  describe('Backward compatibility', () => {
    it('should maintain backward compatibility with existing configs', () => {
      // Old config without features field
      const oldConfig: BuildConfig = {
        npmRegistry: 'https://registry.npmjs.org',
        npmToken: 'test-token',
        workspaceRoot: '/test',
        maxConcurrentBuilds: 4,
        temporal: {
          address: 'localhost:7233',
          namespace: 'default',
          taskQueue: 'engine'
        },
        testing: {
          enableCoverage: true,
          minCoveragePercent: 80,
          failOnError: true
        },
        publishing: {
          dryRun: false,
          requireTests: true,
          requireCleanWorkingDirectory: false
        }
      };

      // Should not break with missing features field
      expect(oldConfig.features).toBeUndefined();

      // Default behavior should use original workflow
      const enableTurnBased = oldConfig.features?.enableTurnBasedGeneration ?? false;
      expect(enableTurnBased).toBe(false);
    });

    it('should work with partial feature flags', () => {
      const config: BuildConfig = {
        npmRegistry: 'https://registry.npmjs.org',
        npmToken: 'test-token',
        workspaceRoot: '/test',
        maxConcurrentBuilds: 4,
        temporal: {
          address: 'localhost:7233',
          namespace: 'default',
          taskQueue: 'engine'
        },
        testing: {
          enableCoverage: true,
          minCoveragePercent: 80,
          failOnError: true
        },
        publishing: {
          dryRun: false,
          requireTests: true,
          requireCleanWorkingDirectory: false
        },
        features: {
          // Could have other feature flags in the future
        }
      };

      expect(config.features?.enableTurnBasedGeneration).toBeUndefined();
      expect(config.features?.enableTurnBasedGeneration ?? false).toBe(false);
    });
  });
});
