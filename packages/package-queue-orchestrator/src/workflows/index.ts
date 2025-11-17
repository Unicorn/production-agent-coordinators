/**
 * Package Queue Orchestrator Workflows
 *
 * This package implements a continuous package queue orchestration system using Temporal.
 */

export * from './mcp-poller.workflow.js';
export * from './continuous-builder.workflow.js';

// Import and re-export child workflows from package-builder-production
// These are spawned as child workflows by the orchestrator
export { PackageBuildWorkflow } from '../../../agents/package-builder-production/src/workflows/package-build.workflow.js';
export { CoordinatorWorkflow } from '../../../agents/package-builder-production/src/workflows/coordinator.workflow.js';
export { AgentExecutorWorkflow } from '../../../agents/package-builder-production/src/workflows/agent-executor.workflow.js';
