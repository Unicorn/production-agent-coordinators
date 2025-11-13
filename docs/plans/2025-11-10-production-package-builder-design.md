# Production Package Builder - Design Document

**Date:** 2025-11-10
**Status:** Approved
**Architecture:** Phase-Based with Dynamic Parallelism

## Overview

This design describes a Temporal-based workflow system for building and publishing the BernierLLC package ecosystem. The system orchestrates building ~88 packages in correct dependency order, with quality checks, automatic error remediation, and detailed observability.

### Key Design Decisions

1. **Main + Child Workflows**: Main workflow orchestrates phases, child workflows handle individual package builds (keeps history manageable)
2. **Dynamic Parallelism**: Packages build as soon as dependencies complete (no layer waiting)
3. **Agent-Based Fixes**: Quality failures spawn agents with dynamic prompts to fix issues
4. **Comprehensive Reporting**: JSON reports for every package build enable data-driven workflow improvements

## Architecture

### Phase-Based Main Workflow

The main workflow (`PackageBuilderWorkflow`) progresses through five sequential phases:

```
INITIALIZE → PLAN → BUILD → VERIFY → COMPLETE
```

**Phase Descriptions:**

- **INITIALIZE**: Parse audit report, build dependency graph, validate config
- **PLAN**: Verify package plans exist, spawn agents to create/update missing plans
- **BUILD**: Spawn child workflows for packages in dependency order with dynamic parallelism
- **VERIFY**: Run integration tests for the complete suite
- **COMPLETE**: Publish main suite package, generate aggregate reports

### Dependency Graph Structure

Packages are organized in hierarchical layers based on category:

```
Layer 0: validators      (no dependencies)
Layer 1: core           (may depend on validators)
Layer 2: utilities      (may depend on validators, core)
Layer 3: services       (may depend on validators, core, utilities)
Layer 4: ui             (may depend on validators, core, utilities, services)
Layer 5: suites         (may depend on any lower layer)
```

Each package is represented as a node:

```typescript
interface PackageNode {
  name: string;                    // @bernierllc/retry-policy
  category: 'validator' | 'core' | 'utility' | 'service' | 'ui' | 'suite';
  dependencies: string[];          // [@bernierllc/backoff-strategy, ...]
  layer: number;                   // 0-5 based on category
  buildStatus: 'pending' | 'building' | 'completed' | 'failed';
}
```

## Main Workflow Structure

### Workflow State

```typescript
interface PackageBuilderState {
  phase: BuildPhase;
  buildId: string;                          // e.g., "content-management-suite"
  packages: PackageNode[];                  // Full dependency graph
  completedPackages: string[];              // Successfully built packages
  failedPackages: PackageFailure[];         // Failed builds with details
  childWorkflowIds: Map<string, string>;    // Package name → workflow ID
}
```

### Phase Implementations

#### INITIALIZE Phase

```typescript
async function initializePhase(input: PackageBuilderInput): Promise<PackageBuilderState> {
  // Activity: Parse audit report and build dependency graph
  const packages = await activities.buildDependencyGraph(input.auditReportPath);

  // Activity: Validate configuration
  await activities.validateConfig(input.config);

  return {
    phase: BuildPhase.PLAN,
    buildId: input.buildId,
    packages,
    completedPackages: [],
    failedPackages: [],
    childWorkflowIds: new Map()
  };
}
```

#### PLAN Phase

```typescript
async function planPhase(state: PackageBuilderState): Promise<void> {
  // For each package, verify plan exists
  for (const pkg of state.packages) {
    const planExists = await activities.checkPlanExists(pkg.name);

    if (!planExists) {
      // Spawn agent to create plan
      await activities.spawnPlanAgent({
        packageName: pkg.name,
        category: pkg.category,
        dependencies: pkg.dependencies
      });
    }
  }

  state.phase = BuildPhase.BUILD;
}
```

#### BUILD Phase (Dynamic Parallelism)

