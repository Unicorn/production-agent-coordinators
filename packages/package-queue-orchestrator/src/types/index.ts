/**
 * Package Queue Orchestrator Types
 */

import type { ChildWorkflowHandle } from '@temporalio/workflow';

/**
 * Package information from MCP
 */
export interface Package {
  name: string;
  priority: number;
  dependencies: string[];
}

/**
 * MCP Package type matching the MCP API response
 */
export interface MCPPackage {
  id: string;
  name: string;
  priority: number;
  dependencies: string[];
  category: string;
  status: string;
}

/**
 * State for the ContinuousBuilderWorkflow
 */
export interface OrchestratorState {
  internalQueue: Package[];
  activeBuilds: Map<string, ChildWorkflowHandle<any>>;
  failedRetries: Map<string, number>;
  isPaused: boolean;
  isDraining: boolean;
  maxConcurrent: number;
}

/**
 * Input configuration for the ContinuousBuilderWorkflow
 */
export interface OrchestratorInput {
  maxConcurrent: number;
  workspaceRoot: string;
  config: {
    registry: string;
  };
}

/**
 * Configuration for the ContinuousBuilderWorkflow
 * @deprecated Use OrchestratorInput instead
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
  failedPhase?: string;
  fixAttempts?: number;
}
