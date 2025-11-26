// Build phases
export enum BuildPhase {
  INITIALIZE = 'INITIALIZE',
  PLAN = 'PLAN',
  BUILD = 'BUILD',
  VERIFY = 'VERIFY',
  COMPLETE = 'COMPLETE'
}

// Package category types
export type PackageCategory = 'validator' | 'core' | 'utility' | 'service' | 'ui' | 'suite';

// Dependency graph node
export interface PackageNode {
  name: string;
  category: PackageCategory;
  dependencies: string[];
  layer: number;
  buildStatus: 'pending' | 'building' | 'completed' | 'failed';
}

// Main workflow state
export interface PackageBuilderState {
  phase: BuildPhase;
  buildId: string;
  packages: PackageNode[];
  completedPackages: string[];
  failedPackages: PackageFailure[];
  childWorkflowIds: Map<string, string>;
}

// Package failure tracking
export interface PackageFailure {
  packageName: string;
  phase: 'build' | 'test' | 'quality' | 'publish';
  error: string;
  fixAttempts: number;
  canRetryManually: boolean;
}

// Build configuration
export interface BuildConfig {
  npmRegistry: string;
  npmToken: string;
  workspaceRoot: string;
  maxConcurrentBuilds: number;
  temporal: {
    address: string;
    namespace: string;
    taskQueue: string;
  };
  testing: {
    enableCoverage: boolean;
    minCoveragePercent: number;
    failOnError: boolean;
  };
  publishing: {
    dryRun: boolean;
    requireTests: boolean;
    requireCleanWorkingDirectory: boolean;
  };
  features?: {
    enableTurnBasedGeneration?: boolean;
  };
}

// Main workflow input
export interface PackageBuilderInput {
  buildId: string;
  workspaceRoot: string;
  config: BuildConfig;

  // Option 1: Audit report (backward compatible)
  auditReportPath?: string;

  // Option 2: Direct plan path (NEW - parse dependencies automatically)
  planPath?: string;

  // Option 3: Direct package list (NEW - explicit packages)
  packages?: Array<{
    packageName: string;
    packagePath: string;
    planPath: string;
    category: PackageCategory;
    dependencies: string[];
  }>;
}

// Child workflow input
export interface PackageBuildInput {
  packageName: string;
  packagePath: string;
  planPath: string;
  category: PackageCategory;
  dependencies: string[];
  workspaceRoot: string;
  config: BuildConfig;
}

// Child workflow result
export interface PackageBuildResult {
  success: boolean;
  packageName: string;
  failedPhase?: 'build' | 'test' | 'quality' | 'publish';
  error?: string;
  fixAttempts?: number;
  report: PackageBuildReport;
}

// Build report for package
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

// Build aggregate report
export interface BuildReport {
  buildId: string;
  timestamp: string;
  totalPackages: number;
  successful: number;
  failed: number;

  totalDuration: number;
  totalFixAttempts: number;

  slowestPackages: PackageBuildReport[];
  mostFixAttempts: PackageBuildReport[];
  totalWaitTime: number;

  packageReports: PackageBuildReport[];
}

// Activity result types
export interface BuildResult {
  success: boolean;
  duration: number;
  stdout: string;
  stderr: string;
}

export interface TestResult {
  success: boolean;
  duration: number;
  coverage: number;
  stdout: string;
  stderr: string;
}

export interface QualityFailure {
  type: string;
  message: string;
  file?: string;
  line?: number;
}

export interface QualityResult {
  passed: boolean;
  duration: number;
  failures: QualityFailure[];
  stdout: string;
}

export interface PublishResult {
  success: boolean;
  duration: number;
  stdout: string;
}

// Agent execution types
export type TaskType =
  | 'PACKAGE_SCAFFOLDING'
  | 'FEATURE_IMPLEMENTATION'
  | 'BUG_FIX'
  | 'REFACTORING'
  | 'DOCUMENTATION'
  | 'TESTING';

export interface GitHubContext {
  token: string;
  repo: string;
  branch: string;
}

export interface BuildPromptInput {
  agentName: string;
  taskType: TaskType;
  instructions: string;
  packagePath: string;
  planPath: string;
  workspaceRoot: string;
  githubContext?: GitHubContext;
  includeQualityStandards?: boolean;
  includeFewShotExamples?: boolean;
  includeValidationChecklist?: boolean;
}

