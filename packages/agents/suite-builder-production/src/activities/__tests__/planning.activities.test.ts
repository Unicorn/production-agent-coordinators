import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { searchLocalPlans, queryMcpForPlan } from '../planning.activities';
import * as fs from 'fs';
import * as path from 'path';

describe('Planning Activities', () => {
  describe('searchLocalPlans', () => {
    let testWorkspace: string;

    beforeEach(() => {
      // Create a temporary test workspace
      testWorkspace = `/tmp/test-workspace-${Date.now()}`;
      fs.mkdirSync(testWorkspace, { recursive: true });
    });

    afterEach(() => {
      // Clean up test workspace
      if (fs.existsSync(testWorkspace)) {
        fs.rmSync(testWorkspace, { recursive: true, force: true });
      }
    });

    it('should find plan file in plans/packages/ directory', async () => {
      // Setup: Create a plan file at plans/packages/openai-client.md
      const plansDir = path.join(testWorkspace, 'plans', 'packages');
      fs.mkdirSync(plansDir, { recursive: true });
      const planPath = path.join(plansDir, 'openai-client.md');
      fs.writeFileSync(planPath, '# OpenAI Client Plan');

      const result = await searchLocalPlans({
        packageName: '@bernierllc/openai-client',
        workspaceRoot: testWorkspace
      });

      expect(result).toBe(planPath);
    });

    it('should find plan file in nested structure (plans/packages/core/package-name.md)', async () => {
      // Setup: Create a plan file at plans/packages/core/logger.md
      const nestedDir = path.join(testWorkspace, 'plans', 'packages', 'core');
      fs.mkdirSync(nestedDir, { recursive: true });
      const planPath = path.join(nestedDir, 'logger.md');
      fs.writeFileSync(planPath, '# Logger Plan');

      const result = await searchLocalPlans({
        packageName: '@bernierllc/logger',
        workspaceRoot: testWorkspace
      });

      expect(result).toBe(planPath);
    });

    it('should return null if package plan file not found', async () => {
      // Setup: Create plans directory but no matching plan file
      const plansDir = path.join(testWorkspace, 'plans', 'packages');
      fs.mkdirSync(plansDir, { recursive: true });
      fs.writeFileSync(path.join(plansDir, 'other-package.md'), '# Other');

      const result = await searchLocalPlans({
        packageName: '@bernierllc/nonexistent-package',
        workspaceRoot: testWorkspace
      });

      expect(result).toBeNull();
    });

    it('should return first match when multiple plan files exist', async () => {
      // Setup: Create multiple potential matches
      const plansDir = path.join(testWorkspace, 'plans', 'packages');
      fs.mkdirSync(plansDir, { recursive: true });

      // Create first match
      const firstPath = path.join(plansDir, 'retry-policy.md');
      fs.writeFileSync(firstPath, '# Retry Policy');

      // Create nested match
      const nestedDir = path.join(plansDir, 'core');
      fs.mkdirSync(nestedDir, { recursive: true });
      const nestedPath = path.join(nestedDir, 'retry-policy.md');
      fs.writeFileSync(nestedPath, '# Retry Policy Core');

      const result = await searchLocalPlans({
        packageName: '@bernierllc/retry-policy',
        workspaceRoot: testWorkspace
      });

      // Should return one of them (glob will return in some order)
      expect(result).toBeTruthy();
      expect(result).toMatch(/retry-policy\.md$/);
    });

    it('should throw error if packageName is empty', async () => {
      await expect(
        searchLocalPlans({
          packageName: '',
          workspaceRoot: testWorkspace
        })
      ).rejects.toThrow('packageName cannot be empty');
    });

    it('should throw error if workspaceRoot is empty', async () => {
      await expect(
        searchLocalPlans({
          packageName: '@bernierllc/test',
          workspaceRoot: ''
        })
      ).rejects.toThrow('workspaceRoot cannot be empty');
    });

    it('should throw error if workspaceRoot does not exist', async () => {
      await expect(
        searchLocalPlans({
          packageName: '@bernierllc/test',
          workspaceRoot: '/nonexistent/workspace/path'
        })
      ).rejects.toThrow('workspaceRoot does not exist');
    });

    it('should match package name without scope prefix', async () => {
      // Setup: Create plan file
      const plansDir = path.join(testWorkspace, 'plans', 'packages');
      fs.mkdirSync(plansDir, { recursive: true });
      const planPath = path.join(plansDir, 'test-package.md');
      fs.writeFileSync(planPath, '# Test Package');

      const result = await searchLocalPlans({
        packageName: '@bernierllc/test-package',
        workspaceRoot: testWorkspace
      });

      expect(result).toBe(planPath);
    });

    it('should handle non-scoped package names', async () => {
      // Setup: Create plan file
      const plansDir = path.join(testWorkspace, 'plans', 'packages');
      fs.mkdirSync(plansDir, { recursive: true });
      const planPath = path.join(plansDir, 'simple-package.md');
      fs.writeFileSync(planPath, '# Simple Package');

      const result = await searchLocalPlans({
        packageName: 'simple-package',
        workspaceRoot: testWorkspace
      });

      expect(result).toBe(planPath);
    });

    it('should return null if plans directory does not exist', async () => {
      // Don't create plans directory at all
      const result = await searchLocalPlans({
        packageName: '@bernierllc/test',
        workspaceRoot: testWorkspace
      });

      expect(result).toBeNull();
    });
  });

  describe('queryMcpForPlan', () => {
    it('should return plan content when package plan is registered in MCP', async () => {
      // This test will use a mock MCP response
      const mockPlanContent = '# OpenAI Client Plan\n\nThis is a test plan.';

      // TODO: Mock MCP call here when implementation is ready
      // For now, we expect null since it's a stub
      const result = await queryMcpForPlan({
        packageName: '@bernierllc/openai-client'
      });

      // Once MCP is implemented, this should return mockPlanContent
      // For now, stub returns null
      expect(result).toBeNull();
    });

    it('should return null when package plan is not found in MCP', async () => {
      // TODO: Mock MCP call here when implementation is ready
      const result = await queryMcpForPlan({
        packageName: '@bernierllc/nonexistent-package'
      });

      expect(result).toBeNull();
    });

    it('should throw error if packageName is empty', async () => {
      await expect(
        queryMcpForPlan({
          packageName: ''
        })
      ).rejects.toThrow('packageName cannot be empty');
    });

    it('should throw error if packageName is only whitespace', async () => {
      await expect(
        queryMcpForPlan({
          packageName: '   '
        })
      ).rejects.toThrow('packageName cannot be empty');
    });
  });
});
