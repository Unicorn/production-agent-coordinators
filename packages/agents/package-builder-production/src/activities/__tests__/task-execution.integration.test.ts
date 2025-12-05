/**
 * Integration Tests for Task Execution Activities
 * 
 * These tests use REAL CLI calls (not mocked) to validate that the activities
 * actually work outside of a Temporal workflow.
 * 
 * CRITICAL: These tests validate the actual CLI interaction patterns and ensure
 * that all inner activity code works correctly.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { executeTaskWithCLI, runTaskValidations, executeFixWithCLI } from '../cli-agent.activities.js';
import type { TaskBreakdown } from '../cli-agent.activities.js';

const RUN_INTEGRATION_TESTS = process.env.RUN_INTEGRATION_TESTS === 'true';

describe('Task Execution Integration Tests (REAL CLI)', () => {
  const testWorkspace = path.join(process.cwd(), 'test-workspace', 'task-execution-tests');
  const workflowId = 'test-workflow-123';
  let sequenceNumber = 0;

  beforeAll(async () => {
    // Create test workspace
    await fs.mkdir(testWorkspace, { recursive: true });
    
    // Create a simple test package structure
    await fs.writeFile(
      path.join(testWorkspace, 'package.json'),
      JSON.stringify({
        name: '@test/task-execution',
        version: '0.1.0',
        scripts: {
          test: 'echo "Tests passed"',
          lint: 'echo "Lint passed"',
          build: 'echo "Build passed"',
        },
      }, null, 2)
    );
  });

  afterAll(async () => {
    // Clean up test workspace
    try {
      await fs.rm(testWorkspace, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('executeTaskWithCLI', () => {
    it.skipIf(!RUN_INTEGRATION_TESTS)('should execute task and return deterministic file paths', async () => {
      const task: TaskBreakdown['tasks'][0] = {
        id: 'T1',
        title: 'Create index file',
        description: 'Create a simple index.ts file',
        acceptance_criteria: [
          'File src/index.ts exists',
          'File exports a function',
        ],
        validation_steps: ['file_exists:src/index.ts'],
      };

      const result = await executeTaskWithCLI({
        task,
        workingDir: testWorkspace,
        workflowId,
        sequenceNumber: sequenceNumber++,
        provider: 'claude',
        model: 'sonnet',
        permissionMode: 'acceptEdits',
      });

      // Verify deterministic return values
      expect(result.success).toBe(true);
      expect(result.logFilePath).toContain(workflowId);
      expect(result.logFilePath).toContain('task-T1');
      expect(result.logFilePath).toContain('.jsonl');
      expect(typeof result.sessionId).toBe('string');
      expect(result.cost_usd).toBeGreaterThanOrEqual(0);
      expect(result.duration_ms).toBeGreaterThan(0);

      // Verify log file exists and contains expected data
      const logContent = await fs.readFile(result.logFilePath, 'utf-8');
      const logData = JSON.parse(logContent);
      expect(logData.workflowId).toBe(workflowId);
      expect(logData.taskId).toBe('T1');
      expect(logData.instruction).toContain('Create index file');
    }, 600000); // 10 minute timeout

    it.skipIf(!RUN_INTEGRATION_TESTS)('should parse task_complete signal from CLI response', async () => {
      const task: TaskBreakdown['tasks'][0] = {
        id: 'T2',
        title: 'Create utils file',
        description: 'Create a utils.ts file with a helper function',
        acceptance_criteria: ['File src/utils.ts exists'],
        validation_steps: ['file_exists:src/utils.ts'],
      };

      const result = await executeTaskWithCLI({
        task,
        workingDir: testWorkspace,
        workflowId,
        sequenceNumber: sequenceNumber++,
        provider: 'claude',
        model: 'sonnet',
        permissionMode: 'acceptEdits',
      });

      // Verify task completion signal is parsed
      expect(result.taskComplete).toBeDefined();
      expect(typeof result.taskComplete).toBe('boolean');
    }, 600000);

    it.skipIf(!RUN_INTEGRATION_TESTS)('should continue task on subsequent calls', async () => {
      const task: TaskBreakdown['tasks'][0] = {
        id: 'T3',
        title: 'Create complex file',
        description: 'Create a complex file that may need multiple turns',
        acceptance_criteria: ['File exists', 'File has correct structure'],
        validation_steps: ['file_exists:src/complex.ts'],
      };

      // First call
      const firstResult = await executeTaskWithCLI({
        task,
        workingDir: testWorkspace,
        workflowId,
        sequenceNumber: sequenceNumber++,
        provider: 'claude',
        model: 'sonnet',
        permissionMode: 'acceptEdits',
      });

      // If not complete, continue
      if (!firstResult.taskComplete) {
        const continueResult = await executeTaskWithCLI({
          task,
          sessionId: firstResult.sessionId,
          workingDir: testWorkspace,
          workflowId,
          sequenceNumber: sequenceNumber++,
          continueTask: true,
          previousLogFilePath: firstResult.logFilePath,
          provider: 'claude',
          model: 'sonnet',
          permissionMode: 'acceptEdits',
        });

        // Verify session ID is maintained
        expect(continueResult.sessionId).toBe(firstResult.sessionId);
        expect(continueResult.logFilePath).not.toBe(firstResult.logFilePath);
      }
    }, 1200000); // 20 minute timeout for multi-turn
  });

  describe('runTaskValidations', () => {
    it.skipIf(!RUN_INTEGRATION_TESTS)('should run file existence validation', async () => {
      // Create a test file first
      await fs.mkdir(path.join(testWorkspace, 'src'), { recursive: true });
      await fs.writeFile(path.join(testWorkspace, 'src', 'test.ts'), 'export const test = "test";');

      const task: TaskBreakdown['tasks'][0] = {
        id: 'V1',
        title: 'Validate file exists',
        description: 'Test file existence validation',
        acceptance_criteria: [],
        validation_steps: ['file_exists:src/test.ts'],
      };

      const result = await runTaskValidations({
        task,
        workingDir: testWorkspace,
        workflowId,
      });

      // Verify deterministic return values
      expect(result.success).toBe(true);
      expect(result.validationErrorsFilePath).toContain(workflowId);
      expect(result.validationErrorsFilePath).toContain('task-V1');
      expect(result.validationErrorsFilePath).toContain('.json');
      expect(result.allPassed).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it.skipIf(!RUN_INTEGRATION_TESTS)('should detect missing file', async () => {
      const task: TaskBreakdown['tasks'][0] = {
        id: 'V2',
        title: 'Validate missing file',
        description: 'Test missing file detection',
        acceptance_criteria: [],
        validation_steps: ['file_exists:src/missing.ts'],
      };

      const result = await runTaskValidations({
        task,
        workingDir: testWorkspace,
        workflowId,
      });

      expect(result.allPassed).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('file_missing');
      expect(result.errors[0].target).toBe('src/missing.ts');

      // Verify errors file exists and contains errors
      const errorsContent = await fs.readFile(result.validationErrorsFilePath, 'utf-8');
      const errors = JSON.parse(errorsContent);
      expect(Array.isArray(errors)).toBe(true);
      expect(errors.length).toBeGreaterThan(0);
    });

    it.skipIf(!RUN_INTEGRATION_TESTS)('should run lint validation', async () => {
      const task: TaskBreakdown['tasks'][0] = {
        id: 'V3',
        title: 'Validate lint',
        description: 'Test lint validation',
        acceptance_criteria: [],
        validation_steps: ['lint_passes'],
      };

      const result = await runTaskValidations({
        task,
        workingDir: testWorkspace,
        workflowId,
      });

      // Verify deterministic file path
      expect(result.validationErrorsFilePath).toContain(workflowId);
      expect(result.validationErrorsFilePath).toContain('task-V3');
      
      // Note: Actual result depends on lint output, but file path should be deterministic
      expect(typeof result.allPassed).toBe('boolean');
    }, 180000); // 3 minute timeout for lint
  });

  describe('executeFixWithCLI', () => {
    it.skipIf(!RUN_INTEGRATION_TESTS)('should read validation errors from file and fix them', async () => {
      // Create validation errors file
      const errorsDir = path.join(testWorkspace, '.claude', 'validation-errors');
      await fs.mkdir(errorsDir, { recursive: true });
      const errorsFilePath = path.join(errorsDir, `${workflowId}-task-F1-errors.json`);
      const errors = [
        {
          type: 'file_missing',
          message: 'Required file does not exist: src/fix-test.ts',
          target: 'src/fix-test.ts',
        },
      ];
      await fs.writeFile(errorsFilePath, JSON.stringify(errors, null, 2));

      const task: TaskBreakdown['tasks'][0] = {
        id: 'F1',
        title: 'Fix missing file',
        description: 'Fix the missing file error',
        acceptance_criteria: ['File src/fix-test.ts exists'],
        validation_steps: ['file_exists:src/fix-test.ts'],
      };

      const result = await executeFixWithCLI({
        task,
        validationErrorsFilePath: errorsFilePath,
        workingDir: testWorkspace,
        workflowId,
        sequenceNumber: sequenceNumber++,
        provider: 'claude',
        model: 'sonnet',
        permissionMode: 'acceptEdits',
      });

      // Verify deterministic return values
      expect(result.success).toBe(true);
      expect(result.logFilePath).toContain(workflowId);
      expect(result.logFilePath).toContain('fix-F1');
      expect(result.logFilePath).toContain('.jsonl');
      expect(typeof result.sessionId).toBe('string');
      expect(typeof result.fixed).toBe('boolean');

      // Verify log file contains validation errors file path reference
      const logContent = await fs.readFile(result.logFilePath, 'utf-8');
      const logData = JSON.parse(logContent);
      expect(logData.validationErrorsFilePath).toBe(errorsFilePath);
      expect(logData.instruction).toContain(errorsFilePath);
    }, 600000); // 10 minute timeout
  });

  describe('End-to-End Task Loop', () => {
    it.skipIf(!RUN_INTEGRATION_TESTS)('should execute task, validate, and fix in sequence', async () => {
      const task: TaskBreakdown['tasks'][0] = {
        id: 'E2E1',
        title: 'End-to-end test task',
        description: 'Create a file, validate it exists, fix if needed',
        acceptance_criteria: ['File src/e2e.ts exists'],
        validation_steps: ['file_exists:src/e2e.ts'],
      };

      let sessionId: string | undefined;
      let taskComplete = false;
      let taskSequence = 0;

      // Task execution loop
      while (!taskComplete && taskSequence < 3) {
        const taskResult = await executeTaskWithCLI({
          task,
          sessionId,
          workingDir: testWorkspace,
          workflowId,
          sequenceNumber: sequenceNumber++,
          continueTask: taskSequence > 0,
          provider: 'claude',
          model: 'sonnet',
          permissionMode: 'acceptEdits',
        });

        sessionId = taskResult.sessionId;
        taskComplete = taskResult.taskComplete;
        taskSequence++;

        if (!taskComplete) {
          console.log(`[E2E] Task not complete, continuing (iteration ${taskSequence})`);
        }
      }

      expect(taskComplete).toBe(true);

      // Validation loop
      let allValidationsPassed = false;
      let validationSequence = 0;

      while (!allValidationsPassed && validationSequence < 3) {
        const validationResult = await runTaskValidations({
          task,
          workingDir: testWorkspace,
          workflowId,
        });

        if (validationResult.allPassed) {
          allValidationsPassed = true;
          break;
        }

        // Fix errors
        const fixResult = await executeFixWithCLI({
          task,
          validationErrorsFilePath: validationResult.validationErrorsFilePath,
          sessionId,
          workingDir: testWorkspace,
          workflowId,
          sequenceNumber: sequenceNumber++,
          provider: 'claude',
          model: 'sonnet',
          permissionMode: 'acceptEdits',
        });

        sessionId = fixResult.sessionId;
        validationSequence++;
      }

      expect(allValidationsPassed).toBe(true);
    }, 1800000); // 30 minute timeout for full E2E
  });
});

