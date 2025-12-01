/**
 * Workflow exports for Temporal bundler
 *
 * This index file is required by Temporal's webpack bundler to discover
 * and bundle all workflow functions for the worker.
 */

export { PackageBuildWorkflow } from './package-build.workflow.js';
export { PackageBuilderWorkflow } from './package-builder.workflow.js';
export { CoordinatorWorkflow } from './coordinator.workflow.js';
export { AgentExecutorWorkflow } from './agent-executor.workflow.js';

// Deprecated: Turn-based workflows replaced by CLI agent integration
// @deprecated Use PackageBuildWorkflow with CLI agents instead
// export { PackageBuildTurnBasedWorkflow } from './package-build-turn-based.workflow.js';
// export { TurnBasedCodingAgentWorkflow } from './turn-based-coding-agent.workflow.js';
// export { GeminiTurnBasedAgentWorkflow } from './gemini-turn-based-agent.workflow.js';
