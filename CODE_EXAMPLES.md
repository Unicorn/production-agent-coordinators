# Real Code Examples from Codebase

## Actual Workflow Examples

### Example 1: Simple Demo Workflow
**File:** `/packages/temporal-coordinator/src/workflows.ts` (lines 57-181)

```typescript
export async function helloWorkflow(
  config: HelloWorkflowConfig
): Promise<EngineState> {
  const {
    goalId,
    specType,
    specConfig,
    agentType,
    agentConfig,
    agentApiKey,
    maxIterations = 10,
  } = config;

  console.log(`[Workflow] Starting hello workflow for goal: ${goalId}`);

  // Step 1: Initialize workflow state
  let state = await initializeWorkflow(goalId, {
    specType,
    specConfig: specConfig || {},
    agentType,
    agentConfig: agentConfig || {},
  });

  // Step 2: Execute workflow loop
  while (state.status === 'RUNNING' && iterations < maxIterations) {
    // Get decision from spec
    state = await executeSpecDecision(state, {
      specType,
      specConfig: specConfig || {},
      lastResponse,
    });

    // Execute waiting steps
    const waitingSteps = Object.entries(state.openSteps).filter(
      ([_, step]) => step.status === 'WAITING'
    );

    for (const [stepId, step] of waitingSteps) {
      try {
        const response = await executeAgentStep(goalId, stepId, step, {
          agentType,
          agentConfig: agentConfig || {},
          agentApiKey,
        });

        state = await processAgentResponse(state, response);
      } catch (error) {
        // Error handling
        throw error; // Let Temporal handle retries
      }
    }
  }

  // Step 3: Store artifacts
  if (Object.keys(state.artifacts).length > 0) {
    for (const [key, value] of Object.entries(state.artifacts)) {
      await storeArtifact(goalId, key, value);
    }
  }

  return state;
}
```

**Pattern Analysis:**
- Name: `helloWorkflow` (camelCase - simple/demo)
- Suffix: Yes, ends with `Workflow`
- Activity calls: Uses proxied activities without "Activity" suffix
- Deterministic: Yes - only state management between activity calls
- Error handling: Try/catch with rethrow for Temporal retry

---

### Example 2: Complex Parent Orchestrator Workflow
**File:** `/packages/agents/package-builder-production/src/workflows/package-builder.workflow.ts` (lines 20-179)

```typescript
export async function PackageBuilderWorkflow(
  input: PackageBuilderInput
): Promise<void> {
  console.log(`Starting package builder for ${input.buildId}`);

  // Initialize state
  const state: PackageBuilderState = await initializePhase(input);

  // PLAN phase
  await planPhase(state);

  // BUILD phase - Dynamic child spawning
  await buildPhase(state, input.config);

  // VERIFY phase
  await verifyPhase(state);

  // COMPLETE phase
  await completePhase(state, input.config.workspaceRoot);

  console.log(`Package builder complete for ${input.buildId}`);
}

async function buildPhase(
  state: PackageBuilderState,
  config: BuildConfig
): Promise<void> {
  console.log('Phase: BUILD');

  const maxConcurrent = config.maxConcurrentBuilds || 4;
  const activeBuilds = new Map<string, any>();

  while (hasUnbuiltPackages(state)) {
    // Find packages ready to build
    const readyPackages = state.packages.filter(pkg =>
      pkg.buildStatus === 'pending' &&
      pkg.dependencies.every(dep => state.completedPackages.includes(dep))
    );

    // Fill available slots
    const availableSlots = maxConcurrent - activeBuilds.size;
    const batch = readyPackages.slice(0, availableSlots);

    // SPAWN CHILD WORKFLOWS
    for (const pkg of batch) {
      const child = await startChild(PackageBuildWorkflow, {
        workflowId: `build-${state.buildId}-${pkg.name}`,
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

      // Update state with results
      activeBuilds.delete(results.name);
      // ... update package status
    }
  }
}
```

