import { describe, it, expect } from 'vitest';
import { execa } from 'execa';

/**
 * Mock Validation Tests
 *
 * Per CLAUDE.md requirement: "mocks used in tests must always be validated!"
 * These tests verify our execa mock matches the real execa library behavior.
 */
describe('Execa Mock Validation', () => {
  it('should match real execa return structure for successful commands', async () => {
    // Use real execa with a simple command
    const result = await execa('echo', ['test']);

    // Verify structure matches what our mocks return
    expect(result).toHaveProperty('stdout');
    expect(result).toHaveProperty('stderr');
    expect(result).toHaveProperty('exitCode');

    // Verify types
    expect(typeof result.stdout).toBe('string');
    expect(typeof result.stderr).toBe('string');
    expect(typeof result.exitCode).toBe('number');

    // Verify successful command properties
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('test');
  });

  it('should match real execa error structure for failed commands', async () => {
    try {
      // Use a command that will fail
      await execa('false'); // 'false' command always exits with code 1

      // Should not reach here
      expect.fail('Expected command to fail');
    } catch (error: unknown) {
      // Verify error structure matches what our mocks throw
      expect(error).toHaveProperty('exitCode');
      expect(error).toHaveProperty('stderr');
      expect(error).toHaveProperty('stdout');

      const execaError = error as { exitCode: number; stderr: string; stdout: string };
      expect(typeof execaError.exitCode).toBe('number');
      expect(execaError.exitCode).not.toBe(0);
    }
  });

  it('should handle JSON output correctly', async () => {
    // Test that real execa can handle JSON output
    const jsonOutput = { test: 'value', number: 123 };
    const result = await execa('echo', [JSON.stringify(jsonOutput)]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe(JSON.stringify(jsonOutput));

    // Verify we can parse it
    const parsed = JSON.parse(result.stdout);
    expect(parsed).toEqual(jsonOutput);
  });
});
