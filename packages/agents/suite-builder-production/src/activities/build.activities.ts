import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import type { BuildResult, TestResult, QualityResult, QualityFailure, PublishResult, BuildConfig } from '../types/index';

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

export async function runQualityChecks(input: {
  workspaceRoot: string;
  packagePath: string;
}): Promise<QualityResult> {
  const startTime = Date.now();
  const fullPath = path.join(input.workspaceRoot, input.packagePath);

  try {
    const { stdout } = await execAsync(
      './manager validate-requirements',
      { cwd: fullPath }
    );

    return {
      passed: true,
      duration: Date.now() - startTime,
      failures: [],
      stdout
    };
  } catch (error: any) {
    const stdout = error.stdout || '';
    const failures = parseQualityFailures(stdout);

    return {
      passed: false,
      duration: Date.now() - startTime,
      failures,
      stdout
    };
  }
}

function parseQualityFailures(output: string): QualityFailure[] {
  const failures: QualityFailure[] = [];

  // Parse format: "LINT ERROR: file.ts:line - message"
  const lintRegex = /LINT ERROR:\s*([^:]+):(\d+)\s*-\s*(.+)/g;
  let match;

  while ((match = lintRegex.exec(output)) !== null) {
    failures.push({
      type: 'lint',
      file: match[1],
      line: parseInt(match[2], 10),
      message: match[3]
    });
  }

  // Parse test failures
  if (output.includes('TEST FAILED')) {
    failures.push({
      type: 'test',
      message: 'Test suite failed'
    });
  }

  return failures;
}

export async function publishPackage(input: {
  packageName: string;
  packagePath: string;
  config: BuildConfig;
}): Promise<PublishResult> {
  const startTime = Date.now();
  const fullPath = path.join(input.config.workspaceRoot, input.packagePath);

  const env = {
    ...process.env,
    NPM_TOKEN: input.config.npmToken
  };

  try {
    const { stdout } = await execAsync(
      'npm publish --access restricted',
      { cwd: fullPath, env }
    );

    return {
      success: true,
      duration: Date.now() - startTime,
      stdout
    };
  } catch (error: any) {
    return {
      success: false,
      duration: Date.now() - startTime,
      stdout: error.stdout || error.message
    };
  }
}
