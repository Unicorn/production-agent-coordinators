import { describe, it, expect } from "vitest";
import {
  applyRequestWork,
  applyAnnotate,
  applyRequestApproval,
  applyAgentResponse,
  finalizeState,
  generateStepId,
} from "../src/state-transitions.js";
import type {
  EngineState,
  EngineAction,
  AgentResponse,
  SpecExecutionContext,
} from "@coordinator/contracts";

describe("State Transitions", () => {
  describe("applyRequestWork", () => {
    it("should add new step to openSteps with WAITING status", () => {
      const state: EngineState = {
        goalId: "goal-1",
        status: "RUNNING",
        openSteps: {},
        artifacts: {},
        log: [],
      };

      const action: EngineAction = {
        type: "REQUEST_WORK",
        workKind: "analyze",
        payload: { data: "test" },
        stepId: "step-1",
      };

      const context: SpecExecutionContext = {
        now: 1000,
        random: () => 0.5,
      };

      const newState = applyRequestWork(state, action, context);

      expect(newState.openSteps["step-1"]).toEqual({
        kind: "analyze",
        status: "WAITING",
        requestedAt: 1000,
        updatedAt: 1000,
        payload: { data: "test" },
      });
      expect(newState.log.length).toBe(1);
      expect(newState.log[0].event).toBe("WORK_REQUESTED");
    });

    it("should generate stepId if not provided", () => {
      const state: EngineState = {
        goalId: "goal-1",
        status: "RUNNING",
        openSteps: {},
        artifacts: {},
        log: [],
      };

      const action: EngineAction = {
        type: "REQUEST_WORK",
        workKind: "analyze",
      };

      const context: SpecExecutionContext = {
        now: 1000,
        random: () => 0.5,
      };

      const newState = applyRequestWork(state, action, context);
      const stepIds = Object.keys(newState.openSteps);

      expect(stepIds.length).toBe(1);
      expect(stepIds[0]).toMatch(/^step-/);
    });

    it("should not mutate original state", () => {
      const state: EngineState = {
        goalId: "goal-1",
        status: "RUNNING",
        openSteps: {},
        artifacts: {},
        log: [],
      };

      const action: EngineAction = {
        type: "REQUEST_WORK",
        workKind: "analyze",
        stepId: "step-1",
      };

      const context: SpecExecutionContext = {
        now: 1000,
        random: () => 0.5,
      };

      const originalOpenSteps = state.openSteps;
      const originalLog = state.log;

      applyRequestWork(state, action, context);

      expect(state.openSteps).toBe(originalOpenSteps);
      expect(state.log).toBe(originalLog);
      expect(Object.keys(state.openSteps).length).toBe(0);
    });
  });

  describe("applyAnnotate", () => {
    it("should add annotation to artifacts", () => {
      const state: EngineState = {
        goalId: "goal-1",
        status: "RUNNING",
        openSteps: {},
        artifacts: {},
        log: [],
      };

      const action: EngineAction = {
        type: "ANNOTATE",
        key: "result",
        value: { data: "test" },
      };

      const context: SpecExecutionContext = {
        now: 1000,
        random: () => 0.5,
      };

      const newState = applyAnnotate(state, action, context);

      expect(newState.artifacts["result"]).toEqual({ data: "test" });
      expect(newState.log.length).toBe(1);
      expect(newState.log[0].event).toBe("ANNOTATED");
    });

    it("should overwrite existing annotation", () => {
      const state: EngineState = {
        goalId: "goal-1",
        status: "RUNNING",
        openSteps: {},
        artifacts: { result: "old value" },
        log: [],
      };

      const action: EngineAction = {
        type: "ANNOTATE",
        key: "result",
        value: "new value",
      };

      const context: SpecExecutionContext = {
        now: 1000,
        random: () => 0.5,
      };

      const newState = applyAnnotate(state, action, context);

      expect(newState.artifacts["result"]).toBe("new value");
    });

    it("should not mutate original state", () => {
      const state: EngineState = {
        goalId: "goal-1",
        status: "RUNNING",
        openSteps: {},
        artifacts: {},
        log: [],
      };

      const action: EngineAction = {
        type: "ANNOTATE",
        key: "result",
        value: "test",
      };

      const context: SpecExecutionContext = {
        now: 1000,
        random: () => 0.5,
      };

      const originalArtifacts = state.artifacts;

      applyAnnotate(state, action, context);

      expect(state.artifacts).toBe(originalArtifacts);
      expect(Object.keys(state.artifacts).length).toBe(0);
    });
  });

  describe("applyRequestApproval", () => {
    it("should add approval step and change status to AWAITING_APPROVAL", () => {
      const state: EngineState = {
        goalId: "goal-1",
        status: "RUNNING",
        openSteps: {},
        artifacts: {},
        log: [],
      };

      const action: EngineAction = {
        type: "REQUEST_APPROVAL",
        payload: { question: "Proceed?" },
        stepId: "approval-1",
      };

      const context: SpecExecutionContext = {
        now: 1000,
        random: () => 0.5,
      };

      const newState = applyRequestApproval(state, action, context);

      expect(newState.status).toBe("AWAITING_APPROVAL");
      expect(newState.openSteps["approval-1"]).toEqual({
        kind: "approval",
        status: "WAITING",
        requestedAt: 1000,
        updatedAt: 1000,
        payload: { question: "Proceed?" },
      });
      expect(newState.log.length).toBe(1);
      expect(newState.log[0].event).toBe("APPROVAL_REQUESTED");
    });

    it("should generate stepId if not provided", () => {
      const state: EngineState = {
        goalId: "goal-1",
        status: "RUNNING",
        openSteps: {},
        artifacts: {},
        log: [],
      };

      const action: EngineAction = {
        type: "REQUEST_APPROVAL",
        payload: { question: "Proceed?" },
      };

      const context: SpecExecutionContext = {
        now: 1000,
        random: () => 0.5,
      };

      const newState = applyRequestApproval(state, action, context);
      const stepIds = Object.keys(newState.openSteps);

      expect(stepIds.length).toBe(1);
      expect(stepIds[0]).toMatch(/^approval-/);
    });
  });

  describe("applyAgentResponse", () => {
    it("should mark step as DONE for successful response", () => {
      const state: EngineState = {
        goalId: "goal-1",
        status: "RUNNING",
        openSteps: {
          "step-1": {
            kind: "analyze",
            status: "IN_PROGRESS",
            requestedAt: 900,
            updatedAt: 900,
          },
        },
        artifacts: {},
        log: [],
      };

      const response: AgentResponse = {
        goalId: "goal-1",
        workflowId: "workflow-1",
        stepId: "step-1",
        runId: "run-1",
        agentRole: "analyzer",
        status: "OK",
        content: { result: "success" },
      };

      const context: SpecExecutionContext = {
        now: 1000,
        random: () => 0.5,
      };

      const newState = applyAgentResponse(state, response, context);

      expect(newState.openSteps["step-1"].status).toBe("DONE");
      expect(newState.openSteps["step-1"].updatedAt).toBe(1000);
      expect(newState.log.length).toBe(1);
      expect(newState.log[0].event).toBe("STEP_COMPLETED");
    });

    it("should mark step as FAILED for failed response", () => {
      const state: EngineState = {
        goalId: "goal-1",
        status: "RUNNING",
        openSteps: {
          "step-1": {
            kind: "analyze",
            status: "IN_PROGRESS",
            requestedAt: 900,
            updatedAt: 900,
          },
        },
        artifacts: {},
        log: [],
      };

      const response: AgentResponse = {
        goalId: "goal-1",
        workflowId: "workflow-1",
        stepId: "step-1",
        runId: "run-1",
        agentRole: "analyzer",
        status: "FAIL",
      };

      const context: SpecExecutionContext = {
        now: 1000,
        random: () => 0.5,
      };

      const newState = applyAgentResponse(state, response, context);

      expect(newState.openSteps["step-1"].status).toBe("FAILED");
    });

    it("should keep step IN_PROGRESS for partial response", () => {
      const state: EngineState = {
        goalId: "goal-1",
        status: "RUNNING",
        openSteps: {
          "step-1": {
            kind: "analyze",
            status: "IN_PROGRESS",
            requestedAt: 900,
            updatedAt: 900,
          },
        },
        artifacts: {},
        log: [],
      };

      const response: AgentResponse = {
        goalId: "goal-1",
        workflowId: "workflow-1",
        stepId: "step-1",
        runId: "run-1",
        agentRole: "analyzer",
        status: "PARTIAL",
      };

      const context: SpecExecutionContext = {
        now: 1000,
        random: () => 0.5,
      };

      const newState = applyAgentResponse(state, response, context);

      expect(newState.openSteps["step-1"].status).toBe("IN_PROGRESS");
      expect(newState.openSteps["step-1"].updatedAt).toBe(1000);
    });

    it("should throw error if goalId does not match", () => {
      const state: EngineState = {
        goalId: "goal-1",
        status: "RUNNING",
        openSteps: {
          "step-1": {
            kind: "analyze",
            status: "IN_PROGRESS",
            requestedAt: 900,
            updatedAt: 900,
          },
        },
        artifacts: {},
        log: [],
      };

      const response: AgentResponse = {
        goalId: "goal-2", // Mismatched
        workflowId: "workflow-1",
        stepId: "step-1",
        runId: "run-1",
        agentRole: "analyzer",
        status: "OK",
      };

      const context: SpecExecutionContext = {
        now: 1000,
        random: () => 0.5,
      };

      expect(() => applyAgentResponse(state, response, context)).toThrow(
        "goalId mismatch"
      );
    });

    it("should throw error if step does not exist", () => {
      const state: EngineState = {
        goalId: "goal-1",
        status: "RUNNING",
        openSteps: {},
        artifacts: {},
        log: [],
      };

      const response: AgentResponse = {
        goalId: "goal-1",
        workflowId: "workflow-1",
        stepId: "non-existent",
        runId: "run-1",
        agentRole: "analyzer",
        status: "OK",
      };

      const context: SpecExecutionContext = {
        now: 1000,
        random: () => 0.5,
      };

      expect(() => applyAgentResponse(state, response, context)).toThrow(
        "Step non-existent not found"
      );
    });
  });

  describe("finalizeState", () => {
    it("should mark state as COMPLETED", () => {
      const state: EngineState = {
        goalId: "goal-1",
        status: "RUNNING",
        openSteps: {},
        artifacts: {},
        log: [],
      };

      const context: SpecExecutionContext = {
        now: 1000,
        random: () => 0.5,
      };

      const newState = finalizeState(state, context);

      expect(newState.status).toBe("COMPLETED");
      expect(newState.log.length).toBe(1);
      expect(newState.log[0].event).toBe("WORKFLOW_COMPLETED");
    });

    it("should not mutate original state", () => {
      const state: EngineState = {
        goalId: "goal-1",
        status: "RUNNING",
        openSteps: {},
        artifacts: {},
        log: [],
      };

      const context: SpecExecutionContext = {
        now: 1000,
        random: () => 0.5,
      };

      const originalStatus = state.status;

      finalizeState(state, context);

      expect(state.status).toBe(originalStatus);
    });
  });

  describe("generateStepId", () => {
    it("should generate unique step IDs with different contexts", () => {
      const context1: SpecExecutionContext = {
        now: 1000,
        random: () => 0.5,
      };

      const context2: SpecExecutionContext = {
        now: 1001,
        random: () => 0.5,
      };

      const id1 = generateStepId(context1);
      const id2 = generateStepId(context2);

      expect(id1).toMatch(/^step-/);
      expect(id2).toMatch(/^step-/);
      expect(id1).not.toBe(id2);
    });

    it("should use context.random for determinism", () => {
      const context1: SpecExecutionContext = {
        now: 1000,
        random: () => 0.12345,
      };

      const context2: SpecExecutionContext = {
        now: 1000,
        random: () => 0.12345,
      };

      const id1 = generateStepId(context1);
      const id2 = generateStepId(context2);

      // IDs should be identical with same random
      expect(id1).toBe(id2);
    });
  });
});
