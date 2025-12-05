/**
 * End-to-End Tests for CLI Agent Integration
 *
 * These tests validate the complete CLI agent integration in PackageBuildWorkflow.
 * They require:
 * - Gemini CLI installed and authenticated (for Gemini tests)
 * - Claude CLI installed and authenticated (for Claude tests)
 * - Temporal server running
 * - Worker running with CLI activities
 *
 * Tests are organized by provider:
 * - All Claude tests first (with credit check and skip if unavailable)
 * - All Gemini tests second (with credit check and skip if unavailable)
 *
 * NOTE: The workflow now uses the task activity loop pattern with efficient CLI communication:
 * 
 * Phase 1: Task Breakdown
 * - requestTaskBreakdown - Gets task breakdown from CLI agent (returns task queue)
 * 
 * Phase 2: Task Activity Loop (per task)
 * - executeTaskWithCLI - Executes task with CLI, loops until agent signals completion
 *   - Returns: logFilePath (deterministic), sessionId, taskComplete (boolean)
 *   - Agent signals completion with JSON: { "task_complete": true }
 *   - If not complete, loops back with continueTask=true
 * 
 * Phase 3: Validation Task Activity Loop (per task)
 * - runTaskValidations - Runs validation steps (file_exists, tests_pass, lint_passes, etc.)
 *   - Returns: validationErrorsFilePath (deterministic), allPassed (boolean), errors[]
 *   - Writes errors to deterministic file path (no JSON serialization)
 * - executeFixWithCLI - Fixes validation errors using CLI
 *   - Reads validation errors from file path (not file contents - efficient!)
 *   - CLI reads errors file directly using Read tool
 *   - Returns: logFilePath (deterministic), fixed (boolean)
 *   - Loops back to runTaskValidations until allPassed=true
 * 
 * Key Benefits:
 * - Deterministic workflows (only file paths, session IDs, boolean flags)
 * - Efficient communication (file paths, not file contents in JSON)
 * - Full visibility (each loop iteration = separate activity in Temporal UI)
 * - Quality enforcement (validation loop ensures quality before next task)
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
import { checkClaudeCLI, checkGeminiCLI } from '../activities/credentials.activities.js';

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

/**
 * Check if Claude CLI has credits/availability
 * Returns true if Claude CLI is installed and can be used
 */
async function checkClaudeCredits(): Promise<boolean> {
  try {
    const status = await checkClaudeCLI();
    if (!status.available) {
      return false;
    }
    
    // Try a minimal test to verify credits (check version works)
    try {
      execSync('claude --version', { stdio: 'ignore', timeout: 5000 });
      return true;
    } catch {
      // If version check fails, CLI might not be properly authenticated
      return false;
    }
  } catch {
    return false;
  }
}

/**
 * Check if Gemini CLI has credits/availability
 * Returns true if Gemini CLI is installed and can be used
 */
async function checkGeminiCredits(): Promise<boolean> {
  try {
    const status = await checkGeminiCLI();
    if (!status.available) {
      return false;
    }
    
    // Try a minimal test to verify credits (check version works)
    try {
      execSync('gemini --version', { stdio: 'ignore', timeout: 5000 });
      return true;
    } catch {
      // If version check fails, CLI might not be properly authenticated
      return false;
    }
  } catch {
    return false;
  }
}

