/**
 * Gemini-based Turn-Based Coding Agent Workflow
 *
 * Alternative implementation using Google's Gemini API with agentic command pattern.
 * Unlike the Claude approach which uses predefined phases, this workflow lets the AI
 * choose the next action from a set of commands in a loop.
 *
 * ## Architecture
 *
 * - **Loop-based**: Up to 40 iterations vs 15 predefined phases
 * - **Dynamic commands**: AI chooses from APPLY_CODE_CHANGES, RUN_LINT_CHECK, RUN_UNIT_TESTS, etc.
 * - **Human-in-the-loop**: Can receive hints via signal when stuck
 * - **Context building**: Fetches file content on failures to provide more context
 *
 * ## Workflow
 *
 * 1. Start with empty action history
 * 2. Loop up to 40 times:
 *    a. Ask Gemini for next command based on plan, context, and history
 *    b. Execute command (apply changes, run lint, run tests, etc.)
 *    c. Update action history
 *    d. If stuck on lint/test failures, request human help
 * 3. Success when PUBLISH_PACKAGE command completes
 *
 * ## Key Differences from Claude Approach
 *
 * | Feature | Claude Approach | Gemini Approach |
 * |---------|----------------|-----------------|
 * | Structure | 15 predefined phases | Dynamic loop (40 max) |
 * | AI Decision | Which phase to execute | Which command to execute next |
 * | Token Budget | 2000-8000 per phase | Per-command basis |
 * | Commits | After each phase | After each code change |
 * | Recovery | Resume from phase | Human intervention signal |
 *
 * Extracted from temporal-agent-generator.zip and adapted for production use.
 */

import { proxyActivities, log, sleep, defineSignal, defineQuery, setHandler, condition, workflowInfo } from '@temporalio/workflow';
import { ApplicationFailure } from '@temporalio/common';
import type * as geminiActivities from '../activities/gemini-agent.activities.js';
import type { PackageCategory, FileFailureTracker, FileFailureEntry, FileFailureAction, PackageAuditContext } from '../types/index.js';

// Proxy Gemini activities
const {
  determineNextAction,
  applyCodeChanges,
  getFileContent,
  validatePackageJson,
  checkLicenseHeaders,
  runLintCheck,
  runUnitTests,
  runBuildValidation,
  publishGeminiPackage,
  notifyHumanForHelp,
  notifyPublishSuccess,
  readPlanFile,
  // listPackageFiles - used internally by getPackageContext
  getPackageContext,
  scaffoldPackageConfig
} = proxyActivities<typeof geminiActivities>({
  startToCloseTimeout: '10 minutes',
});

// Constants
const MAX_LOOP_ITERATIONS = 40;
const MAX_LINT_FIX_ATTEMPTS = 3;
const MIN_TEST_COVERAGE = 90;

// Per-file loop detection constants
const MAX_FILE_MODIFICATIONS_BEFORE_META = 3;
const MAX_META_CORRECTION_ATTEMPTS = 2;

// ========================================================================
// Per-File Failure Tracking Helpers
// ========================================================================

/**
 * Simple hash function for error messages.
 * Used to detect repeated errors on the same file.
 */
function hashError(errorMessage: string): string {
  // Simple hash: first 50 chars + length (good enough for error comparison)
  const normalized = errorMessage.toLowerCase().replace(/\s+/g, ' ').trim();
  return `${normalized.substring(0, 50)}_${normalized.length}`;
}

/**
 * Tracks a file failure and determines the appropriate action.
 *
 * @param tracker - The file failure tracker state
 * @param filePath - Path of the file with the error
 * @param errorMessage - The error message
 * @returns Action to take: 'continue', 'meta_correct', or 'terminate'
 */
function trackFileFailure(
  tracker: FileFailureTracker,
  filePath: string,
  errorMessage: string
): FileFailureAction {
  const errorHash = hashError(errorMessage);

  if (!tracker[filePath]) {
    // First failure for this file
    tracker[filePath] = {
      modificationCount: 1,
      errors: [errorMessage.substring(0, 500)], // Truncate for storage
      metaCorrectionSent: false,
      metaCorrectionAttempts: 0,
      lastErrorHash: errorHash
    };
    return 'continue';
  }

  const entry = tracker[filePath];

  // Check if same error repeating
  if (entry.lastErrorHash === errorHash) {
    entry.modificationCount++;
    entry.errors.push(errorMessage.substring(0, 500));

    // Threshold 1: Send meta-correction after 3 failures with same error
    if (entry.modificationCount >= MAX_FILE_MODIFICATIONS_BEFORE_META && !entry.metaCorrectionSent) {
      entry.metaCorrectionSent = true;
      entry.metaCorrectionAttempts = 0;
      log.warn(`[Gemini] File ${filePath} stuck after ${entry.modificationCount} attempts, sending meta-correction`);
      return 'meta_correct';
    }

    // Threshold 2: After meta-correction, allow 2 more attempts
    if (entry.metaCorrectionSent) {
      entry.metaCorrectionAttempts++;

      if (entry.metaCorrectionAttempts > MAX_META_CORRECTION_ATTEMPTS) {
        log.error(`[Gemini] File ${filePath} still failing after meta-correction, terminating workflow`);
        return 'terminate';
      }
      return 'meta_correct'; // Keep sending meta-correction
    }
  } else {
    // Different error - reset counter but keep history
    entry.modificationCount = 1;
    entry.lastErrorHash = errorHash;
    entry.errors.push(errorMessage.substring(0, 500));
    // Don't reset metaCorrectionSent - if we already sent it, file is problematic
  }

  return 'continue';
}

