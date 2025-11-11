import { describe, it, expect, vi } from "vitest";
import { Engine } from "../src/engine.js";
import type {
  EngineState,
  EngineDecision,
  AgentResponse,
  SpecExecutionContext,
} from "@coordinator/contracts";

describe("Engine", () => {
  describe("initialization", () => {
    it("should create an engine with initial state", () => {
      const initialState: EngineState = {
        goalId: "goal-1",
        status: "RUNNING",
        openSteps: {},
        artifacts: {},
        log: [],
      };

      const engine = new Engine(initialState);
      expect(engine.getState()).toEqual(initialState);
    });

    it("should validate initial state has required fields", () => {
      const invalidState = {
        goalId: "goal-1",
        status: "RUNNING",
        // missing openSteps, artifacts, log
      } as unknown as EngineState;

      expect(() => new Engine(invalidState)).toThrow();
    });
  });

  describe("decision processing", () => {
    it("should process REQUEST_WORK decision and update state", () => {
      const initialState: EngineState = {
        goalId: "goal-1",
        status: "RUNNING",
        openSteps: {},
        artifacts: {},
        log: [],
      };

      const engine = new Engine(initialState);
      const now = Date.now();
      const context: SpecExecutionContext = {
        now,
        random: () => 0.5,
      };

      const decision: EngineDecision = {
        decisionId: "dec-1",
        actions: [
          {
            type: "REQUEST_WORK",
            workKind: "analyze",
            payload: { task: "analyze data" },
            stepId: "step-1",
          },
        ],
      };

      const newState = engine.processDecision(decision, context);

      expect(newState.openSteps["step-1"]).toBeDefined();
      expect(newState.openSteps["step-1"].kind).toBe("analyze");
      expect(newState.openSteps["step-1"].status).toBe("WAITING");
      expect(newState.openSteps["step-1"].requestedAt).toBe(now);
      expect(newState.log.length).toBeGreaterThan(0);
    });

    it("should process ANNOTATE decision and update artifacts", () => {
      const initialState: EngineState = {
        goalId: "goal-1",
        status: "RUNNING",
        openSteps: {},
        artifacts: {},
        log: [],
      };

      const engine = new Engine(initialState);
      const context: SpecExecutionContext = {
        now: Date.now(),
        random: () => 0.5,
      };

      const decision: EngineDecision = {
        decisionId: "dec-1",
        actions: [
          {
            type: "ANNOTATE",
            key: "analysis-result",
            value: { findings: ["finding1", "finding2"] },
          },
        ],
      };

      const newState = engine.processDecision(decision, context);

      expect(newState.artifacts["analysis-result"]).toEqual({
        findings: ["finding1", "finding2"],
      });
      expect(newState.log.length).toBeGreaterThan(0);
    });

    it("should process REQUEST_APPROVAL decision and update state", () => {
      const initialState: EngineState = {
        goalId: "goal-1",
        status: "RUNNING",
        openSteps: {},
        artifacts: {},
        log: [],
      };

      const engine = new Engine(initialState);
      const context: SpecExecutionContext = {
        now: Date.now(),
        random: () => 0.5,
      };

      const decision: EngineDecision = {
        decisionId: "dec-1",
        actions: [
          {
            type: "REQUEST_APPROVAL",
            payload: { question: "Proceed with deletion?" },
            stepId: "approval-1",
          },
        ],
      };

      const newState = engine.processDecision(decision, context);

      expect(newState.status).toBe("AWAITING_APPROVAL");
      expect(newState.openSteps["approval-1"]).toBeDefined();
      expect(newState.openSteps["approval-1"].kind).toBe("approval");
    });

    it("should finalize state when decision has finalize=true", () => {
      const initialState: EngineState = {
        goalId: "goal-1",
        status: "RUNNING",
        openSteps: {},
        artifacts: {},
        log: [],
      };

      const engine = new Engine(initialState);
      const context: SpecExecutionContext = {
        now: Date.now(),
        random: () => 0.5,
      };

      const decision: EngineDecision = {
        decisionId: "dec-1",
        actions: [],
        finalize: true,
      };

      const newState = engine.processDecision(decision, context);

      expect(newState.status).toBe("COMPLETED");
    });

    it("should process multiple actions in a single decision", () => {
      const initialState: EngineState = {
        goalId: "goal-1",
        status: "RUNNING",
        openSteps: {},
        artifacts: {},
        log: [],
      };

      const engine = new Engine(initialState);
      const context: SpecExecutionContext = {
        now: Date.now(),
        random: () => 0.5,
      };

      const decision: EngineDecision = {
        decisionId: "dec-1",
        actions: [
          { type: "ANNOTATE", key: "step1", value: "done" },
          { type: "REQUEST_WORK", workKind: "analyze", stepId: "step-2" },
          { type: "ANNOTATE", key: "step2", value: "started" },
        ],
      };

      const newState = engine.processDecision(decision, context);

      expect(newState.artifacts["step1"]).toBe("done");
      expect(newState.artifacts["step2"]).toBe("started");
      expect(newState.openSteps["step-2"]).toBeDefined();
    });
  });

  describe("agent response processing", () => {
    it("should process successful agent response and mark step as DONE", () => {
      const initialState: EngineState = {
        goalId: "goal-1",
        status: "RUNNING",
        openSteps: {
          "step-1": {
            kind: "analyze",
            status: "IN_PROGRESS",
            requestedAt: Date.now() - 1000,
            updatedAt: Date.now() - 1000,
          },
        },
        artifacts: {},
        log: [],
      };

      const engine = new Engine(initialState);
      const context: SpecExecutionContext = {
        now: Date.now(),
        random: () => 0.5,
      };

      const response: AgentResponse = {
        goalId: "goal-1",
        workflowId: "workflow-1",
        stepId: "step-1",
        runId: "run-1",
        agentRole: "analyzer",
        status: "OK",
        content: { result: "analysis complete" },
      };

      const newState = engine.processAgentResponse(response, context);

      expect(newState.openSteps["step-1"].status).toBe("DONE");
      expect(newState.openSteps["step-1"].updatedAt).toBe(context.now);
      expect(newState.log.length).toBeGreaterThan(0);
    });

    it("should process failed agent response and mark step as FAILED", () => {
      const initialState: EngineState = {
        goalId: "goal-1",
        status: "RUNNING",
        openSteps: {
          "step-1": {
            kind: "analyze",
            status: "IN_PROGRESS",
            requestedAt: Date.now() - 1000,
            updatedAt: Date.now() - 1000,
          },
        },
        artifacts: {},
        log: [],
      };

      const engine = new Engine(initialState);
      const context: SpecExecutionContext = {
        now: Date.now(),
        random: () => 0.5,
      };

      const response: AgentResponse = {
        goalId: "goal-1",
        workflowId: "workflow-1",
        stepId: "step-1",
        runId: "run-1",
        agentRole: "analyzer",
        status: "FAIL",
        errors: [
          {
            type: "PROVIDER_ERROR",
            message: "API unavailable",
            retryable: true,
          },
        ],
      };

      const newState = engine.processAgentResponse(response, context);

      expect(newState.openSteps["step-1"].status).toBe("FAILED");
    });

    it("should handle partial agent response", () => {
      const initialState: EngineState = {
        goalId: "goal-1",
        status: "RUNNING",
        openSteps: {
          "step-1": {
            kind: "analyze",
            status: "IN_PROGRESS",
            requestedAt: Date.now() - 1000,
            updatedAt: Date.now() - 1000,
          },
        },
        artifacts: {},
        log: [],
      };

      const engine = new Engine(initialState);
      const context: SpecExecutionContext = {
        now: Date.now(),
        random: () => 0.5,
      };

      const response: AgentResponse = {
        goalId: "goal-1",
        workflowId: "workflow-1",
        stepId: "step-1",
        runId: "run-1",
        agentRole: "analyzer",
        status: "PARTIAL",
        content: { partialResult: "incomplete" },
      };

      const newState = engine.processAgentResponse(response, context);

      expect(newState.openSteps["step-1"].status).toBe("IN_PROGRESS");
      expect(newState.openSteps["step-1"].updatedAt).toBe(context.now);
    });

    it("should reject response with mismatched goalId", () => {
      const initialState: EngineState = {
        goalId: "goal-1",
        status: "RUNNING",
        openSteps: {
          "step-1": {
            kind: "analyze",
            status: "IN_PROGRESS",
            requestedAt: Date.now() - 1000,
            updatedAt: Date.now() - 1000,
          },
        },
        artifacts: {},
        log: [],
      };

      const engine = new Engine(initialState);
      const context: SpecExecutionContext = {
        now: Date.now(),
        random: () => 0.5,
      };

      const response: AgentResponse = {
        goalId: "goal-2", // Different goalId
        workflowId: "workflow-1",
        stepId: "step-1",
        runId: "run-1",
        agentRole: "analyzer",
        status: "OK",
      };

      expect(() => engine.processAgentResponse(response, context)).toThrow();
    });

    it("should reject response for non-existent step", () => {
      const initialState: EngineState = {
        goalId: "goal-1",
        status: "RUNNING",
        openSteps: {},
        artifacts: {},
        log: [],
      };

      const engine = new Engine(initialState);
      const context: SpecExecutionContext = {
        now: Date.now(),
        random: () => 0.5,
      };

      const response: AgentResponse = {
        goalId: "goal-1",
        workflowId: "workflow-1",
        stepId: "non-existent-step",
        runId: "run-1",
        agentRole: "analyzer",
        status: "OK",
      };

      expect(() => engine.processAgentResponse(response, context)).toThrow();
    });
  });

  describe("state transitions are pure", () => {
    it("should not mutate original state when processing decisions", () => {
      const initialState: EngineState = {
        goalId: "goal-1",
        status: "RUNNING",
        openSteps: {},
        artifacts: {},
        log: [],
      };

      const engine = new Engine(initialState);
      const context: SpecExecutionContext = {
        now: Date.now(),
        random: () => 0.5,
      };

      const originalOpenSteps = { ...initialState.openSteps };
      const originalArtifacts = { ...initialState.artifacts };
      const originalLogLength = initialState.log.length;

      const decision: EngineDecision = {
        decisionId: "dec-1",
        actions: [
          { type: "REQUEST_WORK", workKind: "analyze", stepId: "step-1" },
        ],
      };

      engine.processDecision(decision, context);

      // Original state should be unchanged
      expect(initialState.openSteps).toEqual(originalOpenSteps);
      expect(initialState.artifacts).toEqual(originalArtifacts);
      expect(initialState.log.length).toBe(originalLogLength);
    });

    it("should not mutate original state when processing agent responses", () => {
      const initialState: EngineState = {
        goalId: "goal-1",
        status: "RUNNING",
        openSteps: {
          "step-1": {
            kind: "analyze",
            status: "IN_PROGRESS",
            requestedAt: Date.now() - 1000,
            updatedAt: Date.now() - 1000,
          },
        },
        artifacts: {},
        log: [],
      };

      const engine = new Engine(initialState);
      const context: SpecExecutionContext = {
        now: Date.now(),
        random: () => 0.5,
      };

      const originalStepStatus = initialState.openSteps["step-1"].status;
      const originalLogLength = initialState.log.length;

      const response: AgentResponse = {
        goalId: "goal-1",
        workflowId: "workflow-1",
        stepId: "step-1",
        runId: "run-1",
        agentRole: "analyzer",
        status: "OK",
      };

      engine.processAgentResponse(response, context);

      // Original state should be unchanged
      expect(initialState.openSteps["step-1"].status).toBe(originalStepStatus);
      expect(initialState.log.length).toBe(originalLogLength);
    });
  });

  describe("deterministic behavior", () => {
    it("should produce identical state given same inputs and context", () => {
      const initialState: EngineState = {
        goalId: "goal-1",
        status: "RUNNING",
        openSteps: {},
        artifacts: {},
        log: [],
      };

      const context: SpecExecutionContext = {
        now: 1000000,
        random: () => 0.5,
      };

      const decision: EngineDecision = {
        decisionId: "dec-1",
        actions: [
          { type: "REQUEST_WORK", workKind: "analyze", stepId: "step-1" },
          { type: "ANNOTATE", key: "test", value: "value" },
        ],
      };

      const engine1 = new Engine(initialState);
      const state1 = engine1.processDecision(decision, context);

      const engine2 = new Engine(initialState);
      const state2 = engine2.processDecision(decision, context);

      expect(state1).toEqual(state2);
    });

    it("should use context.now instead of Date.now() for timestamps", () => {
      const initialState: EngineState = {
        goalId: "goal-1",
        status: "RUNNING",
        openSteps: {},
        artifacts: {},
        log: [],
      };

      const context: SpecExecutionContext = {
        now: 123456789,
        random: () => 0.5,
      };

      const decision: EngineDecision = {
        decisionId: "dec-1",
        actions: [
          { type: "REQUEST_WORK", workKind: "analyze", stepId: "step-1" },
        ],
      };

      const engine = new Engine(initialState);
      const newState = engine.processDecision(decision, context);

      expect(newState.openSteps["step-1"].requestedAt).toBe(123456789);
    });
  });

  describe("workflow execution loop", () => {
    it("should execute complete workflow with spec function", async () => {
      const initialState: EngineState = {
        goalId: "goal-1",
        status: "RUNNING",
        openSteps: {},
        artifacts: {},
        log: [],
      };

      // Mock spec function that returns decisions based on state
      const mockSpec = vi.fn((state: EngineState): EngineDecision => {
        if (Object.keys(state.openSteps).length === 0) {
          return {
            decisionId: "dec-1",
            actions: [
              { type: "REQUEST_WORK", workKind: "analyze", stepId: "step-1" },
            ],
          };
        }
        return {
          decisionId: "dec-final",
          actions: [],
          finalize: true,
        };
      });

      // Mock agent executor
      const mockAgentExecutor = vi.fn(
        async (stepId: string): Promise<AgentResponse> => ({
          goalId: "goal-1",
          workflowId: "workflow-1",
          stepId,
          runId: "run-1",
          agentRole: "analyzer",
          status: "OK",
        })
      );

      const engine = new Engine(initialState);
      const finalState = await engine.runWorkflow(mockSpec, mockAgentExecutor);

      expect(finalState.status).toBe("COMPLETED");
      expect(mockSpec).toHaveBeenCalled();
      expect(mockAgentExecutor).toHaveBeenCalledWith("step-1", expect.any(Object));
    });

    it("should handle workflow with multiple sequential steps", async () => {
      const initialState: EngineState = {
        goalId: "goal-1",
        status: "RUNNING",
        openSteps: {},
        artifacts: {},
        log: [],
      };

      let stepCounter = 0;
      const mockSpec = vi.fn((state: EngineState): EngineDecision => {
        const doneSteps = Object.values(state.openSteps).filter(
          (s) => s.status === "DONE"
        ).length;

        if (doneSteps < 3) {
          stepCounter++;
          return {
            decisionId: `dec-${stepCounter}`,
            actions: [
              {
                type: "REQUEST_WORK",
                workKind: "analyze",
                stepId: `step-${stepCounter}`,
              },
            ],
          };
        }

        return {
          decisionId: "dec-final",
          actions: [],
          finalize: true,
        };
      });

      const mockAgentExecutor = vi.fn(
        async (stepId: string): Promise<AgentResponse> => ({
          goalId: "goal-1",
          workflowId: "workflow-1",
          stepId,
          runId: "run-1",
          agentRole: "analyzer",
          status: "OK",
        })
      );

      const engine = new Engine(initialState);
      const finalState = await engine.runWorkflow(mockSpec, mockAgentExecutor);

      expect(finalState.status).toBe("COMPLETED");
      expect(mockAgentExecutor).toHaveBeenCalledTimes(3);
    });

    it("should prevent infinite loops with max iteration limit", async () => {
      const initialState: EngineState = {
        goalId: "goal-1",
        status: "RUNNING",
        openSteps: {},
        artifacts: {},
        log: [],
      };

      // Spec that never finalizes
      const mockSpec = vi.fn((): EngineDecision => ({
        decisionId: "dec-infinite",
        actions: [{ type: "ANNOTATE", key: "count", value: Date.now() }],
      }));

      const mockAgentExecutor = vi.fn();

      const engine = new Engine(initialState);
      await expect(
        engine.runWorkflow(mockSpec, mockAgentExecutor, { maxIterations: 10 })
      ).rejects.toThrow("Maximum iterations");
    });
  });

  describe("error handling", () => {
    it("should handle spec function errors gracefully", async () => {
      const initialState: EngineState = {
        goalId: "goal-1",
        status: "RUNNING",
        openSteps: {},
        artifacts: {},
        log: [],
      };

      const mockSpec = vi.fn(() => {
        throw new Error("Spec error");
      });

      const mockAgentExecutor = vi.fn();

      const engine = new Engine(initialState);
      await expect(
        engine.runWorkflow(mockSpec, mockAgentExecutor)
      ).rejects.toThrow("Spec error");
    });

    it("should handle agent executor errors gracefully", async () => {
      const initialState: EngineState = {
        goalId: "goal-1",
        status: "RUNNING",
        openSteps: {},
        artifacts: {},
        log: [],
      };

      const mockSpec = vi.fn((): EngineDecision => ({
        decisionId: "dec-1",
        actions: [
          { type: "REQUEST_WORK", workKind: "analyze", stepId: "step-1" },
        ],
      }));

      const mockAgentExecutor = vi.fn(() => {
        throw new Error("Agent execution failed");
      });

      const engine = new Engine(initialState);
      await expect(
        engine.runWorkflow(mockSpec, mockAgentExecutor)
      ).rejects.toThrow("Agent execution failed");
    });
  });
});
