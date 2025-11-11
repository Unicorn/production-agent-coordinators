import type {
  EngineState,
  EngineDecision,
  AgentResponse,
  SpecExecutionContext,
  StepState,
} from "@coordinator/contracts";
import {
  applyAction,
  applyAgentResponse,
  finalizeState,
} from "./state-transitions.js";

/**
 * Type for spec function that generates decisions based on state
 */
export type SpecFunction = (state: EngineState) => EngineDecision;

/**
 * Type for agent executor that executes a step and returns response
 */
export type AgentExecutor = (
  stepId: string,
  step: StepState
) => Promise<AgentResponse>;

/**
 * Options for workflow execution
 */
export interface WorkflowOptions {
  maxIterations?: number;
  timeout?: number;
}

/**
 * Engine class for deterministic workflow execution
 *
 * Key design principles:
 * - State transitions are pure functions (no side effects)
 * - All async operations isolated to agent calls
 * - Deterministic behavior through SpecExecutionContext
 * - Immutable state updates
 */
export class Engine {
  private state: EngineState;

  constructor(initialState: EngineState) {
    this.validateState(initialState);
    this.state = initialState;
  }

  /**
   * Validate that state has all required fields
   */
  private validateState(state: EngineState): void {
    if (!state.goalId) {
      throw new Error("EngineState must have goalId");
    }
    if (!state.status) {
      throw new Error("EngineState must have status");
    }
    if (!state.openSteps) {
      throw new Error("EngineState must have openSteps");
    }
    if (!state.artifacts) {
      throw new Error("EngineState must have artifacts");
    }
    if (!state.log) {
      throw new Error("EngineState must have log");
    }
  }

  /**
   * Get current state (returns a copy to maintain immutability)
   */
  getState(): EngineState {
    return structuredClone(this.state);
  }

  /**
   * Process a decision and update state
   * This is a pure operation - it doesn't mutate the current state
   */
  processDecision(
    decision: EngineDecision,
    context: SpecExecutionContext
  ): EngineState {
    let newState = this.state;

    // Apply all actions in the decision
    for (const action of decision.actions) {
      newState = applyAction(newState, action, context);
    }

    // Finalize if requested
    if (decision.finalize) {
      newState = finalizeState(newState, context);
    }

    // Update internal state
    this.state = newState;

    return structuredClone(newState);
  }

  /**
   * Process an agent response and update state
   */
  processAgentResponse(
    response: AgentResponse,
    context: SpecExecutionContext
  ): EngineState {
    const newState = applyAgentResponse(this.state, response, context);
    this.state = newState;
    return structuredClone(newState);
  }

  /**
   * Run a complete workflow using a spec function and agent executor
   *
   * This is the main execution loop:
   * 1. Call spec function to get decision
   * 2. Process decision to update state
   * 3. Execute any waiting steps with agents
   * 4. Process agent responses
   * 5. Repeat until workflow is complete or max iterations reached
   */
  async runWorkflow(
    spec: SpecFunction,
    agentExecutor: AgentExecutor,
    options: WorkflowOptions = {}
  ): Promise<EngineState> {
    const { maxIterations = 1000, timeout } = options;
    let iterations = 0;
    const startTime = Date.now();

    while (this.state.status === "RUNNING") {
      // Check iteration limit
      if (iterations >= maxIterations) {
        throw new Error(
          `Maximum iterations (${maxIterations}) reached without completion`
        );
      }

      // Check timeout
      if (timeout && Date.now() - startTime > timeout) {
        throw new Error(`Workflow timeout (${timeout}ms) exceeded`);
      }

      // Create execution context with deterministic time
      const context: SpecExecutionContext = {
        now: Date.now(),
        random: Math.random, // In production, this should be seeded
      };

      // Get decision from spec
      const decision = spec(this.getState());

      // Process the decision
      this.processDecision(decision, context);

      // Execute any waiting steps
      const waitingSteps = Object.entries(this.state.openSteps).filter(
        ([_, step]) => step.status === "WAITING"
      );

      for (const [stepId, step] of waitingSteps) {
        // Mark step as in progress
        this.state = {
          ...this.state,
          openSteps: {
            ...this.state.openSteps,
            [stepId]: {
              ...step,
              status: "IN_PROGRESS",
              updatedAt: context.now,
            },
          },
        };

        try {
          // Execute agent (this is the only async operation)
          const response = await agentExecutor(stepId, step);

          // Process the response
          this.processAgentResponse(response, context);
        } catch (error) {
          // If agent execution fails, mark step as failed
          const errorResponse: AgentResponse = {
            goalId: this.state.goalId,
            workflowId: "unknown",
            stepId,
            runId: "unknown",
            agentRole: "unknown",
            status: "FAIL",
            errors: [
              {
                type: "PROVIDER_ERROR",
                message:
                  error instanceof Error ? error.message : "Unknown error",
                retryable: false,
              },
            ],
          };
          this.processAgentResponse(errorResponse, context);
          throw error;
        }
      }

      iterations++;
    }

    return this.getState();
  }
}
