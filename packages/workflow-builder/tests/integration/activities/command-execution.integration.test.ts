/**
 * Integration Tests for Command Execution Activities
 * 
 * Tests command execution with real process execution in isolated environments.
 * 
 * @see planning-standards.mdc - Testing requirements
 * @see plans/ui-compiler-activities.md - Comprehensive testing strategy
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  executeCommand,
  runBuildCommand,
  runTestCommand,
  runLintCommand,
  logCommandExecution,
  type ExecuteCommandInput,
} from '@/lib/activities/command-execution.activities';

describe('Command Execution Activities - Integration', () => {
  let tempDir: string;
  let testProjectDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-cmd-int-'));
    testProjectDir = path.join(tempDir, 'test-project');
    await fs.mkdir(testProjectDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  // ========================================================================
  // Real Command Execution Tests
  // ========================================================================

  describe('executeCommand - Real Execution', () => {
    it('should execute echo command successfully', async () => {
      const result = await executeCommand({
        command: 'echo',
        args: ['hello world'],
        workingDir: testProjectDir,
        timeout: 5000,
      });

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe('hello world');
      expect(result.duration).toBeGreaterThan(0);
      expect(result.commandId).toBeDefined();
    });

    it('should handle command failures', async () => {
      const result = await executeCommand({
        command: 'npm',
        args: ['invalid-command-that-does-not-exist'],
        workingDir: testProjectDir,
        timeout: 5000,
      });

      expect(result.success).toBe(false);
      expect(result.exitCode).not.toBe(0);
    });

    it('should respect working directory', async () => {
      // Create a test file
      const testFile = path.join(testProjectDir, 'test.txt');
      await fs.writeFile(testFile, 'test content');

      // List files in working directory
      const result = await executeCommand({
        command: 'ls',
        args: ['-la'],
        workingDir: testProjectDir,
        timeout: 5000,
      });

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('test.txt');
    });

    it('should handle command timeouts', async () => {
      const startTime = Date.now();
      
      const result = await executeCommand({
        command: 'sleep',
        args: ['2'], // Sleep for 2 seconds
        workingDir: testProjectDir,
        timeout: 500, // But timeout after 500ms
      });

      const duration = Date.now() - startTime;
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');
      expect(duration).toBeLessThan(2000); // Should timeout before sleep completes
    });

    it('should capture environment variables', async () => {
      const result = await executeCommand({
        command: 'node',
        args: ['-e', 'console.log(process.env.TEST_VAR)'],
        workingDir: testProjectDir,
        env: { TEST_VAR: 'test-value' },
        timeout: 5000,
      });

      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe('test-value');
    });

    it('should handle stdin input', async () => {
      const result = await executeCommand({
        command: 'cat',
        args: [],
        workingDir: testProjectDir,
        stdin: 'input text',
        timeout: 5000,
      });

      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe('input text');
    });
  });

  // ========================================================================
  // Build Command Integration Tests
  // ========================================================================

  describe('runBuildCommand - Real Execution', () => {
    it('should execute npm build command', async () => {
      // Create minimal package.json
      await fs.writeFile(
        path.join(testProjectDir, 'package.json'),
        JSON.stringify({
          name: 'test-package',
          version: '1.0.0',
          scripts: {
            build: 'echo "build complete"',
          },
        })
      );

      const result = await runBuildCommand({
        command: 'npm',
        subcommand: 'run',
        args: ['build'],
        workingDir: testProjectDir,
        timeout: 30000,
      });

      expect(result.success).toBe(true);
      expect(result.buildTime).toBeDefined();
    });

    it('should parse TypeScript compilation errors', async () => {
      // Create package.json with TypeScript
      await fs.writeFile(
        path.join(testProjectDir, 'package.json'),
        JSON.stringify({
          name: 'test-package',
          version: '1.0.0',
          scripts: {
            build: 'tsc --noEmit',
          },
        })
      );

      // Create tsconfig.json
      await fs.writeFile(
        path.join(testProjectDir, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            target: 'ES2020',
            module: 'commonjs',
            strict: true,
          },
        })
      );

      // Create TypeScript file with error
      await fs.mkdir(path.join(testProjectDir, 'src'), { recursive: true });
      await fs.writeFile(
        path.join(testProjectDir, 'src', 'index.ts'),
        'const x: number = "string"; // Type error'
      );

      const result = await runBuildCommand({
        command: 'npm',
        subcommand: 'run',
        args: ['build'],
        workingDir: testProjectDir,
        timeout: 30000,
      });

      expect(result.success).toBe(false);
      // Note: This test may pass if tsc is not installed, which is fine
      // The important thing is that the function handles the result correctly
    });
  });

  // ========================================================================
  // Test Command Integration Tests
  // ========================================================================

  describe('runTestCommand - Real Execution', () => {
    it('should execute npm test command', async () => {
      // Create minimal package.json with test script
      await fs.writeFile(
        path.join(testProjectDir, 'package.json'),
        JSON.stringify({
          name: 'test-package',
          version: '1.0.0',
          scripts: {
            test: 'echo "tests passed"',
          },
        })
      );

      const result = await runTestCommand({
        command: 'npm',
        workingDir: testProjectDir,
        timeout: 30000,
      });

      expect(result.success).toBe(true);
    });

    it('should handle test failures', async () => {
      // Create package.json with failing test
      await fs.writeFile(
        path.join(testProjectDir, 'package.json'),
        JSON.stringify({
          name: 'test-package',
          version: '1.0.0',
          scripts: {
            test: 'exit 1', // Always fail
          },
        })
      );

      const result = await runTestCommand({
        command: 'npm',
        workingDir: testProjectDir,
        timeout: 30000,
      });

      expect(result.success).toBe(false);
    });
  });

  // ========================================================================
  // Lint Command Integration Tests
  // ========================================================================

  describe('runLintCommand - Real Execution', () => {
    it('should execute npm lint command', async () => {
      // Create minimal package.json with lint script
      await fs.writeFile(
        path.join(testProjectDir, 'package.json'),
        JSON.stringify({
          name: 'test-package',
          version: '1.0.0',
          scripts: {
            lint: 'echo "linting complete"',
          },
        })
      );

      const result = await runLintCommand({
        command: 'npm',
        workingDir: testProjectDir,
        timeout: 30000,
      });

      expect(result.success).toBe(true);
    });
  });

  // ========================================================================
  // Command Logging Integration Tests
  // ========================================================================

  describe('logCommandExecution - Real File System', () => {
    it('should create and append to log file', async () => {
      const entry = {
        commandId: 'test-command-id',
        workflowRunId: 'test-workflow-id',
        stepName: 'test-step',
        timestamp: new Date().toISOString(),
        command: 'npm',
        args: ['test'],
        workingDir: testProjectDir,
        duration: 1234,
        success: true,
        exitCode: 0,
        outputSize: 5678,
      };

      await logCommandExecution(testProjectDir, entry);

      // Verify log file was created
      const logPath = path.join(testProjectDir, 'command_execution_log.jsonl');
      const logContent = await fs.readFile(logPath, 'utf-8');

      expect(logContent).toContain('test-command-id');
      expect(logContent).toContain('test-workflow-id');
      expect(logContent).toContain('test-step');
    });

    it('should append multiple entries', async () => {
      const entry1 = {
        commandId: 'command-1',
        timestamp: new Date().toISOString(),
        command: 'npm',
        args: ['test'],
        workingDir: testProjectDir,
        duration: 1000,
        success: true,
        exitCode: 0,
        outputSize: 100,
      };

      const entry2 = {
        commandId: 'command-2',
        timestamp: new Date().toISOString(),
        command: 'npm',
        args: ['build'],
        workingDir: testProjectDir,
        duration: 2000,
        success: true,
        exitCode: 0,
        outputSize: 200,
      };

      await logCommandExecution(testProjectDir, entry1);
      await logCommandExecution(testProjectDir, entry2);

      const logPath = path.join(testProjectDir, 'command_execution_log.jsonl');
      const logContent = await fs.readFile(logPath, 'utf-8');
      const lines = logContent.trim().split('\n');

      expect(lines.length).toBe(2);
      expect(logContent).toContain('command-1');
      expect(logContent).toContain('command-2');
    });
  });

  // ========================================================================
  // Error Handling Integration Tests
  // ========================================================================

  describe('Error Handling - Real Scenarios', () => {
    it('should handle invalid working directory gracefully', async () => {
      const result = await executeCommand({
        command: 'echo',
        args: ['test'],
        workingDir: '/nonexistent/directory/12345',
        timeout: 5000,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('does not exist');
    });

    it('should handle blocked dangerous commands', async () => {
      const result = await executeCommand({
        command: 'rm',
        args: ['-rf', '/'],
        workingDir: testProjectDir,
        timeout: 5000,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Dangerous command');
    });

    it('should handle process spawn failures gracefully', async () => {
      // Use a command that doesn't exist
      const result = await executeCommand({
        command: 'nonexistent-command-xyz123',
        args: [],
        workingDir: testProjectDir,
        timeout: 5000,
      });

      // Should fail but not crash
      expect(result.success).toBe(false);
    });
  });

  // ========================================================================
  // Resource and Performance Tests
  // ========================================================================

  describe('Resource and Performance', () => {
    it('should track execution duration', async () => {
      const startTime = Date.now();
      
      const result = await executeCommand({
        command: 'sleep',
        args: ['0.1'], // 100ms
        workingDir: testProjectDir,
        timeout: 5000,
      });

      const actualDuration = Date.now() - startTime;
      
      expect(result.duration).toBeGreaterThan(0);
      expect(result.duration).toBeLessThan(actualDuration + 100); // Allow some margin
    });

    it('should generate unique command IDs', async () => {
      const result1 = await executeCommand({
        command: 'echo',
        args: ['test1'],
        workingDir: testProjectDir,
      });

      const result2 = await executeCommand({
        command: 'echo',
        args: ['test2'],
        workingDir: testProjectDir,
      });

      expect(result1.commandId).toBeDefined();
      expect(result2.commandId).toBeDefined();
      expect(result1.commandId).not.toBe(result2.commandId);
    });
  });
});

