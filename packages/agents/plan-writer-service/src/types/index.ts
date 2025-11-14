/**
 * Types and Metadata for Plan Writer Service
 *
 * Following standards from:
 * docs/plans/2025-11-13-temporal-workflow-standardization-and-service-architecture.md
 */

// ============================================================================
// Workflow Metadata (Standardized)
// ============================================================================

export interface WorkflowMetadata {
  name: string;              // Workflow function name (PascalCase)
  workflowId: string;        // Workflow ID pattern
  description: string;       // Human-readable description
  serviceType: 'long-running' | 'short-running';
  triggers: string[];        // What triggers this workflow
  signalsTo: string[];       // Which services it signals
  signalsFrom: string[];     // Which services signal it
  mcpOperations: string[];   // Which MCP operations it performs
  gitOperations: string[];   // Which git operations it performs
  version: string;           // Semver version
}

export const PlanWriterServiceMetadata: WorkflowMetadata = {
  name: 'PlanWriterServiceWorkflow',
  workflowId: 'plan-writer-service',
  description: 'Long-running service that writes package plans and files them to MCP',
  serviceType: 'long-running',
  triggers: ['discovery-service', 'monitor-service', 'integration-service', 'ideation-service', 'manual'],
  signalsTo: ['mcp-api'],
  signalsFrom: ['discovery-service', 'monitor-service', 'integration-service', 'ideation-service'],
  mcpOperations: ['packages_update (plan_file_path, plan_git_branch, status)'],
  gitOperations: ['commit --no-verify', 'push origin feature/{package-name}'],
  version: '1.0.0'
};

// ============================================================================
// Activity Metadata (Standardized)
// ============================================================================

export interface ActivityMetadata {
  name: string;              // Activity function name (camelCase)
  displayName: string;       // Human-readable UI name
  description: string;       // What this activity does
  activityType: 'standard' | 'cli' | 'agentic';

  // Agentic activities only:
  modelProvider?: string;    // e.g., 'anthropic', 'openai'
  modelName?: string;        // e.g., 'claude-sonnet-4-5-20250929'
  agentPromptId?: string;    // Reference to agent registry
  agentPromptVersion?: string; // Semver version
}

export const spawnPlanWriterAgentMetadata: ActivityMetadata = {
  name: 'spawnPlanWriterAgent',
  displayName: 'Write package plan (claude-sonnet-4-5 | plan-writer-agent-v1.0.0)',
  description: 'Spawns AI agent to write comprehensive package implementation plan',
  activityType: 'agentic',
  modelProvider: 'anthropic',
  modelName: 'claude-sonnet-4-5-20250929',
  agentPromptId: 'plan-writer-agent',
  agentPromptVersion: '1.0.0'
};

export const gitCommitPlanMetadata: ActivityMetadata = {
  name: 'gitCommitPlan',
  displayName: 'Commit plan to Git (--no-verify)',
  description: 'Commits package plan to feature branch without triggering hooks',
  activityType: 'cli'
};

export const updateMCPStatusMetadata: ActivityMetadata = {
  name: 'updateMCPStatus',
  displayName: 'Update MCP package status',
  description: 'Updates package status in MCP with plan file path and git branch',
  activityType: 'standard'
};

// ============================================================================
// Signal Contracts (Standardized)
// ============================================================================

export interface ServiceSignalPayload<T = unknown> {
  signalType: string;           // e.g., 'package_plan_needed'
  sourceService: string;        // e.g., 'discovery-service'
  targetService: string;        // e.g., 'plan-writer-service'
  packageId: string;            // e.g., '@bernierllc/package-name'
  timestamp: string;            // ISO 8601
  priority?: 'low' | 'normal' | 'high' | 'critical';
  data?: T;                     // Signal-specific data
}

export interface PackagePlanNeededPayload {
  reason: string;               // Why plan is needed
  context: {
    discoverySource?: string;   // Where package was discovered
    existingPlanPath?: string;  // Path to existing plan (if updating)
    requirements?: string[];    // Known requirements
    dependencies?: string[];    // Package dependencies
  };
}

export interface PlanWrittenPayload {
  planFilePath: string;         // Absolute path to plan file
  gitBranch: string;            // Feature branch name
  planSummary: string;          // Brief summary of plan
}

// ============================================================================
// Workflow State
// ============================================================================

export interface PlanWriterServiceState {
  serviceStatus: 'initializing' | 'running' | 'paused' | 'stopped';
  activeRequests: Map<string, PlanRequest>;
  completedPlans: string[];     // Package IDs
  failedPlans: FailedPlan[];
  statistics: {
    totalRequests: number;
    totalCompleted: number;
    totalFailed: number;
    averageDuration: number;
  };
}

