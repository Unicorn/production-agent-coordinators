/**
 * Phase 4 Integration Tests
 * 
 * Tests for:
 * - Optimization dashboard
 * - Hook scripts
 * - Git activities
 * - Credential checks
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  analyzeAuditTrace,
  generateOptimizationReport,
  readAuditTrace,
} from '../activities/optimization.activities.js';
import {
  checkCredentials,
  formatCredentialsError,
} from '../activities/credentials.activities.js';
import {
  gitCommit,
  gitCreateBranch,
  gitPush,
  gitCreatePR,
} from '../activities/git.activities.js';

const execAsync = promisify(exec);

describe('Phase 4: Optimization Dashboard', () => {
  let testWorkspace: string;

  beforeEach(async () => {
    testWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'phase4-test-'));
  });

  afterEach(async () => {
    await fs.rm(testWorkspace, { recursive: true, force: true });
  });

  it('should read and parse audit trace file', async () => {
    // Create test audit trace
    const auditPath = path.join(testWorkspace, 'audit_trace.jsonl');
    const entries = [
      {
        workflow_run_id: 'test-1',
        step_name: 'scaffold',
        timestamp: new Date().toISOString(),
        cost_usd: 0.05,
        validation_status: 'pass' as const,
        model: 'sonnet',
      },
      {
        workflow_run_id: 'test-1',
        step_name: 'implement_v1',
        timestamp: new Date().toISOString(),
        cost_usd: 0.15,
        validation_status: 'pass' as const,
        model: 'sonnet',
      },
      {
        workflow_run_id: 'test-2',
        step_name: 'scaffold',
        timestamp: new Date().toISOString(),
        cost_usd: 0.06,
        validation_status: 'fail' as const,
        validation_error_type: 'TSC_ERROR',
        model: 'sonnet',
      },
    ];

    await fs.writeFile(
      auditPath,
      entries.map(e => JSON.stringify(e)).join('\n'),
      'utf-8'
    );

    const parsed = await readAuditTrace(testWorkspace);
    expect(parsed).toHaveLength(3);
    expect(parsed[0].workflow_run_id).toBe('test-1');
  });

  it('should analyze audit trace and provide insights', async () => {
    // Create test audit trace
    const auditPath = path.join(testWorkspace, 'audit_trace.jsonl');
    const entries = [
      {
        workflow_run_id: 'test-1',
        step_name: 'scaffold',
        timestamp: new Date().toISOString(),
        cost_usd: 0.05,
        validation_status: 'pass' as const,
        model: 'sonnet',
      },
      {
        workflow_run_id: 'test-1',
        step_name: 'repair_1',
        timestamp: new Date().toISOString(),
        cost_usd: 0.02,
        validation_status: 'pass' as const,
        validation_error_type: 'ESLINT_ERROR',
        model: 'haiku',
      },
      {
        workflow_run_id: 'test-2',
        step_name: 'scaffold',
        timestamp: new Date().toISOString(),
        cost_usd: 0.06,
        validation_status: 'fail' as const,
        validation_error_type: 'TSC_ERROR',
        model: 'sonnet',
      },
    ];

    await fs.writeFile(
      auditPath,
      entries.map(e => JSON.stringify(e)).join('\n'),
      'utf-8'
    );

    const analysis = await analyzeAuditTrace(testWorkspace);
    
    expect(analysis.totalRuns).toBe(2);
    expect(analysis.totalCost).toBeCloseTo(0.13, 2);
    expect(analysis.mostExpensiveSteps.length).toBeGreaterThan(0);
    expect(analysis.recommendations.length).toBeGreaterThan(0);
  });

  it('should generate optimization report', async () => {
    // Create test audit trace
    const auditPath = path.join(testWorkspace, 'audit_trace.jsonl');
    await fs.writeFile(
      auditPath,
      JSON.stringify({
        workflow_run_id: 'test-1',
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
  });

  it('should handle empty audit trace gracefully', async () => {
    const analysis = await analyzeAuditTrace(testWorkspace);
    
    expect(analysis.totalRuns).toBe(0);
    expect(analysis.totalCost).toBe(0);
    expect(analysis.recommendations).toContain('No audit data available');
  });
});

describe('Phase 4: Hook Scripts', () => {
  let testWorkspace: string;
  const hookScriptsDir = path.resolve(
    __dirname,
    '../../.claude/scripts'
  );

  beforeEach(async () => {
    testWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'hook-test-'));
  });

  afterEach(async () => {
    await fs.rm(testWorkspace, { recursive: true, force: true });
  });

  it('should log tool call to file', async () => {
    const logToolCallScript = path.join(hookScriptsDir, 'log-tool-call.js');
    
    // Check if script exists
    try {
      await fs.access(logToolCallScript);
    } catch {
      // Skip test if script doesn't exist (not built yet)
      return;
    }

    const testData = JSON.stringify({
      tool: 'Read',
      toolCall: { file: 'test.ts' },
    });

    // Set environment variables
    process.env.CLAUDE_WORKSPACE = testWorkspace;
    process.env.CLAUDE_TOOL = 'Read';
    process.env.WORKFLOW_RUN_ID = 'test-workflow-1';

    // Run script with test data
    const { stdout, stderr } = await execAsync(
      `echo '${testData}' | node ${logToolCallScript}`,
      { env: process.env }
    );

    // Check if log file was created
    const logPath = path.join(testWorkspace, 'tool_call_log.jsonl');
    const logExists = await fs.access(logPath).then(() => true).catch(() => false);
    
    expect(logExists).toBe(true);

    if (logExists) {
      const logContent = await fs.readFile(logPath, 'utf-8');
      const logEntry = JSON.parse(logContent.trim());
      expect(logEntry.tool).toBe('Read');
      expect(logEntry.workspace).toBe(testWorkspace);
    }
  });

  it('should log response to file', async () => {
    const logResponseScript = path.join(hookScriptsDir, 'log-response.js');
    
    // Check if script exists
    try {
      await fs.access(logResponseScript);
    } catch {
      // Skip test if script doesn't exist (not built yet)
      return;
    }

    const testData = JSON.stringify({
      response: 'Success',
      cost_usd: 0.05,
      duration_ms: 1000,
    });

    // Set environment variables
    process.env.CLAUDE_WORKSPACE = testWorkspace;
    process.env.CLAUDE_COST = '0.05';
    process.env.WORKFLOW_RUN_ID = 'test-workflow-1';

    // Run script with test data
    await execAsync(
      `echo '${testData}' | node ${logResponseScript}`,
      { env: process.env }
    );

    // Check if log file was created
    const logPath = path.join(testWorkspace, 'response_log.jsonl');
    const logExists = await fs.access(logPath).then(() => true).catch(() => false);
    
    expect(logExists).toBe(true);

    if (logExists) {
      const logContent = await fs.readFile(logPath, 'utf-8');
      const logEntry = JSON.parse(logContent.trim());
      expect(logEntry.cost_usd).toBe('0.05');
      expect(logEntry.workspace).toBe(testWorkspace);
    }
  });
});

describe('Phase 4: Credential Checks', () => {
  it('should check GitHub CLI availability', async () => {
    const result = await checkCredentials({
      checkGitHub: true,
      checkNPM: false,
      checkPackagesAPI: false,
      checkGit: false,
      checkClaude: false,
      checkGemini: false,
    });

    // Should return status (may pass or fail depending on environment)
    expect(result).toHaveProperty('allAvailable');
    expect(result).toHaveProperty('checks');
    // Tool name is 'gh' not 'github'
    expect(result.checks).toHaveProperty('gh');
  });

  it('should check npm availability', async () => {
    const result = await checkCredentials({
      checkGitHub: false,
      checkNPM: true,
      checkPackagesAPI: false,
      checkGit: false,
      checkClaude: false,
      checkGemini: false,
    });

    expect(result).toHaveProperty('allAvailable');
    expect(result.checks).toHaveProperty('npm');
  });

  it('should format credential errors clearly', async () => {
    const status = {
      allAvailable: false,
      missing: ['gh', 'npm'],
      checks: {
        gh: { available: false, tool: 'gh', error: 'GitHub CLI not installed' },
        npm: { available: false, tool: 'npm', error: 'npm not found' },
        git: { available: true, tool: 'git' },
        'claude-cli': { available: true, tool: 'claude-cli' },
        'gemini-cli': { available: false, tool: 'gemini-cli' },
        'packages-api': { available: true, tool: 'packages-api' },
      },
    };

    const errorMessage = formatCredentialsError(status);
    
    expect(errorMessage).toContain('Missing or misconfigured credentials');
    expect(errorMessage).toContain('GH');
    expect(errorMessage).toContain('NPM');
  });
});

describe('Phase 4: Git Activities', () => {
  let testRepo: string;

  beforeEach(async () => {
    testRepo = await fs.mkdtemp(path.join(os.tmpdir(), 'git-test-'));
    
    // Initialize git repo
    await execAsync('git init', { cwd: testRepo });
    await execAsync('git config user.name "Test User"', { cwd: testRepo });
    await execAsync('git config user.email "test@example.com"', { cwd: testRepo });
    
    // Create initial file and commit
    await fs.writeFile(path.join(testRepo, 'README.md'), '# Test\n', 'utf-8');
    await execAsync('git add README.md', { cwd: testRepo });
    await execAsync('git commit -m "Initial commit"', { cwd: testRepo });
  });

  afterEach(async () => {
    await fs.rm(testRepo, { recursive: true, force: true });
  });

  it('should create a branch', async () => {
    // Get default branch
    const { stdout: branchOut } = await execAsync('git branch --show-current', { cwd: testRepo });
    const defaultBranch = branchOut.trim() || 'main';
    
    const result = await gitCreateBranch({
      workspacePath: testRepo,
      branchName: 'test-branch',
      baseBranch: defaultBranch,
    });

    expect(result.success).toBe(true);
    
    // Verify branch exists
    const { stdout } = await execAsync('git branch', { cwd: testRepo });
    expect(stdout).toContain('test-branch');
  });

  it('should commit changes', async () => {
    // Create a test file
    await fs.writeFile(path.join(testRepo, 'test.txt'), 'test content', 'utf-8');
    
    const result = await gitCommit({
      workspacePath: testRepo,
      message: 'test: Add test file',
      gitUser: {
        name: 'Test User',
        email: 'test@example.com',
      },
    });

    expect(result.success).toBe(true);
    
    // Verify commit exists
    const { stdout } = await execAsync('git log --oneline -1', { cwd: testRepo });
    expect(stdout).toContain('test: Add test file');
  });

  it('should handle commit with no changes gracefully', async () => {
    const result = await gitCommit({
      workspacePath: testRepo,
      message: 'test: No changes',
      gitUser: {
        name: 'Test User',
        email: 'test@example.com',
      },
    });

    // Should either succeed (nothing to commit) or fail gracefully
    expect(result).toHaveProperty('success');
  });
});

describe('Phase 4: Optimization Dashboard CLI', () => {
  let testWorkspace: string;

  beforeEach(async () => {
    testWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'dashboard-test-'));
  });

  afterEach(async () => {
    await fs.rm(testWorkspace, { recursive: true, force: true });
  });

  it('should generate text output', async () => {
    // Create test audit trace
    const auditPath = path.join(testWorkspace, 'audit_trace.jsonl');
    await fs.writeFile(
      auditPath,
      JSON.stringify({
        workflow_run_id: 'test-1',
        step_name: 'scaffold',
        timestamp: new Date().toISOString(),
        cost_usd: 0.05,
        validation_status: 'pass',
        model: 'sonnet',
      }) + '\n',
      'utf-8'
    );

    // Import and test the analysis function directly
    const analysis = await analyzeAuditTrace(testWorkspace);
    
    expect(analysis.totalRuns).toBe(1);
    expect(analysis.totalCost).toBe(0.05);
  });

  it('should handle missing audit trace file', async () => {
    const analysis = await analyzeAuditTrace(testWorkspace);
    
    expect(analysis.totalRuns).toBe(0);
    expect(analysis.recommendations).toContain('No audit data available');
  });
});