```typescript
async function buildPhase(state: PackageBuilderState, config: BuildConfig): Promise<void> {
  const maxConcurrent = config.maxConcurrentBuilds || 4;
  const activeBuilds = new Map<string, ChildWorkflowHandle>();

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
        workflowId: `build-${state.buildId}-${pkg.name}`,
        args: [{
          packageName: pkg.name,
          packagePath: `packages/${pkg.category}/${pkg.name}`,
          planPath: `plans/packages/${pkg.category}/${pkg.name}.md`,
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
    const completed = await Promise.race(
      Array.from(activeBuilds.entries()).map(async ([name, handle]) => {
        const result = await handle.result();
        return { name, result };
      })
    );

    // Update state
    activeBuilds.delete(completed.name);
    const pkg = state.packages.find(p => p.name === completed.name);

    if (completed.result.success) {
      pkg.buildStatus = 'completed';
      state.completedPackages.push(completed.name);
    } else {
      pkg.buildStatus = 'failed';
      state.failedPackages.push({
        packageName: completed.name,
        phase: completed.result.failedPhase,
        error: completed.result.error,
        fixAttempts: completed.result.fixAttempts,
        canRetryManually: true
      });
    }
  }

  state.phase = BuildPhase.VERIFY;
}
```

#### VERIFY Phase

```typescript
async function verifyPhase(state: PackageBuilderState): Promise<void> {
  // Run integration tests for the full suite
  const verifyResult = await activities.runSuiteIntegrationTests(state.buildId);

  if (!verifyResult.passed) {
    throw new Error(`Suite integration tests failed: ${verifyResult.failures}`);
  }

  state.phase = BuildPhase.COMPLETE;
}
```

#### COMPLETE Phase

```typescript
async function completePhase(state: PackageBuilderState): Promise<void> {
  // Generate aggregate suite report
  await activities.generateBuildReport(state);

  // Publish main suite package (if all dependencies succeeded)
  if (state.failedPackages.length === 0) {
    await activities.publishSuitePackage(state.buildId);
  }

  // Log completion
  console.log(`✅ Package build complete: ${state.completedPackages.length} packages`);
  if (state.failedPackages.length > 0) {
    console.log(`❌ Failed: ${state.failedPackages.length} packages`);
  }
}
```

## Child Workflow Structure

### PackageBuildWorkflow

Each package builds in its own child workflow to isolate history:

```typescript
interface PackageBuildInput {
  packageName: string;              // @bernierllc/retry-policy
  packagePath: string;              // packages/core/retry-policy
  planPath: string;                 // plans/packages/core/retry-policy.md
  category: string;                 // validator, core, utility, service, ui, suite
  dependencies: string[];           // Must complete before this starts
  workspaceRoot: string;            // /Users/mattbernier/projects/tools
  config: BuildConfig;
}

async function PackageBuildWorkflow(input: PackageBuildInput): Promise<PackageBuildResult> {
  const startTime = Date.now();
  const report: PackageBuildReport = initializeReport(input);

  try {
    // Activity 1: Verify dependencies are published
    await activities.verifyDependencies(input.dependencies);

    // Activity 2: Run build command
    const buildResult = await activities.runBuild({
      workspaceRoot: input.workspaceRoot,
      packagePath: input.packagePath
    });
    report.buildMetrics.buildTime = buildResult.duration;

    // Activity 3: Run tests
    const testResult = await activities.runTests({
      workspaceRoot: input.workspaceRoot,
      packagePath: input.packagePath
    });
    report.buildMetrics.testTime = testResult.duration;
    report.quality.testCoverage = testResult.coverage;

    // Activity 4: Run quality checks
    let qualityResult = await activities.runQualityChecks({
      workspaceRoot: input.workspaceRoot,
      packagePath: input.packagePath
    });
    report.buildMetrics.qualityCheckTime = qualityResult.duration;

    // If quality checks fail, spawn fix agent and retry
    let fixAttempt = 1;
    while (!qualityResult.passed && fixAttempt <= 3) {
      const fixStart = Date.now();

      await activities.spawnFixAgent({
        packagePath: input.packagePath,
        planPath: input.planPath,
        failures: qualityResult.failures
      });

      report.fixAttempts.push({
        count: fixAttempt,
        types: qualityResult.failures.map(f => f.type),
        agentPromptUsed: determinePromptPath(qualityResult.failures),
        fixDuration: Date.now() - fixStart
      });

      // Retry quality checks
      qualityResult = await activities.runQualityChecks({
        workspaceRoot: input.workspaceRoot,
        packagePath: input.packagePath
      });

      fixAttempt++;
    }

    if (!qualityResult.passed) {
      throw new Error(`Quality checks failed after 3 fix attempts`);
    }

    // Activity 5: Publish to npm
    const publishResult = await activities.publishPackage({
      packageName: input.packageName,
      packagePath: input.packagePath,
      config: input.config
    });
    report.buildMetrics.publishTime = publishResult.duration;

    report.status = 'success';
    report.quality.passed = true;

    return { success: true, packageName: input.packageName, report };

  } catch (error) {
    report.status = 'failed';
    report.error = error.message;

    return {
      success: false,
      packageName: input.packageName,
      failedPhase: determineFailedPhase(error),
      error: error.message,
      fixAttempts: report.fixAttempts.length,
      report
    };

  } finally {
    report.endTime = new Date().toISOString();
    report.duration = Date.now() - startTime;

    // Write package build report
    await activities.writePackageBuildReport(report);
  }
}
```

