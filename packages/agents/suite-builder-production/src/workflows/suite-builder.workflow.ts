import { proxyActivities, startChild } from '@temporalio/workflow';
import { PackageBuildWorkflow } from './package-build.workflow';
import type {
  PackageWorkflowInput,
  SuiteBuilderState,
  SuiteBuilderResult,
  BuildPhase,
  BuildConfig,
  PackageNode,
  DiscoveryResult,
  PlanningResult,
  MeceValidationResult
} from '../types/index';
import type * as reportActivities from '../activities/report.activities';
import type * as discoveryActivities from '../activities/discovery.activities';
import type * as planningActivities from '../activities/planning.activities';
import type * as meceActivities from '../activities/mece.activities';
import type * as publishActivities from '../activities/publish.activities';

// Import pure functions directly (not async activities)
import { parseInput } from '../activities/discovery.activities';

// Activity proxies
const { loadAllPackageReports, writeSuiteReport } = proxyActivities<typeof reportActivities>({
  startToCloseTimeout: '5 minutes'
});

const {
  searchForPackage,
  readPackageJson,
  buildDependencyTree,
  copyEnvFiles
} = proxyActivities<typeof discoveryActivities>({
  startToCloseTimeout: '10 minutes'
});

const {
  searchLocalPlans,
  queryMcpForPlan,
  validatePlan,
  registerPlanWithMcp
} = proxyActivities<typeof planningActivities>({
  startToCloseTimeout: '5 minutes'
});

const {
  analyzeMeceCompliance,
  generateSplitPlans,
  registerSplitPlans,
  determineDeprecationCycle,
  updateDependentPlans
} = proxyActivities<typeof meceActivities>({
  startToCloseTimeout: '10 minutes'
});

const {
  determineVersionBump,
  publishToNpm,
  updateDependentVersions,
  publishDeprecationNotice
} = proxyActivities<typeof publishActivities>({
  startToCloseTimeout: '5 minutes'
});

/**
 * Main autonomous workflow for building packages.
 *
 * Accepts minimal input (packageName, packageIdea, planFilePath, or updatePrompt)
 * and autonomously:
 * 1. Discovers the package and its dependencies
 * 2. Finds or creates implementation plans
 * 3. Validates MECE compliance
 * 4. Builds all packages in dependency order
 * 5. Runs quality checks and remediation
 * 6. Publishes to npm
 * 7. Generates comprehensive reports
 */
export async function SuiteBuilderWorkflow(input: PackageWorkflowInput): Promise<SuiteBuilderResult> {
  console.log(`Starting autonomous suite builder workflow`);

  // PHASE 1: DISCOVERY - Determine what we're building
  const discovery = await discoveryPhase(input);
  console.log(`✓ Discovery complete for ${discovery.packageName}`);

  // PHASE 2: PLANNING - Find or create implementation plans
  const planning = await planningPhase(discovery, input.config.workspaceRoot);
  console.log(`✓ Planning complete, plan at ${planning.planPath}`);

  // PHASE 3: MECE VALIDATION - Ensure compliance and handle splits
  const meceValidation = await meceValidationPhase(discovery, input);
  console.log(`✓ MECE validation complete, ${meceValidation.additionalPackages.length} additional packages`);

  // Build dependency tree including any split packages
  const allPackages = [
    ...meceValidation.additionalPackages,
    {
      name: discovery.packageName,
      path: discovery.packagePath,
      version: discovery.version,
      dependencies: discovery.dependencies,
      buildStatus: 'pending' as const,
      testStatus: 'pending' as const
    }
  ];

  // Initialize state
  const state: SuiteBuilderState = {
    phase: 'BUILD' as BuildPhase,
    suiteId: `suite-${Date.now()}`,
    packages: allPackages,
    completedPackages: [],
    failedPackages: [],
    childWorkflowIds: new Map()
  };

  // PHASE 4: BUILD - Build all packages in dependency order
  await buildPhase(state, input.config);
  console.log(`✓ Build complete: ${state.completedPackages.length}/${state.packages.length} succeeded`);

  // PHASE 5: QUALITY - Validate quality and run remediation if needed
  // (Quality checks are integrated into PackageBuildWorkflow)
  state.phase = 'VERIFY' as BuildPhase;

  // PHASE 6: PUBLISH - Publish packages to npm
  await publishPhase(state, input.config, meceValidation);
  console.log(`✓ Publish complete`);

  // PHASE 7: COMPLETE - Generate reports
  state.phase = 'COMPLETE' as BuildPhase;
  await completePhase(state, input.config.workspaceRoot);

  console.log(`✅ Autonomous suite builder workflow complete`);

  // Return summary result
  return {
    totalPackages: state.packages.length,
    successfulBuilds: state.completedPackages.length,
    failedBuilds: state.failedPackages.length,
    skippedPackages: state.packages.length - state.completedPackages.length - state.failedPackages.length,
    packages: state.packages.map(pkg => ({
      name: pkg.name,
      version: pkg.version,
      buildStatus: state.completedPackages.includes(pkg.name)
        ? 'completed' as const
        : state.failedPackages.some(f => f.packageName === pkg.name)
        ? 'failed' as const
        : 'skipped' as const
    }))
  };
}

