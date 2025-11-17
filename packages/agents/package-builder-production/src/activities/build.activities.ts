import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import type { BuildResult, TestResult, QualityResult, QualityFailure, PublishResult, BuildConfig, PackageNode, PackageCategory } from '../types/index';

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

export async function buildDependencyGraph(auditReportPath: string): Promise<PackageNode[]> {
  // Read audit report
  const content = await fs.readFile(auditReportPath, 'utf-8');
  const report = JSON.parse(content);

  // Extract package dependencies
  const dependencies = report.checks?.packageDependencies || [];

  // For now, create simple graph from single package
  // TODO: Recursively resolve all dependencies
  const packages: PackageNode[] = [];

  // Determine category from package name
  const getCategory = (name: string): PackageCategory => {
    // Check suite first as it's the most specific (packages can have 'ui' or 'service' in 'suite' name)
    if (name.includes('suite')) return 'suite';
    if (name.includes('validator')) return 'validator';
    if (name.includes('core')) return 'core';
    if (name.includes('util')) return 'utility';
    if (name.includes('service')) return 'service';
    if (name.includes('ui')) return 'ui';
    return 'suite';
  };

  // Add dependencies as nodes
  dependencies.forEach((dep: string) => {
    const category = getCategory(dep);
    const layer = categoryToLayer(category);

    packages.push({
      name: dep,
      category,
      dependencies: [],
      layer,
      buildStatus: 'pending'
    });
  });

  // Add main package
  const mainCategory = getCategory(report.packageName);
  packages.push({
    name: report.packageName,
    category: mainCategory,
    dependencies,
    layer: categoryToLayer(mainCategory),
    buildStatus: 'pending'
  });

  // Sort by layer (validators first, suites last)
  return packages.sort((a, b) => a.layer - b.layer);
}

function categoryToLayer(category: PackageCategory): number {
  const layerMap: Record<PackageCategory, number> = {
    'validator': 0,
    'core': 1,
    'utility': 2,
    'service': 3,
    'ui': 4,
    'suite': 5
  };
  return layerMap[category];
}

export interface GitCommitInput {
  workspaceRoot: string;
  packagePath: string;
  message: string;
  gitUser?: {
    name: string;
    email: string;
  };
}

export interface GitCommitResult {
  success: boolean;
  duration: number;
  commitHash?: string;
  stdout: string;
  stderr?: string;
}