**Pattern Analysis:**
- Name: `PackageBuilderWorkflow` (PascalCase - complex orchestrator)
- Type: Parent workflow using child workflow execution
- Pattern: Multi-phase with dynamic child spawning
- Dependency awareness: Filters ready packages based on completed dependencies
- Concurrency: Respects maxConcurrentBuilds limit

---

### Example 3: Child Package Build Workflow
**File:** `/packages/agents/package-builder-production/src/workflows/package-build.workflow.ts` (lines 20-161)

```typescript
export async function PackageBuildWorkflow(
  input: PackageBuildInput
): Promise<PackageBuildResult> {
  const startTime = Date.now();
  const report: PackageBuildReport = {
    packageName: input.packageName,
    workflowId: 'wf-placeholder',
    // ... report initialization
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

    // Activity 4: Run quality checks
    let qualityResult = await runQualityChecks({
      workspaceRoot: input.workspaceRoot,
      packagePath: input.packagePath
    });

    // Activity 5: If quality fails, spawn fix agent
    let fixAttempt = 1;
    while (!qualityResult.passed && fixAttempt <= 3) {
      const fixStart = Date.now();

      await spawnFixAgent({
        packagePath: input.packagePath,
        planPath: input.planPath,
        failures: qualityResult.failures
      });

      report.fixAttempts.push({
        count: fixAttempt,
        types: qualityResult.failures.map(f => f.type),
        agentPromptUsed: 'generic-developer.md',
        fixDuration: Date.now() - fixStart
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

    // Activity 6: Publish package
    const publishResult = await publishPackage({
      packageName: input.packageName,
      packagePath: input.packagePath,
      config: input.config
    });

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

**Pattern Analysis:**
- Name: `PackageBuildWorkflow` (PascalCase - complex child workflow)
- Type: Child workflow for individual package
- Pattern: Linear sequential activities with retry loop
- Agent Integration: `spawnFixAgent` called up to 3 times on quality failures
- Error Handling: Phase detection from error message
- Reporting: Finally block ensures report is written

---

## Actual Activity Examples

### Example 1: Build Activities
**File:** `/packages/agents/package-builder-production/src/activities/build.activities.ts` (lines 9-160)

```typescript
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

    // Parse coverage from output
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
```

**Pattern Analysis:**
- Naming: `run<Command>` pattern (runBuild, runTests, runQualityChecks)
- No "Activity" suffix
- Consistent input/output types
- Try/catch with explicit return structures
- Success/failure fields in all returns

---

### Example 2: Agentic Activity
**File:** `/packages/agents/package-builder-production/src/activities/agent.activities.ts` (lines 6-79)

```typescript
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

  // Log what would be sent (TODO: integrate actual spawning)
  console.log('Would spawn agent with prompt:');
  console.log(`Package: ${input.packagePath}`);
  console.log(`Plan: ${input.planPath}`);
  console.log(`Failures:\n${formattedFailures}`);
  console.log(`Prompt template: ${fixPrompt}`);

  // TODO: Integrate with actual agent spawning mechanism
  // await spawnAgent({
  //   subagent_type: 'package-development-agent',
  //   description: `Fix quality issues in ${input.packagePath}`,
  //   prompt: `${fixPrompt}\n\n...`
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
    // Copy from ~/.claude/agents/package-development-agent.md
    const homeAgentsDir = path.join(os.homedir(), '.claude/agents');
    const templatePrompt = path.join(homeAgentsDir, 'package-development-agent.md');

    if (fs.existsSync(templatePrompt)) {
      const template = fs.readFileSync(templatePrompt, 'utf-8');
      fs.mkdirSync(promptsDir, { recursive: true });
      fs.writeFileSync(genericPrompt, template);
    } else {
      fs.mkdirSync(promptsDir, { recursive: true });
      fs.writeFileSync(genericPrompt, `You are a package development agent. Fix the reported quality issues.`);
    }
  }

  return fs.readFileSync(genericPrompt, 'utf-8');
}

