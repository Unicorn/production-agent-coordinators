import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { searchLocalPlans, queryMcpForPlan, validatePlan, registerPlanWithMcp, generatePlanForPackage, discoverPackagesNeedingPlans } from '../planning.activities';
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

  describe('validatePlan', () => {
    let testWorkspace: string;

    beforeEach(() => {
      // Create a temporary test workspace
      testWorkspace = `/tmp/test-plan-validate-${Date.now()}`;
      fs.mkdirSync(testWorkspace, { recursive: true });
    });

    afterEach(() => {
      // Clean up test workspace
      if (fs.existsSync(testWorkspace)) {
        fs.rmSync(testWorkspace, { recursive: true, force: true });
      }
    });

    it('should pass validation for plan file with all required sections', async () => {
      // Setup: Create a plan file with all required sections
      const planPath = path.join(testWorkspace, 'complete-plan.md');
      const planContent = `# Complete Plan

## Overview
This is a complete plan with all required sections.

## Requirements
- Requirement 1
- Requirement 2

## Implementation
Implementation steps:
1. Step 1
2. Step 2

## Testing
Testing approach:
- Unit tests
- Integration tests
`;
      fs.writeFileSync(planPath, planContent);

      const result = await validatePlan({ planPath });

      expect(result.passed).toBe(true);
      expect(result.missingSections).toEqual([]);
      expect(result.foundSections).toContain('Overview');
      expect(result.foundSections).toContain('Requirements');
      expect(result.foundSections).toContain('Implementation');
      expect(result.foundSections).toContain('Testing');
    });

    it('should fail validation for plan file with missing sections', async () => {
      // Setup: Create a plan file missing Requirements and Testing sections
      const planPath = path.join(testWorkspace, 'incomplete-plan.md');
      const planContent = `# Incomplete Plan

## Overview
This plan is missing some required sections.

## Implementation
Implementation steps:
1. Step 1
2. Step 2
`;
      fs.writeFileSync(planPath, planContent);

      const result = await validatePlan({ planPath });

      expect(result.passed).toBe(false);
      expect(result.missingSections).toContain('Requirements');
      expect(result.missingSections).toContain('Testing');
      expect(result.foundSections).toContain('Overview');
      expect(result.foundSections).toContain('Implementation');
    });

    it('should handle section name variations (case-insensitive)', async () => {
      // Setup: Create a plan file with section name variations
      const planPath = path.join(testWorkspace, 'varied-plan.md');
      const planContent = `# Plan with Variations

## description
Overview content here.

## scope
Requirements content here.

## tasks
Implementation content here.

## tests
Testing content here.
`;
      fs.writeFileSync(planPath, planContent);

      const result = await validatePlan({ planPath });

      expect(result.passed).toBe(true);
      expect(result.missingSections).toEqual([]);
    });

    it('should fail validation for empty plan file', async () => {
      // Setup: Create an empty plan file
      const planPath = path.join(testWorkspace, 'empty-plan.md');
      fs.writeFileSync(planPath, '');

      const result = await validatePlan({ planPath });

      expect(result.passed).toBe(false);
      expect(result.missingSections.length).toBeGreaterThan(0);
      expect(result.foundSections).toEqual([]);
    });

    it('should throw error for invalid file path (file does not exist)', async () => {
      const nonExistentPath = path.join(testWorkspace, 'nonexistent-plan.md');

      await expect(
        validatePlan({ planPath: nonExistentPath })
      ).rejects.toThrow('planPath does not exist');
    });

    it('should throw error if planPath is empty', async () => {
      await expect(
        validatePlan({ planPath: '' })
      ).rejects.toThrow('planPath cannot be empty');
    });

    it('should throw error if planPath is only whitespace', async () => {
      await expect(
        validatePlan({ planPath: '   ' })
      ).rejects.toThrow('planPath cannot be empty');
    });

    it('should recognize alternative section names (Description for Overview)', async () => {
      // Setup: Create a plan file with alternative section names
      const planPath = path.join(testWorkspace, 'alternative-plan.md');
      const planContent = `# Plan with Alternative Names

## Description
This is the description/overview section.

## Requirements
Requirements content here.

## Implementation
Implementation content here.

## Testing
Testing content here.
`;
      fs.writeFileSync(planPath, planContent);

      const result = await validatePlan({ planPath });

      expect(result.passed).toBe(true);
      expect(result.missingSections).toEqual([]);
    });

    it('should handle nested headers correctly', async () => {
      // Setup: Create a plan file with nested headers
      const planPath = path.join(testWorkspace, 'nested-plan.md');
      const planContent = `# Main Plan Title

## Overview
Overview content.

### Sub-section
This is a subsection under Overview.

## Requirements
Requirements content.

## Implementation
Implementation content.

### Implementation Details
Nested details.

## Testing
Testing content.
`;
      fs.writeFileSync(planPath, planContent);

      const result = await validatePlan({ planPath });

      expect(result.passed).toBe(true);
      expect(result.missingSections).toEqual([]);
    });

    it('should handle plans with only some required sections', async () => {
      // Setup: Create a plan file with only Overview
      const planPath = path.join(testWorkspace, 'minimal-plan.md');
      const planContent = `# Minimal Plan

## Overview
This plan only has an overview.
`;
      fs.writeFileSync(planPath, planContent);

      const result = await validatePlan({ planPath });

      expect(result.passed).toBe(false);
      expect(result.missingSections).toContain('Requirements');
      expect(result.missingSections).toContain('Implementation');
      expect(result.missingSections).toContain('Testing');
      expect(result.foundSections).toContain('Overview');
    });
  });

  describe('registerPlanWithMcp', () => {
    it('should return true for successful plan registration', async () => {
      // This test uses a stub implementation
      // TODO: Mock MCP call here when implementation is ready
      const result = await registerPlanWithMcp({
        packageName: '@bernierllc/openai-client',
        planContent: '# OpenAI Client Plan\n\nThis is a test plan.'
      });

      // Stub implementation returns true
      expect(result).toBe(true);
    });

    it('should return true for registration (stub implementation)', async () => {
      // This test verifies the stub behavior
      // TODO: Update when actual MCP implementation is ready to test actual registration
      const result = await registerPlanWithMcp({
        packageName: '@bernierllc/test-package',
        planContent: '# Test Package Plan\n\n## Overview\nTest content.'
      });

      expect(result).toBe(true);
    });

    it('should throw error if packageName is empty', async () => {
      await expect(
        registerPlanWithMcp({
          packageName: '',
          planContent: '# Plan Content'
        })
      ).rejects.toThrow('packageName cannot be empty');
    });

    it('should throw error if packageName is only whitespace', async () => {
      await expect(
        registerPlanWithMcp({
          packageName: '   ',
          planContent: '# Plan Content'
        })
      ).rejects.toThrow('packageName cannot be empty');
    });

    it('should throw error if planContent is empty', async () => {
      await expect(
        registerPlanWithMcp({
          packageName: '@bernierllc/test-package',
          planContent: ''
        })
      ).rejects.toThrow('planContent cannot be empty');
    });

    it('should throw error if planContent is only whitespace', async () => {
      await expect(
        registerPlanWithMcp({
          packageName: '@bernierllc/test-package',
          planContent: '   '
        })
      ).rejects.toThrow('planContent cannot be empty');
    });
  });

  describe('generatePlanForPackage', () => {
    it('should generate plan and register with MCP', async () => {
      // Mock MCP calls
      global.fetch = vi.fn();

      // Mock packages_get_dependencies
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => `event: message\ndata: ${JSON.stringify({
          jsonrpc: '2.0',
          result: {
            content: [{
              type: 'text',
              text: JSON.stringify({
                dependencies: [
                  { package_name: '@bernierllc/webhook-receiver' }
                ]
              })
            }]
          }
        })}`
      });

      // Mock packages_update (plan registration)
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => `event: message\ndata: ${JSON.stringify({
          jsonrpc: '2.0',
          result: {
            content: [{ type: 'text', text: JSON.stringify({ success: true }) }]
          }
        })}`
      });

      await generatePlanForPackage({
        packageName: '@bernierllc/github-parser',
        requestedBy: 'build-workflow-123'
      });

      // Verify MCP was called for registration
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('discoverPackagesNeedingPlans', () => {
    it('should query MCP for packages in planning status with no plan', async () => {
      global.fetch = vi.fn();

      // Mock packages_query
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => `event: message\ndata: ${JSON.stringify({
          jsonrpc: '2.0',
          result: {
            content: [{
              type: 'text',
              text: JSON.stringify({
                packages: [
                  { id: '@bernierllc/package-a', plan_file_path: null },
                  { id: '@bernierllc/package-b', plan_file_path: null }
                ]
              })
            }]
          }
        })}`
      });

      const result = await discoverPackagesNeedingPlans();

      expect(result).toEqual(['@bernierllc/package-a', '@bernierllc/package-b']);
    });
  });
});
