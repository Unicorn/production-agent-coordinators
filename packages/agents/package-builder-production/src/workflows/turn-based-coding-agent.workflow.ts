/**
 * Generic Turn-Based Coding Agent Workflow
 *
 * A reusable workflow for any turn-based coding task using Claude API.
 * Executes code generation/modification in 15 sequential phases with:
 * - Controlled token budgets per phase (2000-8000 tokens)
 * - Git commits between phases for recovery
 * - State persistence to disk
 * - Support for resume from failures
 * - **Conversation tracking for context preservation**
 *
 * ## Conversation Tracking
 *
 * This workflow automatically tracks all Claude API conversations:
 * - `context.fullConversationHistory` - Complete message history across ALL phases
 * - `context.phaseConversations` - Per-phase message history for debugging
 * - `context.totalTokensUsed` - Token usage tracking for cost analysis
 *
 * Phase executors capture every Claude API call:
 * 1. Include previous conversation in API request (for context continuity)
 * 2. Capture Claude's response
 * 3. Store in GenerationContext
 * 4. Persist via saveGenerationState()
 *
 * This enables:
 * - **Validation feedback loops**: Send errors back to same conversation
 * - **Resume from failures**: Continue with full context
 * - **Debugging**: Trace what Claude saw/said at each phase
 * - **Cost tracking**: Monitor token usage per phase
 *
 * Use Cases:
 * - Building new packages from scratch
 * - Fixing broken packages
 * - Refactoring existing code
 * - Adding features to existing code
 * - Code reviews and improvements
 *
 * Architecture:
 * - Runs on dedicated "turn-based-coding" task queue
 * - Worker concurrency controls Claude API rate limits
 * - Generic enough to handle any coding task
 * - Conversation context preserved across phases
 *
 * @example Building a new package
 * ```typescript
 * const handle = await client.workflow.start(TurnBasedCodingAgentWorkflow, {
 *   taskQueue: 'turn-based-coding',
 *   args: [{
 *     task: 'build-package',
 *     prompt: 'Build a data validator package according to the plan',
 *     workspaceRoot: '/workspace',
 *     targetPath: 'packages/core/data-validator',
 *     contextPaths: ['plans/packages/core/data-validator.md'],
 *     category: 'core'
 *   }]
 * });
 * ```
 *
 * @example Fixing a broken package with conversation context
 * ```typescript
 * // Load existing context from disk
 * const existingContext = await loadGenerationState(sessionId);
 *
 * // Resume with FULL conversation history
 * const handle = await client.workflow.start(TurnBasedCodingAgentWorkflow, {
 *   taskQueue: 'turn-based-coding',
 *   args: [{
 *     task: 'fix-package',
 *     prompt: 'Fix these test failures: [errors]',
 *     workspaceRoot: '/workspace',
 *     targetPath: 'packages/core/data-validator',
 *     contextPaths: ['packages/core/data-validator/test-results.txt'],
 *     resumeFromContext: existingContext  // ← Claude gets full context!
 *   }]
 * });
 * ```
 */

import { proxyActivities } from '@temporalio/workflow';
import type {
  GenerationContext,
  GenerationPhase,
  PackageCategory,
  ConversationHistory
} from '../types/index.js';
import type * as stateActivities from '../activities/generation-state.activities.js';
import type * as phaseActivities from '../activities/phase-executor.activities.js';
import type * as buildActivities from '../activities/build.activities.js';

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
  executeFoundationPhase,
  executeTypesPhase,
  executeCoreImplementationPhase,
  executeEntryPointPhase,
  executeUtilitiesPhase,
  executeErrorHandlingPhase,
  executeTestingPhase,
  executeDocumentationPhase,
  executeExamplesPhase,
  executeIntegrationReviewPhase,
  executeCriticalFixesPhase,
  executeBuildValidationPhase,
  executeFinalPolishPhase
} = proxyActivities<typeof phaseActivities>({
  startToCloseTimeout: '15 minutes'
});

// Build activities (git operations)
const { commitChanges } = proxyActivities<typeof buildActivities>({
  startToCloseTimeout: '5 minutes'
});

/**
 * Input for turn-based coding agent workflow
 */
export interface TurnBasedCodingAgentInput {
  /** Task type: 'build-package', 'fix-package', 'refactor-code', etc. */
  task: string;

