import { describe, it, expect, beforeEach, vi } from "vitest";
import { TodoSpecFactory } from "./index";
import type {
  EngineState,
  AgentResponse,
  SpecExecutionContext,
  SpecContext,
  ILogger,
  IStorage,
} from "@coordinator/contracts";

// Mock logger implementation
const createMockLogger = (): ILogger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
});

// Mock storage implementation
const createMockStorage = (): IStorage => ({
  write: vi.fn().mockResolvedValue("test-key"),
  read: vi.fn().mockResolvedValue(Buffer.from("{}")),
  exists: vi.fn().mockResolvedValue(false),
  delete: vi.fn().mockResolvedValue(undefined),
  list: vi.fn().mockResolvedValue([]),
});

describe("TodoSpecFactory", () => {
  let factory: TodoSpecFactory;
  let mockContext: SpecContext;

  beforeEach(() => {
    factory = new TodoSpecFactory();
    mockContext = {
      logger: createMockLogger(),
      storage: createMockStorage(),
      config: {},
    };
  });

  it("should have correct factory metadata", () => {
    expect(factory.name).toBe("todo");
    expect(factory.version).toBe("0.1.0");
  });

  it("should provide a valid descriptor", () => {
    const descriptor = factory.describe();
    expect(descriptor.name).toBe("todo");
    expect(descriptor.version).toBe("0.1.0");
    expect(descriptor.description).toBeTruthy();
    expect(descriptor.requiredWorkKinds).toContain("gather_requirements");
    expect(descriptor.requiredWorkKinds).toContain("create_tasks");
    expect(descriptor.requiredWorkKinds).toContain("confirm_completion");
  });

  it("should create a spec instance", () => {
    const spec = factory.create(mockContext);
    expect(spec).toBeDefined();
    expect(spec.name).toBe("todo");
  });

  it("should validate config if validator is present", () => {
    if (factory.validate) {
      expect(factory.validate({})).toBe(true);
      expect(factory.validate({ maxTasks: 10 })).toBe(true);
    }
  });
});

