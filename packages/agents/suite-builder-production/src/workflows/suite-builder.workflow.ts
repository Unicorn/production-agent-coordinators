import { proxyActivities } from '@temporalio/workflow';
// import { startChild } from '@temporalio/workflow'; // TODO: Uncomment in Task 10
// import { PackageBuildWorkflow } from './package-build.workflow'; // TODO: Uncomment in Task 10
import type {
  SuiteBuilderInput,
  SuiteBuilderState,
  BuildPhase,
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

async function buildPhase(state: SuiteBuilderState, _config: BuildConfig): Promise<void> {
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