/**
 * PHASE 1: DISCOVERY
 * Parse input, find package, build dependency tree, setup worktree
 */
async function discoveryPhase(input: PackageWorkflowInput): Promise<DiscoveryResult> {
  console.log('Phase 1: DISCOVERY');

  // Step 1: Parse input to determine what we're building
  const parsedInput = parseInput(input);
  console.log(`  Input type: ${parsedInput.type}, value: ${parsedInput.value}`);

  let packageName: string;
  let packagePath: string;

  // Step 2: Find package in workspace
  if (parsedInput.type === 'packageName') {
    packageName = parsedInput.value;
    const searchResult = await searchForPackage({
      searchQuery: packageName,
      workspaceRoot: input.config.workspaceRoot
    });

    if (!searchResult.found || !searchResult.packagePath) {
      throw new Error(`Package ${packageName} not found. Searched: ${searchResult.searchedLocations.join(', ')}`);
    }

    packagePath = searchResult.packagePath;
  } else {
    // TODO: Handle other input types (packageIdea, planFilePath, updatePrompt)
    // These require MCP integration to generate plans or find packages
    throw new Error(`Input type ${parsedInput.type} not yet implemented. Use packageName for now.`);
  }

  // Step 3: Read package.json metadata
  const metadata = await readPackageJson({
    packagePath: `${input.config.workspaceRoot}/${packagePath}`
  });

  // Step 4: Build dependency tree (not used directly, but validates dependencies exist)
  await buildDependencyTree({
    packageName: metadata.name,
    workspaceRoot: input.config.workspaceRoot
  });

  // Step 5: Setup worktree (if needed)
  // TODO: Create git worktree for isolated builds
  const worktreePath = input.config.workspaceRoot; // Stub for now

  // Step 6: Copy .env files to worktree
  await copyEnvFiles({
    sourceRoot: input.config.workspaceRoot,
    worktreePath
  });

  return {
    packageName: metadata.name,
    packagePath,
    version: metadata.version,
    dependencies: metadata.dependencies,
    isPublished: false, // TODO: Check npm registry
    npmVersion: null,
    worktreePath
  };
}

/**
 * PHASE 2: PLANNING
 * Find or create implementation plans
 */
async function planningPhase(discovery: DiscoveryResult, workspaceRoot: string): Promise<PlanningResult> {
  console.log('Phase 2: PLANNING');

  // Step 1: Search for plan in local workspace
  let planPath = await searchLocalPlans({
    packageName: discovery.packageName,
    workspaceRoot
  });

  let planContent: string;

  if (planPath) {
    console.log(`  Found local plan at ${planPath}`);
    const fs = await import('fs/promises');
    planContent = await fs.readFile(planPath, 'utf-8');
  } else {
    // Step 2: Query MCP for plan
    console.log(`  No local plan found, querying MCP...`);
    const mcpPlan = await queryMcpForPlan({
      packageName: discovery.packageName
    });

    if (mcpPlan) {
      planContent = mcpPlan;
      // TODO: Write plan to local filesystem
      planPath = `${workspaceRoot}/plans/packages/${discovery.packageName}.md`;
    } else {
      throw new Error(`No plan found for ${discovery.packageName}. Please create a plan first.`);
    }
  }

  // Step 3: Validate plan has required sections
  const validation = await validatePlan({ planPath: planPath! });
  if (!validation.passed) {
    throw new Error(`Plan validation failed. Missing sections: ${validation.missingSections.join(', ')}`);
  }

  // Step 4: Register plan with MCP (if not already registered)
  await registerPlanWithMcp({
    packageName: discovery.packageName,
    planContent
  });

  return {
    packageName: discovery.packageName,
    planPath: planPath!,
    planContent,
    registeredWithMcp: true
  };
}

/**
 * PHASE 3: MECE VALIDATION
 * Validate MECE compliance and handle package splits if needed
 */
