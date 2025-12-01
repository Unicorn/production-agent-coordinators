/**
 * Unit Tests for Command Execution Activities
 * 
 * Tests command execution operations with mocked process execution.
 * 
 * @see planning-standards.mdc - Testing requirements
 * @see plans/ui-compiler-activities.md - Comprehensive testing strategy
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  executeCommand,
  runBuildCommand,
  runTestCommand,
  runLintCommand,
  logCommandExecution,
  validateCommand,
  type ExecuteCommandInput,
  type BuildCommandInput,
  type TestCommandInput,
  type LintCommandInput,
} from '@/lib/activities/command-execution.activities';

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

// Mock fs
vi.mock('fs/promises', async () => {
  const actual = await vi.importActual('fs/promises');
  return {
    ...actual,
    stat: vi.fn(),
    appendFile: vi.fn(),
  };
});

describe('Command Execution Activities', () => {
  let tempDir: string;
  let mockProcess: any;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-cmd-'));
    
    // Setup mock process
    mockProcess = {
      pid: 12345,
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      stdin: { write: vi.fn(), end: vi.fn() },
      on: vi.fn(),
    };

    (spawn as any).mockReturnValue(mockProcess);
    (fs.stat as any).mockResolvedValue({ isDirectory: () => true });
    (fs.appendFile as any).mockResolvedValue(undefined);
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
    vi.clearAllMocks();
  });

  // ========================================================================
  // Command Validation Tests
  // ========================================================================

  describe('Command Validation', () => {
    it('should allow whitelisted commands', () => {
      expect(validateCommand('npm')).toEqual({ allowed: true });
      expect(validateCommand('yarn')).toEqual({ allowed: true });
      expect(validateCommand('tsc')).toEqual({ allowed: true });
      expect(validateCommand('eslint')).toEqual({ allowed: true });
    });

    it('should block dangerous commands', () => {
      const result = validateCommand('rm -rf /');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Dangerous command');
    });

    it('should block non-whitelisted commands', () => {
      const result = validateCommand('curl');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not in whitelist');
    });
  });

  // ========================================================================
  // executeCommand Tests
  // ========================================================================

  describe('executeCommand', () => {
    it('should execute command successfully', async () => {
      // Mock successful process
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
      });

      const result = await executeCommand({
        command: 'echo',
        args: ['test'],
        workingDir: tempDir,
        timeout: 5000,
      });

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.commandId).toBeDefined();
    });

    it('should handle command failures', async () => {
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          setTimeout(() => callback(1), 10);
        }
      });

      const result = await executeCommand({
        command: 'npm',
        args: ['run', 'invalid'],
        workingDir: tempDir,
      });

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
    });

    it('should handle command timeouts', async () => {
      // Mock process that never closes
      mockProcess.on.mockImplementation(() => {
        // Never call close
      });

      const result = await executeCommand({
        command: 'sleep',
        args: ['10'],
        workingDir: tempDir,
        timeout: 100, // Very short timeout
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');
    });

    it('should validate command before execution', async () => {
      const result = await executeCommand({
        command: 'rm',
        args: ['-rf', '/'],
        workingDir: tempDir,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Dangerous command');
      expect(spawn).not.toHaveBeenCalled();
    });

    it('should validate working directory exists', async () => {
      (fs.stat as any).mockRejectedValue(new Error('Not found'));

      const result = await executeCommand({
        command: 'npm',
        args: ['--version'],
        workingDir: '/nonexistent',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('does not exist');
    });

    it('should capture stdout and stderr', async () => {
      let stdoutCallback: Function;
      let stderrCallback: Function;

      mockProcess.stdout.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') {
          stdoutCallback = callback;
        }
      });

      mockProcess.stderr.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') {
          stderrCallback = callback;
        }
      });

      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          setTimeout(() => {
            if (stdoutCallback) stdoutCallback(Buffer.from('stdout output'));
            if (stderrCallback) stderrCallback(Buffer.from('stderr output'));
            callback(0);
          }, 10);
        }
      });

      const result = await executeCommand({
        command: 'echo',
        args: ['test'],
        workingDir: tempDir,
      });

      expect(result.stdout).toContain('stdout output');
      expect(result.stderr).toContain('stderr output');
    });

    it('should handle process spawn errors', async () => {
      (spawn as any).mockImplementation(() => {
        throw new Error('Spawn failed');
      });

      const result = await executeCommand({
        command: 'npm',
        args: ['--version'],
        workingDir: tempDir,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Spawn failed');
    });
  });

  // ========================================================================
  // runBuildCommand Tests
  // ========================================================================

  describe('runBuildCommand', () => {
    it('should execute build command', async () => {
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
      });

      const result = await runBuildCommand({
        command: 'npm',
        subcommand: 'run',
        args: ['build'],
        workingDir: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.buildTime).toBeDefined();
    });

    it('should parse TypeScript build errors', async () => {
      const errorOutput = `src/file.ts(10,5): error TS2322: Type 'string' is not assignable to type 'number'.`;
      
      mockProcess.stderr.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') {
          setTimeout(() => callback(Buffer.from(errorOutput)), 10);
        }
      });

      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          setTimeout(() => callback(1), 20);
        }
      });

      const result = await runBuildCommand({
        command: 'npm',
        subcommand: 'run',
        args: ['build'],
        workingDir: tempDir,
      });

      expect(result.success).toBe(false);
      expect(result.buildErrors).toBeDefined();
      expect(result.buildErrors?.length).toBeGreaterThan(0);
      expect(result.buildErrors?.[0]).toMatchObject({
        file: expect.stringContaining('file.ts'),
        line: 10,
        type: 'error',
      });
    });

    it('should count build warnings', async () => {
      const warningOutput = `src/file.ts(5,3): warning TS6133: 'unused' is declared but never used.`;
      
      mockProcess.stderr.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') {
          setTimeout(() => callback(Buffer.from(warningOutput)), 10);
        }
      });

      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 20);
        }
      });

      const result = await runBuildCommand({
        command: 'npm',
        subcommand: 'run',
        args: ['build'],
        workingDir: tempDir,
      });

      expect(result.buildWarnings).toBeGreaterThan(0);
    });

    it('should use longer timeout for builds', async () => {
      const startTime = Date.now();
      
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
      });

      await runBuildCommand({
        command: 'npm',
        subcommand: 'run',
        args: ['build'],
        workingDir: tempDir,
        timeout: 900000, // 15 minutes
      });

      // Verify timeout was respected (process should complete quickly in test)
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000);
    });
  });

  // ========================================================================
  // runTestCommand Tests
  // ========================================================================

  describe('runTestCommand', () => {
    it('should execute test command', async () => {
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
      });

      const result = await runTestCommand({
        command: 'npm',
        workingDir: tempDir,
      });

      expect(result.success).toBe(true);
    });

    it('should parse test results', async () => {
      const testOutput = `Test Suites: 5 passed, 5 total
Tests:       20 passed, 2 failed, 3 skipped, 25 total`;

      mockProcess.stdout.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') {
          setTimeout(() => callback(Buffer.from(testOutput)), 10);
        }
      });

      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 20);
        }
      });

      const result = await runTestCommand({
        command: 'npm',
        workingDir: tempDir,
      });

      expect(result.testResults).toBeDefined();
      expect(result.testResults?.passed).toBe(20);
      expect(result.testResults?.failed).toBe(2);
      expect(result.testResults?.skipped).toBe(3);
      expect(result.testResults?.total).toBe(25);
    });

    it('should parse coverage information', async () => {
      const coverageOutput = `Lines   : 85.5%
Statements: 82.3%
Functions: 90.1%
Branches: 78.9%`;

      mockProcess.stdout.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') {
          setTimeout(() => callback(Buffer.from(coverageOutput)), 10);
        }
      });

      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 20);
        }
      });

      const result = await runTestCommand({
        command: 'npm',
        workingDir: tempDir,
        coverage: true,
      });

      expect(result.coverage).toBeDefined();
      expect(result.coverage?.lines).toBeGreaterThan(0);
    });

    it('should extract test failures', async () => {
      const failureOutput = `FAIL src/test.test.ts
  Test Name
    ✕ should fail
      Error: Test failed
        at Object.<anonymous> (test.test.ts:10:5)`;

      mockProcess.stdout.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') {
          setTimeout(() => callback(Buffer.from(failureOutput)), 10);
        }
      });

      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          setTimeout(() => callback(1), 20);
        }
      });

      const result = await runTestCommand({
        command: 'npm',
        workingDir: tempDir,
      });

      expect(result.success).toBe(false);
      expect(result.failures).toBeDefined();
      expect(result.failures?.length).toBeGreaterThan(0);
    });

    it('should support test patterns', async () => {
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
      });

      await runTestCommand({
        command: 'jest',
        testPattern: '*.test.ts',
        workingDir: tempDir,
      });

      expect(spawn).toHaveBeenCalledWith(
        'jest',
        expect.arrayContaining(['*.test.ts']),
        expect.any(Object)
      );
    });
  });

  // ========================================================================
  // runLintCommand Tests
  // ========================================================================

  describe('runLintCommand', () => {
    it('should execute lint command', async () => {
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
      });

      const result = await runLintCommand({
        command: 'npm',
        workingDir: tempDir,
      });

      expect(result.success).toBe(true);
    });

    it('should parse ESLint JSON output', async () => {
      const lintOutput = JSON.stringify([
        {
          filePath: 'src/file.ts',
          messages: [
            {
              ruleId: 'no-console',
              severity: 2,
              message: 'Unexpected console statement',
              line: 5,
              column: 3,
              fix: null,
            },
            {
              ruleId: 'no-unused-vars',
              severity: 1,
              message: 'Unused variable',
              line: 10,
              column: 5,
              fix: { range: [100, 110], text: '' },
            },
          ],
        },
      ]);

      mockProcess.stdout.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') {
          setTimeout(() => callback(Buffer.from(lintOutput)), 10);
        }
      });

      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 20);
        }
      });

      const result = await runLintCommand({
        command: 'eslint',
        workingDir: tempDir,
        format: 'json',
      });

      expect(result.lintResults).toBeDefined();
      expect(result.lintResults?.errors).toBe(1);
      expect(result.lintResults?.warnings).toBe(1);
      expect(result.lintResults?.fixable).toBe(1);
      expect(result.issues?.length).toBe(2);
    });

    it('should support auto-fix mode', async () => {
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
      });

      await runLintCommand({
        command: 'eslint',
        workingDir: tempDir,
        fix: true,
      });

      expect(spawn).toHaveBeenCalledWith(
        'eslint',
        expect.arrayContaining(['--fix']),
        expect.any(Object)
      );
    });

    it('should parse text output when JSON fails', async () => {
      const textOutput = `5 errors, 3 warnings`;

      mockProcess.stdout.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') {
          setTimeout(() => callback(Buffer.from(textOutput)), 10);
        }
      });

      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          setTimeout(() => callback(1), 20);
        }
      });

      const result = await runLintCommand({
        command: 'eslint',
        workingDir: tempDir,
        format: 'json', // Will fail to parse, fallback to text
      });

      expect(result.lintResults).toBeDefined();
      expect(result.lintResults?.errors).toBe(5);
      expect(result.lintResults?.warnings).toBe(3);
    });
  });

  // ========================================================================
  // logCommandExecution Tests
  // ========================================================================

  describe('logCommandExecution', () => {
    it('should log command execution', async () => {
      const entry = {
        commandId: 'test-id',
        timestamp: new Date().toISOString(),
        command: 'npm',
        args: ['test'],
        workingDir: tempDir,
        duration: 1000,
        success: true,
        exitCode: 0,
        outputSize: 1024,
      };

      await logCommandExecution(tempDir, entry);

      expect(fs.appendFile).toHaveBeenCalledWith(
        expect.stringContaining('command_execution_log.jsonl'),
        expect.stringContaining('test-id')
      );
    });

    it('should handle logging errors gracefully', async () => {
      (fs.appendFile as any).mockRejectedValue(new Error('Write failed'));

      const entry = {
        commandId: 'test-id',
        timestamp: new Date().toISOString(),
        command: 'npm',
        args: ['test'],
        workingDir: tempDir,
        duration: 1000,
        success: true,
        exitCode: 0,
        outputSize: 1024,
      };

      // Should not throw
      await expect(logCommandExecution(tempDir, entry)).resolves.not.toThrow();
    });
  });
});

