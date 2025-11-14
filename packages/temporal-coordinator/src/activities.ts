/**
 * Temporal Activities for Agent Coordinator
 *
 * Activities are functions that perform side effects and can fail/retry.
 * They wrap the existing Engine, Coordinator, and Agent components.
 */

import type {
  EngineState,
  AgentResponse,
  StepState,
  SpecExecutionContext,
} from '@coordinator/contracts';
import { Engine } from '@coordinator/engine';
import { Container, Coordinator, ConsoleLogger } from '@coordinator/coordinator';
import { LocalFileStorage } from '@coordinator/storage';
import { HelloSpecFactory } from '@coordinator/specs-hello';
import { MockAgentFactory } from '@coordinator/agents-mock';

/**
 * Initialize a workflow with the given goal ID and configuration
 */
export async function initializeWorkflow(
  goalId: string,
  config: {
    specType: string;
    specConfig?: Record<string, unknown>;
    agentType: string;
    agentConfig?: Record<string, unknown>;
  }
): Promise<EngineState> {
  console.log(`[Activity] Initializing workflow for goal: ${goalId}`);

  const initialState: EngineState = {
    goalId,
    status: 'RUNNING',
    openSteps: {},
    artifacts: {},
    log: [{
      at: Date.now(),
      event: 'WORKFLOW_INITIALIZED',
      data: { specType: config.specType, agentType: config.agentType },
    }],
  };

  console.log(`[Activity] Initial state created:`, {
    goalId: initialState.goalId,
    status: initialState.status,
  });

  return initialState;
}

/**
 * Execute a single workflow step by getting decision from spec
 * and processing it with the engine
 */
export async function executeSpecDecision(
  state: EngineState,
  config: {
    specType: string;
    specConfig?: Record<string, unknown>;
    lastResponse?: AgentResponse;
  }
): Promise<EngineState> {
  console.log(`[Activity] Executing spec decision for goal: ${state.goalId}`);

  // Setup container and coordinator
  const container = new Container();
  container.registerStorage(new LocalFileStorage('/tmp/coordinator'));
  container.registerLogger(new ConsoleLogger('TEMPORAL'));

  const coordinator = new Coordinator(container);

  // Register spec factory
  const helloFactory = new HelloSpecFactory();
  coordinator.registerSpec(helloFactory);

  // Create spec instance
  const spec = coordinator.createSpec(config.specType, config.specConfig || {});

  // Create execution context (deterministic)
  const execContext: SpecExecutionContext = {
    now: Date.now(),
    random: () => Math.random(), // In production, use seeded random
  };

  // Get decision from spec
  const decision = config.lastResponse
    ? spec.onAgentCompleted(state, config.lastResponse, execContext)
    : spec.onAgentCompleted(
        state,
        {
          goalId: state.goalId,
          workflowId: 'temporal-workflow',
          stepId: '',
          runId: '',
          agentRole: '',
          status: 'OK',
        },
        execContext
      );

  console.log(`[Activity] Spec decision:`, {
    decisionId: decision.decisionId,
    actions: decision.actions.length,
    finalize: decision.finalize,
  });

  // Process decision with engine
  const engine = new Engine(state);
  const newState = engine.processDecision(decision, execContext);

  console.log(`[Activity] New state:`, {
    status: newState.status,
    openSteps: Object.keys(newState.openSteps).length,
  });

  return newState;
}

/**
 * Execute a single agent step
 */
export async function executeAgentStep(
  goalId: string,
  stepId: string,
  step: StepState,
  config: {
    agentType: string;
    agentConfig?: Record<string, unknown>;
    agentApiKey?: string;
  }
): Promise<AgentResponse> {
  console.log(`[Activity] Executing agent step: ${stepId}`);
  console.log(`[Activity] Work kind: ${step.kind}`);

  // Setup container and coordinator
  const container = new Container();
  container.registerStorage(new LocalFileStorage('/tmp/coordinator'));
  container.registerLogger(new ConsoleLogger('TEMPORAL'));

  const coordinator = new Coordinator(container);

  // Register agent factory based on type
  if (config.agentType === 'mock-agent') {
    const mockFactory = new MockAgentFactory([step.kind]);
    coordinator.registerAgent('mock-agent', mockFactory);
  }
  // Add support for other agent types here (e.g., AnthropicAgent)

  // Create agent instance with config that includes mock response
  const agentConfig = config.agentConfig || {};
  if (config.agentType === 'mock-agent') {
    agentConfig.defaultResponse = {
      status: 'OK',
      content: {
        message: 'Hello from Temporal + Agent Coordinator!',
        timestamp: new Date().toISOString(),
        stepKind: step.kind,
      },
    };
  }

  const agent = coordinator.createAgent(
    config.agentType,
    config.agentApiKey ? { apiKey: config.agentApiKey } : {},
    agentConfig
  );

  // Execute agent
  const result = await agent.execute(step.kind, step.payload, {
    runId: `run-${Date.now()}`,
    goalId,
    workflowType: 'temporal-workflow',
    stepNumber: 1,
    traceId: `trace-${goalId}`,
    spanId: `span-${stepId}`,
  });

  // Convert to AgentResponse
  const response: AgentResponse = {
    goalId,
    workflowId: 'temporal-workflow',
    stepId,
    runId: `run-${Date.now()}`,
    agentRole: 'agent',
    status: result.status,
    content: result.content,
    artifacts: result.artifacts,
    metrics: result.metrics,
    llmMetadata: result.llmMetadata,
    confidence: result.confidence,
    errors: result.errors,
  };

  console.log(`[Activity] Agent response:`, {
    stepId,
    status: response.status,
    hasContent: !!response.content,
  });

  return response;
}

/**
 * Store an artifact to persistent storage
 */
export async function storeArtifact(
  goalId: string,
  key: string,
  value: unknown
): Promise<void> {
  console.log(`[Activity] Storing artifact: ${key} for goal: ${goalId}`);

  const container = new Container();
  container.registerStorage(new LocalFileStorage('/tmp/coordinator'));
  container.registerLogger(new ConsoleLogger('TEMPORAL'));

  const storage = container.resolveStorage();

  // Store artifact as JSON
  const artifactKey = `${goalId}/artifacts/${key}.json`;
  await storage.write(artifactKey, JSON.stringify(value, null, 2));

  console.log(`[Activity] Artifact stored successfully at: ${artifactKey}`);
}

/**
 * Process agent response and update state
 */
export async function processAgentResponse(
  state: EngineState,
  response: AgentResponse
): Promise<EngineState> {
  console.log(`[Activity] Processing agent response for step: ${response.stepId}`);

  const execContext: SpecExecutionContext = {
    now: Date.now(),
    random: () => Math.random(),
  };

  const engine = new Engine(state);
  const newState = engine.processAgentResponse(response, execContext);

  console.log(`[Activity] State updated:`, {
    status: newState.status,
    openSteps: Object.keys(newState.openSteps).length,
  });

  return newState;
}

/**
 * Coordinator Activities
 * Re-export from package-builder-production agent
 */
export {
  loadAgentRegistry,
  analyzeProblem,
  writeDiagnosticReport,
  executeAgentTask
} from '@coordinator/agent-package-builder-production'
