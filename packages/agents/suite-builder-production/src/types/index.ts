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
  path: string;
  version: string;
  category?: PackageCategory;
  dependencies: string[];
  layer?: number;
  buildCommand?: string;
  testCommand?: string;
  buildStatus: 'pending' | 'building' | 'completed' | 'failed';
  testStatus?: 'pending' | 'running' | 'passed' | 'failed';
}

// Main workflow state
export interface SuiteBuilderState {
  phase: BuildPhase;
  suiteId: string;
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
export interface SuiteBuilderInput {
  suiteId: string;
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

// Suite aggregate report
export interface SuiteReport {
  suiteId: string;
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

export interface TestActivityResult {
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

// New workflow input type
export interface PackageWorkflowInput {
  // User provides ONE of these:
  packageName?: string;
  packageIdea?: string;
  planFilePath?: string;
  updatePrompt?: string;

  // Configuration (reuse existing BuildConfig)
  config: BuildConfig;
}

// Discovery phase result
export interface DiscoveryResult {
  packageName: string;
  packagePath: string;
  version: string;
  dependencies: string[];
  isPublished: boolean;
  npmVersion: string | null;
  worktreePath: string;
}

// Planning phase result
export interface PlanningResult {
  packageName: string;
  planPath: string;
  planContent: string;
  registeredWithMcp: boolean;
}

// MECE validation result
export interface MeceViolation {
  description: string;
  suggestedSplit: string;
  affectedFunctionality: string[];
  mainPackageStillUsesIt: boolean;
}

export interface MeceAnalysisInput {
  packageName: string;
  updateContext: string;
}

export interface MeceAnalysisResult {
  isCompliant: boolean;
  violation?: MeceViolation;
}

export interface MeceValidationResult {
  isCompliant: boolean;
  violation?: MeceViolation;
  additionalPackages: PackageNode[];
}

// Quality check types
export interface QualityCheckResult {
  passed: boolean;
  details: any;
}

export interface StructureResult extends QualityCheckResult {
  missingFiles: string[];
  invalidFields: string[];
}

export interface TypeScriptResult extends QualityCheckResult {
  errors: Array<{
    file: string;
    line: number;
    message: string;
  }>;
}

export interface LintResult extends QualityCheckResult {
  errors: Array<{
    file: string;
    line: number;
    rule: string;
    message: string;
  }>;
  warnings: Array<{
    file: string;
    line: number;
    rule: string;
    message: string;
  }>;
}

export interface TestResult extends QualityCheckResult {
  coverage: {
    branches: number;
    functions: number;
    lines: number;
    statements: number;
    total: number;
  };
  requiredCoverage: number;
  failures: Array<{
    test: string;
    message: string;
  }>;
}

export interface SecurityResult extends QualityCheckResult {
  vulnerabilities: Array<{
    severity: 'low' | 'moderate' | 'high' | 'critical';
    package: string;
    description: string;
  }>;
}

export interface DocumentationResult extends QualityCheckResult {
  missing: string[];
}

export interface LicenseResult extends QualityCheckResult {
  filesWithoutLicense: string[];
}

export interface IntegrationResult extends QualityCheckResult {
  issues: string[];
  details: {
    packageType: 'core' | 'service' | 'suite' | 'ui' | 'unknown';
    requiredIntegrations: string[];
    missingIntegrations: string[];
    foundIntegrations: string[];
  };
}

export interface ComplianceScore {
  score: number;
  level: 'excellent' | 'good' | 'acceptable' | 'blocked';
}

// Remediation types
export interface RemediationTask {
  category: 'structure' | 'typescript' | 'lint' | 'tests' | 'security' | 'documentation' | 'license' | 'integration';
  priority: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  details: string[];
  suggestedFix?: string;
}

export interface RemediationInput {
  packagePath: string;
  packageName: string;
  currentScore: number;
  targetScore: number;
  tasks: RemediationTask[];
}

export interface RemediationResult {
  completed: boolean;
  tasksAttempted: number;
}

// Split plan generation types
export interface SplitPlanGenerationInput {
  packageName: string;
  violation: MeceViolation;
}

export interface SplitPlanGenerationResult {
  splitPlans: SplitPackagePlan[];
}

export interface SplitPackagePlan {
  packageName: string;
  functionality: string[];
  dependencies: string[];
  mainPackageDependsOnIt: boolean;
  planContent: string;
}

// Register split plans types
export interface RegisterSplitPlansInput {
  splitPlans: SplitPackagePlan[];
}

export interface RegisterSplitPlansResult {
  success: boolean;
  registeredCount: number;
}

// Deprecation cycle types
export interface DeprecationCycleInput {
  packageName: string;
  currentVersion: string;
  violation: MeceViolation;
  isPublished: boolean;
}

export interface DeprecationCycleResult {
  requiresDeprecation: boolean;
  versions: PackageVersion[];
}

export interface PackageVersion {
  version: string; // e.g., "1.1.0", "2.0.0", "next-minor", "next-major", "next"
  versionType: 'minor' | 'major' | 'direct';
  changes: string[];
  deprecationNotice?: string;
}

// Update dependent plans types
export interface UpdateDependentPlansInput {
  packageName: string;
  splitPlans: SplitPackagePlan[];
  workspaceRoot: string;
}

export interface UpdateDependentPlansResult {
  dependentUpdates: DependentPackageUpdate[];
}

export interface DependentPackageUpdate {
  packageName: string;
  currentVersion: string;
  newVersion: string;
  changes: string[];
  updatedDependencies: {
    [key: string]: string; // dependency name -> new version
  };
}

// Version bump types
export type ChangeType = 'major' | 'minor' | 'patch';

export interface VersionBumpInput {
  currentVersion: string;
  changeType: ChangeType;
}

export interface VersionBumpResult {
  newVersion: string;
  previousVersion: string;
  changeType: ChangeType;
}

// Publish to npm types
export interface PublishInput {
  packagePath: string;
  version: string;
  isPublic?: boolean;
  dryRun?: boolean;
}

export interface PublishToNpmResult {
  success: boolean;
  publishedVersion: string;
  packageName: string;
  registryUrl?: string;
  error?: string;
}

// Update dependent versions types
export interface UpdateDependentVersionsInput {
  packageName: string;
  newVersion: string;
  workspaceRoot: string;
}

export interface UpdateDependentVersionsResult {
  updatedPackages: UpdatedPackage[];
}

export interface UpdatedPackage {
  packageName: string;
  packagePath: string;
  previousVersion: string;
  newVersion: string;
}

// Deprecation notice types
export interface DeprecationNoticeInput {
  packageName: string;
  version: string;
  message: string;
  dryRun?: boolean;
}

export interface DeprecationNoticeResult {
  success: boolean;
  packageName: string;
  version: string;
  message: string;
  error?: string;
}

// Remediation workflow types
export interface RemediationWorkflowInput {
  packagePath: string;
  packageName: string;
  tasks: RemediationTask[];
  maxAttempts?: number;
}

export interface RemediationWorkflowResult {
  success: boolean;
  finalQualityScore: number;
  attemptsUsed: number;
  tasksCompleted: number;
  remainingIssues: RemediationTask[];
}

// Suite builder workflow result
export interface SuiteBuilderResult {
  totalPackages: number;
  successfulBuilds: number;
  failedBuilds: number;
  skippedPackages: number;
  packages: Array<{
    name: string;
    version: string;
    buildStatus: 'completed' | 'failed' | 'skipped';
    qualityScore?: number;
  }>;
}
