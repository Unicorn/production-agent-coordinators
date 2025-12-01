/**
 * End-to-End Tests for CLI Agent Integration
 *
 * These tests validate the complete CLI agent integration in PackageBuildWorkflow.
 * They require:
 * - Gemini CLI installed and authenticated
 * - Claude CLI installed and authenticated
 * - Temporal server running
 * - Worker running with CLI activities
 *
 * Run with: yarn test cli-integration.e2e.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, Connection } from '@temporalio/client';
import { PackageBuildWorkflow } from '../workflows/package-build.workflow.js';
import type { PackageBuildInput } from '../types/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';

// Test configuration
const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS || 'localhost:7233';
const TEMPORAL_NAMESPACE = process.env.TEMPORAL_NAMESPACE || 'default';
const TEST_WORKSPACE_ROOT = path.join(process.cwd(), 'test-workspace');

// Test package specification
const TEST_PACKAGE_SPEC = {
  name: '@test/simple-package',
  description: 'A simple test package for CLI integration testing',
  version: '0.1.0',
  category: 'test' as const,
  dependencies: [],
};

// Minimal package plan content
const TEST_PLAN_CONTENT = `# Test Package Plan

## Package Overview
- Name: ${TEST_PACKAGE_SPEC.name}
- Description: ${TEST_PACKAGE_SPEC.description}
- Version: ${TEST_PACKAGE_SPEC.version}

## Architecture
- Single entry point: src/index.ts
- Export a simple function: \`greet(name: string): string\`

## Implementation
Create a simple greeting function that returns "Hello, {name}!"
`;

// Minimal requirements content
const TEST_REQUIREMENTS_CONTENT = `# BernierLLC Package Requirements

## TypeScript Configuration
- Strict mode enabled
- ES2020 target
- Generate .d.ts files

## Quality Gates
- ESLint with zero warnings
- Jest with 80%+ coverage
- All public exports must have TSDoc comments

## Package Structure
- Entry point: src/index.ts
- Tests in __tests__/ directory
`;

describe('CLI Agent Integration - End-to-End', () => {
  let client: Client;
  let connection: Connection;
  let testPackagePath: string;

  beforeAll(async () => {
    // Check CLI availability
    try {
      execSync('gemini --version', { stdio: 'ignore' });
      console.log('✅ Gemini CLI available');
    } catch (error) {
      console.warn('⚠️  Gemini CLI not found - some tests will be skipped');
    }

    try {
      execSync('claude --version', { stdio: 'ignore' });
      console.log('✅ Claude CLI available');
    } catch (error) {
      console.warn('⚠️  Claude CLI not found - some tests will be skipped');
    }

    // Connect to Temporal
    connection = await Connection.connect({
      address: TEMPORAL_ADDRESS,
      namespace: TEMPORAL_NAMESPACE,
    });

    client = new Client({ connection });

    // Create test workspace
    testPackagePath = path.join(TEST_WORKSPACE_ROOT, 'packages', 'test', 'simple-package');
    await fs.mkdir(testPackagePath, { recursive: true });

    // Create plan file
    const planPath = path.join(TEST_WORKSPACE_ROOT, 'plans', 'test', 'simple-package.md');
    await fs.mkdir(path.dirname(planPath), { recursive: true });
    await fs.writeFile(planPath, TEST_PLAN_CONTENT, 'utf-8');

    // Create requirements file
    const requirementsPath = path.join(TEST_WORKSPACE_ROOT, 'docs', 'PACKAGE_REQUIREMENTS.md');
    await fs.mkdir(path.dirname(requirementsPath), { recursive: true });
    await fs.writeFile(requirementsPath, TEST_REQUIREMENTS_CONTENT, 'utf-8');
  });

  afterAll(async () => {
    // Cleanup test workspace
    try {
      await fs.rm(TEST_WORKSPACE_ROOT, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup test workspace:', error);
    }

    // Close Temporal connection
    await connection.close();
  });

  describe('Basic CLI Agent Execution', () => {
    it('should execute Gemini CLI agent for scaffold task', async () => {
      // Skip if CLI not available
      try {
        execSync('gemini --version', { stdio: 'ignore' });
      } catch {
        console.log('⏭️  Skipping: Gemini CLI not available');
        return;
      }

      const input: PackageBuildInput = {
        packageName: TEST_PACKAGE_SPEC.name,
        packagePath: path.relative(TEST_WORKSPACE_ROOT, testPackagePath),
        planPath: 'plans/test/simple-package.md',
        workspaceRoot: TEST_WORKSPACE_ROOT,
        category: 'test',
        dependencies: [],
      };

      const handle = await client.workflow.start(PackageBuildWorkflow, {
        taskQueue: 'engine',
        args: [input],
        workflowId: `test-gemini-scaffold-${Date.now()}`,
      });

      // Wait for workflow to complete (with timeout)
      const result = await Promise.race([
        handle.result(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Workflow timeout')), 600000) // 10 min timeout
        ),
      ]);

      expect(result).toBeDefined();
      // Add more assertions based on actual result structure
    }, 600000); // 10 minute timeout

    it('should execute Claude CLI agent for scaffold task', async () => {
      // Skip if CLI not available
      try {
        execSync('claude --version', { stdio: 'ignore' });
      } catch {
        console.log('⏭️  Skipping: Claude CLI not available');
        return;
      }

      // Similar test for Claude
      // Force Claude by setting provider preference
      const input: PackageBuildInput = {
        packageName: TEST_PACKAGE_SPEC.name,
        packagePath: path.relative(TEST_WORKSPACE_ROOT, testPackagePath),
        planPath: 'plans/test/simple-package.md',
        workspaceRoot: TEST_WORKSPACE_ROOT,
        category: 'test',
        dependencies: [],
        // TODO: Add provider preference when implemented
      };

      const handle = await client.workflow.start(PackageBuildWorkflow, {
        taskQueue: 'engine',
        args: [input],
        workflowId: `test-claude-scaffold-${Date.now()}`,
      });

      const result = await Promise.race([
        handle.result(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Workflow timeout')), 600000)
        ),
      ]);

      expect(result).toBeDefined();
    }, 600000);
  });

  describe('Provider Selection and Fallback', () => {
    it('should select Gemini when both providers are available', async () => {
      // This would test the ProviderFactory logic
      // For now, we'll verify the workflow uses a provider
      // TODO: Add explicit provider selection test
    });

    it('should fallback to Claude when Gemini fails', async () => {
      // This would test the fallback mechanism
      // TODO: Add fallback test with simulated Gemini failure
    });
  });

  describe('Resume Capability', () => {
    it('should detect partial build and resume', async () => {
      // Create partial package (package.json exists, src/ missing)
      const packageJsonPath = path.join(testPackagePath, 'package.json');
      await fs.writeFile(
        packageJsonPath,
        JSON.stringify({
          name: TEST_PACKAGE_SPEC.name,
          version: TEST_PACKAGE_SPEC.version,
          description: TEST_PACKAGE_SPEC.description,
        }),
        'utf-8'
      );

      const input: PackageBuildInput = {
        packageName: TEST_PACKAGE_SPEC.name,
        packagePath: path.relative(TEST_WORKSPACE_ROOT, testPackagePath),
        planPath: 'plans/test/simple-package.md',
        workspaceRoot: TEST_WORKSPACE_ROOT,
        category: 'test',
        dependencies: [],
      };

      const handle = await client.workflow.start(PackageBuildWorkflow, {
        taskQueue: 'engine',
        args: [input],
        workflowId: `test-resume-${Date.now()}`,
      });

      const result = await Promise.race([
        handle.result(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Workflow timeout')), 600000)
        ),
      ]);

      // Verify resume was detected and used
      expect(result).toBeDefined();
      // TODO: Verify resume instructions were used
    }, 600000);
  });

  describe('End-to-End Package Build', () => {
    it('should complete full package build with Gemini CLI', async () => {
      // Skip if CLI not available
      try {
        execSync('gemini --version', { stdio: 'ignore' });
      } catch {
        console.log('⏭️  Skipping: Gemini CLI not available');
        return;
      }

      // Clean package directory
      await fs.rm(testPackagePath, { recursive: true, force: true });
      await fs.mkdir(testPackagePath, { recursive: true });

      const input: PackageBuildInput = {
        packageName: TEST_PACKAGE_SPEC.name,
        packagePath: path.relative(TEST_WORKSPACE_ROOT, testPackagePath),
        planPath: 'plans/test/simple-package.md',
        workspaceRoot: TEST_WORKSPACE_ROOT,
        category: 'test',
        dependencies: [],
      };

      const handle = await client.workflow.start(PackageBuildWorkflow, {
        taskQueue: 'engine',
        args: [input],
        workflowId: `test-e2e-gemini-${Date.now()}`,
      });

      const result = await Promise.race([
        handle.result(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Workflow timeout')), 600000)
        ),
      ]) as { success: boolean; packageName: string; report: unknown };

      expect(result.success).toBe(true);
      expect(result.packageName).toBe(TEST_PACKAGE_SPEC.name);

      // Verify package files were created
      const indexFile = path.join(testPackagePath, 'src', 'index.ts');
      const indexExists = await fs
        .access(indexFile)
        .then(() => true)
        .catch(() => false);
      expect(indexExists).toBe(true);
    }, 600000);
  });
});

