import { describe, it, expect } from 'vitest';
import {
  spawnPlanWriterAgent,
  gitCommitPlan,
  updateMCPStatus
} from '../plan.activities';
import type {
  WritePlanInput,
  GitCommitInput,
  MCPUpdateInput
} from '../../types/index';

describe('Plan Activities', () => {
  describe('spawnPlanWriterAgent', () => {
    it('should generate a plan successfully', async () => {
      const input: WritePlanInput = {
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
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should include context in generated plan', async () => {
      const input: WritePlanInput = {
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
