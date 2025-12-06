/**
 * CLI Prompt Inspection Tests
 * 
 * These tests actually call the Claude CLI to see:
 * 1. What prompts are being sent
 * 2. What responses come back
 * 3. How the responses are parsed
 * 
 * These tests can be run headless (outside Temporal) to inspect CLI behavior.
 * 
 * To run: npm test -- cli-prompt-inspection.test.ts
 * 
 * Note: These tests require:
 * - Claude CLI installed and authenticated
 * - ANTHROPIC_API_KEY environment variable set
 * - May incur API costs
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { requestTaskBreakdown, executeAgentActivityRequest } from '../cli-agent.activities';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

// Skip these tests by default (they require CLI and API keys)
// Run with: npm test -- cli-prompt-inspection.test.ts --reporter=verbose
const RUN_HEADLESS_TESTS = process.env.RUN_HEADLESS_CLI_TESTS === 'true';

describe.skipIf(!RUN_HEADLESS_TESTS)('CLI Prompt Inspection (Headless)', () => {
  const testDir = '/tmp/cli-prompt-test';
  const testPlanContent = `# Test Package Plan

## Package Overview
- Name: @test/inspection-package
- Description: A test package for inspecting CLI prompts and responses
- Version: 0.1.0

## Architecture
- Single entry point: src/index.ts
- Export a simple function: \`greet(name: string): string\`

## Implementation
Create a simple greeting function that returns "Hello, {name}!"`;

  const testRequirementsContent = `# BernierLLC Package Requirements

## TypeScript & Code Quality
- Zero TypeScript Errors (Strict Mode)
- Zero ESLint Errors
- No \`any\` types
- JSDoc comments on all public APIs

## Testing
- Minimum 80% test coverage
- Tests in __tests__/ directory

## Build
- package.json with required scripts (build, test, lint)
- tsconfig.json with strict mode
- dist/ directory with compiled output`;

  beforeAll(async () => {
    // Create test directory
    await fs.mkdir(testDir, { recursive: true });
    
    // Check if Claude CLI is available
    try {
      await execPromise('which claude');
    } catch {
      throw new Error('Claude CLI not found. Install with: npm install -g @anthropic-ai/cli');
    }
  });

  describe('requestTaskBreakdown - Actual CLI Call', () => {
    it('should show the actual prompt sent to Claude CLI', async () => {
      // Capture what gets sent to the CLI
      const breakdown = await requestTaskBreakdown({
        planContent: testPlanContent,
        requirementsContent: testRequirementsContent,
        phase: 'scaffold',
        workingDir: testDir,
        provider: 'claude',
        contextContent: 'Test context',
      });

      console.log('\n=== TASK BREAKDOWN RESULT ===');
      console.log(JSON.stringify(breakdown, null, 2));
      console.log('\n');

      // Verify we got a response
      expect(breakdown.tasks).toBeDefined();
      expect(Array.isArray(breakdown.tasks)).toBe(true);
      expect(breakdown.tasks.length).toBeGreaterThan(0);

      // Log the first task to see structure
      if (breakdown.tasks.length > 0) {
        console.log('First task:', JSON.stringify(breakdown.tasks[0], null, 2));
      }

      // Verify task structure
      breakdown.tasks.forEach((task, index) => {
        expect(task.id).toBeDefined();
        expect(task.title).toBeDefined();
        expect(task.description).toBeDefined();
        expect(task.acceptance_criteria).toBeDefined();
        expect(Array.isArray(task.acceptance_criteria)).toBe(true);
        console.log(`Task ${index + 1}: ${task.title} (${task.id})`);
      });

      // Check for activity requests
      if (breakdown.activities && breakdown.activities.length > 0) {
        console.log('\nActivity requests:', JSON.stringify(breakdown.activities, null, 2));
      }

      // Check for outline
      if (breakdown.outline) {
        console.log('\nOutline:', JSON.stringify(breakdown.outline, null, 2));
      }
    }, 60000); // 60 second timeout for actual CLI call

    it('should show iterative planning with completed tasks', async () => {
      const breakdown1 = await requestTaskBreakdown({
        planContent: testPlanContent,
        requirementsContent: testRequirementsContent,
        phase: 'scaffold',
        workingDir: testDir,
        provider: 'claude',
      });

      console.log('\n=== FIRST BREAKDOWN ===');
      console.log(`Tasks: ${breakdown1.tasks.length}`);
      console.log(`More tasks: ${breakdown1.more_tasks}`);

      if (breakdown1.tasks.length > 0) {
        const completedIds = breakdown1.tasks.slice(0, 2).map(t => t.id);
        console.log(`\nCompleting tasks: ${completedIds.join(', ')}`);

        const breakdown2 = await requestTaskBreakdown({
          planContent: testPlanContent,
          requirementsContent: testRequirementsContent,
          phase: 'scaffold',
          workingDir: testDir,
          provider: 'claude',
          completedTaskIds: completedIds,
        });

        console.log('\n=== SECOND BREAKDOWN (After completing tasks) ===');
        console.log(`Tasks: ${breakdown2.tasks.length}`);
        console.log(`More tasks: ${breakdown2.more_tasks}`);
        console.log(`Completed task ID: ${breakdown2.completed_task_id}`);

        // The second breakdown should account for completed tasks
        breakdown2.tasks.forEach(task => {
          if (task.dependencies) {
            console.log(`Task ${task.id} depends on: ${task.dependencies.join(', ')}`);
          }
        });
      }
    }, 120000); // 2 minute timeout for two CLI calls
  });

  describe('executeAgentActivityRequest - Actual Execution', () => {
    it('should execute read_file activity and show result', async () => {
      // Create a test file
      const testFile = path.join(testDir, 'test-read.txt');
      await fs.writeFile(testFile, 'Test file content\nLine 2');

      const result = await executeAgentActivityRequest({
        type: 'read_file',
        args: { path: 'test-read.txt' },
        workingDir: testDir,
      });

      console.log('\n=== READ_FILE RESULT ===');
      console.log(`Success: ${result.success}`);
      console.log(`Output: ${result.output}`);
      console.log(`Error: ${result.error || 'none'}`);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Test file content');
    });

    it('should execute list_dir activity and show result', async () => {
      // Create some test files
      await fs.writeFile(path.join(testDir, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(testDir, 'file2.txt'), 'content2');
      await fs.mkdir(path.join(testDir, 'subdir'), { recursive: true });

      const result = await executeAgentActivityRequest({
        type: 'list_dir',
        args: { path: '.' },
        workingDir: testDir,
      });

      console.log('\n=== LIST_DIR RESULT ===');
      console.log(`Success: ${result.success}`);
      console.log(`Output: ${result.output}`);
      
      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.output!);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThan(0);
    });

    it('should execute run_cmd activity and show result', async () => {
      const result = await executeAgentActivityRequest({
        type: 'run_cmd',
        args: { cmd: 'echo "Hello from CLI test"' },
        workingDir: testDir,
      });

      console.log('\n=== RUN_CMD RESULT ===');
      console.log(`Success: ${result.success}`);
      console.log(`Output: ${result.output}`);
      console.log(`Error: ${result.error || 'none'}`);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Hello from CLI test');
    });
  });

  describe('Full Workflow Simulation', () => {
    it('should simulate a full task breakdown and execution cycle', async () => {
      console.log('\n=== FULL WORKFLOW SIMULATION ===\n');

      // Step 1: Request task breakdown
      console.log('Step 1: Requesting task breakdown...');
      const breakdown = await requestTaskBreakdown({
        planContent: testPlanContent,
        requirementsContent: testRequirementsContent,
        phase: 'scaffold',
        workingDir: testDir,
        provider: 'claude',
      });

      console.log(`Received ${breakdown.tasks.length} tasks`);
      console.log(`More tasks available: ${breakdown.more_tasks}`);

      // Step 2: Execute activity requests (if any)
      if (breakdown.activities && breakdown.activities.length > 0) {
        console.log(`\nStep 2: Executing ${breakdown.activities.length} activity requests...`);
        for (const activity of breakdown.activities) {
          console.log(`  Executing: ${activity.type}`);
          const result = await executeAgentActivityRequest({
            type: activity.type,
            args: activity.args,
            workingDir: testDir,
          });
          console.log(`  Result: ${result.success ? 'success' : 'failed'}`);
          if (result.output) {
            console.log(`  Output (first 100 chars): ${result.output.substring(0, 100)}...`);
          }
        }
      }

      // Step 3: Show task structure
      console.log('\nStep 3: Task structure:');
      breakdown.tasks.forEach((task, index) => {
        console.log(`\n  Task ${index + 1}: ${task.title} (${task.id})`);
        console.log(`    Description: ${task.description.substring(0, 80)}...`);
        console.log(`    Acceptance Criteria: ${task.acceptance_criteria.length} items`);
        if (task.quality_gates) {
          console.log(`    Quality Gates: ${task.quality_gates.join(', ')}`);
        }
        if (task.dependencies && task.dependencies.length > 0) {
          console.log(`    Dependencies: ${task.dependencies.join(', ')}`);
        }
        if (task.activity_requests && task.activity_requests.length > 0) {
          console.log(`    Activity Requests: ${task.activity_requests.length}`);
        }
      });

      console.log('\n=== SIMULATION COMPLETE ===\n');
    }, 180000); // 3 minute timeout
  });
});

