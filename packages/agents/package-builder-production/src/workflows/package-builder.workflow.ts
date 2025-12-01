import { proxyActivities, startChild, defineSignal } from '@temporalio/workflow';
import { PackageBuildWorkflow } from './package-build.workflow.js';
import type {
  PackageBuilderInput,
  PackageBuilderState,
  BuildPhase,
  BuildConfig,
  PackageNode
} from '../types/index';
import type * as reportActivities from '../activities/report.activities';
import type * as buildActivities from '../activities/build.activities';
import type * as agenticParserActivities from '../activities/agentic-plan-parser.activities';
import type * as dependencyTreeValidatorActivities from '../activities/dependency-tree-validator.activities';

// Define signals for child workflow completion
export const packageBuildCompleteSignal = defineSignal<[{ packageName: string; success: boolean; result: any }]>(
  'packageBuildComplete'
);

const { loadAllPackageReports, writeBuildReport } = proxyActivities<typeof reportActivities>({
  startToCloseTimeout: '5 minutes'
});

const { buildDependencyGraph } = proxyActivities<typeof buildActivities>({
  startToCloseTimeout: '5 minutes'
});

const { parsePlanFileWithAgent } = proxyActivities<typeof agenticParserActivities>({
  startToCloseTimeout: '10 minutes' // Longer timeout for AI processing
});

const { validateDependencyTreePublishStatus } = proxyActivities<typeof dependencyTreeValidatorActivities>({
  startToCloseTimeout: '10 minutes' // Longer timeout for npm checks
});

export async function PackageBuilderWorkflow(input: PackageBuilderInput): Promise<void> {
  console.log(`Starting package builder for ${input.buildId}`);

  // Initialize state
  const state: PackageBuilderState = await initializePhase(input);

  // PLAN phase - validates dependencies and filters packages
  await planPhase(state, input.workspaceRoot);

  // BUILD phase
  await buildPhase(state, input.workspaceRoot, input.config);

  // VERIFY phase
  await verifyPhase(state);

  // COMPLETE phase
  await completePhase(state, input.workspaceRoot);

  console.log(`Package builder complete for ${input.buildId}`);
}

async function initializePhase(input: PackageBuilderInput): Promise<PackageBuilderState> {
  console.log('Phase: INITIALIZE');

  let packages: PackageNode[];

  // Handle three input modes
  if (input.auditReportPath) {
    // Option 1: Audit report (backward compatible)
    console.log(`[Init] Loading packages from audit report: ${input.auditReportPath}`);
    packages = await buildDependencyGraph(input.auditReportPath);
  } else if (input.planPath) {
    // Option 2: Direct plan path - parse dependencies from plan using AI agent
    console.log(`[Init] Parsing plan file with AI agent: ${input.planPath}`);
    packages = await parsePlanFileWithAgent({
      workspaceRoot: input.workspaceRoot,
      planPath: input.planPath
    });
  } else if (input.packages) {
    // Option 3: Direct package list
    console.log(`[Init] Using provided package list: ${input.packages.length} packages`);
    packages = input.packages.map(pkg => ({
      name: pkg.packageName,
      category: pkg.category,
      dependencies: pkg.dependencies,
      layer: categoryToLayer(pkg.category),
      buildStatus: 'pending' as const
    }));

    // Sort by layer
    packages.sort((a, b) => a.layer - b.layer);
  } else {
    throw new Error('PackageBuilderInput must provide one of: auditReportPath, planPath, or packages');
  }

  console.log(`[Init] Found ${packages.length} packages to build`);

  const state: PackageBuilderState = {
    phase: 'PLAN' as BuildPhase,
    buildId: input.buildId,
    packages,
    completedPackages: [],
    failedPackages: [],
    childWorkflowIds: new Map()
  };

  return state;
}

function categoryToLayer(category: string): number {
  const layerMap: Record<string, number> = {
    'validator': 0,
    'core': 1,
    'utility': 2,
    'service': 3,
    'ui': 4,
    'suite': 5
  };
  return layerMap[category] || 3;
}

/**
 * Map package category to actual directory name
 * The "utility" category doesn't have a corresponding directory - use "core" instead
 */
function categoryToDirectory(category: string): string {
  // Map utility to core since no utility directory exists
  if (category === 'utility') {
    return 'core';
  }
  // Validators directory uses "validators" plural
  if (category === 'validator') {
    return 'validators';
  }
  return category;
}

