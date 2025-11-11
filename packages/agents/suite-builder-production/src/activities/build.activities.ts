import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import type { BuildResult, TestResult } from '../types/index';

const execAsync = promisify(exec);

export async function runBuild(input: {
  workspaceRoot: string;
  packagePath: string;
}): Promise<BuildResult> {
  const startTime = Date.now();
  const fullPath = path.join(input.workspaceRoot, input.packagePath);

  try {
    const { stdout, stderr } = await execAsync('yarn build', { cwd: fullPath });

    return {
      success: true,
      duration: Date.now() - startTime,
      stdout,
      stderr
    };
  } catch (error: any) {
    return {
      success: false,
      duration: Date.now() - startTime,
      stdout: error.stdout || '',
      stderr: error.stderr || error.message
    };
  }
}

export async function runTests(input: {
  workspaceRoot: string;
  packagePath: string;
}): Promise<TestResult> {
  const startTime = Date.now();
  const fullPath = path.join(input.workspaceRoot, input.packagePath);

  try {
    const { stdout, stderr } = await execAsync(
      'yarn test --run --coverage',
      { cwd: fullPath }
    );

    // Parse coverage from output (simple regex for "Coverage: XX%")
    const coverageMatch = stdout.match(/Coverage:\s*(\d+)%/);
    const coverage = coverageMatch ? parseInt(coverageMatch[1], 10) : 0;

    return {
      success: true,
      duration: Date.now() - startTime,
      coverage,
      stdout,
      stderr
    };
  } catch (error: any) {
    return {
      success: false,
      duration: Date.now() - startTime,
      coverage: 0,
      stdout: error.stdout || '',
      stderr: error.stderr || error.message
    };
  }
}
