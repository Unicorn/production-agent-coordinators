import { proxyActivities, startChild } from '@temporalio/workflow';
import { PackageBuildWorkflow } from './package-build.workflow';
import type {
  PackageBuilderInput,
  PackageBuilderState,
  BuildPhase,
  BuildConfig
} from '../types/index';
import type * as reportActivities from '../activities/report.activities';
import type * as buildActivities from '../activities/build.activities';

const { loadAllPackageReports, writeBuildReport } = proxyActivities<typeof reportActivities>({
  startToCloseTimeout: '5 minutes'
});

const { buildDependencyGraph } = proxyActivities<typeof buildActivities>({
  startToCloseTimeout: '5 minutes'
});

export async function PackageBuilderWorkflow(input: PackageBuilderInput): Promise<void> {
  console.log(`Starting package builder for ${input.buildId}`);

  // Initialize state
  const state: PackageBuilderState = await initializePhase(input);

  // PLAN phase
  await planPhase(state);

  // BUILD phase
  await buildPhase(state, input.config);

  // VERIFY phase
  await verifyPhase(state);

  // COMPLETE phase
  await completePhase(state, input.config.workspaceRoot);

  console.log(`Package builder complete for ${input.buildId}`);
}

async function initializePhase(input: PackageBuilderInput): Promise<PackageBuilderState> {
  console.log('Phase: INITIALIZE');

  // Parse audit report and build dependency graph
  const packages = await buildDependencyGraph(input.auditReportPath);

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

async function planPhase(state: PackageBuilderState): Promise<void> {
  console.log('Phase: PLAN');

  // TODO: Verify package plans exist

  state.phase = 'BUILD' as BuildPhase;
}

async function buildPhase(state: PackageBuilderState, config: BuildConfig): Promise<void> {
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

function hasUnbuiltPackages(state: PackageBuilderState): boolean {
  return state.packages.some(pkg =>
    pkg.buildStatus === 'pending' || pkg.buildStatus === 'building'
  );
}

async function verifyPhase(state: PackageBuilderState): Promise<void> {
  console.log('Phase: VERIFY');

  // TODO: Run integration tests

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