## Activities Implementation

### Build Activities

```typescript
// Activity: Run package build
async function runBuild(input: {
  workspaceRoot: string;
  packagePath: string;
}): Promise<BuildResult> {
  const startTime = Date.now();
  const fullPath = path.join(input.workspaceRoot, input.packagePath);

  const result = await execCommand(`cd ${fullPath} && yarn build`);

  return {
    success: result.exitCode === 0,
    duration: Date.now() - startTime,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

// Activity: Run tests
async function runTests(input: {
  workspaceRoot: string;
  packagePath: string;
}): Promise<TestResult> {
  const startTime = Date.now();
  const fullPath = path.join(input.workspaceRoot, input.packagePath);

  // Run with --run to avoid watch mode
  const result = await execCommand(`cd ${fullPath} && yarn test --run --coverage`);

  // Parse coverage from output
  const coverage = parseCoverageFromOutput(result.stdout);

  return {
    success: result.exitCode === 0,
    duration: Date.now() - startTime,
    coverage,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

// Activity: Run quality checks
async function runQualityChecks(input: {
  workspaceRoot: string;
  packagePath: string;
}): Promise<QualityResult> {
  const startTime = Date.now();
  const fullPath = path.join(input.workspaceRoot, input.packagePath);

  const result = await execCommand(`cd ${fullPath} && ./manager validate-requirements`);

  return {
    passed: result.exitCode === 0,
    duration: Date.now() - startTime,
    failures: parseQualityFailures(result.stdout),
    stdout: result.stdout
  };
}

// Activity: Publish package
async function publishPackage(input: {
  packageName: string;
  packagePath: string;
  config: BuildConfig;
}): Promise<PublishResult> {
  const startTime = Date.now();
  const fullPath = path.join(input.config.workspaceRoot, input.packagePath);

  // Set npm token from config
  const env = {
    ...process.env,
    NPM_TOKEN: input.config.npmToken
  };

  const result = await execCommand(
    `cd ${fullPath} && npm publish --access restricted`,
    { env }
  );

  return {
    success: result.exitCode === 0,
    duration: Date.now() - startTime,
    stdout: result.stdout
  };
}
```

### Agent Coordination Activities

```typescript
// Activity: Spawn fix agent
async function spawnFixAgent(input: {
  packagePath: string;
  planPath: string;
  failures: QualityFailure[];
}): Promise<void> {

  // Categorize failures
  const failureTypes = [...new Set(input.failures.map(f => f.type))];

  // Get or create fix prompt
  const fixPrompt = await getOrCreateFixPrompt(failureTypes);

  // Spawn agent via Task tool
  await spawnAgent({
    subagent_type: 'package-development-agent',
    description: `Fix quality issues in ${input.packagePath}`,
    prompt: `${fixPrompt}

