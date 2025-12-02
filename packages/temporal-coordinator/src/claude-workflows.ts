/**
 * Claude Code CLI Workflows for Temporal
 *
 * This workflow orchestrates the Claude Code CLI in headless mode for
 * agent-driven package building. Key differences from Gemini workflow:
 *
 * 1. Session Management: Uses `--resume <session_id>` for conversation continuity
 *    instead of rewriting context file each call
 * 2. Model Selection: Routes to opus/sonnet/haiku based on task complexity
 * 3. Static CLAUDE.md: Written once at setup, not updated during workflow
 * 4. Extended Thinking: Uses `think hard`/`ultrathink` for architectural phases
 */

import { proxyActivities, ApplicationFailure, workflowInfo } from '@temporalio/workflow';
import type * as claudeActivities from './claude-activities';
import type { ClaudeModel, ClaudeComplianceResult } from './claude-activities';
// Import credential activities from package-builder-production
// Using relative path since we're in the same monorepo
// Note: formatCredentialsError is a regular function, not an activity, so we import it directly
import type * as credentialActivities from '../../agents/package-builder-production/src/activities/credentials.activities.js';
import type * as gitActivities from '../../agents/package-builder-production/src/activities/git.activities.js';

// Create activity proxies with appropriate timeouts
// Note: selectRepairModel is a pure function, not proxied (defined below)
const {
  executeClaudeAgent,
  setupClaudeWorkspace,
  runClaudeComplianceChecks,
  logClaudeAuditEntry,
} = proxyActivities<typeof claudeActivities>({
  startToCloseTimeout: '10 minutes',
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumInterval: '60s',
    maximumAttempts: 1, // Workflow handles retries explicitly
  },
});

// Shared activities (credentials, git operations)
// Note: formatCredentialsError is a regular function, not an activity, so we'll format errors inline
const { checkCredentials } = proxyActivities<typeof credentialActivities>({
  startToCloseTimeout: '1 minute',
  retry: {
    maximumAttempts: 1, // Fail fast on credential checks
  },
});

const { gitCommit, gitPush, gitCreateBranch, gitCreatePR } = proxyActivities<typeof gitActivities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    maximumAttempts: 2,
  },
});

/**
 * Select the appropriate model based on error type.
 * This is a pure, deterministic function safe for workflow use.
 *
 * Model selection rules:
 * - Haiku: Mechanical fixes (lint errors, simple type fixes)
 * - Opus: Cross-file architectural issues
 * - Sonnet: Everything else (default, best cost-to-quality)
 */
function selectRepairModel(validation: ClaudeComplianceResult): ClaudeModel {
  // Rule 1: Mechanical fixes -> Haiku
  if (validation.errorType === 'ESLINT_ERROR') {
    return 'haiku';
  }

  // Rule 2: Cross-file architectural issues -> Opus
  const hasCrossFileIssues =
    validation.output.includes('circular dependency') ||
    validation.output.includes('module type mismatch') ||
    validation.output.includes('design inconsistency') ||
    /Module .+ no longer aligns with .+ constraints/i.test(validation.output);

  if (hasCrossFileIssues) {
    return 'opus';
  }

  // Rule 3: Single-file type/interface issues -> Haiku
  if (validation.errorType === 'TSC_ERROR' &&
      !validation.output.includes('multiple files')) {
    return 'haiku';
  }

  // Rule 4: Complex logic/implementation fixes -> Sonnet
  return 'sonnet';
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const MAX_REPAIR_ATTEMPTS = 3;
const DEFAULT_BASE_PATH = '/tmp/claude-builds';

// ─────────────────────────────────────────────────────────────────────────────
// Workflow Input/Output Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ClaudeAuditedBuildWorkflowInput {
  /** The package specification content */
  specFileContent: string;
  /** BernierLLC requirements content for CLAUDE.md */
  requirementsFileContent: string;
  /** Optional base path for workspace (default: /tmp/claude-builds) */
  basePath?: string;
  /** Optional model override for scaffolding (default: sonnet) */
  scaffoldModel?: ClaudeModel;
  /** Optional model override for implementation (default: sonnet) */
  implementModel?: ClaudeModel;
  /** Use extended thinking for architecture phase (default: false) */
  useArchitecturePlanning?: boolean;
  /** Create PR after successful build (default: false) */
  createPR?: boolean;
  /** PR configuration */
  prConfig?: {
    branchName?: string;
    baseBranch?: string;
    title?: string;
    body?: string;
    draft?: boolean;
    labels?: string[];
  };
}

