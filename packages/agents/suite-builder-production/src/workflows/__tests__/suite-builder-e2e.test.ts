/**
 * End-to-End Integration Tests for Autonomous Package Workflow
 *
 * These tests verify the complete workflow orchestration from minimal input
 * to published packages with comprehensive reporting.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SuiteBuilderWorkflow } from '../suite-builder.workflow';
import type { PackageWorkflowInput, BuildConfig } from '../../types/index';

// Mock all activities
vi.mock('@temporalio/workflow', async () => {
  const actual = await vi.importActual('@temporalio/workflow');
  return {
    ...actual,
    proxyActivities: () => ({
      // Discovery activities
      searchForPackage: vi.fn(async () => ({
        found: true,
        packagePath: '/workspace/packages/core/test-package',
        searchedLocations: ['plans/packages/**', 'packages/**']
      })),
      readPackageJson: vi.fn(async () => ({
        name: '@bernierllc/test-package',
        version: '1.0.0',
        dependencies: []
      })),
      buildDependencyTree: vi.fn(async () => ({
        packages: [{
          name: '@bernierllc/test-package',
          path: '/workspace/packages/core/test-package',
          version: '1.0.0',
          dependencies: [],
          buildStatus: 'pending' as const
        }]
      })),
      copyEnvFiles: vi.fn(async () => {}),

      // Planning activities
      searchLocalPlans: vi.fn(async () => '/workspace/plans/packages/core/test-package.md'),
      queryMcpForPlan: vi.fn(async () => '/workspace/plans/packages/core/test-package.md'),
      validatePlan: vi.fn(async () => ({
        isValid: true,
        content: '# Test Package Plan\n\n## Implementation\n\nTest implementation details.',
        errors: []
      })),
      registerPlanWithMcp: vi.fn(async () => {}),

      // MECE activities
      analyzeMeceCompliance: vi.fn(async () => ({
        isCompliant: true
      })),
      generateSplitPlans: vi.fn(async () => ({ splitPlans: [] })),
      registerSplitPlans: vi.fn(async () => {}),
      determineDeprecationCycle: vi.fn(async () => ({
        requiresDeprecation: false,
        versions: []
      })),
      updateDependentPlans: vi.fn(async () => {}),

      // Build activities
      buildDependencyGraph: vi.fn(async () => [{
        name: '@bernierllc/test-package',
        path: '/workspace/packages/core/test-package',
        version: '1.0.0',
        dependencies: [],
        buildStatus: 'pending' as const
      }]),

      // Publish activities
      determineVersionBump: vi.fn(async () => ({
        newVersion: '1.0.1',
        previousVersion: '1.0.0',
        changeType: 'patch'
      })),
      publishToNpm: vi.fn(async () => ({
        success: true,
        packageName: '@bernierllc/test-package',
        version: '1.0.1',
        registry: 'https://registry.npmjs.org'
      })),
      updateDependentVersions: vi.fn(async () => ({
        updatedPackages: [],
        errors: []
      })),
      publishDeprecationNotice: vi.fn(async () => ({
        success: true,
        packageName: '@bernierllc/test-package',
        version: '1.0.0',
        message: 'Deprecated'
      })),

      // Report activities
      loadAllPackageReports: vi.fn(async () => []),
      writeSuiteReport: vi.fn(async () => {})
    }),
    startChild: vi.fn(async () => ({
      workflowId: 'test-child-workflow',
      result: async () => ({
        packageName: '@bernierllc/test-package',
        success: true,
        qualityScore: 95,
        duration: 1000,
        buildErrors: [],
        testResults: { passed: true, coverage: 90 },
        fixAttempts: []
      })
    }))
  };
});

const createTestConfig = (): BuildConfig => ({
  npmRegistry: 'https://registry.npmjs.org',
  npmToken: 'test-token',
  workspaceRoot: '/workspace',
  maxConcurrentBuilds: 3,
  temporal: {
    address: 'localhost:7233',
    namespace: 'default',
    taskQueue: 'suite-builder'
  }
});

describe('SuiteBuilderWorkflow - End-to-End Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Package Name Input', () => {
    it('should complete full workflow with package name', async () => {
      const input: PackageWorkflowInput = {
        packageName: '@bernierllc/test-package',
        config: createTestConfig()
      };

      const result = await SuiteBuilderWorkflow(input);

      expect(result).toBeDefined();
      expect(result.totalPackages).toBe(1);
      expect(result.successfulBuilds).toBe(1);
      expect(result.failedBuilds).toBe(0);
      expect(result.skippedPackages).toBe(0);
      expect(result.packages).toHaveLength(1);
      expect(result.packages[0]).toMatchObject({
        name: '@bernierllc/test-package',
        version: '1.0.0',
        buildStatus: 'completed'
      });
    });

    it('should handle package name without scope', async () => {
      const input: PackageWorkflowInput = {
        packageName: 'test-package',
        config: createTestConfig()
      };

      const result = await SuiteBuilderWorkflow(input);

      expect(result).toBeDefined();
      expect(result.totalPackages).toBeGreaterThan(0);
    });
  });

  describe('Package Idea Input', () => {
    it.skip('should complete full workflow with package idea (requires MCP)', async () => {
      // TODO: Implement when MCP integration is complete
      const input: PackageWorkflowInput = {
        packageIdea: 'create a streaming OpenAI client with retry logic',
        config: createTestConfig()
      };

      const result = await SuiteBuilderWorkflow(input);

      expect(result).toBeDefined();
      expect(result.totalPackages).toBeGreaterThan(0);
    });
  });

  describe('Plan File Path Input', () => {
    it.skip('should complete full workflow with plan file path (requires MCP)', async () => {
      // TODO: Implement when MCP integration is complete
      const input: PackageWorkflowInput = {
        planFilePath: 'plans/packages/core/test-package.md',
        config: createTestConfig()
      };

      const result = await SuiteBuilderWorkflow(input);

      expect(result).toBeDefined();
      expect(result.totalPackages).toBeGreaterThan(0);
    });
  });

  describe('Update Prompt Input', () => {
    it('should complete full workflow with update prompt', async () => {
      const input: PackageWorkflowInput = {
        packageName: '@bernierllc/test-package',
        updatePrompt: 'add streaming support with backpressure handling',
        config: createTestConfig()
      };

      const result = await SuiteBuilderWorkflow(input);

      expect(result).toBeDefined();
      expect(result.totalPackages).toBeGreaterThan(0);
    });
  });

  describe('MECE Compliance Handling', () => {
    it('should handle MECE violations and create split packages', async () => {
      // Override analyzeMeceCompliance to return violation
      const { proxyActivities } = await import('@temporalio/workflow');
      const activities = proxyActivities();
      vi.mocked(activities.analyzeMeceCompliance).mockResolvedValueOnce({
        isCompliant: false,
        violation: {
          reason: 'Package has video processing functionality',
          affectedFunctionality: ['processVideo', 'encodeVideo'],
          suggestedSplit: '@bernierllc/video-processor',
          mainPackageStillUsesIt: true
        }
      });

      vi.mocked(activities.generateSplitPlans).mockResolvedValueOnce({
        splitPlans: [{
          packageName: '@bernierllc/video-processor',
          functionality: ['processVideo', 'encodeVideo'],
          planPath: '/workspace/plans/packages/core/video-processor.md',
          dependencies: []
        }]
      });

      const input: PackageWorkflowInput = {
        packageName: '@bernierllc/test-package',
        updatePrompt: 'add video processing',
        config: createTestConfig()
      };

      const result = await SuiteBuilderWorkflow(input);

      expect(result).toBeDefined();
      // Should have main package + split package
      expect(result.totalPackages).toBeGreaterThanOrEqual(1);
    });

    it('should handle deprecation cycle for published packages', async () => {
      // Override searchForPackage to indicate published
      const { proxyActivities } = await import('@temporalio/workflow');
      const activities = proxyActivities();
      vi.mocked(activities.searchForPackage).mockResolvedValueOnce({
        packagePath: '/workspace/packages/core/test-package',
        packageName: '@bernierllc/test-package',
        worktreePath: '/workspace/.worktrees/test-package',
        isPublished: true
      });

      vi.mocked(activities.analyzeMeceCompliance).mockResolvedValueOnce({
        isCompliant: false,
        violation: {
          reason: 'Package has video processing functionality',
          affectedFunctionality: ['processVideo'],
          suggestedSplit: '@bernierllc/video-processor',
          mainPackageStillUsesIt: true
        }
      });

      vi.mocked(activities.determineDeprecationCycle).mockResolvedValueOnce({
        requiresDeprecation: true,
        versions: [
          {
            version: '1.1.0',
            versionType: 'minor',
            changes: ['Add deprecation notice for processVideo'],
            deprecationNotice: 'processVideo will be moved to @bernierllc/video-processor in 2.0.0'
          },
          {
            version: '2.0.0',
            versionType: 'major',
            changes: [
              'Remove processVideo',
              'Add dependency on @bernierllc/video-processor'
            ]
          }
        ]
      });

      const input: PackageWorkflowInput = {
        packageName: '@bernierllc/test-package',
        updatePrompt: 'add video processing',
        config: createTestConfig()
      };

      const result = await SuiteBuilderWorkflow(input);

      expect(result).toBeDefined();
      // Should handle deprecation cycle
      expect(result.totalPackages).toBeGreaterThan(0);
    });
  });

  describe('Result Summary', () => {
    it('should return comprehensive summary with all packages', async () => {
      const input: PackageWorkflowInput = {
        packageName: '@bernierllc/test-package',
        config: createTestConfig()
      };

      const result = await SuiteBuilderWorkflow(input);

      expect(result).toMatchObject({
        totalPackages: expect.any(Number),
        successfulBuilds: expect.any(Number),
        failedBuilds: expect.any(Number),
        skippedPackages: expect.any(Number),
        packages: expect.arrayContaining([
          expect.objectContaining({
            name: expect.any(String),
            version: expect.any(String),
            buildStatus: expect.stringMatching(/completed|failed|skipped/)
          })
        ])
      });

      // Verify counts add up
      const { totalPackages, successfulBuilds, failedBuilds, skippedPackages } = result;
      expect(successfulBuilds + failedBuilds + skippedPackages).toBe(totalPackages);
    });

    it('should include all package details in result', async () => {
      const input: PackageWorkflowInput = {
        packageName: '@bernierllc/test-package',
        config: createTestConfig()
      };

      const result = await SuiteBuilderWorkflow(input);

      expect(result.packages).toBeDefined();
      expect(result.packages.length).toBe(result.totalPackages);

      result.packages.forEach(pkg => {
        expect(pkg).toHaveProperty('name');
        expect(pkg).toHaveProperty('version');
        expect(pkg).toHaveProperty('buildStatus');
        expect(['completed', 'failed', 'skipped']).toContain(pkg.buildStatus);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing input gracefully', async () => {
      const input: PackageWorkflowInput = {
        config: createTestConfig()
      };

      await expect(SuiteBuilderWorkflow(input)).rejects.toThrow();
    });

    it('should continue workflow even if some packages fail', async () => {
      // Mock a build failure
      const { startChild } = await import('@temporalio/workflow');
      vi.mocked(startChild).mockResolvedValueOnce({
        workflowId: 'test-child-workflow',
        result: async () => {
          throw new Error('Build failed');
        }
      } as any);

      const input: PackageWorkflowInput = {
        packageName: '@bernierllc/test-package',
        config: createTestConfig()
      };

      const result = await SuiteBuilderWorkflow(input);

      expect(result).toBeDefined();
      // Workflow should complete even with failures
      expect(result.totalPackages).toBeGreaterThan(0);
    });
  });
});
