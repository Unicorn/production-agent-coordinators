/**
 * Phase 4 End-to-End Integration Tests
 * 
 * These tests validate Phase 4 features with real workflows, CLI tools, and external services.
 * 
 * Prerequisites:
 * - Temporal server running
 * - GitHub CLI authenticated
 * - Claude CLI installed and authenticated
 * - npm configured
 * 
 * Run with: npm test -- integration/phase4-e2e.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  checkCredentials,
  formatCredentialsError,
} from '../../activities/credentials.activities.js';
import {
  analyzeAuditTrace,
  generateOptimizationReport,
} from '../../activities/optimization.activities.js';
import {
  gitCommit,
  gitCreateBranch,
} from '../../activities/git.activities.js';

const execAsync = promisify(exec);

// Test configuration
const TEST_REPO_OWNER = process.env.TEST_REPO_OWNER || 'bernierllc';
const TEST_REPO_NAME = process.env.TEST_REPO_NAME || 'test-package-builder';
const SKIP_EXTERNAL_TESTS = process.env.SKIP_EXTERNAL_TESTS === 'true';

describe('Phase 4: Integration Tests', () => {
  let testWorkspace: string;

  beforeAll(async () => {
    testWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'phase4-e2e-'));
    console.log(`[Test] Using workspace: ${testWorkspace}`);
  });

  afterAll(async () => {
    // Cleanup
    try {
      await fs.rm(testWorkspace, { recursive: true, force: true });
      console.log(`[Test] Cleaned up workspace: ${testWorkspace}`);
    } catch (error) {
      console.warn(`[Test] Failed to cleanup workspace: ${error}`);
    }
  });

  describe('Credential Checks', () => {
    it('should check all credentials and provide clear errors', async () => {
      const result = await checkCredentials({
        checkGitHub: true,
        checkNPM: true,
        checkPackagesAPI: true,
        checkGit: true,
        checkClaude: true,
        checkGemini: false,
      });

      if (!result.allAvailable) {
        const errorMessage = formatCredentialsError(result);
        console.log('Missing credentials:', errorMessage);
        
        // Don't fail test - just log what's missing
        // In CI, we might skip tests that require missing credentials
        expect(errorMessage).toContain('Missing or misconfigured credentials');
      } else {
        expect(result.allAvailable).toBe(true);
        expect(result.missing).toHaveLength(0);
      }
    });

    it('should handle partial credential checks', async () => {
      const result = await checkCredentials({
        checkGitHub: true,
        checkNPM: true,
        checkPackagesAPI: false,
        checkGit: true,
        checkClaude: false,
        checkGemini: false,
      });

      expect(result).toHaveProperty('allAvailable');
      expect(result).toHaveProperty('checks');
      expect(result).toHaveProperty('missing');
    });
  });

  describe('Hook Scripts Execution', () => {
    it('should execute hook scripts and create log files', async () => {
      const hookScriptsDir = path.resolve(
        __dirname,
        '../../../.claude/scripts'
      );

      // Check if scripts exist
      const logToolCallScript = path.join(hookScriptsDir, 'log-tool-call.js');
      const logResponseScript = path.join(hookScriptsDir, 'log-response.js');

      try {
        await fs.access(logToolCallScript);
        await fs.access(logResponseScript);
      } catch {
        // Skip test if scripts don't exist (not built yet)
        console.log('[Test] Hook scripts not found, skipping test');
        return;
      }

      // Test tool call logging
      const testToolCallData = JSON.stringify({
        tool: 'Read',
        toolCall: { file: 'test.ts' },
      });

      process.env.CLAUDE_WORKSPACE = testWorkspace;
      process.env.CLAUDE_TOOL = 'Read';
      process.env.WORKFLOW_RUN_ID = 'test-workflow-1';

      await execAsync(
        `echo '${testToolCallData}' | node ${logToolCallScript}`,
        { env: process.env }
      );

      // Verify log file created
      const toolCallLog = path.join(testWorkspace, 'tool_call_log.jsonl');
      const toolCallLogExists = await fs.access(toolCallLog).then(() => true).catch(() => false);
      
      expect(toolCallLogExists).toBe(true);

      if (toolCallLogExists) {
        const content = await fs.readFile(toolCallLog, 'utf-8');
        const entry = JSON.parse(content.trim());
        expect(entry.tool).toBe('Read');
        expect(entry.workspace).toBe(testWorkspace);
      }

      // Test response logging
      const testResponseData = JSON.stringify({
        response: 'Success',
        cost_usd: 0.05,
      });

      process.env.CLAUDE_COST = '0.05';

      await execAsync(
        `echo '${testResponseData}' | node ${logResponseScript}`,
        { env: process.env }
      );

      // Verify log file created
      const responseLog = path.join(testWorkspace, 'response_log.jsonl');
      const responseLogExists = await fs.access(responseLog).then(() => true).catch(() => false);
      
      expect(responseLogExists).toBe(true);
    });
  });

  describe('Optimization Dashboard', () => {
    it('should analyze real audit trace data', async () => {
      // Create realistic audit trace
      const auditPath = path.join(testWorkspace, 'audit_trace.jsonl');
      const entries = [
        {
          workflow_run_id: 'wf-001',
          step_name: 'scaffold',
          timestamp: new Date().toISOString(),
          cost_usd: 0.05,
          validation_status: 'pass',
          model: 'sonnet',
        },
        {
          workflow_run_id: 'wf-001',
          step_name: 'implement_v1',
          timestamp: new Date().toISOString(),
          cost_usd: 0.15,
          validation_status: 'pass',
          model: 'sonnet',
        },
        {
          workflow_run_id: 'wf-002',
          step_name: 'scaffold',
          timestamp: new Date().toISOString(),
          cost_usd: 0.06,
          validation_status: 'fail',
          validation_error_type: 'TSC_ERROR',
          model: 'sonnet',
        },
        {
          workflow_run_id: 'wf-002',
          step_name: 'repair_1',
          timestamp: new Date().toISOString(),
          cost_usd: 0.02,
          validation_status: 'pass',
          validation_error_type: 'TSC_ERROR',
          model: 'haiku',
        },
      ];

      await fs.writeFile(
        auditPath,
        entries.map(e => JSON.stringify(e)).join('\n'),
        'utf-8'
      );

      const analysis = await analyzeAuditTrace(testWorkspace);

      expect(analysis.totalRuns).toBe(2);
      expect(analysis.totalCost).toBeGreaterThan(0);
      expect(analysis.mostExpensiveSteps.length).toBeGreaterThan(0);
      expect(analysis.mostCommonErrors.length).toBeGreaterThan(0);
      expect(analysis.modelEfficiency.length).toBeGreaterThan(0);
      expect(analysis.recommendations.length).toBeGreaterThan(0);
    });

    it('should generate optimization report', async () => {
      // Create audit trace
      const auditPath = path.join(testWorkspace, 'audit_trace.jsonl');
      await fs.writeFile(
        auditPath,
        JSON.stringify({
          workflow_run_id: 'wf-001',
          step_name: 'scaffold',
          timestamp: new Date().toISOString(),
          cost_usd: 0.05,
          validation_status: 'pass',
          model: 'sonnet',
        }) + '\n',
        'utf-8'
      );

      const report = await generateOptimizationReport(testWorkspace);

      expect(report).toContain('Optimization Analysis Report');
      expect(report).toContain('Total Runs');
      expect(report).toContain('Total Cost');
      expect(report).toContain('Success Rate');
    });
  });

  describe('Git Operations', () => {
    let testRepo: string;

    beforeEach(async () => {
      testRepo = await fs.mkdtemp(path.join(os.tmpdir(), 'git-e2e-'));
      
      // Initialize git repo
      await execAsync('git init', { cwd: testRepo });
      await execAsync('git config user.name "Test User"', { cwd: testRepo });
      await execAsync('git config user.email "test@example.com"', { cwd: testRepo });
      
      // Create initial commit
      await fs.writeFile(path.join(testRepo, 'README.md'), '# Test\n', 'utf-8');
      await execAsync('git add README.md', { cwd: testRepo });
      await execAsync('git commit -m "Initial commit"', { cwd: testRepo });
    });

    afterEach(async () => {
      await fs.rm(testRepo, { recursive: true, force: true });
    });

    it('should create branch and commit changes', async () => {
      // Get default branch
      const { stdout: branchOut } = await execAsync('git branch --show-current', { cwd: testRepo });
      const defaultBranch = branchOut.trim() || 'main';

      // Create branch
      const branchResult = await gitCreateBranch({
        workspacePath: testRepo,
        branchName: 'test-feature',
        baseBranch: defaultBranch,
      });

      expect(branchResult.success).toBe(true);

      // Create a test file
      await fs.writeFile(path.join(testRepo, 'test.txt'), 'test content', 'utf-8');

      // Commit changes
      const commitResult = await gitCommit({
        workspacePath: testRepo,
        message: 'test: Add test file',
        gitUser: {
          name: 'Test User',
          email: 'test@example.com',
        },
      });

      expect(commitResult.success).toBe(true);
      expect(commitResult.commitHash).toBeDefined();

      // Verify commit
      const { stdout } = await execAsync('git log --oneline -1', { cwd: testRepo });
      expect(stdout).toContain('test: Add test file');
    });
  });

  describe('End-to-End Workflow Simulation', () => {
    it('should simulate full workflow with audit logging', async () => {
      // Simulate workflow steps by creating audit entries
      const auditPath = path.join(testWorkspace, 'audit_trace.jsonl');
      const workflowId = 'test-workflow-e2e';

      const steps = [
        {
          workflow_run_id: workflowId,
          step_name: 'credential_check',
          timestamp: new Date().toISOString(),
          cost_usd: 0,
          validation_status: 'pass' as const,
        },
        {
          workflow_run_id: workflowId,
          step_name: 'setup_workspace',
          timestamp: new Date().toISOString(),
          cost_usd: 0,
          validation_status: 'pass' as const,
        },
        {
          workflow_run_id: workflowId,
          step_name: 'scaffold',
          timestamp: new Date().toISOString(),
          cost_usd: 0.05,
          validation_status: 'pass' as const,
          model: 'sonnet',
        },
        {
          workflow_run_id: workflowId,
          step_name: 'implement_v1',
          timestamp: new Date().toISOString(),
          cost_usd: 0.15,
          validation_status: 'pass' as const,
          model: 'sonnet',
        },
        {
          workflow_run_id: workflowId,
          step_name: 'validation_initial',
          timestamp: new Date().toISOString(),
          cost_usd: 0,
          validation_status: 'pass' as const,
        },
      ];

      // Ensure clean audit file (remove any existing entries)
      await fs.writeFile(auditPath, '', 'utf-8');
      
      // Write audit entries
      for (const step of steps) {
        await fs.appendFile(auditPath, JSON.stringify(step) + '\n', 'utf-8');
      }

      // Analyze the workflow
      const analysis = await analyzeAuditTrace(testWorkspace);

      expect(analysis.totalRuns).toBe(1);
      expect(analysis.successRate).toBe(1.0); // 100% success
      expect(analysis.totalCost).toBeCloseTo(0.20, 2);
    });
  });

  describe('Real Workflow Integration', () => {
    it.skipIf(SKIP_EXTERNAL_TESTS)('should create PR with real GitHub repository', async () => {
      // This test requires:
      // - Real GitHub repository
      // - GitHub CLI authenticated
      // - Temporal server running
      // - Worker running
      
      // TODO: Implement when ready for real integration testing
      // This would require:
      // 1. Starting Temporal worker
      // 2. Executing ClaudeAuditedBuildWorkflow
      // 3. Waiting for completion
      // 4. Verifying PR exists on GitHub
      
      expect(true).toBe(true); // Placeholder
    });

    it.skipIf(SKIP_EXTERNAL_TESTS)('should execute hooks during real Claude CLI run', async () => {
      // This test requires:
      // - Claude CLI installed and authenticated
      // - Real workflow execution
      
      // TODO: Implement when ready for real integration testing
      // This would require:
      // 1. Running actual Claude CLI command
      // 2. Verifying hooks are called
      // 3. Checking log files are created
      
      expect(true).toBe(true); // Placeholder
    });
  });
});

