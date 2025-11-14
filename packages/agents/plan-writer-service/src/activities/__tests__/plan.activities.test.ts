import { describe, it, expect } from 'vitest';
import {
  spawnPlanWriterAgent,
  spawnPackageEvaluatorAgent,
  gitCommitPlan,
  updateMCPStatus
} from '../plan.activities';
import type {
  WritePlanInputWithContext,
  PackageEvaluationInput,
  GitCommitInput,
  MCPUpdateInput
} from '../../types/index';

describe('Plan Activities', () => {
  describe('spawnPlanWriterAgent', () => {
    it('should generate a plan successfully', async () => {
      const input: WritePlanInputWithContext = {
        packageId: '@bernierllc/test-package',
        reason: 'Testing plan generation',
        context: {
          requirements: ['Feature A', 'Feature B']
        }
      };

      const result = await spawnPlanWriterAgent(input);

      expect(result.success).toBe(true);
      expect(result.planContent).toContain('@bernierllc/test-package');
      expect(result.planContent).toContain('Testing plan generation');
      expect(result.planFilePath).toBe('plans/packages/test-package.md');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should include context in generated plan', async () => {
      const input: WritePlanInputWithContext = {
        packageId: '@bernierllc/my-package',
        reason: 'New feature required',
        context: {
          dependencies: ['@bernierllc/dep-1', '@bernierllc/dep-2'],
          requirements: ['Must be fast', 'Must be secure']
        }
      };

      const result = await spawnPlanWriterAgent(input);

      expect(result.success).toBe(true);
      expect(result.planContent).toContain('dep-1');
      expect(result.planContent).toContain('Must be fast');
    });

    it('should include parent context in generated plan', async () => {
      const input: WritePlanInputWithContext = {
        packageId: '@bernierllc/child-package',
        reason: 'Child package for testing',
        context: {},
        parentPlanContent: '# Parent Package Plan\n\nThis is the parent architecture.',
        parentPackageId: '@bernierllc/parent-package',
        lineage: ['@bernierllc/parent-package']
      };

      const result = await spawnPlanWriterAgent(input);

      expect(result.success).toBe(true);
      expect(result.planContent).toContain('Parent Package Context');
      expect(result.planContent).toContain('@bernierllc/parent-package');
      expect(result.planContent).toContain('**Lineage**:');
      expect(result.planContent).toContain('Parent plan excerpt');
    });
  });

  describe('spawnPackageEvaluatorAgent', () => {
    it('should decide no update needed for existing matching package', async () => {
      const input: PackageEvaluationInput = {
        packageId: '@bernierllc/test-package',
        existingPlanContent: 'Existing plan content',
        parentPlanContent: 'Parent plan content',
        npmPackageInfo: {
          version: '1.0.0',
          published_at: '2025-01-01',
          url: 'https://npmjs.com/package/test'
        },
        packageDetails: {
          status: 'published',
          plan_file_path: 'plans/test.md',
          current_version: '1.0.0',
          dependencies: []
        }
      };

      const result = await spawnPackageEvaluatorAgent(input);

      expect(result.success).toBe(true);
      expect(result.needsUpdate).toBe(false);
      expect(result.updateType).toBe('none');
      expect(result.confidence).toBe('high');
    });

    it('should decide plan needed when no plan exists', async () => {
      const input: PackageEvaluationInput = {
        packageId: '@bernierllc/test-package',
        parentPlanContent: 'Parent plan content',
        packageDetails: {
          status: 'plan_needed',
          dependencies: []
        }
      };

      const result = await spawnPackageEvaluatorAgent(input);

      expect(result.success).toBe(true);
      expect(result.needsUpdate).toBe(true);
      expect(result.updateType).toBe('plan');
      expect(result.reason).toContain('No existing plan');
    });

    it('should decide implementation needed when plan exists but not published', async () => {
      const input: PackageEvaluationInput = {
        packageId: '@bernierllc/test-package',
        existingPlanContent: 'Existing plan content',
        packageDetails: {
          status: 'plan_written',
          plan_file_path: 'plans/test.md',
          dependencies: []
        }
      };

      const result = await spawnPackageEvaluatorAgent(input);

      expect(result.success).toBe(true);
      expect(result.needsUpdate).toBe(true);
      expect(result.updateType).toBe('implementation');
      expect(result.reason).toContain('not yet implemented');
    });
  });

  describe('gitCommitPlan', () => {
    it('should commit plan successfully', async () => {
      const input: GitCommitInput = {
        packageId: '@bernierllc/test-package',
        planFilePath: 'plans/packages/test-package.md',
        gitBranch: 'feature/bernierllc-test-package',
        commitMessage: 'feat: Add plan for test-package'
      };

      const result = await gitCommitPlan(input);

      expect(result.success).toBe(true);
      expect(result.commitSha).toBeTruthy();
      expect(result.branch).toBe('feature/bernierllc-test-package');
    });
  });

  describe('updateMCPStatus', () => {
    it('should update MCP successfully', async () => {
      const input: MCPUpdateInput = {
        packageId: '@bernierllc/test-package',
        planFilePath: 'plans/packages/test-package.md',
        gitBranch: 'feature/bernierllc-test-package',
        status: 'plan_written'
      };

      const result = await updateMCPStatus(input);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });
});