async function meceValidationPhase(
  discovery: DiscoveryResult,
  input: PackageWorkflowInput
): Promise<MeceValidationResult> {
  console.log('Phase 3: MECE VALIDATION');

  // Determine update context based on input type
  const parsedInput = parseInput(input);
  const updateContext = parsedInput.type === 'updatePrompt' ? parsedInput.value : 'Initial implementation';

  // Step 1: Analyze MECE compliance
  const analysis = await analyzeMeceCompliance({
    packageName: discovery.packageName,
    updateContext
  });

  if (analysis.isCompliant) {
    console.log(`  ✓ Package is MECE compliant`);
    return {
      isCompliant: true,
      additionalPackages: []
    };
  }

  console.log(`  ✗ MECE violation detected: ${analysis.violation!.description}`);

  // Step 2: Generate split package plans
  const splitPlansResult = await generateSplitPlans({
    packageName: discovery.packageName,
    violation: analysis.violation!
  });

  // Step 3: Register split plans with MCP
  await registerSplitPlans({
    splitPlans: splitPlansResult.splitPlans
  });

  // Step 4: Determine deprecation cycle (if package is published)
  const deprecationCycle = await determineDeprecationCycle({
    packageName: discovery.packageName,
    currentVersion: discovery.version,
    violation: analysis.violation!,
    isPublished: discovery.isPublished
  });

  console.log(`  Deprecation required: ${deprecationCycle.requiresDeprecation}`);

  // Step 5: Update dependent package plans
  await updateDependentPlans({
    packageName: discovery.packageName,
    splitPlans: splitPlansResult.splitPlans,
    workspaceRoot: input.config.workspaceRoot
  });

  // Convert split plans to PackageNode objects
  const additionalPackages: PackageNode[] = splitPlansResult.splitPlans.map(plan => ({
    name: plan.packageName,
    path: `packages/core/${plan.packageName.split('/')[1]}`, // Assume core category
    version: '0.1.0',
    dependencies: plan.dependencies,
    buildStatus: 'pending' as const,
    testStatus: 'pending' as const
  }));

  return {
    isCompliant: false,
    violation: analysis.violation,
    additionalPackages
  };
}

/**
 * PHASE 4: BUILD
 * Build all packages in dependency order with parallel execution
 */
async function buildPhase(state: SuiteBuilderState, config: BuildConfig): Promise<void> {
  console.log('Phase 4: BUILD');

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
      const category = pkg.category || 'core';
      const child = await startChild(PackageBuildWorkflow, {
        workflowId: `build-${state.suiteId}-${pkg.name}`,
        args: [{
          packageName: pkg.name,
          packagePath: `packages/${category}/${pkg.name.split('/')[1]}`,
          planPath: `plans/packages/${category}/${pkg.name.split('/')[1]}.md`,
          category,
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

/**
 * PHASE 6: PUBLISH
 * Publish packages to npm with version bumps and deprecation notices
 */
async function publishPhase(
  state: SuiteBuilderState,
  config: BuildConfig,
  meceValidation: MeceValidationResult
): Promise<void> {
  console.log('Phase 6: PUBLISH');

  // Only publish successfully built packages
  const successfulPackages = state.packages.filter(pkg =>
    state.completedPackages.includes(pkg.name)
  );

  for (const pkg of successfulPackages) {
    console.log(`  Publishing ${pkg.name}...`);

    // Step 1: Determine version bump
    const versionBump = await determineVersionBump({
      currentVersion: pkg.version,
      changeType: 'patch' // TODO: Determine based on changes
    });

    // Step 2: Publish to npm
    const publishResult = await publishToNpm({
      packagePath: `${config.workspaceRoot}/${pkg.path}`,
      version: versionBump.newVersion,
      isPublic: true,
      dryRun: config.publishing.dryRun
    });

    if (!publishResult.success) {
      console.error(`  Failed to publish ${pkg.name}: ${publishResult.error}`);
      continue;
    }

    console.log(`  ✓ Published ${pkg.name}@${publishResult.publishedVersion}`);

    // Step 3: Update dependent package versions
    await updateDependentVersions({
      packageName: pkg.name,
      newVersion: versionBump.newVersion,
      workspaceRoot: config.workspaceRoot
    });

    // Step 4: Publish deprecation notice if needed
    if (meceValidation.violation && !meceValidation.isCompliant) {
      const deprecationCycle = await determineDeprecationCycle({
        packageName: pkg.name,
        currentVersion: pkg.version,
        violation: meceValidation.violation,
        isPublished: true
      });

      if (deprecationCycle.requiresDeprecation) {
        const minorVersion = deprecationCycle.versions.find(v => v.versionType === 'minor');
        if (minorVersion && minorVersion.deprecationNotice) {
          await publishDeprecationNotice({
            packageName: pkg.name,
            version: versionBump.newVersion,
            message: minorVersion.deprecationNotice,
            dryRun: config.publishing.dryRun
          });
        }
      }
    }
  }
}

/**
 * PHASE 7: COMPLETE
 * Generate comprehensive reports
 */
async function completePhase(state: SuiteBuilderState, workspaceRoot: string): Promise<any[]> {
  console.log('Phase 7: COMPLETE');

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

  return packageReports;
}
