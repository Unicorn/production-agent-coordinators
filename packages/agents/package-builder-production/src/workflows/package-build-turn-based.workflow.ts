/**
 * Turn-Based Package Build Workflow
 *
 * Orchestrates 15-phase package generation with git commits between phases.
 * Each phase makes focused Claude API calls within token budgets.
 * State persists to disk for recovery from failures.
 *
 * Architecture:
 * - Phases execute sequentially (PLANNING → FOUNDATION → TYPES → ... → MERGE)
 * - Each phase saves state after completion
 * - Git commits after each phase for recovery points
 * - Supports resume from saved context
 */

import { proxyActivities } from '@temporalio/workflow';
import type {
  TurnBasedPackageBuildInput,
  PackageBuildResult,
  PackageBuildReport,
  GenerationContext,
  GenerationPhase,
  PackageCategory
} from '../types/index.js';
import type * as stateActivities from '../activities/generation-state.activities.js';
import type * as phaseActivities from '../activities/phase-executor.activities.js';
import type * as buildActivities from '../activities/build.activities.js';
import type * as reportActivities from '../activities/report.activities.js';

// State management activities (quick operations)
const {
  saveGenerationState,
  recordCompletedStep,
  markContextFailed
} = proxyActivities<typeof stateActivities>({
  startToCloseTimeout: '2 minutes'
});

// Phase executor activities (longer - includes Claude API calls)
const {
  executePlanningPhase,
  executeFoundationPhase
} = proxyActivities<typeof phaseActivities>({
  startToCloseTimeout: '15 minutes'
});

// Build activities (git operations)
const { commitChanges } = proxyActivities<typeof buildActivities>({
  startToCloseTimeout: '5 minutes'
});

// Report activities
const { writePackageBuildReport } = proxyActivities<typeof reportActivities>({
  startToCloseTimeout: '1 minute'
});

/**
 * Turn-Based Package Build Workflow
 *
 * Executes package generation in 15 phases with state persistence.
 *
 * @param input - Turn-based package build input with optional resume context
 * @returns Package build result with success status and report
 */
export async function PackageBuildTurnBasedWorkflow(
  input: TurnBasedPackageBuildInput
): Promise<PackageBuildResult> {
  const startTime = Date.now();
  const report: PackageBuildReport = {
    packageName: input.packageName,
    workflowId: 'wf-placeholder',
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
    // Initialize or resume generation context
    let context: GenerationContext;

    if (input.resumeFromContext) {
      console.log(`[TurnBased] Resuming from context session ${input.resumeFromContext.sessionId}`);
      context = input.resumeFromContext;
    } else {
      console.log(`[TurnBased] Initializing new generation context for ${input.packageName}`);
      context = initializeContext(input);
      await saveGenerationState(context);
    }

    // Execute phases in order
    // Currently only PLANNING and FOUNDATION are implemented
    // TODO: Add remaining 13 phases in Task 5
    const phases: GenerationPhase[] = [
      'PLANNING',
      'FOUNDATION'
    ];

    for (const phase of phases) {
      if (shouldSkipPhase(context, phase)) {
        console.log(`[TurnBased] Skipping ${phase} (already completed)`);
        continue;
      }

      console.log(`[TurnBased] Executing ${phase} phase`);
      context.currentPhase = phase;

      const result = await executePhase(context, phase);

      if (!result.success) {
        console.error(`[TurnBased] Phase ${phase} failed: ${result.error}`);
        await markContextFailed(context, context.currentStepNumber, result.error!);
        throw new Error(`Phase ${phase} failed: ${result.error}`);
      }

      // Record completed steps
      for (const step of result.steps) {
        await recordCompletedStep(context, step);
      }

      // Commit phase completion to git
      const commitResult = await commitChanges({
        workspaceRoot: context.workspaceRoot,
        packagePath: context.packagePath,
        message: buildCommitMessage(phase, context, result.filesModified),
        gitUser: {
          name: 'Package Builder',
          email: 'builder@bernier.llc'
        }
      });

      if (commitResult.success && commitResult.commitHash) {
        context.lastSuccessfulCommit = commitResult.commitHash;
        await saveGenerationState(context);
        console.log(`[TurnBased] Phase ${phase} committed: ${commitResult.commitHash}`);
      }
    }

    // Mark workflow as successful
    report.status = 'success';
    report.quality.passed = true;

    return {
      success: true,
      packageName: input.packageName,
      report
    };

  } catch (error) {
    console.error(`[TurnBased] Workflow failed: ${error}`);
    report.status = 'failed';
    report.error = error instanceof Error ? error.message : String(error);

    return {
      success: false,
      packageName: input.packageName,
      failedPhase: 'build',
      error: report.error,
      fixAttempts: 0,
      report
    };

  } finally {
    report.endTime = new Date().toISOString();
    report.duration = Date.now() - startTime;

    await writePackageBuildReport(report, input.workspaceRoot);
  }
}

/**
 * Initialize new generation context
 *
 * @param input - Package build input
 * @returns New generation context
 */
function initializeContext(input: TurnBasedPackageBuildInput): GenerationContext {
  return {
    sessionId: `gen-${Date.now()}`,
    branch: `feat/package-generation-${Date.now()}`,
    packageName: input.packageName,
    packageCategory: input.category,
    packagePath: input.packagePath,
    planPath: input.planPath,
    workspaceRoot: input.workspaceRoot,
    currentPhase: 'PLANNING',
    currentStepNumber: 0,
    completedSteps: [],
    requirements: {
      testCoverageTarget: getCoverageTarget(input.category),
      loggerIntegration: 'not-applicable',
      neverhubIntegration: 'not-applicable',
      docsSuiteIntegration: 'planned',
      meceValidated: false,
      planApproved: false
    }
  };
}

/**
 * Execute a specific phase
 *
 * Routes to the appropriate phase executor activity.
 *
 * @param context - Generation context
 * @param phase - Phase to execute
 * @returns Phase execution result
 */
async function executePhase(
  context: GenerationContext,
  phase: GenerationPhase
) {
  switch (phase) {
    case 'PLANNING':
      return executePlanningPhase(context);
    case 'FOUNDATION':
      return executeFoundationPhase(context);
    default:
      throw new Error(`Phase ${phase} not implemented yet`);
  }
}

/**
 * Check if phase should be skipped
 *
 * Skips phases that have already been completed in the context.
 *
 * @param context - Generation context
 * @param phase - Phase to check
 * @returns True if phase should be skipped
 */
function shouldSkipPhase(context: GenerationContext, phase: GenerationPhase): boolean {
  // Skip if any step from this phase is already completed
  return context.completedSteps.some(step => step.phase === phase);
}

/**
 * Get coverage target based on package category
 *
 * @param category - Package category
 * @returns Coverage percentage target
 */
function getCoverageTarget(category: PackageCategory): number {
  const targets: Record<PackageCategory, number> = {
    'core': 90,
    'service': 85,
    'suite': 80,
    'ui': 80,
    'validator': 90,
    'utility': 85
  };
  return targets[category] || 85;
}

/**
 * Build git commit message for phase completion
 *
 * @param phase - Completed phase
 * @param context - Generation context
 * @param filesModified - List of modified files
 * @returns Formatted commit message
 */
function buildCommitMessage(
  phase: GenerationPhase,
  context: GenerationContext,
  filesModified: string[]
): string {
  const phaseLabel = phase.toLowerCase().replace(/_/g, '-');

  return `feat(${phaseLabel}): complete ${phase} phase for ${context.packageName}

Files modified: ${filesModified.join(', ')}

[Turn-based generation step ${context.currentStepNumber}]`;
}
