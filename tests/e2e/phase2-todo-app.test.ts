import { describe, it, expect, beforeEach } from 'vitest';
import { Engine } from '@coordinator/engine';
import { Container, ConsoleLogger } from '@coordinator/coordinator';
import { LocalFileStorage } from '@coordinator/storage';
import { TodoSpecFactory } from '@coordinator/specs-todo';
import { MockAgentFactory } from '@coordinator/agents-mock';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import type {
  EngineState,
  EngineDecision,
  AgentResponse,
  StepState,
  ISpec,
  IAgent,
  AgentExecutionContext,
} from '@coordinator/contracts';

/**
 * E2E Test Suite for Phase 2 Todo App Multi-Step Workflow
 *
 * This test suite validates the complete integration of:
 * - TodoSpec workflow specification with multi-step state machine
 * - MockAgent for deterministic multi-step testing
 * - Engine for complex workflow execution
 * - Storage for artifact persistence across workflow steps
 * - State transitions through all workflow phases
 *
 * Test Flow:
 * 1. Initialize all components (Container, Storage, Spec, Agent)
 * 2. Execute complete multi-step workflow:
 *    - Step 1: Gather requirements from user
 *    - Step 2: Create tasks based on requirements
 *    - Step 3: Confirm completion
 * 3. Verify state transitions at each workflow step
 * 4. Verify artifact storage accumulates correctly
 * 5. Verify workflow completion with all artifacts present
 */
/**
 * Helper to create a spec function that wraps an ISpec instance
 * This bridges the gap between Engine's SpecFunction and ISpec.onAgentCompleted
 */
function createSpecFunctionWrapper(
  spec: ISpec,
  agentResponsesMap: Map<string, AgentResponse>
): (state: EngineState) => EngineDecision {
  return (state: EngineState): EngineDecision => {
    // Find completed steps that have stored responses
    const doneSteps = Object.entries(state.openSteps)
      .filter(([id, step]) => agentResponsesMap.has(id) && step.status === 'DONE')
      .sort((a, b) => (b[1].completedAt || 0) - (a[1].completedAt || 0));

    let response: AgentResponse;

    if (doneSteps.length > 0) {
      // Use actual agent response
      const [stepId, _] = doneSteps[0];
      response = agentResponsesMap.get(stepId)!;
      agentResponsesMap.delete(stepId);
    } else {
      // Use synthetic initial response
      response = {
        goalId: state.goalId,
        workflowId: 'workflow-1',
        stepId: 'initial',
        runId: 'run-1',
        agentRole: 'system',
        status: 'OK',
        content: {},
      };
    }

    return spec.onAgentCompleted(state, response, {
      now: Date.now(),
      traceId: 'trace-1',
    });
  };
}

/**
 * Helper to create an agent executor that stores responses for spec wrapper
 */
function createAgentExecutor(
  agent: IAgent,
  goalId: string,
  agentResponsesMap: Map<string, AgentResponse>
): (stepId: string, step: StepState) => Promise<AgentResponse> {
  return async (stepId: string, step: StepState): Promise<AgentResponse> => {
    const context: AgentExecutionContext = {
      runId: 'run-1',
      goalId,
      workflowType: 'todo',
      stepNumber: 1,
      traceId: 'trace-1',
      spanId: 'span-1',
    };

    const result = await agent.execute(step.kind, step.payload, context);

    const response: AgentResponse = {
      goalId,
      workflowId: 'workflow-1',
      stepId,
      runId: 'run-1',
      agentRole: 'mock',
      status: result.status,
      content: result.content,
      artifacts: result.artifacts,
      metrics: result.metrics,
    };

    agentResponsesMap.set(stepId, response);
    return response;
  };
}

