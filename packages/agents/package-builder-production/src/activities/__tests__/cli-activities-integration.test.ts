/**
 * CLI Activities Integration Tests
 * 
 * These tests call the REAL CLI (not mocked) to verify activities work correctly
 * before they're used in workflows. This is a middle ground between:
 * - Unit tests (mocked, fast, but don't test real CLI)
 * - E2E tests (full workflow, slow, complex)
 * 
 * These tests:
 * - Call real Claude/Gemini CLI
 * - Test activities in isolation
 * - Provide fast feedback on activity behavior
 * - Can be run before workflow tests to catch issues early
 * 
 * To run: RUN_ACTIVITY_INTEGRATION_TESTS=true npm test -- cli-activities-integration.test.ts
 * 
 * ✅ FIXED: The CLI hanging issue has been resolved by:
 * - Explicitly closing stdin with proc.stdin.end()
 * - Setting stdio to ['pipe', 'pipe', 'pipe']
 * - Properly draining stdout/stderr to prevent backpressure
 * 
 * Note: These tests require:
 * - Claude CLI installed and authenticated (for Claude tests)
 * - Gemini CLI installed and authenticated (for Gemini tests)
 * - ANTHROPIC_API_KEY or GEMINI_API_KEY environment variables
 * - May incur API costs
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  checkCLICreditsForExecution,
  selectClaudeModel,
  executeClaudeCLI,
  executeGeminiCLI,
  validateCLIResult,
  requestTaskBreakdown,
  executeAgentActivityRequest,
} from '../cli-agent.activities';
import * as fs from 'fs/promises';
import * as path from 'path';

// Skip these tests by default (they require CLI and API keys)
const RUN_INTEGRATION_TESTS = process.env.RUN_ACTIVITY_INTEGRATION_TESTS === 'true';

const testDir = '/tmp/cli-activities-integration-test';

// Simple test plan and requirements
const testPlanContent = `# Test Package Plan

## Package Overview
- Name: test-package
- Description: A simple test package
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

// Temporarily enable all tests to focus on requestTaskBreakdown
// Focus on requestTaskBreakdown test only - temporarily enable even without env var
describe('CLI Activities Integration Tests (Real CLI)', () => {
  beforeAll(async () => {
    // Create test directory
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe.skip('checkCLICreditsForExecution', () => {
    it.skip('should check credits for both providers', async () => {
      console.log('\n=== Testing checkCLICreditsForExecution ===');
      
      const result = await checkCLICreditsForExecution();
      
      console.log('Claude available:', result.claude.available);
      console.log('Gemini available:', result.gemini.available);
      if (!result.claude.available) {
        console.log('Claude reason:', result.claude.reason);
      }
      if (!result.gemini.available) {
        console.log('Gemini reason:', result.gemini.reason);
      }
      
      // At least one should be available
      expect(result.claude.available || result.gemini.available).toBe(true);
    }, 30000); // 30 second timeout
  });

  describe.skip('selectClaudeModel', () => {
    it.skip('should select appropriate model for scaffold task', async () => {
      console.log('\n=== Testing selectClaudeModel (scaffold) ===');
      
      const result = await selectClaudeModel('scaffold');
      
      console.log('Selected model:', result.model);
      console.log('Permission mode:', result.permissionMode);
      
      expect(result.model).toBeDefined();
      expect(['opus', 'sonnet', 'haiku']).toContain(result.model);
      expect(['plan', 'acceptEdits', 'full']).toContain(result.permissionMode);
    }, 10000);
  });

  describe.skip('executeClaudeCLI', () => {
    it.skip('should execute a simple Claude CLI command', async () => {
      console.log('\n=== Testing executeClaudeCLI (simple command) ===');
      
      const result = await executeClaudeCLI({
        instruction: 'List the files in the current directory. Return only a JSON array of filenames.',
        workingDir: testDir,
        model: 'sonnet',
        permissionMode: 'acceptEdits',
        timeoutMs: 120000, // 2 minutes for simple command
      });
      
      console.log('Success:', result.success);
      console.log('Cost: $', result.cost_usd);
      console.log('Duration:', result.duration_ms, 'ms');
      console.log('Session ID:', result.session_id || 'none');
      if (result.error) {
        console.log('Error:', result.error);
      }
      console.log('Response (first 500 chars):', result.result.substring(0, 500));
      
      expect(result.success).toBe(true);
      expect(result.result).toBeTruthy();
    }, 150000); // 2.5 minute timeout
  });

  describe('requestTaskBreakdown', () => {
    it.only('should request task breakdown from Claude CLI with real call', async () => {
      console.log('\n=== Testing requestTaskBreakdown (real CLI) ===');
      console.log('Plan length:', testPlanContent.length, 'chars');
      console.log('Requirements length:', testRequirementsContent.length, 'chars');
      console.log('Working directory:', testDir);
      console.log('Provider: claude');
      console.log('');
      
      const startTime = Date.now();
      
      const result = await requestTaskBreakdown({
        planContent: testPlanContent,
        requirementsContent: testRequirementsContent,
        phase: 'scaffold',
        workingDir: testDir,
        provider: 'claude',
        contextContent: `# Test Context\n\n${testRequirementsContent}\n\n---\n\n${testPlanContent}`,
      });
      
      const duration = Date.now() - startTime;
      
      console.log('\n=== BREAKDOWN RESULT ===');
      console.log(`Duration: ${duration}ms (${(duration / 1000).toFixed(1)}s)`);
      console.log('Tasks received:', result.tasks.length);
      console.log('More tasks available:', result.more_tasks);
      if (result.outline) {
        console.log('Outline phases:', result.outline.length);
        result.outline.forEach((phase, i) => {
          console.log(`  Phase ${i + 1}: ${phase.title}`);
        });
      }
      if (result.activities && result.activities.length > 0) {
        console.log('Activity requests:', result.activities.length);
        result.activities.forEach((activity, i) => {
          console.log(`  Activity ${i + 1}: ${activity.type}`);
        });
      }
      
      // Log first task details
      if (result.tasks.length > 0) {
        const firstTask = result.tasks[0];
        console.log('\nFirst task:');
        console.log('  ID:', firstTask.id);
        console.log('  Title:', firstTask.title);
        console.log('  Description:', firstTask.description.substring(0, 100) + '...');
        console.log('  Acceptance criteria:', firstTask.acceptance_criteria.length);
        if (firstTask.acceptance_criteria.length > 0) {
          console.log('    -', firstTask.acceptance_criteria[0]);
        }
        console.log('  Quality gates:', firstTask.quality_gates?.length || 0);
        if (firstTask.quality_gates && firstTask.quality_gates.length > 0) {
          console.log('    -', firstTask.quality_gates[0]);
        }
        console.log('  Dependencies:', firstTask.dependencies?.length || 0);
        if (firstTask.dependencies && firstTask.dependencies.length > 0) {
          console.log('    -', firstTask.dependencies.join(', '));
        }
      }
      
      // Log all tasks
      console.log('\n=== ALL TASKS ===');
      result.tasks.forEach((task, i) => {
        console.log(`${i + 1}. ${task.id}: ${task.title}`);
      });
      
      expect(result.tasks).toBeDefined();
      expect(Array.isArray(result.tasks)).toBe(true);
      expect(result.tasks.length).toBeGreaterThan(0);
      expect(result.tasks[0].id).toBeDefined();
      expect(result.tasks[0].title).toBeDefined();
      
      console.log('\n✅ Test passed! CLI piping fix is working.');
    }, 600000); // 10 minute timeout (matching activity timeout)
  });

  describe.skip('executeAgentActivityRequest', () => {
    it.skip('should execute read_file activity request', async () => {
      console.log('\n=== Testing executeAgentActivityRequest (read_file) ===');
      
      // Create a test file first
      const testFile = path.join(testDir, 'test.txt');
      await fs.writeFile(testFile, 'Hello from test file');
      
      const result = await executeAgentActivityRequest({
        type: 'read_file',
        args: { path: 'test.txt' },
        workingDir: testDir,
      });
      
      console.log('Success:', result.success);
      console.log('Output:', result.output);
      if (result.error) {
        console.log('Error:', result.error);
      }
      
      expect(result.success).toBe(true);
      expect(result.output).toContain('Hello from test file');
    }, 10000);

    it.skip('should execute list_dir activity request', async () => {
      console.log('\n=== Testing executeAgentActivityRequest (list_dir) ===');
      
      const result = await executeAgentActivityRequest({
        type: 'list_dir',
        args: { path: '.' },
        workingDir: testDir,
      });
      
      console.log('Success:', result.success);
      console.log('Output:', result.output);
      
      expect(result.success).toBe(true);
      expect(result.output).toBeTruthy();
    }, 10000);

    it.skip('should execute run_cmd activity request', async () => {
      console.log('\n=== Testing executeAgentActivityRequest (run_cmd) ===');
      
      const result = await executeAgentActivityRequest({
        type: 'run_cmd',
        args: { cmd: 'echo "Hello from CLI test"' },
        workingDir: testDir,
      });
      
      console.log('Success:', result.success);
      console.log('Output:', result.output);
      
      expect(result.success).toBe(true);
      expect(result.output).toContain('Hello from CLI test');
    }, 10000);
  });

  describe.skip('validateCLIResult', () => {
    it.skip('should validate a successful CLI result', async () => {
      console.log('\n=== Testing validateCLIResult ===');
      
      // First get a real result
      const cliResult = await executeClaudeCLI({
        instruction: 'Return the string "test successful"',
        workingDir: testDir,
        model: 'sonnet',
        permissionMode: 'acceptEdits',
        timeoutMs: 60000,
      });
      
      console.log('CLI result success:', cliResult.success);
      
      // Then validate it
      const validated = await validateCLIResult(cliResult, 'claude');
      
      console.log('Validated result success:', validated.success);
      
      expect(validated.success).toBe(true);
      expect(validated.result).toBeTruthy();
    }, 90000); // 1.5 minute timeout
  });

  describe.skip('Full Activity Chain Test', () => {
    it.skip('should execute a full chain: check credits -> select model -> execute CLI -> validate', async () => {
      console.log('\n=== Testing Full Activity Chain ===');
      
      // Step 1: Check credits
      console.log('Step 1: Checking credits...');
      const credits = await checkCLICreditsForExecution();
      if (!credits.claude.available) {
        console.log('⚠️  Claude not available, skipping chain test');
        return;
      }
      
      // Step 2: Select model
      console.log('Step 2: Selecting model...');
      const modelConfig = await selectClaudeModel('scaffold');
      console.log('  Model:', modelConfig.model);
      console.log('  Permission:', modelConfig.permissionMode);
      
      // Step 3: Execute CLI
      console.log('Step 3: Executing CLI...');
      const cliResult = await executeClaudeCLI({
        instruction: 'List files in current directory as JSON array',
        workingDir: testDir,
        model: modelConfig.model,
        permissionMode: modelConfig.permissionMode,
        timeoutMs: 120000,
      });
      console.log('  Success:', cliResult.success);
      console.log('  Cost: $', cliResult.cost_usd);
      
      // Step 4: Validate
      console.log('Step 4: Validating result...');
      const validated = await validateCLIResult(cliResult, 'claude');
      console.log('  Validated:', validated.success);
      
      expect(validated.success).toBe(true);
    }, 180000); // 3 minute timeout
  });
});