async function planPhase(state: PackageBuilderState, workspaceRoot: string): Promise<void> {
  console.log('Phase: PLAN');

  // Validate dependency tree publish status BEFORE building
  console.log('[Plan] Validating which packages need building...');

  const packagesForValidation = state.packages.map(pkg => ({
    packageName: pkg.name,
    packagePath: `packages/${categoryToDirectory(pkg.category)}/${pkg.name.split('/')[1]}`,
    planPath: `plans/packages/${categoryToDirectory(pkg.category)}/${pkg.name.split('/')[1]}.md`,
    category: pkg.category
  }));

  const validation = await validateDependencyTreePublishStatus({
    packages: packagesForValidation,
    workspaceRoot
  });

  // Store validation results for use in COMPLETE phase
  (state as any).publishValidation = validation;

  // Filter out packages that don't need building
  const packagesToSkip = new Set(validation.packagesToSkip);
  const originalCount = state.packages.length;

  state.packages = state.packages.filter(pkg => !packagesToSkip.has(pkg.name));

  const skippedCount = originalCount - state.packages.length;

  console.log(`[Plan] ✅ Filtered ${skippedCount} already-published packages`);
  console.log(`[Plan] 📦 ${state.packages.length} packages will be built`);

  if (state.packages.length > 0) {
    console.log('[Plan] Packages to build:');
    state.packages.forEach(pkg => console.log(`[Plan]   - ${pkg.name}`));
  }

  // Check for validation errors that would block the build
  if (validation.packagesNeedingVersionBump.length > 0) {
    console.log(`[Plan] ⚠️  Warning: ${validation.packagesNeedingVersionBump.length} package(s) need version bumps:`);
    validation.packagesNeedingVersionBump.forEach(name => console.log(`[Plan]    - ${name}`));
  }

  if (validation.validationErrors.length > 0) {
    console.log('[Plan] ⚠️  Validation warnings:');
    validation.validationErrors.forEach(err => console.log(`[Plan]    - ${err}`));
  }

  state.phase = 'BUILD' as BuildPhase;
}

async function buildPhase(state: PackageBuilderState, workspaceRoot: string, config: BuildConfig): Promise<void> {
  console.log('Phase: BUILD');

  const maxConcurrent = config.maxConcurrentBuilds || 4;
  const activeBuilds = new Map<string, { handle: any; packageName: string }>();

  while (hasUnbuiltPackages(state)) {
    // Find packages ready to build (all dependencies completed)
    const readyPackages = state.packages.filter(pkg =>
      pkg.buildStatus === 'pending' &&
      pkg.dependencies.every(dep => state.completedPackages.includes(dep))
    );

    // Spawn child workflows one at a time to avoid timeout
    for (const pkg of readyPackages) {
      if (activeBuilds.size >= maxConcurrent) {
        break; // Wait for slots to free up
      }

      console.log(`[Build] Starting child workflow for ${pkg.name}`);

      // Always use PackageBuildWorkflow with CLI agents
      const childWorkflow = PackageBuildWorkflow;

      const packageDir = pkg.name.split('/')[1];
      const categoryDir = categoryToDirectory(pkg.category);

      // Spawn child workflow (non-blocking - just gets the handle)
      const handle = await startChild(childWorkflow, {
        workflowId: `build-${state.buildId}-${pkg.name}`,
        taskQueue: 'engine',
        args: [{
          packageName: pkg.name,
          packagePath: `packages/${categoryDir}/${packageDir}`,
          planPath: `plans/packages/${categoryDir}/${packageDir}.md`,
          category: pkg.category,
          dependencies: pkg.dependencies,
          workspaceRoot,
          config
        }]
      });

      activeBuilds.set(pkg.name, { handle, packageName: pkg.name });
      pkg.buildStatus = 'building';
    }

    // Wait for at least one child to complete (if any are running)
    if (activeBuilds.size > 0) {
      // Create promises for all active builds
      const promises = Array.from(activeBuilds.values()).map(async ({ handle, packageName }) => {
        const result = await handle.result();
        return { packageName, result };
      });

      // Wait for first to complete
      const completed = await Promise.race(promises);

      // Process completion
      activeBuilds.delete(completed.packageName);
      const pkg = state.packages.find(p => p.name === completed.packageName);

      if (pkg) {
        if (completed.result.success) {
          pkg.buildStatus = 'completed';
          state.completedPackages.push(completed.packageName);
          console.log(`[Build] ✅ ${completed.packageName} completed successfully`);
        } else {
          pkg.buildStatus = 'failed';
          state.failedPackages.push({
            packageName: completed.packageName,
            phase: completed.result.failedPhase || 'build',
            error: completed.result.error || 'Unknown error',
            fixAttempts: completed.result.fixAttempts || 0,
            canRetryManually: true
          });
          console.log(`[Build] ❌ ${completed.packageName} failed: ${completed.result.error}`);
        }
      }
    } else {
      // No active builds but have unbuilt packages - wait a bit for dependencies
      // This shouldn't happen if dependency logic is correct
      break;
    }
  }

  state.phase = 'VERIFY' as BuildPhase;
}

function hasUnbuiltPackages(state: PackageBuilderState): boolean {
  return state.packages.some(pkg =>
    pkg.buildStatus === 'pending' || pkg.buildStatus === 'building'
  );
}

async function verifyPhase(state: PackageBuilderState): Promise<void> {
  console.log('Phase: VERIFY');

  // Validation already happened in PLAN phase
  // This phase is for running integration tests

  // TODO: Run integration tests
  console.log('[Verify] ⏭️  Integration tests not yet implemented');
  console.log('[Verify] ✅ Verify phase complete');

  state.phase = 'COMPLETE' as BuildPhase;
}

async function completePhase(state: PackageBuilderState, workspaceRoot: string): Promise<void> {
  console.log('Phase: COMPLETE');

  // Load all package reports
  const packageReports = await loadAllPackageReports(state.buildId, workspaceRoot);

  // Generate build report
  const buildReport = {
    buildId: state.buildId,
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

  await writeBuildReport(buildReport, workspaceRoot);

  console.log(`✅ Package build complete: ${state.completedPackages.length} packages`);
  if (state.failedPackages.length > 0) {
    console.log(`❌ Failed: ${state.failedPackages.length} packages`);
  }
}
