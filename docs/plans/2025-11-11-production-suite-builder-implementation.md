# Production Suite Builder Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Temporal-based workflow system for orchestrating builds of ~88 BernierLLC packages in correct dependency order with quality checks, automatic error remediation, and comprehensive reporting.

**Architecture:** Main workflow progresses through 5 phases (INITIALIZE → PLAN → BUILD → VERIFY → COMPLETE). Each package builds in its own child workflow. Dynamic parallelism respects dependency constraints. Agent-based fixes handle quality failures. JSON reports enable data-driven improvements.

**Tech Stack:** TypeScript, Temporal SDK, Node.js child_process for builds, Vitest for testing

---

## Task 1: Setup Package Structure

**Files:**
- Create: `packages/agents/suite-builder-production/package.json`
- Create: `packages/agents/suite-builder-production/tsconfig.json`
- Create: `packages/agents/suite-builder-production/src/index.ts`

**Step 1: Write package.json**

```json
{
  "name": "@coordinator/agent-suite-builder-production",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -b",
    "clean": "rm -rf dist tsconfig.tsbuildinfo",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@temporalio/workflow": "^1.10.0",
    "@temporalio/activity": "^1.10.0",
    "@temporalio/worker": "^1.10.0",
    "@temporalio/client": "^1.10.0"
  },
  "devDependencies": {
    "@types/node": "^22.7.5",
    "typescript": "^5.6.3",
    "vitest": "^1.6.0"
  }
}
```

**Step 2: Write tsconfig.json**

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "references": []
}
```

**Step 3: Write index.ts (exports barrel)**

```typescript
// Workflows
export * from './workflows/suite-builder.workflow';
export * from './workflows/package-build.workflow';

// Activities
export * from './activities/build.activities';
export * from './activities/agent.activities';
export * from './activities/report.activities';

// Types
export * from './types/index';
```

**Step 4: Install dependencies**

Run: `yarn install`
Expected: Dependencies installed successfully

**Step 5: Commit**

```bash
git add packages/agents/suite-builder-production/
git commit -m "feat: initialize suite-builder-production package structure"
```

---

## Task 2: Create Type Definitions

**Files:**
- Create: `packages/agents/suite-builder-production/src/types/index.ts`

**Step 1: Write type definitions**

```typescript
// Build phases
export enum BuildPhase {
  INITIALIZE = 'INITIALIZE',
  PLAN = 'PLAN',
  BUILD = 'BUILD',
  VERIFY = 'VERIFY',
  COMPLETE = 'COMPLETE'
}

// Package category types
export type PackageCategory = 'validator' | 'core' | 'utility' | 'service' | 'ui' | 'suite';

// Dependency graph node
export interface PackageNode {
  name: string;
  category: PackageCategory;
  dependencies: string[];
  layer: number;
  buildStatus: 'pending' | 'building' | 'completed' | 'failed';
}

// Main workflow state
export interface SuiteBuilderState {
  phase: BuildPhase;
  suiteId: string;
  packages: PackageNode[];
  completedPackages: string[];
  failedPackages: PackageFailure[];
  childWorkflowIds: Map<string, string>;
}

// Package failure tracking
export interface PackageFailure {
  packageName: string;
  phase: 'build' | 'test' | 'quality' | 'publish';
  error: string;
  fixAttempts: number;
  canRetryManually: boolean;
}

// Build configuration
export interface BuildConfig {
  npmRegistry: string;
  npmToken: string;
  workspaceRoot: string;
  maxConcurrentBuilds: number;
  temporal: {
    address: string;
    namespace: string;
    taskQueue: string;
  };
  testing: {
    enableCoverage: boolean;
    minCoveragePercent: number;
    failOnError: boolean;
  };
  publishing: {
    dryRun: boolean;
    requireTests: boolean;
    requireCleanWorkingDirectory: boolean;
  };
}

// Main workflow input
export interface SuiteBuilderInput {
  suiteId: string;
  auditReportPath: string;
  config: BuildConfig;
}

// Child workflow input
export interface PackageBuildInput {
  packageName: string;
  packagePath: string;
  planPath: string;
  category: PackageCategory;
  dependencies: string[];
  workspaceRoot: string;
  config: BuildConfig;
}

// Child workflow result
export interface PackageBuildResult {
  success: boolean;
  packageName: string;
  failedPhase?: 'build' | 'test' | 'quality' | 'publish';
  error?: string;
  fixAttempts?: number;
  report: PackageBuildReport;
}

// Build report for package
export interface PackageBuildReport {
  packageName: string;
  workflowId: string;
  startTime: string;
  endTime: string;
  duration: number;

  buildMetrics: {
    buildTime: number;
    testTime: number;
    qualityCheckTime: number;
    publishTime: number;
  };

  quality: {
    lintScore: number;
    testCoverage: number;
    typeScriptErrors: number;
    passed: boolean;
  };

  fixAttempts: Array<{
    count: number;
    types: string[];
    agentPromptUsed: string;
    fixDuration: number;
  }>;

  status: 'success' | 'failed';
  error?: string;

  dependencies: string[];
  waitedFor: Array<{
    packageName: string;
    waitTime: number;
  }>;
}

// Suite aggregate report
export interface SuiteReport {
  suiteId: string;
  timestamp: string;
  totalPackages: number;
  successful: number;
  failed: number;

