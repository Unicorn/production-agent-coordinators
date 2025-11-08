import { describe, it, expect, vi } from 'vitest';
import { HelloSpecFactory } from './HelloSpec';
import type {
  EngineState,
  AgentResponse,
  SpecExecutionContext,
  SpecContext
} from '@coordinator/contracts';

describe('HelloSpec', () => {
  const createMockSpecContext = (): SpecContext => ({
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    storage: {
      write: vi.fn(),
      read: vi.fn(),
      exists: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
    },
    config: {},
  });

  const createMockExecutionContext = (): SpecExecutionContext => ({
    now: Date.now(),
    random: () => 0.5,
  });

  describe('HelloSpecFactory', () => {
    it('should have correct name and version', () => {
      const factory = new HelloSpecFactory();
      expect(factory.name).toBe('hello');
      expect(factory.version).toBe('1.0.0');
    });

    it('should create a spec instance', () => {
      const factory = new HelloSpecFactory();
      const context = createMockSpecContext();
      const spec = factory.create(context);

      expect(spec).toBeDefined();
      expect(spec.name).toBe('hello');
    });

    it('should describe the spec correctly', () => {
      const factory = new HelloSpecFactory();
      const descriptor = factory.describe();

      expect(descriptor.name).toBe('hello');
      expect(descriptor.version).toBe('1.0.0');
      expect(descriptor.description).toBeTruthy();
      expect(descriptor.requiredWorkKinds).toContain('greet');
    });
  });

  describe('HelloSpec workflow', () => {
    it('should request greeting work on first agent completion when no steps exist', () => {
      const factory = new HelloSpecFactory();
      const spec = factory.create(createMockSpecContext());

      const state: EngineState = {
        goalId: 'test-goal',
        status: 'RUNNING',
        openSteps: {},
        artifacts: {},
        log: [],
      };

      const agentResponse: AgentResponse = {
        goalId: 'test-goal',
        workflowId: 'workflow-1',
        stepId: 'step-1',
        runId: 'run-1',
        agentRole: 'greeter',
        status: 'OK',
      };

      const context = createMockExecutionContext();
      const decision = spec.onAgentCompleted(state, agentResponse, context);

      expect(decision.actions).toHaveLength(1);
      expect(decision.actions[0]).toEqual({
        type: 'REQUEST_WORK',
        workKind: 'greet',
        payload: { message: 'Say hello' },
      });
      expect(decision.finalize).toBeFalsy();
    });

    it('should finalize workflow after greeting is completed', () => {
      const factory = new HelloSpecFactory();
      const spec = factory.create(createMockSpecContext());

      const state: EngineState = {
        goalId: 'test-goal',
        status: 'RUNNING',
        openSteps: {
          'greet-step': {
            kind: 'greet',
            status: 'IN_PROGRESS',
            requestedAt: Date.now(),
            updatedAt: Date.now(),
          },
        },
        artifacts: {},
        log: [],
      };

      const agentResponse: AgentResponse = {
        goalId: 'test-goal',
        workflowId: 'workflow-1',
        stepId: 'greet-step',
        runId: 'run-1',
        agentRole: 'greeter',
        status: 'OK',
        content: { greeting: 'Hello, World!' },
      };

      const context = createMockExecutionContext();
      const decision = spec.onAgentCompleted(state, agentResponse, context);

      expect(decision.actions).toHaveLength(1);
      expect(decision.actions[0]).toEqual({
        type: 'ANNOTATE',
        key: 'greeting',
        value: { greeting: 'Hello, World!' },
      });
      expect(decision.finalize).toBe(true);
    });

    it('should handle partial agent responses', () => {
      const factory = new HelloSpecFactory();
      const spec = factory.create(createMockSpecContext());

      const state: EngineState = {
        goalId: 'test-goal',
        status: 'RUNNING',
        openSteps: {
          'greet-step': {
            kind: 'greet',
            status: 'IN_PROGRESS',
            requestedAt: Date.now(),
            updatedAt: Date.now(),
          },
        },
        artifacts: {},
        log: [],
      };

      const agentResponse: AgentResponse = {
        goalId: 'test-goal',
        workflowId: 'workflow-1',
        stepId: 'greet-step',
        runId: 'run-1',
        agentRole: 'greeter',
        status: 'PARTIAL',
        content: { greeting: 'Hello...' },
      };

      const context = createMockExecutionContext();
      const decision = spec.onAgentCompleted(state, agentResponse, context);

      // Should still accept partial response and finalize
      expect(decision.actions).toHaveLength(1);
      expect(decision.finalize).toBe(true);
    });

    it('should handle agent errors with retry', () => {
      const factory = new HelloSpecFactory();
      const spec = factory.create(createMockSpecContext());

      const state: EngineState = {
        goalId: 'test-goal',
        status: 'RUNNING',
        openSteps: {
          'greet-step': {
            kind: 'greet',
            status: 'IN_PROGRESS',
            requestedAt: Date.now(),
            updatedAt: Date.now(),
          },
        },
        artifacts: {},
        log: [],
      };

      // Test onAgentError if implemented
      if (spec.onAgentError) {
        const decision = spec.onAgentError(
          state,
          'greet',
          new Error('Network timeout'),
          1 // first attempt
        );

        expect(decision.actions).toHaveLength(1);
        expect(decision.actions[0].type).toBe('REQUEST_WORK');
      }
    });
  });
});