export async function commitChanges(input: GitCommitInput): Promise<GitCommitResult> {
  const startTime = Date.now();
  const fullPath = path.join(input.workspaceRoot, input.packagePath);

  try {
    // Configure git user if provided
    if (input.gitUser) {
      await execAsync(
        `git config user.name "${input.gitUser.name}"`,
        { cwd: fullPath }
      );
      await execAsync(
        `git config user.email "${input.gitUser.email}"`,
        { cwd: fullPath }
      );
    }

    // Stage all changes
    await execAsync('git add -A', { cwd: fullPath });

    // Check if there are changes to commit
    const { stdout: statusOut } = await execAsync(
      'git status --porcelain',
      { cwd: fullPath }
    );

    if (!statusOut.trim()) {
      return {
        success: true,
        duration: Date.now() - startTime,
        stdout: 'No changes to commit'
      };
    }

    // Commit with message
    const { stdout } = await execAsync(
      `git commit -m "${input.message.replace(/"/g, '\\"')}"`,
      { cwd: fullPath }
    );

    // Get commit hash
    const { stdout: hashOut } = await execAsync(
      'git rev-parse HEAD',
      { cwd: fullPath }
    );

    return {
      success: true,
      duration: Date.now() - startTime,
      commitHash: hashOut.trim(),
      stdout
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

export interface GitPushInput {
  workspaceRoot: string;
  packagePath: string;
  remote?: string;
  branch?: string;
  force?: boolean;
}

export interface GitPushResult {
  success: boolean;
  duration: number;
  stdout: string;
  stderr?: string;
}

export async function pushChanges(input: GitPushInput): Promise<GitPushResult> {
  const startTime = Date.now();
  const fullPath = path.join(input.workspaceRoot, input.packagePath);

  const remote = input.remote || 'origin';
  const branch = input.branch || 'main';
  const forceFlag = input.force ? '--force' : '';

  try {
    // Check if we have commits to push
    const { stdout: statusOut } = await execAsync(
      `git status -sb`,
      { cwd: fullPath }
    );

    console.log(`[GitPush] Status: ${statusOut.trim()}`);

    // Push to remote
    const { stdout, stderr } = await execAsync(
      `git push ${forceFlag} ${remote} ${branch}`.trim(),
      { cwd: fullPath }
    );

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

// ============================================================================
// Package State Validation Activities
// ============================================================================

/**
 * Check if package code exists in the workspace
 */
export async function checkPackageExists(input: {
  workspaceRoot: string;
  packagePath: string;
}): Promise<boolean> {
  const fullPath = path.join(input.workspaceRoot, input.packagePath);

  try {
    await fs.access(fullPath);
    const stats = await fs.stat(fullPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

export interface NpmPublishStatus {
  published: boolean;
  version?: string;
  latestVersion?: string;
}

/**
 * Check if package is published to npm registry
 */
export async function checkNpmPublished(packageName: string): Promise<NpmPublishStatus> {
  try {
    const response = await fetch(`https://registry.npmjs.org/${packageName}`);

    if (response.status === 404) {
      return { published: false };
    }

    if (!response.ok) {
      console.warn(`[NpmCheck] Unexpected response: ${response.status}`);
      return { published: false };
    }

    const data = await response.json();
    const latestVersion = data['dist-tags']?.latest;

    return {
      published: true,
      version: latestVersion,
      latestVersion
    };
  } catch (error: any) {
    console.error(`[NpmCheck] Error checking npm registry:`, error.message);
    return { published: false };
  }
}

/**
 * Check if plan file indicates an upgrade vs initial implementation
 */
export async function checkIfUpgradePlan(input: {
  workspaceRoot: string;
  planPath: string;
}): Promise<boolean> {
  const fullPath = path.join(input.workspaceRoot, input.planPath);

  try {
    const planContent = await fs.readFile(fullPath, 'utf-8');

    // Check for upgrade indicators in plan content
    const upgradeIndicators = [
      /upgrade/i,
      /update/i,
      /version\s+\d+\.\d+\.\d+\s+to\s+\d+\.\d+\.\d+/i,
      /enhancement/i,
      /breaking\s+change/i,
      /migration/i
    ];

    return upgradeIndicators.some(pattern => pattern.test(planContent));
  } catch (error) {
    // If we can't read the plan, assume it's initial implementation
    return false;
  }
}

export interface PackageAuditResult {
  status: 'complete' | 'needs_work' | 'blocked';
  findings: string[];
  nextSteps: string[];
  completionPercentage: number;
}

/**
 * Audit existing package code against plan (for partial implementations)
 *
 * This is called when:
 * - Code exists in repo
 * - Package is NOT published to npm
 * - Need to determine what's incomplete
 */
export async function auditPackageState(input: {
  workspaceRoot: string;
  packagePath: string;
  planPath: string;
}): Promise<PackageAuditResult> {
  console.log(`[PackageAudit] Auditing partial implementation...`);
  console.log(`[PackageAudit] Package: ${input.packagePath}`);
  console.log(`[PackageAudit] Plan: ${input.planPath}`);

  // TODO: Implement AI agent audit logic
  // For now, return stub indicating audit capability exists

  const fullPath = path.join(input.workspaceRoot, input.packagePath);

  // Check for basic structure
  const findings: string[] = [];
  const nextSteps: string[] = [];

  try {
    // Check package.json
    const pkgJsonPath = path.join(fullPath, 'package.json');
    try {
      await fs.access(pkgJsonPath);
      findings.push('✅ package.json exists');
    } catch {
      findings.push('❌ package.json missing');
      nextSteps.push('Create package.json with dependencies and scripts');
    }

    // Check src directory
    const srcPath = path.join(fullPath, 'src');
    try {
      await fs.access(srcPath);
      findings.push('✅ src/ directory exists');
    } catch {
      findings.push('❌ src/ directory missing');
      nextSteps.push('Create src/ directory with implementation');
    }

    // Check tests
    const testsPath = path.join(fullPath, 'tests');
    try {
      await fs.access(testsPath);
      findings.push('✅ tests/ directory exists');
    } catch {
      findings.push('❌ tests/ directory missing');
      nextSteps.push('Create tests/ directory with test suite');
    }

  } catch (error) {
    findings.push(`⚠️ Error during audit: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Calculate rough completion percentage
  const totalChecks = 3;
  const passedChecks = findings.filter(f => f.startsWith('✅')).length;
  const completionPercentage = Math.round((passedChecks / totalChecks) * 100);

  return {
    status: nextSteps.length === 0 ? 'complete' : 'needs_work',
    findings,
    nextSteps,
    completionPercentage
  };
}

/**
 * Audit package upgrade requirements (for published packages with upgrade plans)
 *
 * This is called when:
 * - Package IS published to npm
 * - We have an upgrade plan
 * - Need to determine what changes are needed
 */
export async function auditPackageUpgrade(input: {
  workspaceRoot: string;
  packagePath: string;
  planPath: string;
  currentVersion: string;
}): Promise<PackageAuditResult> {
  console.log(`[UpgradeAudit] Auditing upgrade requirements...`);
  console.log(`[UpgradeAudit] Package: ${input.packagePath}`);
  console.log(`[UpgradeAudit] Current version: ${input.currentVersion}`);
  console.log(`[UpgradeAudit] Plan: ${input.planPath}`);

  // TODO: Implement AI agent upgrade audit logic
  // For now, return stub indicating upgrade audit needed

  return {
    status: 'needs_work',
    findings: [
      `Current version: ${input.currentVersion}`,
      'Upgrade plan detected',
      'AI agent audit not yet implemented'
    ],
    nextSteps: [
      'Implement AI agent to analyze upgrade requirements',
      'Compare current code with plan specifications',
      'Identify breaking changes and migration needs'
    ],
    completionPercentage: 0
  };
}