export interface PlanRequest {
  packageId: string;
  signal: ServiceSignalPayload<PackagePlanNeededPayload>;
  status: 'queued' | 'in_progress' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface FailedPlan {
  packageId: string;
  error: string;
  retryable: boolean;
  attemptCount: number;
}

// ============================================================================
// Activity Inputs/Outputs
// ============================================================================

export interface WritePlanInput {
  packageId: string;
  reason: string;
  context: PackagePlanNeededPayload['context'];
  agentConfig?: {
    modelProvider?: string;
    modelName?: string;
    temperature?: number;
  };
}

export interface WritePlanResult {
  success: boolean;
  planContent: string;
  planFilePath: string;
  duration: number;
  error?: string;
}

export interface GitCommitInput {
  packageId: string;
  planFilePath: string;
  gitBranch: string;
  commitMessage: string;
}

export interface GitCommitResult {
  success: boolean;
  commitSha: string;
  branch: string;
  error?: string;
}

export interface MCPUpdateInput {
  packageId: string;
  planFilePath: string;
  gitBranch: string;
  status: string;
}

export interface MCPUpdateResult {
  success: boolean;
  error?: string;
}

// ============================================================================
// Child Workflow Types (PlanWriterPackageWorkflow)
// ============================================================================

export const PlanWriterPackageWorkflowMetadata: WorkflowMetadata = {
  name: 'PlanWriterPackageWorkflow',
  workflowId: '{packageId}', // Dynamic per package
  description: 'Short-running workflow that writes plan for a single package with parent context',
  serviceType: 'short-running',
  triggers: ['plan-writer-service'],
  signalsTo: ['plan-writer-service'],
  signalsFrom: ['plan-writer-service'],
  mcpOperations: ['packages_get', 'packages_get_dependencies', 'packages_update'],
  gitOperations: ['commit --no-verify', 'push origin feature/{package-name}'],
  version: '1.0.0'
};

export interface PlanWriterPackageInput {
  packageId: string;
  reason: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  sourceService: string;
}

export interface PlanWriterPackageResult {
  success: boolean;
  packageId: string;
  planFilePath?: string;
  gitBranch?: string;
  skipped?: boolean;
  skipReason?: string;
  error?: string;
  childrenDiscovered?: string[]; // Package IDs of discovered children
}

// ============================================================================
// Package Evaluator Agent Types
// ============================================================================

export const spawnPackageEvaluatorAgentMetadata: ActivityMetadata = {
  name: 'spawnPackageEvaluatorAgent',
  displayName: 'Evaluate package update need (claude-sonnet-4-5 | package-evaluator-agent-v1.0.0)',
  description: 'Spawns AI agent to compare existing package with parent expectations and decide if update needed',
  activityType: 'agentic',
  modelProvider: 'anthropic',
  modelName: 'claude-sonnet-4-5-20250929',
  agentPromptId: 'package-evaluator-agent',
  agentPromptVersion: '1.0.0'
};

export interface PackageEvaluationInput {
  packageId: string;
  existingPlanContent?: string;
  parentPlanContent?: string;
  npmPackageInfo?: {
    version: string;
    published_at: string;
    url: string;
  };
  packageDetails: {
    status: string;
    plan_file_path?: string;
    plan_git_branch?: string;
    current_version?: string;
    dependencies?: string[];
  };
}

export interface PackageEvaluationResult {
  success: boolean;
  needsUpdate: boolean;
  reason: string;
  updateType: 'plan' | 'implementation' | 'none';
  confidence: 'high' | 'medium' | 'low';
  error?: string;
}

// ============================================================================
// MCP Query Types
// ============================================================================

export interface MCPPackageDetails {
  packageId: string;
  exists: boolean;
  status?: string;
  plan_file_path?: string;
  plan_git_branch?: string;
  current_version?: string;
  parent_package?: string;
  dependencies?: string[];
  children?: string[];
  npm_url?: string;
}

export interface MCPPackageLineage {
  packageId: string;
  parents: string[]; // Ordered from immediate parent to root
  depth: number;
}

// ============================================================================
// New Signal Types
// ============================================================================

export interface DiscoveredChildPackagePayload {
  childPackageId: string;
  parentPackageId: string;
  parentPlanPath: string;
  reason: string;
}

// ============================================================================
// Updated Activity Inputs/Outputs
// ============================================================================

// Update WritePlanInput to include parent context
export interface WritePlanInputWithContext extends WritePlanInput {
  parentPlanContent?: string;
  parentPackageId?: string;
  lineage?: string[]; // Full lineage chain
}