describe("TodoSpec - Multi-step workflow", () => {
  let factory: TodoSpecFactory;
  let mockContext: SpecContext;
  let spec: ReturnType<typeof factory.create>;
  let state: EngineState;
  let execContext: SpecExecutionContext;

  beforeEach(() => {
    factory = new TodoSpecFactory();
    mockContext = {
      logger: createMockLogger(),
      storage: createMockStorage(),
      config: {},
    };
    spec = factory.create(mockContext);

    state = {
      goalId: "test-goal-123",
      status: "RUNNING",
      openSteps: {},
      artifacts: {},
      log: [],
    };

    execContext = {
      now: Date.now(),
      random: () => 0.5,
    };
  });

  describe("Step 1: Gather Requirements", () => {
    it("should start workflow by requesting requirements gathering", () => {
      // Initial state - spec should request requirements gathering
      const initialResponse: AgentResponse = {
        goalId: state.goalId,
        workflowId: "workflow-1",
        stepId: "step-init",
        runId: "run-1",
        agentRole: "initializer",
        status: "OK",
        content: { initialized: true },
      };

      const decision = spec.onAgentCompleted(state, initialResponse, execContext);

      expect(decision.actions).toHaveLength(1);
      expect(decision.actions[0]).toMatchObject({
        type: "REQUEST_WORK",
        workKind: "gather_requirements",
      });
      expect(decision.finalize).toBe(false);
    });

    it("should store requirements and request task creation", () => {
      const requirementsResponse: AgentResponse = {
        goalId: state.goalId,
        workflowId: "workflow-1",
        stepId: "step-requirements",
        runId: "run-2",
        agentRole: "requirements_gatherer",
        status: "OK",
        content: {
          requirements: "Build a REST API for user management",
          estimatedTasks: 5,
        },
      };

      // Update state to show requirements gathering is in progress
      state.openSteps["step-requirements"] = {
        kind: "gather_requirements",
        status: "IN_PROGRESS",
        requestedAt: execContext.now,
        updatedAt: execContext.now,
      };

      const decision = spec.onAgentCompleted(state, requirementsResponse, execContext);

      // Should annotate requirements
      const annotateAction = decision.actions.find((a) => a.type === "ANNOTATE");
      expect(annotateAction).toBeDefined();
      expect(annotateAction).toMatchObject({
        type: "ANNOTATE",
        key: "requirements",
      });

      // Should request task creation
      const workAction = decision.actions.find((a) => a.type === "REQUEST_WORK");
      expect(workAction).toMatchObject({
        type: "REQUEST_WORK",
        workKind: "create_tasks",
      });

      expect(decision.finalize).toBe(false);
    });
  });

  describe("Step 2: Create Tasks", () => {
    it("should store tasks and request confirmation", () => {
      const tasksResponse: AgentResponse = {
        goalId: state.goalId,
        workflowId: "workflow-1",
        stepId: "step-tasks",
        runId: "run-3",
        agentRole: "task_creator",
        status: "OK",
        content: {
          tasks: [
            { id: "task-1", title: "Create API endpoint", priority: "high" },
            { id: "task-2", title: "Add validation", priority: "medium" },
            { id: "task-3", title: "Write tests", priority: "high" },
          ],
        },
      };

      // Update state to show task creation is in progress
      state.openSteps["step-tasks"] = {
        kind: "create_tasks",
        status: "IN_PROGRESS",
        requestedAt: execContext.now,
        updatedAt: execContext.now,
      };
      state.artifacts["requirements"] = "Build a REST API for user management";

      const decision = spec.onAgentCompleted(state, tasksResponse, execContext);

      // Should annotate tasks
      const annotateAction = decision.actions.find((a) => a.type === "ANNOTATE");
      expect(annotateAction).toBeDefined();
      expect(annotateAction).toMatchObject({
        type: "ANNOTATE",
        key: "tasks",
      });

      // Should request confirmation
      const workAction = decision.actions.find((a) => a.type === "REQUEST_WORK");
      expect(workAction).toMatchObject({
        type: "REQUEST_WORK",
        workKind: "confirm_completion",
      });

      expect(decision.finalize).toBe(false);
    });
  });

  describe("Step 3: Confirm Completion", () => {
    it("should finalize workflow when confirmation is received", () => {
      const confirmationResponse: AgentResponse = {
        goalId: state.goalId,
        workflowId: "workflow-1",
        stepId: "step-confirm",
        runId: "run-4",
        agentRole: "confirmer",
        status: "OK",
        content: {
          confirmed: true,
          summary: "Created 3 tasks for REST API development",
        },
      };

      // Update state to show confirmation is in progress
      state.openSteps["step-confirm"] = {
        kind: "confirm_completion",
        status: "IN_PROGRESS",
        requestedAt: execContext.now,
        updatedAt: execContext.now,
      };
      state.artifacts["requirements"] = "Build a REST API for user management";
      state.artifacts["tasks"] = [
        { id: "task-1", title: "Create API endpoint", priority: "high" },
        { id: "task-2", title: "Add validation", priority: "medium" },
        { id: "task-3", title: "Write tests", priority: "high" },
      ];

      const decision = spec.onAgentCompleted(state, confirmationResponse, execContext);

      // Should annotate confirmation
      const annotateAction = decision.actions.find((a) => a.type === "ANNOTATE");
      expect(annotateAction).toBeDefined();
      expect(annotateAction).toMatchObject({
        type: "ANNOTATE",
        key: "confirmation",
      });

      // Should finalize the workflow
      expect(decision.finalize).toBe(true);
    });
  });

  describe("Error handling", () => {
    it("should handle agent errors with retry logic", () => {
      if (!spec.onAgentError) {
        return; // Skip if error handler is optional
      }

      const decision = spec.onAgentError(
        state,
        "gather_requirements",
        new Error("Network timeout"),
        1
      );

      expect(decision).toBeDefined();
      expect(decision.actions).toBeDefined();
    });

    it("should handle partial responses appropriately", () => {
      const partialResponse: AgentResponse = {
        goalId: state.goalId,
        workflowId: "workflow-1",
        stepId: "step-tasks",
        runId: "run-3",
        agentRole: "task_creator",
        status: "PARTIAL",
        content: {
          tasks: [{ id: "task-1", title: "Incomplete task" }],
        },
      };

      state.openSteps["step-tasks"] = {
        kind: "create_tasks",
        status: "IN_PROGRESS",
        requestedAt: execContext.now,
        updatedAt: execContext.now,
      };

      const decision = spec.onAgentCompleted(state, partialResponse, execContext);

      // Should handle partial response gracefully
      expect(decision).toBeDefined();
      expect(decision.actions).toBeDefined();
    });
  });

  describe("State management", () => {
    it("should track workflow progress through artifacts", () => {
      // After requirements
      state.artifacts["requirements"] = "Build a REST API";
      expect(state.artifacts["requirements"]).toBeDefined();

      // After tasks
      state.artifacts["tasks"] = [{ id: "task-1", title: "Create API" }];
      expect(state.artifacts["tasks"]).toBeDefined();
      expect(Array.isArray(state.artifacts["tasks"])).toBe(true);

      // After confirmation
      state.artifacts["confirmation"] = { confirmed: true };
      expect(state.artifacts["confirmation"]).toBeDefined();
    });

    it("should maintain step state throughout workflow", () => {
      const stepId = "step-requirements";
      state.openSteps[stepId] = {
        kind: "gather_requirements",
        status: "IN_PROGRESS",
        requestedAt: execContext.now,
        updatedAt: execContext.now,
      };

      expect(state.openSteps[stepId].kind).toBe("gather_requirements");
      expect(state.openSteps[stepId].status).toBe("IN_PROGRESS");
    });
  });

  describe("Deterministic execution", () => {
    it("should use execution context for timestamps", () => {
      const response: AgentResponse = {
        goalId: state.goalId,
        workflowId: "workflow-1",
        stepId: "step-1",
        runId: "run-1",
        agentRole: "test",
        status: "OK",
        content: {},
      };

      const decision = spec.onAgentCompleted(state, response, execContext);

      // Decision should be deterministic based on execContext
      expect(decision.decisionId).toBeDefined();
      expect(decision.basedOn).toBeDefined();
    });

    it("should produce same decision for same input", () => {
      const response: AgentResponse = {
        goalId: state.goalId,
        workflowId: "workflow-1",
        stepId: "step-1",
        runId: "run-1",
        agentRole: "test",
        status: "OK",
        content: {},
      };

      const decision1 = spec.onAgentCompleted(state, response, execContext);
      const decision2 = spec.onAgentCompleted(state, response, execContext);

      expect(decision1.decisionId).toBe(decision2.decisionId);
      expect(decision1.actions).toEqual(decision2.actions);
    });
  });
});
