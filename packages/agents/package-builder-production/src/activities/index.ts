/**
 * Central export point for all activities
 * Import this in worker.ts to ensure all activities are registered
 */

// Re-export all activities from their respective modules
export * from './build.activities.js';
export * from './agent.activities.js';
export * from './report.activities.js';
export * from './agent-registry.activities.js';
export * from './coordinator.activities.js';
export * from './agent-execution.activities.js';
export * from './agent-executor.activities.js';
export * from './agentic-plan-parser.activities.js';
export * from './dependency-tree-validator.activities.js';
export * from './phase-executor.activities.js';
export * from './generation-state.activities.js';

// Optional: Export a list of all activity names for validation
export const ALL_ACTIVITY_NAMES = [
  // Build activities
  'parsePlanFile',
  'parsePlanFileWithAgent',
  'auditPackageState',
  'auditPackageUpgrade',
  'buildDependencyGraph',
  'checkIfUpgradePlan',
  'checkNpmPublished',
  'checkPackageExists',
  'commitChanges',
  'publishPackage',
  'pushChanges',
  'runBuild',
  'runQualityChecks',
  'runTests',
  'spawnFixAgent',
  'updateMCPPackageStatus',
  'verifyDependencies',

  // Report activities
  'loadAllPackageReports',
  'writeBuildReport',
  'writePackageBuildReport',

  // Agent registry activities
  'loadAgentRegistry',

  // Coordinator activities
  'analyzeProblem',
  'writeDiagnosticReport',

  // Agent execution activities
  'executeAgentTask',
  'executeRealAgent',

  // Dependency tree validator activities
  'validatePackagePublishStatus',
  'validateDependencyTreePublishStatus',

  // Phase executor activities
  'executePlanningPhase',
  'executeFoundationPhase',

  // Generation state activities
  'saveGenerationState',
  'loadGenerationState',
  'recordCompletedStep',
  'markContextFailed',
] as const;

export type ActivityName = typeof ALL_ACTIVITY_NAMES[number];