/**
 * Builds a meta-correction message to help the AI understand what's wrong.
 * This is sent when the AI is stuck on the same file with the same error.
 */
function buildMetaCorrectionMessage(
  filePath: string,
  entry: FileFailureEntry,
  expectedFormat: string,
  observedIssue: string
): string {
  const remainingAttempts = MAX_META_CORRECTION_ATTEMPTS - entry.metaCorrectionAttempts;

  return `
## ⚠️ STUCK ON FILE: ${filePath}

You have attempted to modify ${filePath} ${entry.modificationCount} times with the same or similar error.

### Expected Format
${expectedFormat}

### Issue Observed
${observedIssue}

### Latest Error
${entry.errors[entry.errors.length - 1]}

### Instructions
1. Review the error message carefully
2. Check if your file content has the correct format
3. For JSON files: Do NOT use markdown code fences (\`\`\`json...\`\`\`)
4. For TypeScript files: Ensure valid syntax and proper imports
5. Adjust your response to resolve this issue

⚠️ You have ${remainingAttempts} attempt(s) remaining before this workflow terminates.
`.trim();
}

/**
 * Clears failure tracking for successfully modified files.
 */
function clearFileFailures(tracker: FileFailureTracker, filePaths: string[]): void {
  for (const filePath of filePaths) {
    if (tracker[filePath]) {
      log.info(`[Gemini] Cleared failure tracking for ${filePath} (successfully modified)`);
      delete tracker[filePath];
    }
  }
}

// ========================================================================
// Signals
// ========================================================================

export interface HumanInterventionSignal {
  hint: string;
}

export const humanInterventionSignal = defineSignal<[HumanInterventionSignal]>('humanIntervention');

/**
 * Signal to request graceful pause of the workflow.
 * The workflow will complete the current iteration and then stop.
 */
export const gracefulPauseSignal = defineSignal('gracefulPause');

/**
 * Workflow state snapshot for querying progress.
 * Allows external tools to monitor workflow progress.
 */
export interface WorkflowStateSnapshot {
  /** Current iteration number */
  loopCount: number;
  /** Current phase description */
  currentPhase: string;
  /** Files modified so far */
  filesModified: string[];
  /** Number of actions taken */
  actionHistoryLength: number;
  /** Per-file failure tracking state */
  fileFailureTracker: FileFailureTracker;
  /** Whether pause has been requested */
  pauseRequested: boolean;
}

/**
 * Query to get the current workflow state.
 * Can be used by admin tools or monitoring systems.
 */
export const getWorkflowStateQuery = defineQuery<WorkflowStateSnapshot>('getWorkflowState');

// ========================================================================
// Workflow Input/Output
// ========================================================================

export interface GeminiTurnBasedAgentInput {
  /** Package name */
  packageName: string;

  /** Full path to package directory */
  packagePath: string;

  /** Path to markdown plan file */
  planPath: string;

  /** Workspace root directory */
  workspaceRoot: string;

  /** Package category */
  category: PackageCategory;

  /** Agent instructions (system prompt) */
  agentInstructions?: string;

  /** Git user info for commits */
  gitUser?: {
    name: string;
    email: string;
  };

  /**
   * Pre-flight audit context from package state audit.
   * When provided, tells Gemini what files already exist and shouldn't be regenerated.
   * This prevents wasted tokens on regenerating complete files.
   */
  initialContext?: PackageAuditContext;
}

export interface GeminiTurnBasedAgentResult {
  success: boolean;
  filesModified: string[];
  actionHistory: string[];
  totalIterations: number;
  error?: string;
}

// ========================================================================
// Main Workflow
// ========================================================================

/**
 * Gemini-based Turn-Based Package Generation Workflow
 *
 * Uses Gemini AI to decide the next action in a loop until package is complete and published.
 *
 * @param input - Gemini agent input
 * @returns Result with success status and action history
 */