export interface ExecuteAgentInput {
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface FileOperation {
  path: string;
  operation: 'create' | 'update' | 'delete';
  content?: string;
}

export interface AgentResponse {
  files: FileOperation[];
  summary: string;
  qualityChecklist?: {
    strictModeEnabled: boolean;
    noAnyTypes: boolean;
    testCoverageAbove80: boolean;
    allPublicFunctionsDocumented: boolean;
    errorHandlingComplete: boolean;
    [key: string]: boolean; // Allow extra checklist items
  };
  questions?: Array<{
    question: string;
    context: string;
    suggestedAnswer: string;
  }>;
  suggestions?: Array<{
    type: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
    autoExecute: boolean;
  }>;
  filesToFetch?: string[];
  [key: string]: unknown; // Lenient parsing - preserve unknown fields
}

export interface ParseResponseInput {
  responseText: string;
  packagePath: string;
}

export interface ApplyFileChangesInput {
  operations: FileOperation[];
  packagePath: string;
  workspaceRoot: string;
}

export interface ApplyFileChangesResult {
  modifiedFiles: string[];
  failedOperations: Array<{
    path: string;
    operation: string;
    error: string;
  }>;
}

// ========================================================================
// Turn-Based Package Generation Types
// ========================================================================

export type GenerationPhase =
  | 'PLANNING'
  | 'FOUNDATION'
  | 'TYPES'
  | 'CORE_IMPLEMENTATION'
  | 'ENTRY_POINT'
  | 'UTILITIES'
  | 'ERROR_HANDLING'
  | 'TESTING'
  | 'DOCUMENTATION'
  | 'EXAMPLES'
  | 'INTEGRATION_REVIEW'
  | 'CRITICAL_FIXES'
  | 'BUILD_VALIDATION'
  | 'FINAL_POLISH'
  | 'MERGE';

export interface GenerationStep {
  stepNumber: number;
  phase: GenerationPhase;
  description: string;
  files: string[];
  commit?: string;
  timestamp: number;
  claudeTokensUsed?: {
    input: number;
    output: number;
  };
}

/**
 * Conversation message for Claude API
 *
 * Tracks messages exchanged with Claude during turn-based generation.
 * Stored per-phase for debugging and resume functionality.
 */
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  phase: GenerationPhase;
  tokensUsed?: {
    input?: number;
    output?: number;
  };
}

export type ConversationHistory = ConversationMessage[];

export interface GenerationContext {
  sessionId: string;
  branch: string;
  packageName: string;
  packageCategory: PackageCategory;
  packagePath: string;
  planPath: string;
  workspaceRoot: string;

  currentPhase: GenerationPhase;
  currentStepNumber: number;
  completedSteps: GenerationStep[];

  requirements: {
    testCoverageTarget: number; // 90% core, 85% service, 80% suite/ui
    loggerIntegration: 'integrated' | 'planned' | 'not-applicable';
    neverhubIntegration: 'integrated' | 'planned' | 'not-applicable';
    docsSuiteIntegration: 'ready' | 'planned';
    meceValidated: boolean;
    planApproved: boolean;
  };

  lastSuccessfulCommit?: string;
  failureRecovery?: {
    failedStep: number;
    error: string;
    retryCount: number;
  };

  // NEW: Conversation tracking for context preservation
  /**
   * Full conversation history across all phases.
   * Enables resuming with complete context for validation feedback.
   */
  fullConversationHistory?: ConversationHistory;

  /**
   * Per-phase conversation history for debugging and analysis.
   * Maps phase name to conversation messages exchanged during that phase.
   */
  phaseConversations?: Record<GenerationPhase, ConversationHistory>;

  /**
   * Total tokens consumed across all phases.
   * Helps track Claude API usage and costs.
   */
  totalTokensUsed?: {
    input: number;
    output: number;
  };
}

export interface TurnBasedPackageBuildInput extends PackageBuildInput {
  // All fields from PackageBuildInput plus:
  resumeFromContext?: GenerationContext; // For recovery
  enableTurnBasedGeneration: boolean; // Feature flag
}

export interface PhaseExecutionResult {
  success: boolean;
  phase: GenerationPhase;
  steps: GenerationStep[];
  filesModified: string[];
  error?: string;
}

// ========================================================================
// Per-File Failure Tracking Types (for loop detection)
// ========================================================================

/**
 * Tracks failure history for a single file.
 * Used to detect when Gemini is stuck modifying the same file repeatedly.
 */
export interface FileFailureEntry {
  /** Number of times this file has been modified with errors */
  modificationCount: number;
  /** History of error messages for this file */
  errors: string[];
  /** Whether meta-correction message has been sent to AI */
  metaCorrectionSent: boolean;
  /** Number of attempts after meta-correction was sent */
  metaCorrectionAttempts: number;
  /** Hash of last error for comparison (to detect repeated errors) */
  lastErrorHash: string;
}

/**
 * Tracks failure history across all files in a workflow.
 * Maps file path to failure entry.
 */
export type FileFailureTracker = Record<string, FileFailureEntry>;

/**
 * Result of checking a file failure.
 * Determines whether to continue, send meta-correction, or terminate.
 */
export type FileFailureAction = 'continue' | 'meta_correct' | 'terminate';

// ========================================================================
// Package Audit Context Types (for pre-flight audit results)
// ========================================================================

/**
 * Context from pre-flight audit that tells the AI what already exists.
 * Used to prevent regenerating files that are already complete.
 */
export interface PackageAuditContext {
  /** Percentage of package completion (0-100) */
  completionPercentage: number;
  /** List of files that already exist and should NOT be regenerated */
  existingFiles: string[];
  /** List of files/components that are missing and need to be created */
  missingFiles: string[];
  /** Suggested next steps for completing the package */
  nextSteps: string[];
  /** Overall status of the package */
  status: 'complete' | 'incomplete';
}

// ========================================================================
// Gemini Turn-Based Agent Types
// ========================================================================

/**
 * Re-export Gemini workflow types for external use
 */
export type {
  GeminiTurnBasedAgentInput,
  GeminiTurnBasedAgentResult,
  HumanInterventionSignal
} from '../workflows/gemini-turn-based-agent.workflow.js';

/**
 * Re-export Gemini activity types for external use
 */
export type {
  AgentCommand,
  FileOperation as GeminiFileOperation,
  DetermineNextActionInput,
  ApplyCodeChangesInput,
  ApplyCodeChangesOutput,
  RunTestsOutput,
  RunLintCheckOutput,
  ValidationOutput,
  NotifyHumanInput
} from '../activities/gemini-agent.activities.js';

// Coordinator types
export * from './coordinator.types.js'
