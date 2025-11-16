/**
 * Package Queue Orchestrator Types
 */

/**
 * Package information from MCP
 */
export interface Package {
  id: string;
  name: string;
  priority: number;
  status: string;
}

/**
 * State for the ContinuousBuilderWorkflow
 */
export interface OrchestratorState {
  internalQueue: Package[];
  activeBuilds: Map<string, any>; // Child workflow handles
  failedRetries: Map<string, number>;
  isPaused: boolean;
  isDraining: boolean;
  maxConcurrent: number;
}

/**
 * Configuration for the ContinuousBuilderWorkflow
 */
export interface OrchestratorConfig {
  maxConcurrent: number;
  maxRetries?: number;
  workspaceRoot?: string;
}

/**
 * Build result from PackageBuildWorkflow
 */
export interface BuildResult {
  success: boolean;
  packageName: string;
  error?: string;
}