export async function GeminiTurnBasedAgentWorkflow(
  input: GeminiTurnBasedAgentInput
): Promise<GeminiTurnBasedAgentResult> {
  const { packageName, packagePath, planPath, workspaceRoot, agentInstructions, initialContext } = input;

  log.info(`[Gemini] Starting package generation for ${packageName}`);

  // If we have initial context from audit, log it
  if (initialContext) {
    log.info(`[Gemini] Package is ${initialContext.completionPercentage}% complete with ${initialContext.existingFiles.length} existing files`);
  }

  // Human intervention signal handler
  let humanHint: string | null = null;
  setHandler(humanInterventionSignal, (payload) => {
    humanHint = payload.hint;
    log.info(`[Gemini] Received human hint: ${payload.hint}`);
  });

  // Graceful pause signal handler
  let pauseRequested = false;
  setHandler(gracefulPauseSignal, () => {
    pauseRequested = true;
    log.info('[Gemini] Graceful pause requested, will stop after current iteration');
  });

  // ========================================================================
  // Rich Conversation History - Tracks what was actually done, not just names
  // ========================================================================
  interface ConversationEntry {
    iteration: number;
    command: string;
    details: string;
    filesAffected: string[];
    success: boolean;
    timestamp: number;
  }

  const conversationHistory: ConversationEntry[] = [];

  /**
   * Adds a structured entry to the conversation history.
   * This gives Gemini context about what was actually done.
   */
  function addConversationEntry(
    iteration: number,
    command: string,
    details: string,
    filesAffected: string[] = [],
    success: boolean = true
  ): void {
    conversationHistory.push({
      iteration,
      command,
      details,
      filesAffected,
      success,
      timestamp: Date.now()
    });
  }

  /**
   * Formats the conversation history for inclusion in prompts.
   * Shows the last N entries with full details.
   */
  function formatConversationHistory(maxEntries: number = 10): string {
    const recent = conversationHistory.slice(-maxEntries);
    if (recent.length === 0) {
      return 'No actions taken yet.';
    }

    return recent.map(entry => {
      const status = entry.success ? '✓' : '✗';
      const files = entry.filesAffected.length > 0
        ? `\n   Files: ${entry.filesAffected.join(', ')}`
        : '';
      return `[${status}] Iteration ${entry.iteration}: ${entry.command}\n   ${entry.details}${files}`;
    }).join('\n\n');
  }

  // Legacy action history for backward compatibility
  const actionHistory: string[] = ['Workflow started.'];

  // ========================================================================
  // Read the plan file using the new activity
  // ========================================================================
  log.info(`[Gemini] Reading plan file from: ${planPath}`);
  const planResult = await readPlanFile({
    workspaceRoot,
    planPath,
    packagePath
  });

  const fullPlan = planResult.content;
  const expectedFiles = planResult.expectedFiles;

  log.info(`[Gemini] Plan loaded. Expected files: ${expectedFiles.length > 0 ? expectedFiles.join(', ') : 'any (no restriction)'}`);

  // ========================================================================
  // Scaffold Standard Config Files (saves ~2000 tokens)
  // ========================================================================
  log.info(`[Gemini] Scaffolding standard config files for ${packageName}`);
  try {
    const scaffoldResult = await scaffoldPackageConfig({
      workspaceRoot,
      packagePath,
      packageName,
      description: `${packageName} - generated by Bernier LLC`
    });

    if (scaffoldResult.filesCreated.length > 0) {
      log.info(`[Gemini] Scaffolded ${scaffoldResult.filesCreated.length} config files: ${scaffoldResult.filesCreated.join(', ')}`);
      actionHistory.push(`Scaffolded config files: ${scaffoldResult.filesCreated.join(', ')}`);
    }
    if (scaffoldResult.filesSkipped.length > 0) {
      log.info(`[Gemini] Skipped existing config files: ${scaffoldResult.filesSkipped.join(', ')}`);
    }
  } catch (scaffoldError) {
    log.warn(`[Gemini] Config scaffolding failed (non-fatal): ${scaffoldError}`);
    // Continue anyway - Gemini can create these files if needed
  }

  // ========================================================================
  // Scope Enforcement - Track which files are allowed
  // ========================================================================
  const allowedFiles = new Set<string>();

  // Add files from the plan
  for (const file of expectedFiles) {
    allowedFiles.add(file);
    // Also add with src/ prefix if not already there
    if (!file.startsWith('src/') && !file.includes('.json')) {
      allowedFiles.add(`src/${file}`);
    }
  }

  // Add standard config files that are always allowed
  const standardFiles = ['package.json', 'tsconfig.json', 'README.md', '.eslintrc.json', '.eslintrc.js', 'jest.config.js', 'jest.config.ts'];
  for (const file of standardFiles) {
    allowedFiles.add(file);
  }

  // Helper function to check if a file is a test file (always allowed)
  const isTestFile = (filePath: string): boolean => {
    // Test files are always allowed - they follow these patterns:
    // - *.test.ts, *.spec.ts
    // - __tests__/*.ts
    // - src/__tests__/*.ts
    const testPatterns = [
      /\.test\.tsx?$/,
      /\.spec\.tsx?$/,
      /\/__tests__\//,
      /^__tests__\//
    ];
    return testPatterns.some(pattern => pattern.test(filePath));
  };

  // If no files detected in plan, allow all (fallback)
  const enforceScope = expectedFiles.length > 0;

  log.info(`[Gemini] Scope enforcement: ${enforceScope ? 'ENABLED' : 'DISABLED (no files detected in plan)'}`);
  if (enforceScope) {
    log.info(`[Gemini] Allowed files: ${Array.from(allowedFiles).join(', ')}`);
  }

  // ========================================================================
  // Build initial codebase context
  // ========================================================================
  let currentCodebaseContext: string;

  // Get actual file contents for context
  const packageContextResult = await getPackageContext({
    workspaceRoot,
    packagePath,
    maxContentLength: 40000 // Reserve tokens for prompt
  });

  if (packageContextResult.filesIncluded.length > 0) {
    currentCodebaseContext = packageContextResult.context;
    addConversationEntry(0, 'CONTEXT_LOADED', `Loaded ${packageContextResult.filesIncluded.length} existing files`, packageContextResult.filesIncluded, true);
  } else if (initialContext && initialContext.status === 'incomplete') {
    // Package is partially complete - tell Gemini what exists
    currentCodebaseContext = `## CURRENT PACKAGE STATE (from pre-flight audit)

Package is ${initialContext.completionPercentage}% complete.

### Existing Files (DO NOT REGENERATE):
${initialContext.existingFiles.map(f => `- ${f}`).join('\n') || '- None'}

### Missing Components (TO BE CREATED):
${initialContext.missingFiles.map(f => `- ${f}`).join('\n') || '- None'}

### Your Tasks:
${initialContext.nextSteps.map(s => `- ${s}`).join('\n') || '- Complete the package'}

IMPORTANT: Focus ONLY on missing components. Do not regenerate existing files unless they have errors.`;
    addConversationEntry(0, 'PRE_FLIGHT_AUDIT', `Package is ${initialContext.completionPercentage}% complete`, initialContext.existingFiles, true);
    actionHistory.push(`Pre-flight audit: ${initialContext.completionPercentage}% complete, ${initialContext.existingFiles.length} files exist, ${initialContext.missingFiles.length} missing`);
  } else {
    currentCodebaseContext = 'No files have been created yet.';
  }

  let loopCount = 0;
  let consecutiveLintFailures = 0;
  let lastLintError = '';
  const filesModified: string[] = [];

  // Per-file failure tracking (for loop detection)
  const fileFailureTracker: FileFailureTracker = {};

  // Query handler for workflow state
  setHandler(getWorkflowStateQuery, () => ({
    loopCount,
    currentPhase: actionHistory.length > 0 ? actionHistory[actionHistory.length - 1].substring(0, 50) : 'Starting',
    filesModified,
    actionHistoryLength: actionHistory.length,
    fileFailureTracker,
    pauseRequested
  }));

  // Default agent instructions with scope enforcement
  const scopeEnforcementInstructions = enforceScope ? `
SCOPE ENFORCEMENT:
You may ONLY create or modify files from this list:
${Array.from(allowedFiles).map(f => `- ${f}`).join('\n')}

Any attempt to create files outside this list will be rejected.
If you need additional files not in this list, explain why in your response.
` : '';

  const defaultInstructions = `
You are building an npm package for Bernier LLC.

Rules:
1. Follow the plan exactly as specified in the markdown document
2. Write TypeScript code with strict mode enabled
3. Include comprehensive tests with >90% coverage
4. Follow Bernier LLC coding standards
5. Add license headers to all source files
6. Ensure package.json meets all requirements
${scopeEnforcementInstructions}
Workflow:
1. Use APPLY_CODE_CHANGES to create/modify files
2. Use VALIDATE_PACKAGE_JSON after creating package.json
3. Use CHECK_LICENSE_HEADERS after creating source files
4. Use RUN_LINT_CHECK after all code is written
5. Use RUN_UNIT_TESTS after linting passes
6. Use PUBLISH_PACKAGE only when everything passes

If any check fails, use APPLY_CODE_CHANGES to fix the issues.
  `.trim();

  const instructions = agentInstructions || defaultInstructions;

  try {
    // Main loop (exits on max iterations OR pause request)
    while (loopCount < MAX_LOOP_ITERATIONS && !pauseRequested) {
      loopCount++;
      log.info(`[Gemini] Iteration ${loopCount}/${MAX_LOOP_ITERATIONS}${pauseRequested ? ' (pause pending)' : ''}`);

      // ========================================================================
      // CRITICAL: Refresh file context on EVERY iteration
      // This ensures Gemini always knows what files exist and their contents
      // ========================================================================
      try {
        const refreshedContext = await getPackageContext({
          workspaceRoot,
          packagePath,
          maxContentLength: 40000
        });

        if (refreshedContext.filesIncluded.length > 0) {
          currentCodebaseContext = refreshedContext.context;
          log.info(`[Gemini] Context refreshed with ${refreshedContext.filesIncluded.length} files`);
        }
      } catch (contextError) {
        log.warn(`[Gemini] Could not refresh context: ${contextError}`);
        // Continue with existing context
      }

      // Process human hint if available
      if (humanHint) {
        actionHistory.push(`Human provided a hint: ${humanHint}`);
        addConversationEntry(loopCount, 'HUMAN_HINT', humanHint, [], true);
        currentCodebaseContext += `\n\n## Human Hint:\n${humanHint}`;
        humanHint = null; // Consume the hint
      }

      // Build the action history with rich formatting
      const formattedHistory = formatConversationHistory(10);

      // Ask Gemini for next command (returns command + content blocks for hybrid protocol)
      const { command, contentBlocks } = await determineNextAction({
        fullPlan,
        agentInstructions: instructions,
        actionHistory: [formattedHistory], // Pass formatted history instead of simple list
        currentCodebaseContext,
      });

      // Execute command
      switch (command.command) {
        case 'APPLY_CODE_CHANGES': {
          const fileCount = command.files?.length || 0;
          const filePaths = (command.files || []).map(f => f.path);

          // Log the files being modified
          log.info(`[Gemini] APPLY_CODE_CHANGES: ${fileCount} files - ${filePaths.join(', ')}`);
          actionHistory.push(`Action: Applying ${fileCount} file operations using Hybrid Protocol.`);

          // Scope enforcement check (if enabled)
          // Note: Test files (*.test.ts, *.spec.ts, __tests__/*) are always allowed
          if (enforceScope) {
            const disallowedFiles = filePaths.filter(f =>
              !allowedFiles.has(f) &&
              !allowedFiles.has(`src/${f}`) &&
              !isTestFile(f)
            );
            if (disallowedFiles.length > 0) {
              log.warn(`[Gemini] SCOPE VIOLATION: Attempted to create disallowed files: ${disallowedFiles.join(', ')}`);
              addConversationEntry(
                loopCount,
                'APPLY_CODE_CHANGES',
                `SCOPE VIOLATION: Attempted to create files not in plan: ${disallowedFiles.join(', ')}. Only allowed: ${Array.from(allowedFiles).join(', ')} (plus test files)`,
                disallowedFiles,
                false
              );
              actionHistory.push(`❌ SCOPE VIOLATION: ${disallowedFiles.join(', ')} not in plan`);
              // Don't apply changes, let Gemini try again
              break;
            }
          }

          try {
            const result = await applyCodeChanges({
              workspaceRoot,
              packagePath,
              files: command.files || [],
              contentBlocks,
              commitMessage: `feat: apply code changes (iteration ${loopCount})\n\n${(command.files || []).map(f => `${f.action}: ${f.path}`).join('\n')}\n\n[Gemini-based turn-based generation - Hybrid Protocol]`
            });

            // Track success with rich detail
            addConversationEntry(
              loopCount,
              'APPLY_CODE_CHANGES',
              `Successfully modified ${result.filesModified.length} files. Commit: ${result.commitHash.substring(0, 7)}`,
              result.filesModified,
              true
            );

            actionHistory.push(`Result: ${result.filesModified.length} files modified, commit ${result.commitHash.substring(0, 7)}`);
            filesModified.push(...result.filesModified);

            // If there were warnings, add them to action history
            if (result.contentWarnings && result.contentWarnings.length > 0) {
              actionHistory.push(`⚠️ Warnings: ${result.contentWarnings.join('; ')}`);
            }

            // Context will be refreshed at start of next iteration - just note success
            log.info(`[Gemini] Files written successfully: ${result.filesModified.join(', ')}`);

            // Reset failure counters after applying fixes
            consecutiveLintFailures = 0;
            lastLintError = '';

            // Clear per-file failure tracking for successfully modified files
            clearFileFailures(fileFailureTracker, result.filesModified);
          } catch (applyError) {
            // Check if this is a pre-commit error that needs Gemini to fix
            // ActivityFailure wraps the original error, so we need to dig into cause
            let errorMessage = '';
            const err = applyError as any;
            if (err.cause?.cause?.message) {
              errorMessage = err.cause.cause.message;
            } else if (err.cause?.message) {
              errorMessage = err.cause.message;
            } else if (err.message) {
              errorMessage = err.message;
            } else {
              errorMessage = String(applyError);
            }

            log.info(`[Gemini] Caught error in applyCodeChanges: ${errorMessage.substring(0, 200)}...`);

            if (errorMessage.includes('PRE_COMMIT_ERRORS_IN_GENERATED_CODE')) {
              // Pre-commit hook failed due to errors in Gemini's code
              actionHistory.push(`❌ APPLY_CODE_CHANGES FAILED: Pre-commit validation errors in generated code`);

              // Parse file paths from the error message
              const filePathMatch = errorMessage.match(/Errors found in files generated by AI: \[([^\]]+)\]/);
              const errorFiles = filePathMatch
                ? filePathMatch[1].split(',').map(f => f.trim()).filter(f => f.length > 0)
                : [];

              // Clean the error message - remove ANSI codes and extract key parts
              const cleanedError = errorMessage
                .replace(/\u001b\[\d+m/g, '') // Remove ANSI color codes
                .replace(/\[0;31m|\[0m/g, '') // Remove specific codes
                .trim();

              // Extract TypeScript errors specifically
              const tsErrorLines = cleanedError
                .split('\n')
                .filter(line => line.includes(': error TS') || line.includes(': warning'))
                .map(line => line.trim())
                .slice(0, 10); // Limit to 10 most relevant errors

              // Track per-file failures for loop detection
              let metaCorrectionContext = '';
              for (const filePath of errorFiles) {
                const action = trackFileFailure(fileFailureTracker, filePath, cleanedError);

                if (action === 'terminate') {
                  throw ApplicationFailure.create({
                    message: `Workflow terminated: Unable to fix ${filePath} after ${MAX_FILE_MODIFICATIONS_BEFORE_META + MAX_META_CORRECTION_ATTEMPTS} attempts. The AI is stuck in a loop.`,
                    type: 'FILE_LOOP_TERMINATION',
                    nonRetryable: true
                  });
                }

                if (action === 'meta_correct') {
                  const entry = fileFailureTracker[filePath];
                  metaCorrectionContext = buildMetaCorrectionMessage(
                    filePath,
                    entry,
                    'Valid TypeScript code that compiles with strict mode',
                    `File ${filePath} has failed ${entry.modificationCount} times with TypeScript compilation errors`
                  );
                }
              }

              // Fetch the content of error files so Gemini can see what it wrote
              let fileContentsSection = '';
              if (errorFiles.length > 0) {
                for (const filePath of errorFiles.slice(0, 3)) { // Limit to first 3 files
                  try {
                    const fileContent = await getFileContent({ workspaceRoot, packagePath, filePath });
                    fileContentsSection += `\n\n=== FILE: ${filePath} ===\n${fileContent}\n=== END ${filePath} ===`;
                  } catch (fetchError) {
                    log.warn(`[Gemini] Could not fetch file ${filePath}: ${fetchError}`);
                  }
                }
              }

              // Build a clearer context for Gemini (with meta-correction if stuck)
              currentCodebaseContext = `${metaCorrectionContext ? metaCorrectionContext + '\n\n---\n\n' : ''}PRE-COMMIT HOOK FAILED! Your generated TypeScript code has errors.

## Error Summary
Files with errors: ${errorFiles.join(', ') || 'unknown'}

## TypeScript Errors
${tsErrorLines.length > 0 ? tsErrorLines.join('\n') : 'See full error below'}

## Full Error Output
${cleanedError.substring(0, 2000)}
${fileContentsSection}

## What You Must Do
1. Review the TypeScript errors above
2. Look at your file content to see what went wrong
3. Use APPLY_CODE_CHANGES to fix the errors
4. Ensure your TypeScript is valid and can compile with strict mode`;

              actionHistory.push(`Error files: ${errorFiles.join(', ')}`);

              log.warn(`[Gemini] Pre-commit errors in generated code, Gemini will fix on next iteration`);
            } else if (errorMessage.includes('Missing content block')) {
              // Hybrid protocol content block error
              actionHistory.push(`❌ APPLY_CODE_CHANGES FAILED: Missing content block`);
              actionHistory.push(`Error details: ${errorMessage}`);

              // Try to extract file path from error (format: "Missing content block for file index N (path)")
              const contentBlockMatch = errorMessage.match(/Missing content block for file.*?(?:\(([^)]+)\))?/);
              const errorFilePath = contentBlockMatch?.[1] || 'unknown-file';

              // Track this as a failure for the affected file
              const action = trackFileFailure(fileFailureTracker, errorFilePath, errorMessage);

              if (action === 'terminate') {
                throw ApplicationFailure.create({
                  message: `Workflow terminated: Unable to provide correct content blocks for ${errorFilePath} after ${MAX_FILE_MODIFICATIONS_BEFORE_META + MAX_META_CORRECTION_ATTEMPTS} attempts.`,
                  type: 'FILE_LOOP_TERMINATION',
                  nonRetryable: true
                });
              }

              let metaCorrectionContext = '';
              if (action === 'meta_correct') {
                const entry = fileFailureTracker[errorFilePath];
                metaCorrectionContext = buildMetaCorrectionMessage(
                  errorFilePath,
                  entry,
                  'Content block format: ##---Content-Break-N---## followed by file content, where N matches the file index',
                  `Missing or malformed content block for ${errorFilePath}. You have failed to provide the correct format ${entry.modificationCount} times.`
                );
              }

              currentCodebaseContext = `${metaCorrectionContext ? metaCorrectionContext + '\n\n---\n\n' : ''}FILE CONTENT ERROR! A content block was missing.\n\n${errorMessage}\n\nFor each file operation, you MUST provide a corresponding content block using ##---Content-Break-N---## where N matches the file's index.`;

              log.warn(`[Gemini] Missing content block, Gemini will fix on next iteration`);
            } else if (errorMessage.includes('File operation')) {
              // Generic file operation error
              actionHistory.push(`❌ APPLY_CODE_CHANGES FAILED: File operation error`);
              actionHistory.push(`Error details: ${errorMessage}`);

              // Try to extract file path from error
              const fileOpMatch = errorMessage.match(/(?:File operation.*?|Failed.*?)['"]?([^'":\s]+\.[a-z]{2,4})['"]?/i);
              const errorFilePath = fileOpMatch?.[1] || 'unknown-file';

              // Track this as a failure for the affected file
              const action = trackFileFailure(fileFailureTracker, errorFilePath, errorMessage);

              if (action === 'terminate') {
                throw ApplicationFailure.create({
                  message: `Workflow terminated: Unable to complete file operation for ${errorFilePath} after ${MAX_FILE_MODIFICATIONS_BEFORE_META + MAX_META_CORRECTION_ATTEMPTS} attempts.`,
                  type: 'FILE_LOOP_TERMINATION',
                  nonRetryable: true
                });
              }

              let metaCorrectionContext = '';
              if (action === 'meta_correct') {
                const entry = fileFailureTracker[errorFilePath];
                metaCorrectionContext = buildMetaCorrectionMessage(
                  errorFilePath,
                  entry,
                  'Valid file operation with correct path and content',
                  `File operation for ${errorFilePath} has failed ${entry.modificationCount} times.`
                );
              }

              currentCodebaseContext = `${metaCorrectionContext ? metaCorrectionContext + '\n\n---\n\n' : ''}FILE OPERATION ERROR! Failed to apply file changes.\n\n${errorMessage}\n\nPlease check the file paths and content, then try again.`;

              log.warn(`[Gemini] File operation error, Gemini will retry on next iteration`);
            } else {
              // Unknown error - re-throw
              throw applyError;
            }
          }
          break;
        }

        case 'VALIDATE_PACKAGE_JSON': {
          actionHistory.push('Action: Validating package.json requirements.');

          const result = await validatePackageJson({
            workspaceRoot,
            packagePath
          });

          actionHistory.push(`Result: ${result.details}`);

          if (!result.success) {
            currentCodebaseContext = `package.json validation failed: ${result.details}. Please fix the package.json file.`;
          }
          break;
        }

        case 'CHECK_LICENSE_HEADERS': {
          actionHistory.push('Action: Checking for license headers in source files.');

          const result = await checkLicenseHeaders({
            workspaceRoot,
            packagePath
          });

          actionHistory.push(`Result: ${result.details}`);

          if (!result.success) {
            currentCodebaseContext = `License header check failed: ${result.details}. Please add the required header to the affected files.`;
          }
          break;
        }

        case 'RUN_LINT_CHECK': {
          actionHistory.push('Action: Running lint checks.');

          const result = await runLintCheck({
            workspaceRoot,
            packagePath
          });

          actionHistory.push(`Result: Lint check ${result.success ? 'passed' : 'failed'}. Details: ${result.details}`);

          if (!result.success) {
            // Track consecutive failures
            if (result.details === lastLintError) {
              consecutiveLintFailures++;
            } else {
              consecutiveLintFailures = 1;
              lastLintError = result.details;
            }

            // If stuck, request human help
            if (consecutiveLintFailures >= MAX_LINT_FIX_ATTEMPTS) {
              await notifyHumanForHelp({
                workflowId: workflowInfo().workflowId,
                errorMessage: lastLintError,
                actionHistory
              });

              actionHistory.push('Agent is stuck. Notified human for help. Awaiting signal...');

              // Wait for human intervention signal
              await condition(() => humanHint !== null);

              // Reset after human help
              consecutiveLintFailures = 0;
              lastLintError = '';
            } else {
              // CRITICAL: Set explicit context telling Gemini to fix lint errors with APPLY_CODE_CHANGES
              // This mirrors the build failure handling pattern that works well
              currentCodebaseContext = `
**LINT CHECK FAILED - YOU MUST FIX THESE ERRORS NOW**

Your next action MUST be APPLY_CODE_CHANGES to fix the ESLint errors below.
DO NOT run RUN_LINT_CHECK again - that will just show the same errors.
DO NOT run CHECK_LICENSE_HEADERS - that is unrelated to lint errors.

ESLint Errors:
${result.details}

${result.errorFilePaths && result.errorFilePaths.length > 0
  ? `Files with errors: ${result.errorFilePaths.join(', ')}`
  : ''}
`.trim();

              // Fetch file context for first error file to help Gemini understand the code
              if (result.errorFilePaths && result.errorFilePaths.length > 0) {
                const filePath = result.errorFilePaths[0];
                try {
                  const fileContent = await getFileContent({ workspaceRoot, packagePath, filePath });
                  currentCodebaseContext += `\n\nContent of ${filePath}:\n\`\`\`typescript\n${fileContent}\n\`\`\``;
                  actionHistory.push(`Fetched full content of ${filePath} for context to fix the lint errors.`);
                } catch (e) {
                  log.warn(`Could not fetch error file ${filePath}`);
                }
              }
            }
          } else {
            consecutiveLintFailures = 0;
            lastLintError = '';
          }
          break;
        }

        case 'RUN_BUILD': {
          actionHistory.push('Action: Running TypeScript build validation.');

          const result = await runBuildValidation({
            workspaceRoot,
            packagePath,
            installDeps: true
          });

          if (result.success) {
            actionHistory.push('Result: Build succeeded! TypeScript compiles without errors.');
            addConversationEntry(loopCount, 'RUN_BUILD', 'Build succeeded', [], true);
          } else {
            const errorSummary = result.errors.length > 0
              ? `${result.errors.length} TypeScript error(s):\n${result.errors.join('\n')}`
              : result.buildOutput;

            actionHistory.push(`Result: Build FAILED. ${errorSummary}`);
            addConversationEntry(loopCount, 'RUN_BUILD', `Build failed: ${result.errors.length} errors`, result.errorFiles.map(e => e.file), false);

            // Provide detailed error context for Gemini to fix
            if (result.errorFiles.length > 0) {
              const errorContext = result.errorFiles.map(e =>
                `- ${e.file}:${e.line}:${e.column} - ${e.message}`
              ).join('\n');

              currentCodebaseContext = `BUILD FAILED. You must fix these TypeScript errors:\n\n${errorContext}\n\nReview the affected files and fix the type errors by modifying the code.`;

              // Fetch content of first error file for context
              const firstErrorFile = result.errorFiles[0].file;
              try {
                const fileContent = await getFileContent({ workspaceRoot, packagePath, filePath: firstErrorFile });
                currentCodebaseContext += `\n\nContent of ${firstErrorFile}:\n\`\`\`typescript\n${fileContent}\n\`\`\``;
              } catch (e) {
                log.warn(`Could not fetch error file ${firstErrorFile}`);
              }
            } else {
              currentCodebaseContext = `BUILD FAILED:\n${result.buildOutput}\n\nPlease review and fix the build errors.`;
            }
          }
          break;
        }

        case 'RUN_UNIT_TESTS': {
          actionHistory.push('Action: Running unit tests.');

          const result = await runUnitTests({
            workspaceRoot,
            packagePath
          });

          const historyEntry = `Result: Unit tests ${result.success ? 'passed' : 'failed'}. Coverage: ${result.coverage}%. Details: ${result.details}`;
          actionHistory.push(historyEntry);

          if (!result.success) {
            // Fetch file context for next iteration
            if (result.errorFilePaths && result.errorFilePaths.length > 0) {
              const filePath = result.errorFilePaths[0];
              const fileContent = await getFileContent({ workspaceRoot, packagePath, filePath });
              currentCodebaseContext = `Last action failed in ${filePath}. Full file content:\n---\n${fileContent}`;
              actionHistory.push(`Fetched full content of ${filePath} for context to fix the error.`);
            }
          } else if (result.coverage < MIN_TEST_COVERAGE) {
            actionHistory.push(`Result: Test coverage of ${result.coverage}% is below the required ${MIN_TEST_COVERAGE}%. More tests are needed.`);
            currentCodebaseContext = `Test coverage is too low (${result.coverage}%). Please add more tests to meet the ${MIN_TEST_COVERAGE}% requirement.`;
          }
          break;
        }

        case 'PUBLISH_PACKAGE': {
          actionHistory.push('Action: Attempting to publish package.');

          const result = await publishGeminiPackage({
            workspaceRoot,
            packagePath
          });

          if (result.success) {
            await notifyPublishSuccess(packageName);
            actionHistory.push(`Result: Package published successfully. Details: ${result.details}`);

            log.info(`[Gemini] Package ${packageName} published successfully after ${loopCount} iterations`);

            return {
              success: true,
              filesModified,
              actionHistory,
              totalIterations: loopCount
            };
          } else {
            actionHistory.push(`Result: Publishing failed. Details: ${result.details}`);
            currentCodebaseContext = `Publishing failed: ${result.details}. Please fix the issues before retrying.`;
          }
          break;
        }

        case 'AWAIT_DEPENDENCY':
        case 'GATHER_CONTEXT_FOR_DEPENDENCY': {
          // These commands are not implemented yet
          actionHistory.push(`Command ${command.command} is not yet implemented. Skipping.`);
          break;
        }

        default: {
          throw ApplicationFailure.create({
            message: `AI returned an unknown command: ${JSON.stringify(command)}`,
            nonRetryable: true
          });
        }
      }

      // Small sleep to avoid overwhelming the API
      await sleep(100);
    }

    // Check why we exited the loop
    if (pauseRequested) {
      // Graceful pause - return incomplete result
      log.info(`[Gemini] Workflow paused by user request after ${loopCount} iterations`);
      return {
        success: false,
        filesModified,
        actionHistory,
        totalIterations: loopCount,
        error: `Workflow paused by user request. ${loopCount} iterations completed, ${filesModified.length} files modified. Workflow can be resumed via Temporal.`
      };
    }

    // If we exit the loop without publishing or pausing, we've exceeded max iterations
    throw ApplicationFailure.create({
      message: `Exceeded maximum loop iterations (${MAX_LOOP_ITERATIONS}) without completing package.`,
      nonRetryable: true
    });

  } catch (error) {
    log.error(`[Gemini] Workflow failed: ${error}`);

    return {
      success: false,
      filesModified,
      actionHistory,
      totalIterations: loopCount,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// ========================================================================
// Helper Functions
// ========================================================================

// NOTE: readPlanFile is now an activity (imported via proxyActivities)
// This was moved to gemini-agent.activities.ts to properly read files
// from the filesystem, which cannot be done directly in a workflow.