  /** Detailed prompt for Claude describing what to do */
  prompt: string;

  /** Root directory of the workspace */
  workspaceRoot: string;

  /** Target directory where code will be generated/modified */
  targetPath: string;

  /** Context file paths to include (plan files, error logs, etc.) */
  contextPaths?: string[];

  /** Package category (for building new packages) */
  category?: PackageCategory;

  /** Resume from existing context (for retries/fixes) */
  resumeFromContext?: GenerationContext;

  /** Git user info for commits */
  gitUser?: {
    name: string;
    email: string;
  };
}

/**
 * Output from turn-based coding agent workflow
 */
export interface TurnBasedCodingAgentResult {
  success: boolean;
  filesModified: string[];
  context: GenerationContext;
  error?: string;
}

/**
 * Turn-Based Coding Agent Workflow
 *
 * Executes any coding task in 15 sequential phases with Claude API calls.
 * Each phase has a focused token budget and commits to git for recovery.
 *
 * Phases (ALL IMPLEMENTED):
 * 1. PLANNING - Create plan and architecture blueprint (5000 tokens)
 * 2. FOUNDATION - Generate config files (3000 tokens)
 * 3. TYPES - Generate type definitions (4000 tokens)
 * 4. CORE_IMPLEMENTATION - Implement main functionality (8000 tokens)
 * 5. ENTRY_POINT - Create barrel file (2000 tokens)
 * 6. UTILITIES - Generate utility functions (4000 tokens)
 * 7. ERROR_HANDLING - Create error classes (3000 tokens)
 * 8. TESTING - Generate test suite (6000 tokens)
 * 9. DOCUMENTATION - Write README and docs (3000 tokens)
 * 10. EXAMPLES - Create usage examples (4000 tokens)
 * 11. INTEGRATION_REVIEW - Review integrations (4000 tokens)
 * 12. CRITICAL_FIXES - Fix issues from review (5000 tokens)
 * 13. BUILD_VALIDATION - Validate build and tests (4000 tokens)
 * 14. FINAL_POLISH - Final quality pass (3000 tokens)
 *
 * Total execution time: 25-35 minutes
 * Total token budget: ~58,000 tokens across all phases
 *
 * @param input - Turn-based coding agent input
 * @returns Result with success status, files modified, and context
 *
 * @throws Error if phase execution fails after retries
 * @throws Error if git operations fail
 * @throws Error if state persistence fails
 */
