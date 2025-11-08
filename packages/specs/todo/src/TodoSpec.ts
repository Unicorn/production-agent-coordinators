import type {
  ISpec,
  ISpecFactory,
  SpecContext,
  EngineState,
  AgentResponse,
  EngineDecision,
  SpecExecutionContext,
  SpecDescriptor,
} from "@coordinator/contracts";

/**
 * TodoSpec demonstrates a multi-step workflow pattern:
 * 1. Gather requirements from user
 * 2. Create tasks based on requirements
 * 3. Confirm task completion
 *
 * This spec showcases stateful workflow management with multiple agent interactions.
 */
export class TodoSpec implements ISpec {
  readonly name = "todo";

  constructor(private readonly context: SpecContext) {}

  onAgentCompleted(
    state: EngineState,
    resp: AgentResponse,
    context: SpecExecutionContext
  ): EngineDecision {
    const { stepId, runId, status, content } = resp;

    // Generate deterministic decision ID
    const decisionId = `decision-${stepId}-${runId}-${context.now}`;

    // Determine current workflow step based on state
    const hasRequirements = "requirements" in state.artifacts;
    const hasTasks = "tasks" in state.artifacts;
    const hasConfirmation = "confirmation" in state.artifacts;

    // Step 1: Initial request or gather requirements
    if (!hasRequirements) {
      // Check if this is a requirements gathering response
      if (
        stepId in state.openSteps &&
        state.openSteps[stepId].kind === "gather_requirements" &&
        status === "OK" &&
        content &&
        typeof content === "object" &&
        "requirements" in content
      ) {
        this.context.logger.info("Requirements gathered successfully", {
          stepId,
          requirements: content.requirements,
        });

        return {
          decisionId,
          basedOn: { stepId, runId },
          actions: [
            {
              type: "ANNOTATE",
              key: "requirements",
              value: content.requirements,
            },
            {
              type: "REQUEST_WORK",
              workKind: "create_tasks",
              payload: {
                requirements: content.requirements,
                estimatedTasks: (content as { estimatedTasks?: number }).estimatedTasks,
              },
            },
          ],
          finalize: false,
        };
      }

      // Initial state - request requirements gathering
      this.context.logger.info("Starting todo workflow - requesting requirements", {
        goalId: state.goalId,
      });

      return {
        decisionId,
        basedOn: { stepId, runId },
        actions: [
          {
            type: "REQUEST_WORK",
            workKind: "gather_requirements",
            payload: {
              prompt: "What would you like to accomplish?",
            },
          },
        ],
        finalize: false,
      };
    }

    // Step 2: Create tasks based on requirements
    if (hasRequirements && !hasTasks) {
      if (
        stepId in state.openSteps &&
        state.openSteps[stepId].kind === "create_tasks" &&
        status === "OK" &&
        content &&
        typeof content === "object" &&
        "tasks" in content
      ) {
        this.context.logger.info("Tasks created successfully", {
          stepId,
          taskCount: Array.isArray((content as { tasks: unknown[] }).tasks)
            ? (content as { tasks: unknown[] }).tasks.length
            : 0,
        });

        return {
          decisionId,
          basedOn: { stepId, runId },
          actions: [
            {
              type: "ANNOTATE",
              key: "tasks",
              value: (content as { tasks: unknown }).tasks,
            },
            {
              type: "REQUEST_WORK",
              workKind: "confirm_completion",
              payload: {
                requirements: state.artifacts.requirements,
                tasks: (content as { tasks: unknown }).tasks,
              },
            },
          ],
          finalize: false,
        };
      }

      // Handle partial response - request task creation again
      if (status === "PARTIAL") {
        this.context.logger.warn("Received partial task creation response", {
          stepId,
          content,
        });

        return {
          decisionId,
          basedOn: { stepId, runId },
          actions: [
            {
              type: "REQUEST_WORK",
              workKind: "create_tasks",
              payload: {
                requirements: state.artifacts.requirements,
                retry: true,
              },
            },
          ],
          finalize: false,
        };
      }
    }

    // Step 3: Confirm completion and finalize
    if (hasRequirements && hasTasks && !hasConfirmation) {
      if (
        stepId in state.openSteps &&
        state.openSteps[stepId].kind === "confirm_completion" &&
        status === "OK"
      ) {
        this.context.logger.info("Todo workflow completed successfully", {
          stepId,
          confirmation: content,
        });

        return {
          decisionId,
          basedOn: { stepId, runId },
          actions: [
            {
              type: "ANNOTATE",
              key: "confirmation",
              value: content,
            },
          ],
          finalize: true,
        };
      }
    }

    // Workflow already completed
    if (hasRequirements && hasTasks && hasConfirmation) {
      this.context.logger.info("Todo workflow already completed", {
        goalId: state.goalId,
      });

      return {
        decisionId,
        basedOn: { stepId, runId },
        actions: [],
        finalize: true,
      };
    }

    // Default fallback - should not reach here in normal flow
    this.context.logger.warn("Unexpected workflow state", {
      stepId,
      hasRequirements,
      hasTasks,
      hasConfirmation,
    });

    return {
      decisionId,
      basedOn: { stepId, runId },
      actions: [],
      finalize: false,
    };
  }