describe('Phase 2: Todo App Multi-Step E2E Tests', () => {
  let container: Container;
  let storage: LocalFileStorage;
  let storageDir: string;
  let spec: ISpec;
  let agent: IAgent;

  beforeEach(async () => {
    // Create temporary storage directory for test artifacts
    storageDir = path.join(os.tmpdir(), `coordinator-e2e-todo-test-${Date.now()}`);
    await fs.mkdir(storageDir, { recursive: true });

    // Initialize storage
    storage = new LocalFileStorage(storageDir);

    // Create and configure container
    container = new Container();

    // Register logger
    const logger = new ConsoleLogger();
    container.registerLogger(logger);

    // Register storage
    container.registerStorage(storage);

    // Register TodoSpec factory
    const todoSpecFactory = new TodoSpecFactory();
    container.registerSpecFactory(todoSpecFactory);

    // Register agent factory with support for all todo workflow work kinds
    const mockAgentFactory = new MockAgentFactory([
      'gather_requirements',
      'create_tasks',
      'confirm_completion',
    ]);
    container.registerAgentFactory('mock', mockAgentFactory);

    // Create spec instance
    const specContext = container.createSpecContext({});
    spec = todoSpecFactory.create(specContext);

    // Create agent instance with responses for all workflow steps
    const agentContext = container.createAgentContext(
      {},
      {
        responseByWorkKind: {
          gather_requirements: {
            status: 'OK',
            content: {
              requirements: 'Build a REST API for user management',
              estimatedTasks: 5,
            },
          },
          create_tasks: {
            status: 'OK',
            content: {
              tasks: [
                {
                  id: 1,
                  title: 'Design database schema',
                  description: 'Create user and session tables',
                  priority: 'high',
                },
                {
                  id: 2,
                  title: 'Implement authentication',
                  description: 'Add login and registration endpoints',
                  priority: 'high',
                },
                {
                  id: 3,
                  title: 'Add CRUD operations',
                  description: 'Create user CRUD endpoints',
                  priority: 'medium',
                },
                {
                  id: 4,
                  title: 'Write unit tests',
                  description: 'Test all endpoints',
                  priority: 'high',
                },
                {
                  id: 5,
                  title: 'Document API',
                  description: 'Create OpenAPI specification',
                  priority: 'low',
                },
              ],
            },
          },
          confirm_completion: {
            status: 'OK',
            content: {
              confirmed: true,
              message: 'All tasks have been created and organized successfully',
              timestamp: new Date().toISOString(),
            },
          },
        },
      }
    );
    agent = mockAgentFactory.create(agentContext);
  });

  describe('Complete Multi-Step Workflow Execution', () => {
    it('should execute todo workflow from requirements to completion', async () => {
      // Initialize engine with initial state
      const initialState: EngineState = {
        goalId: 'goal-todo-e2e-1',
        status: 'RUNNING',
        openSteps: {},
        artifacts: {},
        log: [],
      };

      const engine = new Engine(initialState);
      const agentResponses = new Map<string, AgentResponse>();
      const specFunction = createSpecFunctionWrapper(spec, agentResponses);
      const agentExecutor = createAgentExecutor(agent, initialState.goalId, agentResponses);

      // Execute workflow
      const finalState = await engine.runWorkflow(specFunction, agentExecutor, {
        maxIterations: 20,
        timeout: 10000,
      });

      // Verify final state
      expect(finalState.status).toBe('COMPLETED');
      expect(finalState.goalId).toBe('goal-todo-e2e-1');

      // Verify all artifacts are present
      expect(finalState.artifacts.requirements).toBeDefined();
      expect(finalState.artifacts.tasks).toBeDefined();
      expect(finalState.artifacts.confirmation).toBeDefined();

      // Verify artifacts content
      expect(finalState.artifacts.requirements).toBe(
        'Build a REST API for user management'
      );
      expect(Array.isArray(finalState.artifacts.tasks)).toBe(true);
      expect((finalState.artifacts.tasks as unknown[]).length).toBe(5);
      expect(finalState.artifacts.confirmation).toHaveProperty('confirmed', true);

      // Verify log contains workflow events
      expect(finalState.log.length).toBeGreaterThan(0);

      // Verify all three work kinds were executed
      const executedWorkKinds = Object.values(finalState.openSteps).map(
        (step) => step.kind
      );
      expect(executedWorkKinds).toContain('gather_requirements');
      expect(executedWorkKinds).toContain('create_tasks');
      expect(executedWorkKinds).toContain('confirm_completion');
    });

    it('should track multi-step state transitions correctly', async () => {
      const initialState: EngineState = {
        goalId: 'goal-transitions-2',
        status: 'RUNNING',
        openSteps: {},
        artifacts: {},
        log: [],
      };

      const engine = new Engine(initialState);
      const states: EngineState[] = [];
      const artifactProgression: string[][] = [];
      const agentResponses = new Map<string, AgentResponse>();

      // Wrap spec function to track state progressionalso
      const baseSpecFunction = createSpecFunctionWrapper(spec, agentResponses);
      const specFunction = (state: EngineState): EngineDecision => {
        states.push(structuredClone(state));
        artifactProgression.push(Object.keys(state.artifacts));
        return baseSpecFunction(state);
      };

      const agentExecutor = createAgentExecutor(agent, initialState.goalId, agentResponses);

      await engine.runWorkflow(specFunction, agentExecutor, {
        maxIterations: 20,
        timeout: 10000,
      });

      // Verify state progression
      expect(states.length).toBeGreaterThan(0);

      // Verify artifact accumulation through workflow
      // Should see progression: [] -> [requirements] -> [requirements, tasks] -> [requirements, tasks, confirmation]
      const hasRequirementsAdded = artifactProgression.some((artifacts) =>
        artifacts.includes('requirements')
      );
      const hasTasksAdded = artifactProgression.some(
        (artifacts) =>
          artifacts.includes('requirements') && artifacts.includes('tasks')
      );
      // Confirmation might be added - check final state instead
      const finalArtifacts = artifactProgression[artifactProgression.length - 1] || [];

      expect(hasRequirementsAdded).toBe(true);
      expect(hasTasksAdded).toBe(true);
      expect(finalArtifacts).toContain('requirements');
      expect(finalArtifacts).toContain('tasks');

      // Verify workflow progressed through different states
      const hasStepsCreated = states.some((s) => Object.keys(s.openSteps).length > 0);
      const hasDoneSteps = states.some((s) =>
        Object.values(s.openSteps).some((step) => step.status === 'DONE')
      );

      expect(hasStepsCreated).toBe(true);
      expect(hasDoneSteps).toBe(true);
    });

    it('should persist artifacts at each workflow step', async () => {
      const initialState: EngineState = {
        goalId: 'goal-storage-2',
        status: 'RUNNING',
        openSteps: {},
        artifacts: {},
        log: [],
      };

      const engine = new Engine(initialState);
      const savedStates: EngineState[] = [];
      const agentResponses = new Map<string, AgentResponse>();

      const baseSpecFunction = createSpecFunctionWrapper(spec, agentResponses);
      const specFunction = (state: EngineState): EngineDecision => {
        // Save state snapshot after each artifact is added
        if (Object.keys(state.artifacts).length > savedStates.length) {
          savedStates.push(structuredClone(state));
        }
        return baseSpecFunction(state);
      };

      const agentExecutor = createAgentExecutor(agent, initialState.goalId, agentResponses);

      const finalState = await engine.runWorkflow(specFunction, agentExecutor, {
        maxIterations: 20,
        timeout: 10000,
      });

      // Persist each state snapshot to storage
      for (let i = 0; i < savedStates.length; i++) {
        const stateKey = `workflows/${finalState.goalId}/state-${i}.json`;
        await storage.write(stateKey, JSON.stringify(savedStates[i], null, 2));

        // Verify storage persistence
        const exists = await storage.exists(stateKey);
        expect(exists).toBe(true);

        // Retrieve and verify stored state
        const storedData = await storage.read(stateKey);
        const storedState = JSON.parse(storedData.toString());
        expect(storedState.goalId).toBe(finalState.goalId);
      }

      // Persist final state
      const finalStateKey = `workflows/${finalState.goalId}/final-state.json`;
      await storage.write(finalStateKey, JSON.stringify(finalState, null, 2));

      const finalStoredData = await storage.read(finalStateKey);
      const finalStoredState = JSON.parse(finalStoredData.toString());

      expect(finalStoredState.status).toBe('COMPLETED');
      expect(finalStoredState.artifacts).toHaveProperty('requirements');
      expect(finalStoredState.artifacts).toHaveProperty('tasks');
      expect(finalStoredState.artifacts).toHaveProperty('confirmation');

      // Verify we saved at least 2 states (requirements and tasks artifacts)
      expect(savedStates.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle workflow with multiple agent interactions', async () => {
      const initialState: EngineState = {
        goalId: 'goal-interactions-1',
        status: 'RUNNING',
        openSteps: {},
        artifacts: {},
        log: [],
      };

      const engine = new Engine(initialState);
      let agentCallCount = 0;
      const agentCalls: Array<{ workKind: string; payload: unknown }> = [];
      const agentResponses = new Map<string, AgentResponse>();
      const specFunction = createSpecFunctionWrapper(spec, agentResponses);

      const baseAgentExecutor = createAgentExecutor(agent, initialState.goalId, agentResponses);
      const agentExecutor = async (stepId: string, step: StepState): Promise<AgentResponse> => {
        agentCallCount++;
        agentCalls.push({ workKind: step.kind, payload: step.payload });
        return baseAgentExecutor(stepId, step);
      };

      const finalState = await engine.runWorkflow(specFunction, agentExecutor, {
        maxIterations: 20,
        timeout: 10000,
      });

      // Verify multiple agent calls occurred
      expect(agentCallCount).toBeGreaterThanOrEqual(3);

      // Verify all expected work kinds were called
      const calledWorkKinds = agentCalls.map((call) => call.workKind);
      expect(calledWorkKinds).toContain('gather_requirements');
      expect(calledWorkKinds).toContain('create_tasks');
      expect(calledWorkKinds).toContain('confirm_completion');

      // Verify workflow completed successfully
      expect(finalState.status).toBe('COMPLETED');

      // Verify agent calls were made in correct sequence
      const requirementsIndex = calledWorkKinds.indexOf('gather_requirements');
      const tasksIndex = calledWorkKinds.indexOf('create_tasks');
      const confirmIndex = calledWorkKinds.indexOf('confirm_completion');

      expect(requirementsIndex).toBeGreaterThanOrEqual(0);
      expect(tasksIndex).toBeGreaterThan(requirementsIndex);
      expect(confirmIndex).toBeGreaterThan(tasksIndex);
    });

    it('should enforce max iterations limit for multi-step workflows', async () => {
      const initialState: EngineState = {
        goalId: 'goal-max-iterations-2',
        status: 'RUNNING',
        openSteps: {},
        artifacts: {},
        log: [],
      };

      const engine = new Engine(initialState);
      const agentResponses = new Map<string, AgentResponse>();

      // Spec that never finalizes
      const specFunction = (_state: EngineState): EngineDecision => {
        return {
          decisionId: `decision-${Date.now()}`,
          actions: [
            {
              type: 'REQUEST_WORK',
              workKind: 'gather_requirements',
              payload: {},
            },
          ],
          finalize: false, // Never finalize
        };
      };

      const agentExecutor = createAgentExecutor(agent, initialState.goalId, agentResponses);

      // Should throw max iterations error
      await expect(
        engine.runWorkflow(specFunction, agentExecutor, {
          maxIterations: 5,
          timeout: 10000,
        })
      ).rejects.toThrow('Maximum iterations');
    });
  });

  describe('Integration with Real Todo Components', () => {
    it('should wire up Container, TodoSpec, and Agent correctly', () => {
      // Verify container has all required components
      const specFactories = container.listSpecFactories();
      expect(specFactories).toHaveLength(1);
      expect(specFactories[0].name).toBe('todo');

      const agentFactories = container.listAgentFactories();
      expect(agentFactories).toHaveLength(1);
      expect(agentFactories[0].name).toBe('mock');

      // Verify spec is correctly instantiated
      expect(spec.name).toBe('todo');

      // Verify storage is available
      const resolvedStorage = container.resolveStorage();
      expect(resolvedStorage).toBeDefined();
      expect(resolvedStorage).toBe(storage);
    });

    it('should create TodoSpec with proper context and descriptor', () => {
      const todoSpecFactory = new TodoSpecFactory();
      const descriptor = todoSpecFactory.describe();

      expect(descriptor.name).toBe('todo');
      expect(descriptor.version).toBe('0.1.0');
      expect(descriptor.requiredWorkKinds).toContain('gather_requirements');
      expect(descriptor.requiredWorkKinds).toContain('create_tasks');
      expect(descriptor.requiredWorkKinds).toContain('confirm_completion');
      expect(descriptor.description).toContain('todo');
      expect(descriptor.description.toLowerCase()).toContain('multi-step');
    });

    it('should create agent with proper configuration for all work kinds', async () => {
      const mockFactory = new MockAgentFactory([
        'gather_requirements',
        'create_tasks',
        'confirm_completion',
        'extra_work',
      ]);
      const descriptor = mockFactory.describe();

      expect(descriptor.name).toBe('MockAgent');
      expect(descriptor.supportedWorkKinds).toContain('gather_requirements');
      expect(descriptor.supportedWorkKinds).toContain('create_tasks');
      expect(descriptor.supportedWorkKinds).toContain('confirm_completion');
      expect(descriptor.supportedWorkKinds).toContain('extra_work');

      // Create agent and test execution for each work kind
      const agentContext = container.createAgentContext(
        {},
        {
          responseByWorkKind: {
            gather_requirements: {
              status: 'OK',
              content: { requirements: 'Test requirements' },
            },
            create_tasks: {
              status: 'OK',
              content: { tasks: [{ id: 1, title: 'Test task' }] },
            },
            confirm_completion: {
              status: 'OK',
              content: { confirmed: true },
            },
          },
        }
      );

      const testAgent = mockFactory.create(agentContext);

      // Test gather_requirements
      const reqResult = await testAgent.execute(
        'gather_requirements',
        { prompt: 'test' },
        {
          runId: 'run-1',
          goalId: 'goal-1',
          workflowType: 'todo',
          stepNumber: 1,
          traceId: 'trace-1',
          spanId: 'span-1',
        }
      );
      expect(reqResult.status).toBe('OK');
      expect(reqResult.content).toEqual({ requirements: 'Test requirements' });

      // Test create_tasks
      const taskResult = await testAgent.execute(
        'create_tasks',
        { requirements: 'test' },
        {
          runId: 'run-1',
          goalId: 'goal-1',
          workflowType: 'todo',
          stepNumber: 2,
          traceId: 'trace-1',
          spanId: 'span-2',
        }
      );
      expect(taskResult.status).toBe('OK');
      expect(taskResult.content).toEqual({ tasks: [{ id: 1, title: 'Test task' }] });

      // Test confirm_completion
      const confirmResult = await testAgent.execute(
        'confirm_completion',
        { tasks: [] },
        {
          runId: 'run-1',
          goalId: 'goal-1',
          workflowType: 'todo',
          stepNumber: 3,
          traceId: 'trace-1',
          spanId: 'span-3',
        }
      );
      expect(confirmResult.status).toBe('OK');
      expect(confirmResult.content).toEqual({ confirmed: true });
    });

    it('should validate TodoSpec configuration schema', () => {
      const todoSpecFactory = new TodoSpecFactory();

      // Valid config
      expect(todoSpecFactory.validate({ maxTasks: 10 })).toBe(true);

      // Valid empty config
      expect(todoSpecFactory.validate({})).toBe(true);

      // Invalid config - negative maxTasks
      expect(todoSpecFactory.validate({ maxTasks: -5 })).toBe(false);

      // Invalid config - zero maxTasks
      expect(todoSpecFactory.validate({ maxTasks: 0 })).toBe(false);

      // Invalid config - non-number maxTasks
      expect(todoSpecFactory.validate({ maxTasks: 'invalid' })).toBe(false);
    });
  });
});
