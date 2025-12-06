/**
 * Simple CLI Test - Minimal prompt to verify CLI responds
 * 
 * This test uses a very small prompt to verify the CLI is working
 * and we can get responses back.
 */

import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

// Skip these tests by default
const RUN_SIMPLE_TESTS = process.env.RUN_SIMPLE_CLI_TESTS === 'true';

/**
 * Simple CLI execution with minimal prompt
 */
async function executeSimpleCLI(prompt: string, workingDir: string): Promise<{
  success: boolean;
  result: string;
  error?: string;
  duration_ms: number;
}> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';

    const args = [
      '--print',
      '--output-format', 'json',
      '--permission-mode', 'acceptEdits',
      '--allowedTools', 'Read,Write,Edit,Bash',
      '--model', 'sonnet',
      prompt,
    ];

    console.log(`[SimpleCLI] Executing: claude ${args.join(' ')}`);
    console.log(`[SimpleCLI] Prompt: ${prompt.substring(0, 100)}...`);

    // Don't set timeout on spawn - let the test timeout handle it
    // The spawn timeout kills the process, which prevents us from seeing output
    // Explicitly set stdio to pipes and ensure stdin is closed
    // This prevents hanging when CLI expects TTY or waits on stdin
    const proc = spawn('claude', args, {
      cwd: workingDir,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'], // Explicitly set stdin/stdout/stderr to pipes
    });

    // CRITICAL: Close stdin immediately to prevent CLI from waiting for input
    proc.stdin.end();

    // Handle errors on stdin (shouldn't happen after end(), but be safe)
    proc.stdin.on('error', (err) => {
      // Ignore EPIPE errors after stdin.end() - this is expected
      if ((err as NodeJS.ErrnoException).code !== 'EPIPE') {
        console.error(`[SimpleCLI] stdin error: ${err}`);
      }
    });

    proc.stdout.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stdout += chunk;
      console.log(`[SimpleCLI] stdout chunk (${chunk.length} bytes)`);
    });

    proc.stderr.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stderr += chunk;
      console.log(`[SimpleCLI] stderr: ${chunk}`);
    });

    proc.on('error', (error: Error) => {
      console.error(`[SimpleCLI] Process error: ${error.message}`);
      resolve({
        success: false,
        result: '',
        error: `Failed to start: ${error.message}`,
        duration_ms: Date.now() - startTime,
      });
    });

    proc.on('close', (code: number | null) => {
      const duration = Date.now() - startTime;
      console.log(`[SimpleCLI] Process closed with code: ${code}, duration: ${duration}ms`);

      if (code !== 0) {
        resolve({
          success: false,
          result: '',
          error: `CLI exited with code ${code}: ${stderr || 'Unknown error'}`,
          duration_ms: duration,
        });
        return;
      }

      const trimmed = stdout.trim();
      if (!trimmed) {
        resolve({
          success: false,
          result: '',
          error: 'No output from CLI',
          duration_ms: duration,
        });
        return;
      }

      console.log(`[SimpleCLI] Raw output (first 500 chars): ${trimmed.substring(0, 500)}`);

      // Try to parse as JSON (CLI returns JSON with result field)
      try {
        const parsed = JSON.parse(trimmed);
        console.log(`[SimpleCLI] Successfully parsed JSON`);
        
        // Extract the actual result from the CLI response
        // CLI returns: { result: "...", cost_usd: ..., etc. }
        let actualResult = '';
        if (parsed.result) {
          actualResult = parsed.result;
          // Remove markdown code blocks if present
          if (actualResult.startsWith('```')) {
            const firstBlockEnd = actualResult.indexOf('```', 3);
            if (firstBlockEnd !== -1) {
              let blockContent = actualResult.substring(3, firstBlockEnd).trim();
              if (blockContent.startsWith('json') || blockContent.startsWith('JSON')) {
                blockContent = blockContent.substring(4).trim();
              }
              actualResult = blockContent;
            }
          }
        } else {
          // If no result field, use the whole parsed object
          actualResult = JSON.stringify(parsed, null, 2);
        }
        
        resolve({
          success: true,
          result: actualResult,
          duration_ms: duration,
        });
      } catch (parseError) {
        // Not JSON, but we got output
        console.log(`[SimpleCLI] Failed to parse JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        resolve({
          success: true,
          result: trimmed,
          duration_ms: duration,
        });
      }
    });
  });
}

describe.skipIf(!RUN_SIMPLE_TESTS)('Simple CLI Test', () => {
  const testDir = '/tmp/cli-simple-test';

  beforeAll(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  it('should get a response from Claude CLI with minimal prompt', async () => {
    const simplePrompt = 'Return a JSON object: {"test": "success", "message": "CLI is working"}';

    console.log('\n=== SIMPLE CLI TEST ===');
    console.log(`Prompt: ${simplePrompt}`);
    console.log(`Working dir: ${testDir}`);
    console.log('');

    const result = await executeSimpleCLI(simplePrompt, testDir);

    console.log('\n=== RESULT ===');
    console.log(`Success: ${result.success}`);
    console.log(`Duration: ${result.duration_ms}ms`);
    console.log(`Error: ${result.error || 'none'}`);
    console.log(`Result (first 500 chars):`);
    console.log(result.result.substring(0, 500));
    console.log('');

    // We should get SOME response, even if it's not perfect JSON
    expect(result.result).toBeTruthy();
    expect(result.result.length).toBeGreaterThan(0);
    
    // If we got JSON, verify it's parseable
    if (result.result.trim().startsWith('{')) {
      const parsed = JSON.parse(result.result);
      expect(parsed).toBeDefined();
      console.log('✅ Successfully parsed JSON response');
    }
  }, 300000); // 5 minute timeout

  it('should get task breakdown response with minimal plan', async () => {
    const minimalPrompt = `You are a task planner. Analyze this simple plan and return 2-3 tasks in JSON format.

Plan: Create a simple greeting function that returns "Hello, {name}!"

Return JSON:
{
  "tasks": [
    {
      "id": "T1",
      "title": "Task name",
      "description": "Task description",
      "acceptance_criteria": ["Criterion 1"]
    }
  ]
}`;

    console.log('\n=== MINIMAL TASK BREAKDOWN TEST ===');
    console.log(`Prompt length: ${minimalPrompt.length} characters`);
    console.log('');

    const result = await executeSimpleCLI(minimalPrompt, testDir);

    console.log('\n=== RESULT ===');
    console.log(`Success: ${result.success}`);
    console.log(`Duration: ${result.duration_ms}ms`);
    if (result.error) {
      console.log(`Error: ${result.error}`);
    }
    console.log(`\nFull response:`);
    console.log(result.result);
    console.log('');

    expect(result.success).toBe(true);
    expect(result.result).toBeTruthy();
    
    // Try to parse as task breakdown
    try {
      const parsed = JSON.parse(result.result);
      expect(parsed.tasks).toBeDefined();
      expect(Array.isArray(parsed.tasks)).toBe(true);
      console.log(`✅ Got ${parsed.tasks.length} tasks`);
    } catch {
      console.log('⚠️  Response is not valid JSON, but we got output');
    }
  }, 300000); // 5 minute timeout
});

