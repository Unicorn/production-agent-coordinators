/**
 * Temporal Coordinator - Main exports
 *
 * This package provides Temporal integration for the Agent Coordinator system.
 */

// Re-export activities and workflows for easy access
export * from './activities';
export * from './claude-activities';
export type { HelloWorkflowConfig } from './workflows';
export type {
  ClaudeAuditedBuildWorkflowInput,
  ClaudeAuditedBuildWorkflowResult,
} from './claude-workflows';