  onAgentError(
    state: EngineState,
    workKind: string,
    error: unknown,
    attemptNumber: number
  ): EngineDecision {
    const errorMessage = error instanceof Error ? error.message : String(error);

    this.context.logger.error(`Agent error in ${workKind}`, error instanceof Error ? error : undefined, {
      workKind,
      attemptNumber,
      goalId: state.goalId,
    });

    // Retry logic with exponential backoff (max 3 attempts)
    if (attemptNumber < 3) {
      this.context.logger.info(`Retrying ${workKind}`, {
        attemptNumber,
        nextAttempt: attemptNumber + 1,
      });

      return {
        decisionId: `error-retry-${workKind}-${attemptNumber}-${Date.now()}`,
        actions: [
          {
            type: "REQUEST_WORK",
            workKind,
            payload: {
              retry: true,
              previousError: errorMessage,
              attemptNumber: attemptNumber + 1,
            },
          },
        ],
        finalize: false,
      };
    }

    // Max retries exceeded - fail the workflow
    this.context.logger.error(`Max retries exceeded for ${workKind}`, undefined, {
      workKind,
      attemptNumber,
      finalError: errorMessage,
    });

    return {
      decisionId: `error-fail-${workKind}-${attemptNumber}-${Date.now()}`,
      actions: [
        {
          type: "ANNOTATE",
          key: "error",
          value: {
            workKind,
            error: errorMessage,
            attemptNumber,
            failedAt: Date.now(),
          },
        },
      ],
      finalize: true,
    };
  }

  postApply(state: EngineState): void {
    // Optional: Log state transitions for debugging
    this.context.logger.debug("State updated", {
      goalId: state.goalId,
      status: state.status,
      openSteps: Object.keys(state.openSteps).length,
      artifacts: Object.keys(state.artifacts),
    });
  }
}

export class TodoSpecFactory implements ISpecFactory {
  readonly name = "todo";
  readonly version = "0.1.0";

  create(context: SpecContext): ISpec {
    return new TodoSpec(context);
  }

  describe(): SpecDescriptor {
    return {
      name: this.name,
      version: this.version,
      description:
        "Multi-step todo workflow: gather requirements, create tasks, and confirm completion. Demonstrates stateful workflow management with agent interactions.",
      requiredWorkKinds: ["gather_requirements", "create_tasks", "confirm_completion"],
      configSchema: {
        type: "object",
        properties: {
          maxTasks: {
            type: "number",
            description: "Maximum number of tasks to create",
            default: 10,
          },
        },
      },
    };
  }

  validate(config: unknown): boolean {
    if (typeof config !== "object" || config === null) {
      return true; // Empty config is valid
    }

    const cfg = config as Record<string, unknown>;

    if ("maxTasks" in cfg) {
      return typeof cfg.maxTasks === "number" && cfg.maxTasks > 0;
    }

    return true;
  }
}