export async function verifyDependencies(dependencies: string[]): Promise<void> {
  if (dependencies.length > 0) {
    console.log(`Verifying ${dependencies.length} dependencies...`);
  }

  // TODO: Add actual npm registry checks
}
```

**Pattern Analysis:**
- Name: `spawnFixAgent` (spawn<Agent> - AGENTIC ACTIVITY)
- Purpose: Invoke external agents for quality fixes
- Status: TODO - not yet integrated with actual spawning
- Prompt Management: Finds/creates appropriate fix prompts
- Helper: `getOrCreateFixPrompt` uses lowercase internal pattern

---

### Example 3: Report Activities
**File:** `/packages/agents/package-builder-production/src/activities/report.activities.ts` (lines 5-57)

```typescript
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

  console.log(`Report written: ${reportPath}`);
}

export async function loadAllPackageReports(
  _suiteId: string,
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

export async function writeBuildReport(
  report: BuildReport,
  workspaceRoot: string
): Promise<void> {
  const date = new Date().toISOString().split('T')[0];
  const reportDir = path.join(workspaceRoot, 'production', 'reports', date);
  const reportPath = path.join(reportDir, 'suite-summary.json');

  await fs.mkdir(reportDir, { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

  console.log(`Suite report written: ${reportPath}`);
}
```

**Pattern Analysis:**
- Naming: `<verb><Entity><noun>` pattern (writePackageBuildReport, loadAllPackageReports)
- Entity clarifies scope: Package vs Build/Suite
- Scope Organization: `writePackageBuildReport` vs `writeBuildReport`
- All use explicit types

---

## Activity Proxy Configuration Example

**File:** `/packages/agents/package-builder-production/src/workflows/package-build.workflow.ts` (lines 8-17)

```typescript
const { runBuild, runTests, runQualityChecks, publishPackage } = 
  proxyActivities<typeof activities>({
    startToCloseTimeout: '10 minutes'
  });

const { verifyDependencies, spawnFixAgent } = 
  proxyActivities<typeof agentActivities>({
    startToCloseTimeout: '30 minutes'
  });

const { writePackageBuildReport } = 
  proxyActivities<typeof reportActivities>({
    startToCloseTimeout: '1 minute'
  });
```

**Pattern Analysis:**
- Separate proxy groups by timeout needs
- Build operations: 10 minutes
- Agent spawning: 30 minutes (longer for agent work)
- Reporting: 1 minute (quick)
- Type safety maintained with typeof imports

---

## Type Definition Examples

**File:** `/packages/agents/package-builder-production/src/types/index.ts` (selected sections)

```typescript
// Workflow Inputs
export interface PackageBuilderInput {
  buildId: string;
  auditReportPath: string;
  config: BuildConfig;
}

export interface PackageBuildInput {
  packageName: string;
  packagePath: string;
  planPath: string;
  category: PackageCategory;
  dependencies: string[];
  workspaceRoot: string;
  config: BuildConfig;
}

// Workflow Outputs
export interface PackageBuildResult {
  success: boolean;
  packageName: string;
  failedPhase?: 'build' | 'test' | 'quality' | 'publish';
  error?: string;
  fixAttempts?: number;
  report: PackageBuildReport;
}

// Activity Results
export interface BuildResult {
  success: boolean;
  duration: number;
  stdout: string;
  stderr: string;
}

export interface QualityResult {
  passed: boolean;
  duration: number;
  failures: QualityFailure[];
  stdout: string;
}

// Report Types
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
```

**Pattern Analysis:**
- Naming: `<Entity><Purpose><Kind>` (PackageBuildInput, PackageBuildResult)
- Consistent suffixes: Input, Result, Report
- Explicit enums for states
- Nested objects for related metrics

