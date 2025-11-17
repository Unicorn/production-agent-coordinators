/**
 * Temporal Workflows for Agent Coordinator
 *
 * Workflows define the orchestration logic and must be deterministic.
 * They call activities to perform actual work.
 *
 * IMPORTANT: Workflows must be deterministic - no direct I/O, no Date.now(),
 * no Math.random(). Use activities for all non-deterministic operations.
 */

import { proxyActivities } from '@temporalio/workflow';
import type * as activities from './activities';
import type { EngineState, AgentResponse } from '@coordinator/contracts';

// Create activity proxies with timeouts and retry policies
const {
  initializeWorkflow,
  executeSpecDecision,
  executeAgentStep,
  processAgentResponse,
  storeArtifact,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumInterval: '30s',
    maximumAttempts: 3,
  },
});

/**
 * Configuration for hello workflow
 */
export interface HelloWorkflowConfig {
  goalId: string;
  specType: string;
  specConfig?: {
    workKind?: string;
    [key: string]: unknown;
  };
  agentType: string;
  agentConfig?: Record<string, unknown>;
  agentApiKey?: string;
  maxIterations?: number;
}

/**
 * Simple hello world workflow using HelloSpec
 *
 * This workflow demonstrates the integration of:
 * - Temporal durability and retries
 * - Agent Coordinator's Engine for state management
 * - HelloSpec for workflow logic
 * - MockAgent (or other agents) for execution
 */
export async function helloWorkflow(
  config: HelloWorkflowConfig
): Promise<EngineState> {
  const {
    goalId,
    specType,
    specConfig,
    agentType,
    agentConfig,
    agentApiKey,
    maxIterations = 10,
  } = config;

  console.log(`[Workflow] Starting hello workflow for goal: ${goalId}`);

  // Step 1: Initialize workflow state
  let state = await initializeWorkflow(goalId, {
    specType,
    specConfig: specConfig || {},
    agentType,
    agentConfig: agentConfig || {},
  });

  console.log(`[Workflow] Initial state created, status: ${state.status}`);

  let iterations = 0;
  let lastResponse: AgentResponse | undefined;

  // Step 2: Execute workflow loop
  while (state.status === 'RUNNING' && iterations < maxIterations) {
    console.log(`[Workflow] Iteration ${iterations + 1}/${maxIterations}`);

    // Get decision from spec and process it
    state = await executeSpecDecision(state, {
      specType,
      specConfig: specConfig || {},
      lastResponse,
    });

    console.log(`[Workflow] State after spec decision: ${state.status}`);

    // Check if we're done
    if (state.status !== 'RUNNING') {
      console.log(`[Workflow] Workflow completed with status: ${state.status}`);
      break;
    }

    // Execute any waiting steps
    const waitingSteps = Object.entries(state.openSteps).filter(
      ([_, step]) => step.status === 'WAITING'
    );

    console.log(`[Workflow] Found ${waitingSteps.length} waiting steps`);

    for (const [stepId, step] of waitingSteps) {
      console.log(`[Workflow] Executing step: ${stepId} (${step.kind})`);

      // Mark step as in progress (update state directly since this is deterministic)
      state = {
        ...state,
        openSteps: {
          ...state.openSteps,
          [stepId]: {
            ...step,
            status: 'IN_PROGRESS',
            updatedAt: Date.now(), // Workflow time is deterministic in Temporal
          },
        },
      };

      // Execute agent step
      try {
        const response = await executeAgentStep(goalId, stepId, step, {
          agentType,
          agentConfig: agentConfig || {},
          agentApiKey,
        });

        console.log(`[Workflow] Step ${stepId} completed with status: ${response.status}`);

        // Process agent response
        state = await processAgentResponse(state, response);
        lastResponse = response;

        console.log(`[Workflow] State after agent response: ${state.status}`);
      } catch (error) {
        console.error(`[Workflow] Step ${stepId} failed:`, error);

        // Create error response
        const errorResponse: AgentResponse = {
          goalId,
          workflowId: 'temporal-workflow',
          stepId,
          runId: `run-${Date.now()}`,
          agentRole: 'agent',
          status: 'FAIL',
          errors: [
            {
              type: 'PROVIDER_ERROR',
              message: error instanceof Error ? error.message : 'Unknown error',
              retryable: false,
            },
          ],
        };

        state = await processAgentResponse(state, errorResponse);
        throw error; // Let Temporal handle retries
      }
    }

    iterations++;
  }

  // Step 3: Store artifacts if any
  if (Object.keys(state.artifacts).length > 0) {
    console.log(`[Workflow] Storing ${Object.keys(state.artifacts).length} artifacts`);
    for (const [key, value] of Object.entries(state.artifacts)) {
      await storeArtifact(goalId, key, value);
    }
  }

  // Step 4: Return final state
  console.log(`[Workflow] Workflow complete, final status: ${state.status}`);
  return state;
}

/**
 * Multi-step workflow example (for future expansion)
 *
 * This demonstrates how to build more complex workflows with multiple specs
 * and conditional logic.
 */
export async function multiStepWorkflow(
  config: HelloWorkflowConfig
): Promise<EngineState> {
  // This is a placeholder for more complex workflow patterns
  // For now, it just delegates to helloWorkflow
  return helloWorkflow(config);
}

/**
 * Package Builder Coordinator Workflows
 * Re-export from package-builder-production agent
 */
export { PackageBuildWorkflow } from '@coordinator/agent-package-builder-production/dist/workflows/package-build.workflow.js'
export { CoordinatorWorkflow } from '@coordinator/agent-package-builder-production/dist/workflows/coordinator.workflow.js'
export { AgentExecutorWorkflow } from '@coordinator/agent-package-builder-production/dist/workflows/agent-executor.workflow.js'