Package: ${input.packagePath}
Plan: ${input.planPath}

Quality Failures:
${formatFailures(input.failures)}

Fix all issues and ensure ./manager validate-requirements passes.
Return a report of changes made.`
  });
}

// Get or create fix prompt based on failure types
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
    const templatePrompt = fs.readFileSync(
      path.join(os.homedir(), '.claude/agents/package-development-agent.md'),
      'utf-8'
    );

    // Write as generic-developer.md
    fs.mkdirSync(promptsDir, { recursive: true });
    fs.writeFileSync(genericPrompt, templatePrompt);
  }

  return fs.readFileSync(genericPrompt, 'utf-8');
}
```

## Error Handling and Resilience

### Retry Strategy

1. **Build/Test Failures**: No automatic retry (likely code issue)
2. **Quality Check Failures**: Up to 3 fix attempts with agent
3. **Publish Failures**: Single retry (may be network issue)

### Failure Isolation

- Failed packages don't block independent packages
- Child workflow failures don't crash main workflow
- Main workflow tracks all failures for final report

### Agent-Based Remediation

When quality checks fail:

1. Categorize failures (lint, test, typescript)
2. Load or generate appropriate fix prompt
3. Spawn agent with context (package path, plan, failures)
4. Agent fixes issues using Bash tool
5. Retry quality checks
6. Repeat up to 3 times

## Build Reports and Observability

### Package Build Report

Each child workflow writes a detailed JSON report:

```typescript
interface PackageBuildReport {
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
```

**Report Location:** `production/reports/{YYYY-MM-DD}/{packageName}.json`

### Suite Aggregate Report

The main workflow generates a summary report:

```typescript
interface BuildReport {
  buildId: string;
  timestamp: string;
  totalPackages: number;
  successful: number;
  failed: number;

  totalDuration: number;
  totalFixAttempts: number;

  // Performance analysis
  slowestPackages: PackageBuildReport[];
  mostFixAttempts: PackageBuildReport[];
  totalWaitTime: number;

  // All package reports
  packageReports: PackageBuildReport[];
}
```

**Report Location:** `production/reports/{YYYY-MM-DD}/suite-summary.json`

### Report Usage

Reports enable:

- **Bottleneck Identification**: Which packages take longest?
- **Quality Trends**: Which failure types are most common?
- **Agent Effectiveness**: How often do fix agents succeed?
- **Dependency Wait Analysis**: Are dependencies blocking builds?
- **Workflow Optimization**: Where can parallelism improve?

## Implementation Components

### Directory Structure

```
production/
  configs/
    build-env.json                 # Real config (gitignored)
    example-build-env.json         # Template
  master-plans/
    content-management-suite.md    # Dependency graph (gitignored)
    example-suite.md               # Template
  scripts/
    build-content-suite.ts         # Demo script to start workflow
  reports/                         # Generated (gitignored)
    2025-11-10/
      {packageName}.json
      suite-summary.json

packages/
  agents/
    package-builder-production/      # Real agent implementation
      src/
        workflows/
          suite-builder.workflow.ts
          package-build.workflow.ts
        activities/
          build.activities.ts
          agent.activities.ts
          report.activities.ts
        types/
          index.ts
      package.json

.claude/
  agents/
    fix-prompts/                   # Dynamic fix prompts
      generic-developer.md
      lint.md
      test.md
      typescript.md
      lint-test.md
```

### Configuration

```json
{
  "npmRegistry": "https://registry.npmjs.org/",
  "npmToken": "npm_REAL_TOKEN_HERE",

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

## Next Steps

1. **Create Master Plan**: Parse audit report to extract all packages and dependencies
2. **Create Production Config**: Copy example, add real npm token and paths
3. **Implement Workflows**: Build main and child workflows with TypeScript
4. **Implement Activities**: Create activities for build/test/publish/report
5. **Test Workflow**: Run against real packages (without publishing initially)
6. **Iterate**: Use reports to identify improvements