export interface ClaudeAuditedBuildWorkflowResult {
  success: boolean;
  workspacePath: string;
  totalCost: number;
  sessionId: string;
  repairAttempts: number;
  prUrl?: string;
  prNumber?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Workflow
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Claude Audited Build Workflow
 *
 * Orchestrates the Claude Code CLI for agent-driven package building with:
 * - Session management for conversation continuity
 * - Model routing for cost optimization
 * - Structured verification and repair loop
 * - Full audit trail
 *
 * Phases:
 * 1. Setup: Create workspace with static CLAUDE.md
 * 2. Scaffold: Generate configuration files (NEW session)
 * 3. Implement: Generate source code (RESUME session - Claude remembers scaffold)
 * 4. Verify/Repair Loop: Run compliance checks and fix issues
 */
export async function ClaudeAuditedBuildWorkflow(
  input: ClaudeAuditedBuildWorkflowInput
): Promise<ClaudeAuditedBuildWorkflowResult> {
  const {
    specFileContent,
    requirementsFileContent,
    basePath = DEFAULT_BASE_PATH,
    scaffoldModel = 'sonnet',
    implementModel = 'sonnet',
    useArchitecturePlanning = false,
    createPR = false,
    prConfig = {},
  } = input;

  const workflowId = workflowInfo().workflowId;
  let totalCost = 0;
  let currentSessionId = '';
  let repairAttempts = 0;

  console.log(`[ClaudeWorkflow] Starting build workflow: ${workflowId}`);

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 0: Credential Checks (Fail Fast)
  // ─────────────────────────────────────────────────────────────────────────

  console.log(`[ClaudeWorkflow] Checking required credentials...`);

  const credentialsStatus = await checkCredentials({
    checkGitHub: true,
    checkNPM: true,
    checkPackagesAPI: true,
    checkGit: true,
    checkClaude: true, // Check Claude CLI since we're using it
    checkGemini: false,
  });

  if (!credentialsStatus.allAvailable) {
    // Format error message inline (formatCredentialsError is not an activity)
    const missingList = credentialsStatus.missing || [];
    const errorMessage = `Missing required credentials: ${missingList.join(', ')}`;
    throw ApplicationFailure.nonRetryable(
      `Missing required credentials:\n\n${errorMessage}`,
      'MISSING_CREDENTIALS',
      [credentialsStatus.missing, credentialsStatus.checks]
    );
  }

  console.log(`[ClaudeWorkflow] All credentials verified`);

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 1: Setup Workspace with Static CLAUDE.md
  // ─────────────────────────────────────────────────────────────────────────

  const workspacePath = await setupClaudeWorkspace({
    basePath,
    requirementsContent: requirementsFileContent,
  });

  console.log(`[ClaudeWorkflow] Workspace created: ${workspacePath}`);

  await logClaudeAuditEntry(workspacePath, {
    workflow_run_id: workflowId,
    step_name: 'workspace_setup',
    timestamp: new Date().toISOString(),
    cost_usd: 0,
    validation_status: 'N/A',
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 1.5 (Optional): Architecture Planning with Extended Thinking
  // ─────────────────────────────────────────────────────────────────────────

  if (useArchitecturePlanning) {
    console.log(`[ClaudeWorkflow] Running architecture planning phase with Opus + extended thinking`);

    const planResult = await executeClaudeAgent({
      instruction: `ULTRATHINK about the best architecture for this package:

${specFileContent}

Consider deeply:
- Type safety patterns (generics vs. unions vs. branded types)
- Error handling strategy (Result types vs. exceptions)
- Extensibility points for future features
- Module boundary purity and separation of concerns
- API surface consistency and future-proofing
- Future extensibility and maintainability
- Module boundary design

Consider long-horizon implications and global design consistency.

Create a detailed implementation plan including:
- File structure and module organization
- Type hierarchy and relationships
- Error handling strategy
- Test strategy

Output your analysis and plan.`,
      workingDir: workspacePath,
      model: 'opus', // REQUIRED: Opus for architectural reasoning (prevents under-specification)
      permissionMode: 'plan', // Read-only, no file modifications yet
      allowedTools: ['Read', 'Grep', 'Glob'],
    });

    totalCost += planResult.cost_usd;
    currentSessionId = planResult.session_id;

    await logClaudeAuditEntry(workspacePath, {
      workflow_run_id: workflowId,
      step_name: 'architecture_planning',
      timestamp: new Date().toISOString(),
      cost_usd: planResult.cost_usd,
      session_id: currentSessionId,
      model: 'opus',
      validation_status: 'N/A',
      duration_ms: planResult.duration_ms,
      num_turns: planResult.num_turns,
    });

    console.log(`[ClaudeWorkflow] Architecture planning complete, cost: $${planResult.cost_usd}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 2: Scaffolding (NEW session or continue from planning)
  // ─────────────────────────────────────────────────────────────────────────

  console.log(`[ClaudeWorkflow] Starting scaffolding phase with ${scaffoldModel}`);

  const scaffoldInstruction = `Create the package structure for the following specification:

${specFileContent}

Generate these files based on the requirements in CLAUDE.md:
- package.json (with all required scripts and dependencies)
- tsconfig.json (strict mode enabled)
- jest.config.js (coverage thresholds per requirements)
- .eslintrc.js (strict rules per requirements)
- README.md (with usage examples)

Create the src/ and __tests__/ directory structure.`;

  const scaffoldResult = await executeClaudeAgent({
    instruction: scaffoldInstruction,
    workingDir: workspacePath,
    // If we did architecture planning, resume that session; otherwise new session
    sessionId: useArchitecturePlanning ? currentSessionId : undefined,
    model: scaffoldModel,
    allowedTools: ['Read', 'Write', 'Bash'],
  });

  totalCost += scaffoldResult.cost_usd;
  currentSessionId = scaffoldResult.session_id; // Capture for next phase

  await logClaudeAuditEntry(workspacePath, {
    workflow_run_id: workflowId,
    step_name: 'scaffold',
    timestamp: new Date().toISOString(),
    cost_usd: scaffoldResult.cost_usd,
    session_id: currentSessionId,
    model: scaffoldModel,
    validation_status: 'N/A',
    duration_ms: scaffoldResult.duration_ms,
    num_turns: scaffoldResult.num_turns,
  });

  console.log(`[ClaudeWorkflow] Scaffolding complete, cost: $${scaffoldResult.cost_usd}`);

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 3: Implementation (RESUME session - Claude remembers the spec)
  // ─────────────────────────────────────────────────────────────────────────

  console.log(`[ClaudeWorkflow] Starting implementation phase with ${implementModel}`);

  const implResult = await executeClaudeAgent({
    instruction: `Now implement the full package based on the specification we discussed.

Create:
- All TypeScript source files in src/
- Comprehensive tests in __tests__/
- TSDoc comments on all public exports

Ensure all requirements from CLAUDE.md are met.`,
    workingDir: workspacePath,
    sessionId: currentSessionId, // Resume - Claude remembers scaffold context
    model: implementModel,
    allowedTools: ['Read', 'Write', 'Edit', 'Bash'],
  });

  totalCost += implResult.cost_usd;
  currentSessionId = implResult.session_id;

  await logClaudeAuditEntry(workspacePath, {
    workflow_run_id: workflowId,
    step_name: 'implement',
    timestamp: new Date().toISOString(),
    cost_usd: implResult.cost_usd,
    session_id: currentSessionId,
    model: implementModel,
    validation_status: 'N/A',
    duration_ms: implResult.duration_ms,
    num_turns: implResult.num_turns,
  });

  console.log(`[ClaudeWorkflow] Implementation complete, cost: $${implResult.cost_usd}`);

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 4: Verification and Repair Loop
  // ─────────────────────────────────────────────────────────────────────────

  let isGreen = false;

  while (repairAttempts < MAX_REPAIR_ATTEMPTS && !isGreen) {
    console.log(`[ClaudeWorkflow] Running compliance checks, attempt ${repairAttempts + 1}/${MAX_REPAIR_ATTEMPTS}`);

    // Run compliance checks
    const validation = await runClaudeComplianceChecks(workspacePath);

    // Log validation result
    await logClaudeAuditEntry(workspacePath, {
      workflow_run_id: workflowId,
      step_name: repairAttempts === 0 ? 'validation_initial' : `validation_attempt_${repairAttempts + 1}`,
      timestamp: new Date().toISOString(),
      cost_usd: 0,
      validation_status: validation.success ? 'pass' : 'fail',
      validation_error_type: validation.errorType,
      error_log_size_chars: validation.output.length,
    });

    if (validation.success) {
      isGreen = true;
      console.log(`[ClaudeWorkflow] Compliance checks passed!`);
      break;
    }

    repairAttempts++;

    if (repairAttempts >= MAX_REPAIR_ATTEMPTS) {
      console.log(`[ClaudeWorkflow] Max repair attempts reached`);
      break;
    }

    // Select model based on error type
    const repairModel = selectRepairModel(validation);
    console.log(`[ClaudeWorkflow] Repair attempt ${repairAttempts} using ${repairModel}`);

    // Construct repair instruction
    const repairInstruction = buildRepairInstruction(validation, repairModel);

    // Execute repair (RESUME session - Claude remembers what it built)
    const fixResult = await executeClaudeAgent({
      instruction: repairInstruction,
      workingDir: workspacePath,
      sessionId: currentSessionId, // Resume - Claude remembers context
      model: repairModel,
      // For repairs: Edit existing files, don't create new ones
      allowedTools: ['Read', 'Edit', 'Bash'],
      systemPromptAppend: 'Focus only on fixing the reported errors. Prefer surgical edits over file rewrites.',
    });

    totalCost += fixResult.cost_usd;
    currentSessionId = fixResult.session_id;

    await logClaudeAuditEntry(workspacePath, {
      workflow_run_id: workflowId,
      step_name: `repair_${repairAttempts}`,
      timestamp: new Date().toISOString(),
      cost_usd: fixResult.cost_usd,
      session_id: currentSessionId,
      model: repairModel,
      validation_status: 'N/A',
      duration_ms: fixResult.duration_ms,
      num_turns: fixResult.num_turns,
    });

    console.log(`[ClaudeWorkflow] Repair ${repairAttempts} complete, cost: $${fixResult.cost_usd}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Final Result
  // ─────────────────────────────────────────────────────────────────────────

  if (!isGreen) {
    throw ApplicationFailure.nonRetryable(
      `Failed to meet publishing requirements after ${MAX_REPAIR_ATTEMPTS} repair attempts. ` +
      `Manual review required. Check audit_trace.jsonl in ${workspacePath} for details.`,
      'BUILD_UNSTABLE',
      { workspacePath, totalCost, lastSessionId: currentSessionId }
    );
  }

  console.log(`[ClaudeWorkflow] Build complete! Total cost: $${totalCost}`);

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 5: Git Commit and PR Creation (Optional)
  // ─────────────────────────────────────────────────────────────────────────

  let prUrl: string | undefined;
  let prNumber: number | undefined;

  if (createPR) {
    console.log(`[ClaudeWorkflow] Creating PR...`);

    try {
      // Extract package name from spec or workspace
      const packageNameMatch = specFileContent.match(/package[:\s]+['"]?([^'"]+)['"]?/i);
      const packageName = packageNameMatch?.[1] || 'package';
      const branchName = prConfig.branchName || `feat/${packageName.replace(/[@\/]/g, '-')}`;
      const baseBranch = prConfig.baseBranch || 'main';

      // Create branch if needed
      await gitCreateBranch({
        workspacePath,
        branchName,
        baseBranch,
      });

      // Commit changes
      const commitResult = await gitCommit({
        workspacePath,
        message: prConfig.title || `feat: Add ${packageName} package`,
        gitUser: {
          name: 'Claude Build Agent',
          email: 'claude-build@bernierllc.com',
        },
      });

      if (!commitResult.success) {
        console.warn(`[ClaudeWorkflow] Commit failed: ${commitResult.stderr}`);
      }

      // Push branch
      const pushResult = await gitPush({
        workspacePath,
        branch: branchName,
        remote: 'origin',
      });

      if (!pushResult.success) {
        console.warn(`[ClaudeWorkflow] Push failed: ${pushResult.stderr}`);
      }

      // Create PR
      const prResult = await gitCreatePR({
        workspacePath,
        branch: branchName,
        title: prConfig.title || `feat: Add ${packageName} package`,
        body: prConfig.body || `Automatically generated package build.

## Package: ${packageName}

This PR was automatically generated by the Claude Build Workflow.

### Build Details
- Total Cost: $${totalCost.toFixed(4)}
- Repair Attempts: ${repairAttempts}
- Workspace: ${workspacePath}

### Verification
All compliance checks passed:
- ✅ TypeScript compilation
- ✅ ESLint validation
- ✅ Test suite
- ✅ Build verification

See audit_trace.jsonl in the workspace for detailed logs.`,
        baseBranch,
        draft: prConfig.draft ?? true,
        labels: prConfig.labels || ['automated', 'needs-review'],
      });

      if (prResult.success) {
        prUrl = prResult.prUrl;
        prNumber = prResult.prNumber;
        console.log(`[ClaudeWorkflow] PR created: ${prUrl}`);
      } else {
        console.warn(`[ClaudeWorkflow] PR creation failed: ${prResult.error}`);
      }
    } catch (error) {
      console.error(`[ClaudeWorkflow] PR creation error: ${error instanceof Error ? error.message : String(error)}`);
      // Non-fatal: workflow succeeded, PR creation is optional
    }
  }

  return {
    success: true,
    workspacePath,
    totalCost,
    sessionId: currentSessionId,
    repairAttempts,
    prUrl,
    prNumber,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a repair instruction tailored to the error type and model.
 * 
 * Matches the refined model selection guidance from the plan:
 * - Opus: Extended thinking for cross-file architectural issues
 * - Sonnet: Standard repair instructions
 * - Haiku: Simple, direct instructions
 */
function buildRepairInstruction(
  validation: ClaudeComplianceResult,
  model: ClaudeModel
): string {
  const baseInstruction = `The compliance check failed. Here is the error log:

\`\`\`
${validation.output}
\`\`\`

Fix these issues. You created these files, so you know the intent.
- Make minimal, targeted changes
- Do not regenerate entire files unless necessary
- Address the root cause, not just the symptoms`;

  // For cross-file architectural issues with Opus, trigger extended thinking
  // This matches the refined plan: Opus + extended thinking for architectural repairs
  if (model === 'opus') {
    return `THINK HARD about the root cause of these errors:

\`\`\`
${validation.output}
\`\`\`

Analyze the architectural or design issues causing these failures.
Fix with minimal, surgical changes addressing the root cause.
Do not regenerate entire files.

Consider whether this is a symptom of a deeper architectural issue that requires
coordinated changes across multiple files.`;
  }

  return baseInstruction;
}

// ─────────────────────────────────────────────────────────────────────────────
// Additional Workflow Variants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simplified Claude build workflow without extended thinking.
 * Cost-optimized version using Sonnet throughout.
 */
export async function ClaudeSimpleBuildWorkflow(
  specFileContent: string,
  requirementsFileContent: string
): Promise<ClaudeAuditedBuildWorkflowResult> {
  return ClaudeAuditedBuildWorkflow({
    specFileContent,
    requirementsFileContent,
    scaffoldModel: 'sonnet',
    implementModel: 'sonnet',
    useArchitecturePlanning: false,
  });
}

/**
 * Premium Claude build workflow with full architecture planning.
 * Uses Opus with extended thinking for architecture phase.
 */
export async function ClaudePremiumBuildWorkflow(
  specFileContent: string,
  requirementsFileContent: string
): Promise<ClaudeAuditedBuildWorkflowResult> {
  return ClaudeAuditedBuildWorkflow({
    specFileContent,
    requirementsFileContent,
    scaffoldModel: 'sonnet',
    implementModel: 'sonnet',
    useArchitecturePlanning: true, // Enables Opus architecture planning
  });
}
