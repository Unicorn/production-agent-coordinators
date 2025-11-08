import type {
  EngineState,
  EngineAction,
  AgentResponse,
  SpecExecutionContext,
  StepState,
} from "@coordinator/contracts";

/**
 * Generate a deterministic step ID using context
 */
export function generateStepId(context: SpecExecutionContext): string {
  const randomValue = Math.floor(context.random() * 1000000);
  return `step-${context.now}-${randomValue}`;
}

/**
 * Generate a deterministic approval ID using context
 */
export function generateApprovalId(context: SpecExecutionContext): string {
  const randomValue = Math.floor(context.random() * 1000000);
  return `approval-${context.now}-${randomValue}`;
}

/**
 * Apply REQUEST_WORK action to state (pure function)
 */
export function applyRequestWork(
  state: EngineState,
  action: Extract<EngineAction, { type: "REQUEST_WORK" }>,
  context: SpecExecutionContext
): EngineState {
  const stepId = action.stepId ?? generateStepId(context);

  const newStep: StepState = {
    kind: action.workKind,
    status: "WAITING",
    requestedAt: context.now,
    updatedAt: context.now,
    ...(action.payload !== undefined && { payload: action.payload }),
  };

  return {
    ...state,
    openSteps: {
      ...state.openSteps,
      [stepId]: newStep,
    },
    log: [
      ...state.log,
      {
        at: context.now,
        event: "WORK_REQUESTED",
        data: { stepId, workKind: action.workKind },
      },
    ],
  };
}

/**
 * Apply ANNOTATE action to state (pure function)
 */
export function applyAnnotate(
  state: EngineState,
  action: Extract<EngineAction, { type: "ANNOTATE" }>,
  context: SpecExecutionContext
): EngineState {
  return {
    ...state,
    artifacts: {
      ...state.artifacts,
      [action.key]: action.value,
    },
    log: [
      ...state.log,
      {
        at: context.now,
        event: "ANNOTATED",
        data: { key: action.key },
      },
    ],
  };
}

/**
 * Apply REQUEST_APPROVAL action to state (pure function)
 */
export function applyRequestApproval(
  state: EngineState,
  action: Extract<EngineAction, { type: "REQUEST_APPROVAL" }>,
  context: SpecExecutionContext
): EngineState {
  const stepId = action.stepId ?? generateApprovalId(context);

  const newStep: StepState = {
    kind: "approval",
    status: "WAITING",
    requestedAt: context.now,
    updatedAt: context.now,
    ...(action.payload !== undefined && { payload: action.payload }),
  };

  return {
    ...state,
    status: "AWAITING_APPROVAL",
    openSteps: {
      ...state.openSteps,
      [stepId]: newStep,
    },
    log: [
      ...state.log,
      {
        at: context.now,
        event: "APPROVAL_REQUESTED",
        data: { stepId },
      },
    ],
  };
}

/**
 * Apply agent response to state (pure function)
 */
export function applyAgentResponse(
  state: EngineState,
  response: AgentResponse,
  context: SpecExecutionContext
): EngineState {
  // Validate response
  if (response.goalId !== state.goalId) {
    throw new Error(
      `Agent response goalId mismatch: expected ${state.goalId}, got ${response.goalId}`
    );
  }

  const step = state.openSteps[response.stepId];
  if (!step) {
    throw new Error(`Step ${response.stepId} not found in state`);
  }

  // Determine new step status based on agent response status
  let newStepStatus: StepState["status"];
  let logEvent: string;

  switch (response.status) {
    case "OK":
      newStepStatus = "DONE";
      logEvent = "STEP_COMPLETED";
      break;
    case "FAIL":
      newStepStatus = "FAILED";
      logEvent = "STEP_FAILED";
      break;
    case "PARTIAL":
      newStepStatus = "IN_PROGRESS";
      logEvent = "STEP_UPDATED";
      break;
    case "RATE_LIMITED":
      newStepStatus = "BLOCKED";
      logEvent = "STEP_BLOCKED";
      break;
    case "CONTEXT_EXCEEDED":
      newStepStatus = "BLOCKED";
      logEvent = "STEP_BLOCKED";
      break;
    default:
      throw new Error(`Unknown agent response status: ${response.status}`);
  }

  const updatedStep: StepState = {
    ...step,
    status: newStepStatus,
    updatedAt: context.now,
  };

  return {
    ...state,
    openSteps: {
      ...state.openSteps,
      [response.stepId]: updatedStep,
    },
    log: [
      ...state.log,
      {
        at: context.now,
        event: logEvent,
        data: {
          stepId: response.stepId,
          status: response.status,
          agentRole: response.agentRole,
        },
      },
    ],
  };
}

/**
 * Finalize state (mark as completed)
 */
export function finalizeState(
  state: EngineState,
  context: SpecExecutionContext
): EngineState {
  return {
    ...state,
    status: "COMPLETED",
    log: [
      ...state.log,
      {
        at: context.now,
        event: "WORKFLOW_COMPLETED",
        data: {},
      },
    ],
  };
}

/**
 * Apply a single action to state
 */
export function applyAction(
  state: EngineState,
  action: EngineAction,
  context: SpecExecutionContext
): EngineState {
  switch (action.type) {
    case "REQUEST_WORK":
      return applyRequestWork(state, action, context);
    case "ANNOTATE":
      return applyAnnotate(state, action, context);
    case "REQUEST_APPROVAL":
      return applyRequestApproval(state, action, context);
    default:
      throw new Error(`Unknown action type: ${(action as EngineAction).type}`);
  }
}
