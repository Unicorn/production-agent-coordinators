import { execa } from 'execa';
import { BrainGridCliError } from './models';

/**
 * Run a BrainGrid CLI command and return parsed JSON output
 */
export async function runBrainGridCommand(
  args: string[],
  options?: {
    cwd?: string;
    env?: Record<string, string>;
  }
): Promise<any> {
  const cliPath = process.env.BRAINGRID_CLI_PATH || 'braingrid';

  try {
    const result = await execa(cliPath, args, {
      cwd: options?.cwd,
      env: {
        ...process.env,
        ...options?.env
      },
      timeout: 30000, // 30 second timeout
      reject: false // Don't throw on non-zero exit
    });

    // Check for errors
    if (result.exitCode !== 0) {
      throw new BrainGridCliError(
        `BrainGrid CLI command failed: ${args.join(' ')}`,
        cliPath,
        result.exitCode,
        result.stderr
      );
    }

    // Try to parse JSON output
    const stdout = result.stdout.trim();
    if (!stdout) {
      return null;
    }

    try {
      return JSON.parse(stdout);
    } catch (e) {
      // Not JSON output, return as-is
      return null;
    }
  } catch (error) {
    if (error instanceof BrainGridCliError) {
      throw error;
    }

    // Handle execa errors
    throw new BrainGridCliError(
      `Failed to execute BrainGrid CLI: ${(error as Error).message}`,
      cliPath,
      (error as any).exitCode || -1,
      (error as any).stderr || ''
    );
  }
}