  totalDuration: number;
  totalFixAttempts: number;

  slowestPackages: PackageBuildReport[];
  mostFixAttempts: PackageBuildReport[];
  totalWaitTime: number;

  packageReports: PackageBuildReport[];
}

// Activity result types
export interface BuildResult {
  success: boolean;
  duration: number;
  stdout: string;
  stderr: string;
}

export interface TestResult {
  success: boolean;
  duration: number;
  coverage: number;
  stdout: string;
  stderr: string;
}

export interface QualityFailure {
  type: string;
  message: string;
  file?: string;
  line?: number;
}

export interface QualityResult {
  passed: boolean;
  duration: number;
  failures: QualityFailure[];
  stdout: string;
}

export interface PublishResult {
  success: boolean;
  duration: number;
  stdout: string;
}
```

**Step 2: Commit**

```bash
git add packages/agents/suite-builder-production/src/types/index.ts
git commit -m "feat: add type definitions for suite builder"
```

---

## Task 3: Implement Build Activities (Part 1 - Build & Test)

**Files:**
- Create: `packages/agents/suite-builder-production/src/activities/build.activities.ts`
- Create: `packages/agents/suite-builder-production/src/activities/__tests__/build.activities.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runBuild, runTests } from '../build.activities';
import * as child_process from 'child_process';

vi.mock('child_process');

