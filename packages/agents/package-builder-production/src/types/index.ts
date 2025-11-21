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

// Coordinator types
export * from './coordinator.types.js'