export async function TurnBasedCodingAgentWorkflow(
  input: TurnBasedCodingAgentInput
): Promise<TurnBasedCodingAgentResult> {
  const startTime = Date.now();

  try {
    // Initialize or resume generation context
    let context: GenerationContext;

    if (input.resumeFromContext) {
      console.log(`[TurnBasedAgent] Resuming from context session ${input.resumeFromContext.sessionId}`);
      context = input.resumeFromContext;
    } else {
      console.log(`[TurnBasedAgent] Initializing new generation context for ${input.task}`);
      context = initializeContext(input);
      await saveGenerationState(context);
    }

    // Execute phases in order
    const phases: GenerationPhase[] = [
      'PLANNING',
      'FOUNDATION',
      'TYPES',
      'CORE_IMPLEMENTATION',
      'ENTRY_POINT',
      'UTILITIES',
      'ERROR_HANDLING',
      'TESTING',
      'DOCUMENTATION',
      'EXAMPLES',
      'INTEGRATION_REVIEW',
      'CRITICAL_FIXES',
      'BUILD_VALIDATION',
      'FINAL_POLISH'
    ];

    const filesModified: string[] = [];

    for (const phase of phases) {
      if (shouldSkipPhase(context, phase)) {
        console.log(`[TurnBasedAgent] Skipping ${phase} (already completed)`);
        continue;
      }

      console.log(`[TurnBasedAgent] Executing ${phase} phase`);
      context.currentPhase = phase;

      const result = await executePhase(context, phase);

      if (!result.success) {
        console.error(`[TurnBasedAgent] Phase ${phase} failed: ${result.error}`);
        await markContextFailed(context, context.currentStepNumber, result.error!);
        throw new Error(`Phase ${phase} failed: ${result.error}`);
      }

      // Record completed steps
      for (const step of result.steps) {
        await recordCompletedStep(context, step);
      }

      // Track modified files
      filesModified.push(...result.filesModified);

      // Commit phase completion to git
      const gitUser = input.gitUser || {
        name: 'Turn-Based Coding Agent',
        email: 'agent@bernier.llc'
      };

      const commitResult = await commitChanges({
        workspaceRoot: context.workspaceRoot,
        packagePath: context.packagePath,
        message: buildCommitMessage(phase, context, input.task, result.filesModified),
        gitUser
      });

      if (commitResult.success && commitResult.commitHash) {
        context.lastSuccessfulCommit = commitResult.commitHash;
        await saveGenerationState(context);
        console.log(`[TurnBasedAgent] Phase ${phase} committed: ${commitResult.commitHash}`);
      }
    }

    console.log(`[TurnBasedAgent] Workflow completed successfully in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

    return {
      success: true,
      filesModified,
      context
    };

  } catch (error) {
    console.error(`[TurnBasedAgent] Workflow failed: ${error}`);

    return {
      success: false,
      filesModified: [],
      context: input.resumeFromContext || initializeContext(input),
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Initialize new generation context
 *
 * @param input - Coding agent input
 * @returns New generation context
 */
function initializeContext(input: TurnBasedCodingAgentInput): GenerationContext {
  return {
    sessionId: `gen-${Date.now()}`,
    branch: `feat/turn-based-${input.task}-${Date.now()}`,
    packageName: extractPackageNameFromPath(input.targetPath),
    packageCategory: input.category || 'core',
    packagePath: input.targetPath,
    planPath: input.contextPaths?.[0] || '',
    workspaceRoot: input.workspaceRoot,
    currentPhase: 'PLANNING',
    currentStepNumber: 0,
    completedSteps: [],
    requirements: {
      testCoverageTarget: getCoverageTarget(input.category || 'core'),
      loggerIntegration: 'not-applicable',
      neverhubIntegration: 'not-applicable',
      docsSuiteIntegration: 'planned',
      meceValidated: false,
      planApproved: false
    },
    // Initialize conversation tracking
    fullConversationHistory: [],
    phaseConversations: {} as Record<GenerationPhase, ConversationHistory>,
    totalTokensUsed: {
      input: 0,
      output: 0
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
    case 'TYPES':
      return executeTypesPhase(context);
    case 'CORE_IMPLEMENTATION':
      return executeCoreImplementationPhase(context);
    case 'ENTRY_POINT':
      return executeEntryPointPhase(context);
    case 'UTILITIES':
      return executeUtilitiesPhase(context);
    case 'ERROR_HANDLING':
      return executeErrorHandlingPhase(context);
    case 'TESTING':
      return executeTestingPhase(context);
    case 'DOCUMENTATION':
      return executeDocumentationPhase(context);
    case 'EXAMPLES':
      return executeExamplesPhase(context);
    case 'INTEGRATION_REVIEW':
      return executeIntegrationReviewPhase(context);
    case 'CRITICAL_FIXES':
      return executeCriticalFixesPhase(context);
    case 'BUILD_VALIDATION':
      return executeBuildValidationPhase(context);
    case 'FINAL_POLISH':
      return executeFinalPolishPhase(context);
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
 * Extract package name from target path
 * E.g., "packages/core/data-validator" → "@bernierllc/data-validator"
 *
 * @param targetPath - Target directory path
 * @returns Package name
 */
function extractPackageNameFromPath(targetPath: string): string {
  const parts = targetPath.split('/');
  const packageDir = parts[parts.length - 1];
  return `@bernierllc/${packageDir}`;
}

/**
 * Build git commit message for phase completion
 *
 * @param phase - Completed phase
 * @param context - Generation context
 * @param task - Task type
 * @param filesModified - List of modified files
 * @returns Formatted commit message
 */
function buildCommitMessage(
  phase: GenerationPhase,
  context: GenerationContext,
  task: string,
  filesModified: string[]
): string {
  const phaseLabel = phase.toLowerCase().replace(/_/g, '-');

  return `feat(${phaseLabel}): complete ${phase} phase for ${task}

Task: ${task}
Package: ${context.packageName}
Files modified: ${filesModified.join(', ')}

[Turn-based generation step ${context.currentStepNumber}]`;
}