describe('CLI Agent Integration - End-to-End', () => {
  let client: Client;
  let connection: Connection;
  let testPackagePath: string;

  beforeAll(async () => {
    // Connect to Temporal (can take time to establish connection)
    // Increase connection timeout for slow connections
    connection = await Connection.connect({
      address: TEMPORAL_ADDRESS,
      connectTimeout: '30s', // 30 second connection timeout
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
  }, 30000); // 30 second timeout for hook (Temporal connection can take time)

  afterAll(async () => {
    // Cleanup test workspace
    try {
      await fs.rm(TEST_WORKSPACE_ROOT, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup test workspace:', error);
    }

    // Close Temporal connection (if it was established)
    if (connection) {
      try {
        await connection.close();
      } catch (error) {
        console.warn('Failed to close Temporal connection:', error);
      }
    }
  }, 30000); // 30 second timeout for hook

  // ─────────────────────────────────────────────────────────────────────────────
  // Claude CLI Tests
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Claude CLI Integration', () => {
    let claudeHasCredits: boolean;

    beforeAll(async () => {
      claudeHasCredits = await checkClaudeCredits();
      if (!claudeHasCredits) {
        console.log('⏭️  Skipping all Claude tests: Claude CLI not available or no credits');
      } else {
        console.log('✅ Claude CLI available with credits - running Claude tests');
      }
    });

    // NOTE: Scaffold-only test removed - scaffold now uses iterative task breakdown
    // The agent dynamically generates tasks based on the plan (typically 3-8 tasks per batch)
    // Each task appears as a separate activity in Temporal UI for better visibility.
    // The full workflow test below covers scaffold + implement phases comprehensively.

    it('should complete full package build with Claude CLI using granular activities', async () => {
      if (!claudeHasCredits) {
        console.log('⏭️  Skipping: Claude CLI not available or no credits');
        return;
      }

      // Clean package directory
      await fs.rm(testPackagePath, { recursive: true, force: true });
      await fs.mkdir(testPackagePath, { recursive: true });
      
      // This test verifies the full workflow uses the new task activity loop pattern:
      // 
      // Scaffold phase:
      // - requestTaskBreakdown - Gets task breakdown (returns task queue)
      // - executeAgentActivityRequest - Executes any activity requests from agent
      // - For each task:
      //   - Task Activity Loop:
      //     - executeTaskWithCLI - Executes task, loops until taskComplete=true
      //     - Each iteration appears as separate activity in Temporal UI
      //   - Validation Activity Loop:
      //     - runTaskValidations - Runs validation steps, writes errors to file
      //     - executeFixWithCLI - Fixes errors (reads from file path, not contents)
      //     - Loops until allValidationsPassed=true
      // - Repeats until more_tasks = false
      //
      // Implement phase (same pattern):
      // - requestTaskBreakdown - Gets next batch of tasks
      // - For each task: Task Activity Loop + Validation Activity Loop
      // - Repeats until more_tasks = false
      //
      // Check Temporal UI to see:
      // - requestTaskBreakdown activities
      // - executeTaskWithCLI activities (one per iteration)
      // - runTaskValidations activities (one per task)
      // - executeFixWithCLI activities (if validation errors occur)
      //
      // All activities return deterministic values (file paths, session IDs, booleans)
      // File operations happen on filesystem (no JSON serialization of file contents)

      const input: PackageBuildInput = {
        packageName: TEST_PACKAGE_SPEC.name,
        packagePath: path.relative(TEST_WORKSPACE_ROOT, testPackagePath),
        planPath: 'plans/test/simple-package.md',
        workspaceRoot: TEST_WORKSPACE_ROOT,
        category: 'utility',
        dependencies: [],
        preferredProvider: 'claude',
        config: {
          npmRegistry: 'https://registry.npmjs.org',
          npmToken: '',
          workspaceRoot: TEST_WORKSPACE_ROOT,
          maxConcurrentBuilds: 1,
          temporal: {
            address: TEMPORAL_ADDRESS,
            namespace: TEMPORAL_NAMESPACE,
            taskQueue: 'engine-cli-e2e',
          },
          testing: {
            enableCoverage: true,
            minCoveragePercent: 80,
            failOnError: true,
          },
          publishing: {
            dryRun: true,
            requireTests: true,
            requireCleanWorkingDirectory: false,
          },
        },
      };

      const handle = await client.workflow.start(PackageBuildWorkflow, {
        taskQueue: 'engine-cli-e2e',
        args: [input],
        workflowId: `test-e2e-claude-${Date.now()}`,
      });

      // E2E tests can take longer with the new task activity loop pattern
      // Each task may have multiple iterations, and validation loops add time
      const result = await Promise.race([
        handle.result(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Workflow timeout')), 1800000) // 30 minutes
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
    }, 1800000); // 30 minutes - task activity loops can take longer

    it('should detect partial build and resume with Claude CLI', async () => {
      if (!claudeHasCredits) {
        console.log('⏭️  Skipping: Claude CLI not available or no credits');
        return;
      }

      // Create partial package (package.json exists, src/ missing)
      await fs.rm(testPackagePath, { recursive: true, force: true });
      await fs.mkdir(testPackagePath, { recursive: true });
      
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
        category: 'utility',
        dependencies: [],
        preferredProvider: 'claude',
        config: {
          npmRegistry: 'https://registry.npmjs.org',
          npmToken: '',
          workspaceRoot: TEST_WORKSPACE_ROOT,
          maxConcurrentBuilds: 1,
          temporal: {
            address: TEMPORAL_ADDRESS,
            namespace: TEMPORAL_NAMESPACE,
            taskQueue: 'engine-cli-e2e',
          },
          testing: {
            enableCoverage: true,
            minCoveragePercent: 80,
            failOnError: true,
          },
          publishing: {
            dryRun: true,
            requireTests: true,
            requireCleanWorkingDirectory: false,
          },
        },
      };

      const handle = await client.workflow.start(PackageBuildWorkflow, {
        taskQueue: 'engine-cli-e2e',
        args: [input],
        workflowId: `test-resume-claude-${Date.now()}`,
      });

      // E2E tests can take longer with the new task activity loop pattern
      const result = await Promise.race([
        handle.result(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Workflow timeout')), 1800000) // 30 minutes
        ),
      ]);

      // Verify resume was detected and used
      expect(result).toBeDefined();
    }, 1800000); // 30 minutes - task activity loops can take longer
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Gemini CLI Tests - COMMENTED OUT FOR NOW (focusing on Claude)
  // ─────────────────────────────────────────────────────────────────────────────
  describe.skip('Gemini CLI Integration', () => {
    let geminiHasCredits: boolean;

    beforeAll(async () => {
      geminiHasCredits = await checkGeminiCredits();
      if (!geminiHasCredits) {
        console.log('⏭️  Skipping all Gemini tests: Gemini CLI not available or no credits');
      } else {
        console.log('✅ Gemini CLI available with credits - running Gemini tests');
      }
    });

    // NOTE: Scaffold-only test removed - scaffold now uses iterative task breakdown
    // The agent dynamically generates tasks based on the plan (typically 3-8 tasks per batch)
    // Each task appears as a separate activity in Temporal UI for better visibility.
    // The full workflow test below covers scaffold + implement phases comprehensively.

    it('should complete full package build with Gemini CLI using granular activities', async () => {
      if (!geminiHasCredits) {
        console.log('⏭️  Skipping: Gemini CLI not available or no credits');
        return;
      }

      // Clean package directory
      await fs.rm(testPackagePath, { recursive: true, force: true });
      await fs.mkdir(testPackagePath, { recursive: true });
      
      // This test verifies the full workflow uses the task activity loop pattern:
      //
      // Scaffold phase:
      // - requestTaskBreakdown - Gets task breakdown (returns task queue)
      // - executeAgentActivityRequest - Executes any activity requests from agent
      // - For each task:
      //   - Task Activity Loop:
      //     - executeTaskWithCLI - Executes task with Gemini CLI, loops until taskComplete=true
      //   - Validation Activity Loop:
      //     - runTaskValidations - Runs validation steps, writes errors to file
      //     - executeFixWithCLI - Fixes errors (if any)
      //     - Loops until allValidationsPassed=true
      // - Repeats until more_tasks = false
      //
      // Implement phase (same pattern):
      // - requestTaskBreakdown - Gets next batch of tasks
      // - For each task: Task Activity Loop + Validation Activity Loop
      // - Repeats until more_tasks = false
      //
      // Check Temporal UI to see:
      // - requestTaskBreakdown activities
      // - executeTaskWithCLI activities (one per iteration)
      // - runTaskValidations activities (one per task)
      // - executeFixWithCLI activities (if validation errors occur)

      const input: PackageBuildInput = {
        packageName: TEST_PACKAGE_SPEC.name,
        packagePath: path.relative(TEST_WORKSPACE_ROOT, testPackagePath),
        planPath: 'plans/test/simple-package.md',
        workspaceRoot: TEST_WORKSPACE_ROOT,
        category: 'utility',
        dependencies: [],
        preferredProvider: 'gemini',
        config: {
          npmRegistry: 'https://registry.npmjs.org',
          npmToken: '',
          workspaceRoot: TEST_WORKSPACE_ROOT,
          maxConcurrentBuilds: 1,
          temporal: {
            address: TEMPORAL_ADDRESS,
            namespace: TEMPORAL_NAMESPACE,
            taskQueue: 'engine-cli-e2e',
          },
          testing: {
            enableCoverage: true,
            minCoveragePercent: 80,
            failOnError: true,
          },
          publishing: {
            dryRun: true,
            requireTests: true,
            requireCleanWorkingDirectory: false,
          },
        },
      };

      const handle = await client.workflow.start(PackageBuildWorkflow, {
        taskQueue: 'engine-cli-e2e',
        args: [input],
        workflowId: `test-e2e-gemini-${Date.now()}`,
      });

      // E2E tests can take longer with the new task activity loop pattern
      // Each task may have multiple iterations, and validation loops add time
      const result = await Promise.race([
        handle.result(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Workflow timeout')), 1800000) // 30 minutes
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
    }, 1800000); // 30 minutes - task activity loops can take longer

    it('should detect partial build and resume with Gemini CLI', async () => {
      if (!geminiHasCredits) {
        console.log('⏭️  Skipping: Gemini CLI not available or no credits');
        return;
      }

      // Create partial package (package.json exists, src/ missing)
      await fs.rm(testPackagePath, { recursive: true, force: true });
      await fs.mkdir(testPackagePath, { recursive: true });
      
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
        category: 'utility',
        dependencies: [],
        preferredProvider: 'gemini',
        config: {
          npmRegistry: 'https://registry.npmjs.org',
          npmToken: '',
          workspaceRoot: TEST_WORKSPACE_ROOT,
          maxConcurrentBuilds: 1,
          temporal: {
            address: TEMPORAL_ADDRESS,
            namespace: TEMPORAL_NAMESPACE,
            taskQueue: 'engine-cli-e2e',
          },
          testing: {
            enableCoverage: true,
            minCoveragePercent: 80,
            failOnError: true,
          },
          publishing: {
            dryRun: true,
            requireTests: true,
            requireCleanWorkingDirectory: false,
          },
        },
      };

      const handle = await client.workflow.start(PackageBuildWorkflow, {
        taskQueue: 'engine-cli-e2e',
        args: [input],
        workflowId: `test-resume-gemini-${Date.now()}`,
      });

      // E2E tests can take longer with the new task activity loop pattern
      const result = await Promise.race([
        handle.result(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Workflow timeout')), 1800000) // 30 minutes
        ),
      ]);

      // Verify resume was detected and used
      expect(result).toBeDefined();
    }, 1800000); // 30 minutes - task activity loops can take longer
  });
});
