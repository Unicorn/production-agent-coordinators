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
  auditReportPath: string;
  config: BuildConfig;
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

// Coordinator types
export * from './coordinator.types.js'