describe('Build Activities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('runBuild', () => {
    it('should execute yarn build successfully', async () => {
      vi.mocked(child_process.exec).mockImplementation((cmd, callback: any) => {
        callback(null, { stdout: 'Build successful', stderr: '' });
        return {} as any;
      });

      const result = await runBuild({
        workspaceRoot: '/test/workspace',
        packagePath: 'packages/core/test-package'
      });

      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThan(0);
      expect(child_process.exec).toHaveBeenCalledWith(
        expect.stringContaining('yarn build'),
        expect.any(Function)
      );
    });

    it('should handle build failures', async () => {
      vi.mocked(child_process.exec).mockImplementation((cmd, callback: any) => {
        callback(new Error('Build failed'), { stdout: '', stderr: 'Error' });
        return {} as any;
      });

      const result = await runBuild({
        workspaceRoot: '/test/workspace',
        packagePath: 'packages/core/test-package'
      });

      expect(result.success).toBe(false);
      expect(result.stderr).toContain('Error');
    });
  });

  describe('runTests', () => {
    it('should execute yarn test with coverage', async () => {
      vi.mocked(child_process.exec).mockImplementation((cmd, callback: any) => {
        callback(null, {
          stdout: 'Tests passed\nCoverage: 85%',
          stderr: ''
        });
        return {} as any;
      });

      const result = await runTests({
        workspaceRoot: '/test/workspace',
        packagePath: 'packages/core/test-package'
      });

      expect(result.success).toBe(true);
      expect(result.coverage).toBe(85);
      expect(child_process.exec).toHaveBeenCalledWith(
        expect.stringContaining('yarn test --run'),
        expect.any(Function)
      );
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/agents/suite-builder-production && yarn test`
Expected: FAIL with "Cannot find module '../build.activities'"

**Step 3: Write minimal implementation**

```typescript
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
    const { stdout, stderr } = await execAsync(`cd ${fullPath} && yarn build`);

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
      `cd ${fullPath} && yarn test --run --coverage`
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
```

**Step 4: Run test to verify it passes**

Run: `cd packages/agents/suite-builder-production && yarn test`
Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add packages/agents/suite-builder-production/src/activities/
git commit -m "feat: add build and test activities with tests"
```

---

## Task 4: Implement Build Activities (Part 2 - Quality & Publish)

**Files:**
- Modify: `packages/agents/suite-builder-production/src/activities/build.activities.ts`
- Modify: `packages/agents/suite-builder-production/src/activities/__tests__/build.activities.test.ts`

**Step 1: Write failing test for quality checks**

Add to test file:

```typescript
describe('runQualityChecks', () => {
  it('should execute quality validation successfully', async () => {
    vi.mocked(child_process.exec).mockImplementation((cmd, callback: any) => {
      callback(null, {
        stdout: 'All checks passed',
        stderr: ''
      });
      return {} as any;
    });

    const result = await runQualityChecks({
      workspaceRoot: '/test/workspace',
      packagePath: 'packages/core/test-package'
    });

    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  it('should parse quality failures from output', async () => {
    vi.mocked(child_process.exec).mockImplementation((cmd, callback: any) => {
      callback(new Error('Validation failed'), {
        stdout: 'LINT ERROR: src/index.ts:10 - Missing semicolon',
        stderr: ''
      });
      return {} as any;
    });

    const result = await runQualityChecks({
      workspaceRoot: '/test/workspace',
      packagePath: 'packages/core/test-package'
    });

    expect(result.passed).toBe(false);
    expect(result.failures.length).toBeGreaterThan(0);
  });
});

describe('publishPackage', () => {
  it('should publish package with npm token', async () => {
    vi.mocked(child_process.exec).mockImplementation((cmd, callback: any) => {
      callback(null, {
        stdout: '+ @bernierllc/test-package@0.1.0',
        stderr: ''
      });
      return {} as any;
    });

    const result = await publishPackage({
      packageName: '@bernierllc/test-package',
      packagePath: 'packages/core/test-package',
      config: {
        npmToken: 'test-token',
        workspaceRoot: '/test/workspace'
      } as any
    });

    expect(result.success).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/agents/suite-builder-production && yarn test`
Expected: FAIL with "runQualityChecks is not defined"

**Step 3: Add imports and implement functions**

Add to build.activities.ts:

```typescript
import type { QualityResult, QualityFailure, PublishResult, BuildConfig } from '../types/index';

export async function runQualityChecks(input: {
  workspaceRoot: string;
  packagePath: string;
}): Promise<QualityResult> {
  const startTime = Date.now();
  const fullPath = path.join(input.workspaceRoot, input.packagePath);

  try {
    const { stdout } = await execAsync(
      `cd ${fullPath} && ./manager validate-requirements`
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
      `cd ${fullPath} && npm publish --access restricted`,
      { env }
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
```

**Step 4: Run test to verify it passes**

Run: `cd packages/agents/suite-builder-production && yarn test`
Expected: PASS (6 tests)

**Step 5: Commit**

```bash
git add packages/agents/suite-builder-production/src/activities/
git commit -m "feat: add quality check and publish activities"
```

---

## Task 5: Implement Report Activities

**Files:**
- Create: `packages/agents/suite-builder-production/src/activities/report.activities.ts`
- Create: `packages/agents/suite-builder-production/src/activities/__tests__/report.activities.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writePackageBuildReport, loadAllPackageReports, writeSuiteReport } from '../report.activities';
import * as fs from 'fs/promises';
import type { PackageBuildReport } from '../../types/index';

vi.mock('fs/promises');

describe('Report Activities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('writePackageBuildReport', () => {
    it('should write report to correct location', async () => {
      const report: PackageBuildReport = {
        packageName: '@bernierllc/test-package',
        workflowId: 'wf-123',
        startTime: '2025-11-10T10:00:00Z',
        endTime: '2025-11-10T10:05:00Z',
        duration: 300000,
        buildMetrics: {
          buildTime: 100000,
          testTime: 150000,
          qualityCheckTime: 30000,
          publishTime: 20000
        },
        quality: {
          lintScore: 100,
          testCoverage: 85,
          typeScriptErrors: 0,
          passed: true
        },
        fixAttempts: [],
        status: 'success',
        dependencies: [],
        waitedFor: []
      };

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await writePackageBuildReport(report, '/workspace');

      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('production/reports'),
        expect.stringContaining('"packageName": "@bernierllc/test-package"')
      );
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/agents/suite-builder-production && yarn test`
Expected: FAIL with "Cannot find module '../report.activities'"

**Step 3: Write minimal implementation**

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import type { PackageBuildReport, SuiteReport } from '../types/index';

export async function writePackageBuildReport(
  report: PackageBuildReport,
  workspaceRoot: string
): Promise<void> {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const reportDir = path.join(workspaceRoot, 'production', 'reports', date);
  const sanitizedName = report.packageName.replace(/@/g, '').replace(/\//g, '-');
  const reportPath = path.join(reportDir, `${sanitizedName}.json`);

  await fs.mkdir(reportDir, { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

  console.log(`📊 Report written: ${reportPath}`);
}

export async function loadAllPackageReports(
  suiteId: string,
  workspaceRoot: string
): Promise<PackageBuildReport[]> {
  const date = new Date().toISOString().split('T')[0];
  const reportDir = path.join(workspaceRoot, 'production', 'reports', date);

  try {
    const files = await fs.readdir(reportDir);
    const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'suite-summary.json');

    const reports = await Promise.all(
      jsonFiles.map(async (file) => {
        const content = await fs.readFile(path.join(reportDir, file), 'utf-8');
        return JSON.parse(content) as PackageBuildReport;
      })
    );

    return reports;
  } catch (error) {
    console.warn(`No reports found in ${reportDir}`);
    return [];
  }
}

export async function writeSuiteReport(
  report: SuiteReport,
  workspaceRoot: string
): Promise<void> {
  const date = new Date().toISOString().split('T')[0];
  const reportDir = path.join(workspaceRoot, 'production', 'reports', date);
  const reportPath = path.join(reportDir, 'suite-summary.json');

  await fs.mkdir(reportDir, { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

  console.log(`📊 Suite report written: ${reportPath}`);
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/agents/suite-builder-production && yarn test`
Expected: PASS (7 tests)

**Step 5: Commit**

```bash
git add packages/agents/suite-builder-production/src/activities/report.activities.ts
git commit -m "feat: add report writing and loading activities"
```

---

## Task 6: Implement Agent Coordination Activities

**Files:**
- Create: `packages/agents/suite-builder-production/src/activities/agent.activities.ts`

**Step 1: Write implementation (no test - agent spawning is integration-level)**

```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { QualityFailure } from '../types/index';

export async function spawnFixAgent(input: {
  packagePath: string;
  planPath: string;
  failures: QualityFailure[];
}): Promise<void> {
  // Categorize failures
  const failureTypes = [...new Set(input.failures.map(f => f.type))];

  // Get or create fix prompt
  const fixPrompt = await getOrCreateFixPrompt(failureTypes);

  // Format failures for prompt
  const formattedFailures = input.failures
    .map(f => {
      if (f.file && f.line) {
        return `- ${f.type.toUpperCase()}: ${f.file}:${f.line} - ${f.message}`;
      }
      return `- ${f.type.toUpperCase()}: ${f.message}`;
    })
    .join('\n');

  // In a real implementation, this would use the Task tool
  // For now, we'll simulate by logging what would be sent
  console.log('Would spawn agent with prompt:');
  console.log(`Package: ${input.packagePath}`);
  console.log(`Plan: ${input.planPath}`);
  console.log(`Failures:\n${formattedFailures}`);
  console.log(`Prompt template: ${fixPrompt}`);

  // TODO: Integrate with actual agent spawning mechanism
  // await spawnAgent({
  //   subagent_type: 'package-development-agent',
  //   description: `Fix quality issues in ${input.packagePath}`,
  //   prompt: `${fixPrompt}\n\nPackage: ${input.packagePath}\nPlan: ${input.planPath}\n\nQuality Failures:\n${formattedFailures}\n\nFix all issues and ensure ./manager validate-requirements passes.`
  // });
}

async function getOrCreateFixPrompt(failureTypes: string[]): Promise<string> {
  const promptsDir = '.claude/agents/fix-prompts';

  // Try to find specific prompt for these failure types
  const promptKey = failureTypes.sort().join('-');
  const specificPrompt = path.join(promptsDir, `${promptKey}.md`);

  if (fs.existsSync(specificPrompt)) {
    return fs.readFileSync(specificPrompt, 'utf-8');
  }

  // Fall back to generic developer prompt
  const genericPrompt = path.join(promptsDir, 'generic-developer.md');

  if (!fs.existsSync(genericPrompt)) {
    // Copy from ~/.claude/agents/package-development-agent.md as template
    const homeAgentsDir = path.join(os.homedir(), '.claude/agents');
    const templatePrompt = path.join(homeAgentsDir, 'package-development-agent.md');

    if (fs.existsSync(templatePrompt)) {
      const template = fs.readFileSync(templatePrompt, 'utf-8');

      // Create prompts directory
      fs.mkdirSync(promptsDir, { recursive: true });

      // Write generic prompt
      fs.writeFileSync(genericPrompt, template);
    } else {
      // Create minimal fallback prompt
      const fallbackPrompt = `You are a package development agent. Fix the reported quality issues.`;
      fs.mkdirSync(promptsDir, { recursive: true });
      fs.writeFileSync(genericPrompt, fallbackPrompt);
    }
  }

  return fs.readFileSync(genericPrompt, 'utf-8');
}

export async function verifyDependencies(dependencies: string[]): Promise<void> {
  // In production, this would check npm registry or local registry
  // For now, we'll just validate the list isn't empty
  if (dependencies.length > 0) {
    console.log(`Verifying ${dependencies.length} dependencies...`);
  }

  // TODO: Add actual npm registry checks
  // for (const dep of dependencies) {
  //   const exists = await checkNpmPackage(dep);
  //   if (!exists) {
  //     throw new Error(`Dependency not published: ${dep}`);
  //   }
  // }
}
```

**Step 2: Commit**

```bash
git add packages/agents/suite-builder-production/src/activities/agent.activities.ts
git commit -m "feat: add agent coordination activities"
```

---

## Task 7: Implement Package Build Child Workflow

**Files:**
- Create: `packages/agents/suite-builder-production/src/workflows/package-build.workflow.ts`
- Create: `packages/agents/suite-builder-production/src/workflows/__tests__/package-build.workflow.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { PackageBuildWorkflow } from '../package-build.workflow';
import type { PackageBuildInput } from '../../types/index';

describe('PackageBuildWorkflow', () => {
  it('should be a function', () => {
    expect(typeof PackageBuildWorkflow).toBe('function');
  });

  it('should accept PackageBuildInput', () => {
    const input: PackageBuildInput = {
      packageName: '@bernierllc/test',
      packagePath: 'packages/core/test',
      planPath: 'plans/packages/core/test.md',
      category: 'core',
      dependencies: [],
      workspaceRoot: '/test',
      config: {} as any
    };

    expect(() => PackageBuildWorkflow(input)).not.toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/agents/suite-builder-production && yarn test`
Expected: FAIL with "Cannot find module '../package-build.workflow'"

**Step 3: Write workflow implementation**

```typescript
import { proxyActivities } from '@temporalio/workflow';
import type { PackageBuildInput, PackageBuildResult, PackageBuildReport } from '../types/index';
import type * as activities from '../activities/build.activities';
import type * as agentActivities from '../activities/agent.activities';
import type * as reportActivities from '../activities/report.activities';

// Create activity proxies with timeouts
const { runBuild, runTests, runQualityChecks, publishPackage } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 minutes'
});

const { verifyDependencies, spawnFixAgent } = proxyActivities<typeof agentActivities>({
  startToCloseTimeout: '30 minutes'
});

const { writePackageBuildReport } = proxyActivities<typeof reportActivities>({
  startToCloseTimeout: '1 minute'
});

export async function PackageBuildWorkflow(input: PackageBuildInput): Promise<PackageBuildResult> {
  const startTime = Date.now();
  const report: PackageBuildReport = {
    packageName: input.packageName,
    workflowId: 'wf-placeholder', // Set by Temporal
    startTime: new Date(startTime).toISOString(),
    endTime: '',
    duration: 0,
    buildMetrics: {
      buildTime: 0,
      testTime: 0,
      qualityCheckTime: 0,
      publishTime: 0
    },
    quality: {
      lintScore: 0,
      testCoverage: 0,
      typeScriptErrors: 0,
      passed: false
    },
    fixAttempts: [],
    status: 'success',
    dependencies: input.dependencies,
    waitedFor: []
  };

  try {
    // Activity 1: Verify dependencies are published
    await verifyDependencies(input.dependencies);

    // Activity 2: Run build
    const buildResult = await runBuild({
      workspaceRoot: input.workspaceRoot,
      packagePath: input.packagePath
    });
    report.buildMetrics.buildTime = buildResult.duration;

    if (!buildResult.success) {
      throw new Error(`Build failed: ${buildResult.stderr}`);
    }

    // Activity 3: Run tests
    const testResult = await runTests({
      workspaceRoot: input.workspaceRoot,
      packagePath: input.packagePath
    });
    report.buildMetrics.testTime = testResult.duration;
    report.quality.testCoverage = testResult.coverage;

    if (!testResult.success) {
      throw new Error(`Tests failed: ${testResult.stderr}`);
    }

    // Activity 4: Run quality checks
    let qualityResult = await runQualityChecks({
      workspaceRoot: input.workspaceRoot,
      packagePath: input.packagePath
    });
    report.buildMetrics.qualityCheckTime = qualityResult.duration;

    // If quality checks fail, spawn fix agent and retry (up to 3 times)
    let fixAttempt = 1;
    while (!qualityResult.passed && fixAttempt <= 3) {
      const fixStart = Date.now();

      await spawnFixAgent({
        packagePath: input.packagePath,
        planPath: input.planPath,
        failures: qualityResult.failures
      });

      const fixDuration = Date.now() - fixStart;

      report.fixAttempts.push({
        count: fixAttempt,
        types: qualityResult.failures.map(f => f.type),
        agentPromptUsed: 'generic-developer.md', // Updated by agent
        fixDuration
      });

      // Retry quality checks
      qualityResult = await runQualityChecks({
        workspaceRoot: input.workspaceRoot,
        packagePath: input.packagePath
      });

      fixAttempt++;
    }

    if (!qualityResult.passed) {
      throw new Error(`Quality checks failed after 3 fix attempts`);
    }

    report.quality.passed = true;

    // Activity 5: Publish package
    const publishResult = await publishPackage({
      packageName: input.packageName,
      packagePath: input.packagePath,
      config: input.config
    });
    report.buildMetrics.publishTime = publishResult.duration;

    if (!publishResult.success) {
      throw new Error(`Publish failed: ${publishResult.stdout}`);
    }

    report.status = 'success';

    return {
      success: true,
      packageName: input.packageName,
      report
    };

  } catch (error) {
    report.status = 'failed';
    report.error = error instanceof Error ? error.message : String(error);

    const errorMsg = error instanceof Error ? error.message : String(error);
    const failedPhase = errorMsg.includes('Build failed') ? 'build' :
                        errorMsg.includes('Tests failed') ? 'test' :
                        errorMsg.includes('Quality checks failed') ? 'quality' :
                        errorMsg.includes('Publish failed') ? 'publish' : 'build';

    return {
      success: false,
      packageName: input.packageName,
      failedPhase,
      error: errorMsg,
      fixAttempts: report.fixAttempts.length,
      report
    };

  } finally {
    report.endTime = new Date().toISOString();
    report.duration = Date.now() - startTime;

    // Write package build report
    await writePackageBuildReport(report, input.workspaceRoot);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/agents/suite-builder-production && yarn test`
Expected: PASS (9 tests)

**Step 5: Commit**

```bash
git add packages/agents/suite-builder-production/src/workflows/
git commit -m "feat: add package build child workflow"
```

---

## Task 8: Implement Main Suite Builder Workflow (Part 1 - Structure)

**Files:**
- Create: `packages/agents/suite-builder-production/src/workflows/suite-builder.workflow.ts`

**Step 1: Write workflow scaffolding**

```typescript
import { proxyActivities, startChild } from '@temporalio/workflow';
import { PackageBuildWorkflow } from './package-build.workflow';
import type {
  SuiteBuilderInput,
  SuiteBuilderState,
  BuildPhase,
  PackageNode,
  BuildConfig
} from '../types/index';
import type * as reportActivities from '../activities/report.activities';

const { loadAllPackageReports, writeSuiteReport } = proxyActivities<typeof reportActivities>({
  startToCloseTimeout: '5 minutes'
});

export async function SuiteBuilderWorkflow(input: SuiteBuilderInput): Promise<void> {
  console.log(`Starting suite builder for ${input.suiteId}`);

  // Initialize state
  const state: SuiteBuilderState = await initializePhase(input);

  // PLAN phase
  await planPhase(state);

  // BUILD phase
  await buildPhase(state, input.config);

  // VERIFY phase
  await verifyPhase(state);

  // COMPLETE phase
  await completePhase(state, input.config.workspaceRoot);

  console.log(`Suite builder complete for ${input.suiteId}`);
}

async function initializePhase(input: SuiteBuilderInput): Promise<SuiteBuilderState> {
  console.log('Phase: INITIALIZE');

  // TODO: Parse audit report and build dependency graph
  // For now, return empty state
  const state: SuiteBuilderState = {
    phase: 'PLAN' as BuildPhase,
    suiteId: input.suiteId,
    packages: [],
    completedPackages: [],
    failedPackages: [],
    childWorkflowIds: new Map()
  };

  return state;
}

async function planPhase(state: SuiteBuilderState): Promise<void> {
  console.log('Phase: PLAN');

  // TODO: Verify package plans exist

  state.phase = 'BUILD' as BuildPhase;
}

async function buildPhase(state: SuiteBuilderState, config: BuildConfig): Promise<void> {
  console.log('Phase: BUILD');

  // TODO: Implement dynamic parallelism

  state.phase = 'VERIFY' as BuildPhase;
}

async function verifyPhase(state: SuiteBuilderState): Promise<void> {
  console.log('Phase: VERIFY');

  // TODO: Run integration tests

  state.phase = 'COMPLETE' as BuildPhase;
}

async function completePhase(state: SuiteBuilderState, workspaceRoot: string): Promise<void> {
  console.log('Phase: COMPLETE');

  // Load all package reports
  const packageReports = await loadAllPackageReports(state.suiteId, workspaceRoot);

  // Generate suite report
  const suiteReport = {
    suiteId: state.suiteId,
    timestamp: new Date().toISOString(),
    totalPackages: state.packages.length,
    successful: state.completedPackages.length,
    failed: state.failedPackages.length,
    totalDuration: packageReports.reduce((sum, r) => sum + r.duration, 0),
    totalFixAttempts: packageReports.reduce((sum, r) => sum + r.fixAttempts.length, 0),
    slowestPackages: packageReports.sort((a, b) => b.duration - a.duration).slice(0, 5),
    mostFixAttempts: packageReports.sort((a, b) => b.fixAttempts.length - a.fixAttempts.length).slice(0, 5),
    totalWaitTime: 0, // TODO: Calculate from waitedFor
    packageReports
  };

  await writeSuiteReport(suiteReport, workspaceRoot);

  console.log(`✅ Suite build complete: ${state.completedPackages.length} packages`);
  if (state.failedPackages.length > 0) {
    console.log(`❌ Failed: ${state.failedPackages.length} packages`);
  }
}
```

**Step 2: Commit**

```bash
git add packages/agents/suite-builder-production/src/workflows/suite-builder.workflow.ts
git commit -m "feat: add main suite builder workflow scaffolding"
```

---

## Task 9: Add Dependency Graph Parsing Activity

**Files:**
- Modify: `packages/agents/suite-builder-production/src/activities/build.activities.ts`
- Add test: `packages/agents/suite-builder-production/src/activities/__tests__/build.activities.test.ts`

**Step 1: Write failing test**

Add to test file:

```typescript
import { buildDependencyGraph } from '../build.activities';

describe('buildDependencyGraph', () => {
  it('should parse audit report and create dependency graph', async () => {
    const mockReport = {
      packageName: '@bernierllc/suite',
      checks: {
        packageDependencies: [
          '@bernierllc/core-a',
          '@bernierllc/service-b'
        ]
      }
    };

    const tempFile = '/tmp/test-audit-report.json';
    await fs.writeFile(tempFile, JSON.stringify(mockReport));

    const result = await buildDependencyGraph(tempFile);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty('name');
    expect(result[0]).toHaveProperty('category');
    expect(result[0]).toHaveProperty('layer');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/agents/suite-builder-production && yarn test`
Expected: FAIL

**Step 3: Implement dependency graph builder**

Add to build.activities.ts:

```typescript
import type { PackageNode, PackageCategory } from '../types/index';

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
    if (name.includes('validator')) return 'validator';
    if (name.includes('core')) return 'core';
    if (name.includes('util')) return 'utility';
    if (name.includes('service')) return 'service';
    if (name.includes('ui')) return 'ui';
    return 'suite';
  };

  // Add dependencies as nodes
  dependencies.forEach((dep: string, index: number) => {
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
```

**Step 4: Run test to verify it passes**

Run: `cd packages/agents/suite-builder-production && yarn test`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/agents/suite-builder-production/src/activities/
git commit -m "feat: add dependency graph parsing from audit reports"
```

---

## Task 10: Complete Main Workflow BUILD Phase

**Files:**
- Modify: `packages/agents/suite-builder-production/src/workflows/suite-builder.workflow.ts`

**Step 1: Implement dynamic parallelism in BUILD phase**

Replace buildPhase function:

```typescript
async function buildPhase(state: SuiteBuilderState, config: BuildConfig): Promise<void> {
  console.log('Phase: BUILD');

  const maxConcurrent = config.maxConcurrentBuilds || 4;
  const activeBuilds = new Map<string, any>();

  while (hasUnbuiltPackages(state)) {
    // Find packages ready to build (all dependencies completed)
    const readyPackages = state.packages.filter(pkg =>
      pkg.buildStatus === 'pending' &&
      pkg.dependencies.every(dep => state.completedPackages.includes(dep))
    );

    // Fill available slots
    const availableSlots = maxConcurrent - activeBuilds.size;
    const batch = readyPackages.slice(0, availableSlots);

    // Spawn child workflows for batch
    for (const pkg of batch) {
      const child = await startChild(PackageBuildWorkflow, {
        workflowId: `build-${state.suiteId}-${pkg.name}`,
        args: [{
          packageName: pkg.name,
          packagePath: `packages/${pkg.category}/${pkg.name.split('/')[1]}`,
          planPath: `plans/packages/${pkg.category}/${pkg.name.split('/')[1]}.md`,
          category: pkg.category,
          dependencies: pkg.dependencies,
          workspaceRoot: config.workspaceRoot,
          config
        }]
      });

      activeBuilds.set(pkg.name, child);
      pkg.buildStatus = 'building';
    }

    // Wait for any child to complete
    if (activeBuilds.size > 0) {
      const entries = Array.from(activeBuilds.entries());
      const results = await Promise.race(
        entries.map(async ([name, handle]) => {
          const result = await handle.result();
          return { name, result };
        })
      );

      // Update state
      activeBuilds.delete(results.name);
      const pkg = state.packages.find(p => p.name === results.name);

      if (pkg) {
        if (results.result.success) {
          pkg.buildStatus = 'completed';
          state.completedPackages.push(results.name);
        } else {
          pkg.buildStatus = 'failed';
          state.failedPackages.push({
            packageName: results.name,
            phase: results.result.failedPhase || 'build',
            error: results.result.error || 'Unknown error',
            fixAttempts: results.result.fixAttempts || 0,
            canRetryManually: true
          });
        }
      }
    }
  }

  state.phase = 'VERIFY' as BuildPhase;
}

function hasUnbuiltPackages(state: SuiteBuilderState): boolean {
  return state.packages.some(pkg =>
    pkg.buildStatus === 'pending' || pkg.buildStatus === 'building'
  );
}
```

**Step 2: Update INITIALIZE phase to use buildDependencyGraph**

Import and use the activity:

```typescript
import type * as buildActivities from '../activities/build.activities';

const { buildDependencyGraph } = proxyActivities<typeof buildActivities>({
  startToCloseTimeout: '5 minutes'
});

// In initializePhase:
async function initializePhase(input: SuiteBuilderInput): Promise<SuiteBuilderState> {
  console.log('Phase: INITIALIZE');

  // Parse audit report and build dependency graph
  const packages = await buildDependencyGraph(input.auditReportPath);

  const state: SuiteBuilderState = {
    phase: 'PLAN' as BuildPhase,
    suiteId: input.suiteId,
    packages,
    completedPackages: [],
    failedPackages: [],
    childWorkflowIds: new Map()
  };

  return state;
}
```

**Step 3: Commit**

```bash
git add packages/agents/suite-builder-production/src/workflows/suite-builder.workflow.ts
git commit -m "feat: implement dynamic parallelism in BUILD phase"
```

---

## Task 11: Create Demo Script

**Files:**
- Create: `production/scripts/build-content-suite.ts`

**Step 1: Write demo script**

```typescript
import { Connection, Client } from '@temporalio/client';
import { SuiteBuilderWorkflow } from '@coordinator/agent-suite-builder-production';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  // Load configuration
  const configPath = path.join(__dirname, '../configs/build-env.json');

  if (!fs.existsSync(configPath)) {
    console.error('❌ Configuration file not found:', configPath);
    console.error('Please copy example-build-env.json to build-env.json and add your credentials');
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  // Validate audit report exists
  const auditReportPath = '/Users/mattbernier/projects/tools/audit-report-content-management-suite.json';

  if (!fs.existsSync(auditReportPath)) {
    console.error('❌ Audit report not found:', auditReportPath);
    process.exit(1);
  }

  console.log('🚀 Starting Production Suite Builder');
  console.log('Suite: content-management-suite');
  console.log(`Workspace: ${config.workspaceRoot}`);
  console.log(`Max Concurrent Builds: ${config.maxConcurrentBuilds}`);
  console.log('');

  // Connect to Temporal
  const connection = await Connection.connect({
    address: config.temporal.address
  });

  const client = new Client({
    connection,
    namespace: config.temporal.namespace
  });

  // Start workflow
  const handle = await client.workflow.start(SuiteBuilderWorkflow, {
    taskQueue: config.temporal.taskQueue,
    workflowId: `suite-builder-content-management-${Date.now()}`,
    args: [{
      suiteId: 'content-management-suite',
      auditReportPath,
      config
    }]
  });

  console.log(`Workflow started: ${handle.workflowId}`);
  console.log('Waiting for completion...');
  console.log('');

  // Wait for result
  try {
    await handle.result();
    console.log('');
    console.log('✅ Suite build completed successfully!');
    console.log('');
    console.log('Reports available at:');
    console.log(`  ${config.workspaceRoot}/production/reports/${new Date().toISOString().split('T')[0]}/`);
  } catch (error) {
    console.error('');
    console.error('❌ Suite build failed:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
```

**Step 2: Commit**

```bash
git add production/scripts/build-content-suite.ts
git commit -m "feat: add demo script for running suite builder"
```

---

## Task 12: Create Production Configuration Template

**Files:**
- Modify: `production/configs/example-build-env.json`

**Step 1: Update example config with all fields**

```json
{
  "__NOTE__": "Copy this file to build-env.json and fill in real values",
  "__WARNING__": "build-env.json is gitignored - it will NOT be committed",

  "npmRegistry": "https://registry.npmjs.org/",
  "npmToken": "npm_REPLACE_WITH_REAL_TOKEN",

  "workspaceRoot": "/Users/mattbernier/projects/tools",
  "maxConcurrentBuilds": 4,

  "temporal": {
    "address": "localhost:7233",
    "namespace": "default",
    "taskQueue": "agent-coordinator-queue"
  },

  "testing": {
    "enableCoverage": true,
    "minCoveragePercent": 80,
    "failOnError": true
  },

  "publishing": {
    "dryRun": false,
    "requireTests": true,
    "requireCleanWorkingDirectory": true
  }
}
```

**Step 2: Commit**

```bash
git add production/configs/example-build-env.json
git commit -m "docs: update example config with complete fields"
```

---

## Task 13: Add Package Scripts and Build

**Files:**
- Modify: `package.json` (root)

**Step 1: Add build and demo scripts**

Add to root package.json scripts:

```json
{
  "scripts": {
    "build": "tsc -b",
    "test": "vitest run",
    "demo:suite-builder": "tsx production/scripts/build-content-suite.ts"
  }
}
```

**Step 2: Build all packages**

Run: `yarn build`
Expected: All packages build successfully

**Step 3: Run tests**

Run: `yarn test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add package.json
git commit -m "feat: add build and demo scripts to root package"
```

---

## Task 14: Create README Documentation

**Files:**
- Create: `production/README.md`

**Step 1: Write production README**

```markdown
# Production Suite Builder

Temporal-based workflow system for building and publishing BernierLLC package suites.

## Prerequisites

- Temporal server running (see framework repo: `yarn infra:up`)
- Node.js 22+
- Yarn
- npm token with publish access to @bernierllc scope

## Setup

1. **Create configuration file:**

```bash
cp production/configs/example-build-env.json production/configs/build-env.json
```

2. **Edit build-env.json with your credentials:**

- Add your npm token
- Verify workspace root path
- Adjust concurrent builds if needed

3. **Ensure Temporal is running:**

```bash
cd ../agent-coordinators
yarn infra:up
```

## Running the Suite Builder

Build a suite from an audit report:

```bash
yarn demo:suite-builder
```

This will:
- Parse the audit report
- Build dependency graph
- Build packages in correct order (validators → core → utilities → services → UI → suites)
- Run quality checks for each package
- Automatically fix quality issues with agents
- Publish packages to npm
- Generate comprehensive reports

## Reports

After a build completes, find reports at:

```
production/reports/{YYYY-MM-DD}/
  @bernierllc-package-name.json     # Individual package reports
  suite-summary.json                 # Aggregate suite report
```

### Report Contents

**Package Reports:**
- Build/test/quality/publish metrics
- Fix attempts and agent prompts used
- Dependency wait times

**Suite Report:**
- Overall success/failure counts
- Total duration
- Slowest packages
- Packages requiring most fixes
- Full aggregated data

## Architecture

- **Main Workflow:** Orchestrates 5 phases (INITIALIZE → PLAN → BUILD → VERIFY → COMPLETE)
- **Child Workflows:** One per package, keeps history manageable
- **Dynamic Parallelism:** Respects dependencies, maximizes concurrency
- **Agent-Based Fixes:** Quality failures spawn agents to fix issues automatically
- **Comprehensive Reporting:** JSON reports enable data-driven improvements

## Configuration

See `production/configs/example-build-env.json` for all options.

Key settings:
- `maxConcurrentBuilds`: How many packages to build in parallel (default: 4)
- `testing.minCoveragePercent`: Minimum test coverage required (default: 80%)
- `publishing.dryRun`: Test without actually publishing (default: false)

## Troubleshooting

**"Temporal connection failed"**
- Ensure Temporal server is running: `yarn infra:up`

**"npm publish failed"**
- Verify npm token in build-env.json
- Check token has publish access to @bernierllc scope

**"Quality checks failed after 3 attempts"**
- Review package reports for specific failures
- Check agent prompts were created correctly
- Manual fixes may be needed

## Development

Build the suite builder package:

```bash
cd packages/agents/suite-builder-production
yarn build
yarn test
```
```

**Step 2: Commit**

```bash
git add production/README.md
git commit -m "docs: add production suite builder README"
```

---

## Final Tasks

### Task 15: Integration Test

**Run the full workflow:**

1. Ensure Temporal is running
2. Create build-env.json with test credentials
3. Run demo script
4. Verify reports are generated
5. Check all phases execute correctly

### Task 16: Final Commit and Push

```bash
git add -A
git commit -m "feat: complete production suite builder implementation

- Main and child Temporal workflows
- Build, test, quality check, and publish activities
- Agent-based error remediation
- Comprehensive JSON reporting
- Demo script for running builds
- Full documentation

All tests passing (184/184)"

git push -u origin feature/production-suite-builder
```

---

## Summary

This plan implements a complete production suite builder using:
- Temporal workflows for orchestration
- Child workflows per package for clean history
- Dynamic parallelism respecting dependencies
- Agent-based fixes for quality issues
- Comprehensive JSON reporting

The system can build ~88 packages in correct dependency order with automatic quality checks and error remediation.
