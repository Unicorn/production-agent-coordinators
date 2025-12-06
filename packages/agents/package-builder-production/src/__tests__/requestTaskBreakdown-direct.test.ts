/**
 * Direct Test for requestTaskBreakdown Activity
 * 
 * This test directly calls the requestTaskBreakdown activity to verify:
 * 1. It doesn't hang when called directly
 * 2. It properly executes the Claude CLI
 * 3. It returns valid task breakdown
 * 
 * This isolates the activity from the full workflow to identify if the issue
 * is with the activity itself or with the workflow/worker setup.
 * 
 * Run with: RUN_DIRECT_REQUESTTASKBREAKDOWN=true npm test -- requestTaskBreakdown-direct.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { requestTaskBreakdown } from '../activities/cli-agent.activities.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { checkClaudeCLI } from '../activities/credentials.activities.js';

const RUN_DIRECT_TEST = process.env.RUN_DIRECT_REQUESTTASKBREAKDOWN === 'true';

const TEST_WORKSPACE_ROOT = path.join(process.cwd(), 'test-workspace-direct');
const TEST_PACKAGE_PATH = path.join(TEST_WORKSPACE_ROOT, 'packages', 'test', 'simple-package');

const TEST_PLAN_CONTENT = `# Test Package Plan

## Package Overview
- Name: @test/simple-package
- Description: A simple test package for CLI integration testing
- Version: 0.1.0

## Architecture
- Single entry point: src/index.ts
- Export a simple function: \`greet(name: string): string\`

## Implementation
Create a simple greeting function that returns "Hello, {name}!"
`;

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

describe.skipIf(!RUN_DIRECT_TEST)('requestTaskBreakdown - Direct Activity Test', () => {
  let claudeAvailable: boolean;

  beforeAll(async () => {
    // Check if Claude CLI is available
    try {
      const status = await checkClaudeCLI();
      claudeAvailable = status.available;
      if (!claudeAvailable) {
        console.log('⏭️  Skipping: Claude CLI not available');
      }
    } catch (error) {
      console.error('Error checking Claude CLI:', error);
      claudeAvailable = false;
    }

    // Create test workspace
    await fs.mkdir(TEST_PACKAGE_PATH, { recursive: true });
  }, 30000);

  afterAll(async () => {
    // Cleanup test workspace
    try {
      await fs.rm(TEST_WORKSPACE_ROOT, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup test workspace:', error);
    }
  }, 30000);

  it('should execute requestTaskBreakdown without hanging', async () => {
    if (!claudeAvailable) {
      console.log('⏭️  Skipping: Claude CLI not available');
      return;
    }

    console.log('\n=== Testing requestTaskBreakdown Directly ===');
    console.log(`Working directory: ${TEST_PACKAGE_PATH}`);
    console.log(`Plan content length: ${TEST_PLAN_CONTENT.length} chars`);
    console.log(`Requirements content length: ${TEST_REQUIREMENTS_CONTENT.length} chars`);
    console.log('');

    const startTime = Date.now();

    try {
      // Call the activity directly (not through workflow)
      const result = await Promise.race([
        requestTaskBreakdown({
          planContent: TEST_PLAN_CONTENT,
          requirementsContent: TEST_REQUIREMENTS_CONTENT,
          phase: 'scaffold',
          workingDir: TEST_PACKAGE_PATH,
          provider: 'claude',
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Activity timeout after 5 minutes')), 300000)
        ),
      ]);

      const duration = Date.now() - startTime;
      console.log(`\n✅ requestTaskBreakdown completed in ${duration}ms`);
      console.log(`   Tasks received: ${result.tasks.length}`);
      console.log(`   More tasks: ${result.more_tasks || false}`);
      if (result.outline) {
        console.log(`   Outline phases: ${result.outline.length}`);
      }

      // Verify result structure
      expect(result).toBeDefined();
      expect(result.tasks).toBeDefined();
      expect(Array.isArray(result.tasks)).toBe(true);
      expect(result.tasks.length).toBeGreaterThan(0);

      // Verify task structure
      const firstTask = result.tasks[0];
      expect(firstTask).toHaveProperty('id');
      expect(firstTask).toHaveProperty('title');
      expect(firstTask).toHaveProperty('description');

      console.log(`\n✅ All assertions passed`);
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`\n❌ requestTaskBreakdown failed after ${duration}ms`);
      console.error('Error:', error);
      
      // If it timed out, this indicates the activity is hanging
      if (error instanceof Error && error.message.includes('timeout')) {
        console.error('\n⚠️  ACTIVITY HANGING DETECTED');
        console.error('   The activity did not complete within 5 minutes.');
        console.error('   This suggests the CLI spawn is not working correctly.');
      }
      
      throw error;
    }
  }, 300000); // 5 minute timeout

  it('should handle CLI spawn correctly', async () => {
    if (!claudeAvailable) {
      console.log('⏭️  Skipping: Claude CLI not available');
      return;
    }

    console.log('\n=== Testing CLI Spawn Directly ===');

    const { spawn } = await import('child_process');

    return new Promise<void>((resolve, reject) => {
      const proc = spawn('claude', ['--version'], {
        cwd: TEST_PACKAGE_PATH,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
      });

      // CRITICAL: Close stdin immediately (same as in executeClaudeAgent)
      proc.stdin.end();

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('error', (err: Error) => {
        console.error(`❌ Process error: ${err.message}`);
        reject(err);
      });

      proc.on('close', (code: number | null) => {
        if (code === 0) {
          console.log(`✅ CLI spawn test passed (exit code: ${code})`);
          console.log(`   stdout: ${stdout.trim()}`);
          resolve();
        } else {
          console.error(`❌ CLI spawn test failed (exit code: ${code})`);
          console.error(`   stderr: ${stderr}`);
          reject(new Error(`CLI exited with code ${code}: ${stderr || stdout}`));
        }
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (!proc.killed) {
          proc.kill();
          reject(new Error('CLI spawn test timed out after 30 seconds'));
        }
      }, 30000);
    });
  }, 30000);
});

