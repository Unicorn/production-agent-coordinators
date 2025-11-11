#!/usr/bin/env tsx

/**
 * Agent Coordinator Demo - Hello World Workflow
 *
 * This demonstrates the full agent coordinator system in action:
 * 1. Container wires up all dependencies (DI)
 * 2. Coordinator manages specs and agents
 * 3. Engine executes deterministic workflow
 * 4. Spec defines workflow logic (HelloSpec)
 * 5. Agent executes work (MockAgent)
 *
 * Run with: npx tsx examples/demo-hello-world.ts
 */

import { Engine } from '../packages/engine/src/index.js';
import { Container, Coordinator, ConsoleLogger } from '../packages/coordinator/src/index.js';
import { LocalFileStorage } from '../packages/storage/src/index.js';
import { HelloSpecFactory } from '../packages/specs/hello/src/index.js';
import { MockAgentFactory } from '../packages/agents/mock/src/index.js';
import type { EngineState, AgentResponse, StepState } from '../packages/contracts/src/index.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

// Helper to create spec function wrapper
function createSpecFunctionWrapper(spec: any, responses: Map<string, AgentResponse>) {
  return (state: EngineState) => {
    // Get the most recent step (if any)
    const stepIds = Object.keys(state.openSteps);
    const lastStepId = stepIds[stepIds.length - 1];
    const lastResponse = lastStepId ? responses.get(lastStepId) : undefined;

    const execContext = {
      now: Date.now(),
      random: () => Math.random(),
    };

    if (!lastResponse) {
      // Initial call - no agent response yet
      return spec.onAgentCompleted(
        state,
        {
          goalId: state.goalId,
          workflowId: 'demo-workflow-001',
          stepId: '',
          runId: '',
          agentRole: '',
          status: 'OK' as const,
        },
        execContext
      );
    }

    return spec.onAgentCompleted(state, lastResponse, execContext);
  };
}

// Helper to create agent executor
function createAgentExecutor(agent: any, responses: Map<string, AgentResponse>, goalId: string) {
  return async (stepId: string, step: StepState) => {
    console.log(`\n🤖 Agent executing step: ${stepId}`);
    console.log(`   Work kind: ${step.kind}`);
    console.log(`   Payload:`, JSON.stringify(step.payload, null, 2));

    const result = await agent.execute(step.kind, step.payload, {
      goalId,
      workflowId: 'demo-workflow-001',
      stepId,
      runId: `run-${Date.now()}`,
      agentRole: 'greeter',
    });

    const response: AgentResponse = {
      goalId,
      workflowId: 'demo-workflow-001',
      stepId,
      runId: `run-${Date.now()}`,
      agentRole: 'greeter',
      status: result.status,
      content: result.content,
      artifacts: result.artifacts,
      metrics: result.metrics,
      llmMetadata: result.llmMetadata,
      confidence: result.confidence,
      errors: result.errors,
    };

    responses.set(stepId, response);

    console.log(`   ✅ Agent response: ${result.status}`);
    if (result.content) {
      console.log(`   Content:`, JSON.stringify(result.content, null, 2));
    }

    return response;
  };
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║      Agent Coordinator - Hello World Demo                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Setup temporary storage
  const tempDir = path.join(process.cwd(), 'demo-output');
  await fs.mkdir(tempDir, { recursive: true });

  console.log('📦 Step 1: Setting up Container (Dependency Injection)');
  console.log('   - Registering LocalFileStorage');
  console.log('   - Registering ConsoleLogger');

  const container = new Container();
  container.registerStorage(new LocalFileStorage(tempDir));
  container.registerLogger(new ConsoleLogger('DEMO'));

  console.log('\n🎯 Step 2: Creating Coordinator');
  console.log('   - Wiring up components');

  const coordinator = new Coordinator(container, {
    maxIterations: 10,
    timeout: 30000,
  });

  console.log('\n📋 Step 3: Registering Spec and Agent Factories');
  console.log('   - HelloSpec: Simple greeting workflow');
  console.log('   - MockAgent: Deterministic test agent');

  const helloFactory = new HelloSpecFactory();
  const mockFactory = new MockAgentFactory(['greet'], {
    defaultResponse: {
      status: 'OK',
      content: {
        message: 'Hello from the Agent Coordinator! 👋',
        timestamp: new Date().toISOString(),
      },
    },
  });

  coordinator.registerSpec(helloFactory);
  coordinator.registerAgent('mock-agent', mockFactory);

  console.log('\n🏗️  Step 4: Creating Spec and Agent Instances');

  const spec = coordinator.createSpec('hello', {
    workKind: 'greet',
  });

  const agent = coordinator.createAgent('mock-agent', {}, {});

  console.log('   ✅ Spec created:', helloFactory.describe().name);
  console.log('   ✅ Agent created:', mockFactory.describe().name);

  console.log('\n⚙️  Step 5: Initializing Engine State');

  const initialState: EngineState = {
    goalId: 'demo-goal-001',
    status: 'RUNNING',
    openSteps: {},
    artifacts: {},
    log: [],
  };

  console.log('   Goal ID:', initialState.goalId);
  console.log('   Status:', initialState.status);

  console.log('\n🚀 Step 6: Running Workflow');
  console.log('════════════════════════════════════════════════════════════\n');

  const engine = new Engine(initialState, {
    maxIterations: 10,
    timeoutMs: 30000,
  });

  const responses = new Map<string, AgentResponse>();

  const finalState = await engine.runWorkflow(
    createSpecFunctionWrapper(spec, responses),
    createAgentExecutor(agent, responses, initialState.goalId)
  );

  console.log('\n════════════════════════════════════════════════════════════');
  console.log('🎉 Workflow Complete!\n');

  console.log('📊 Final State:');
  console.log('   Status:', finalState.status);
  console.log('   Total steps:', Object.keys(finalState.openSteps).length);
  console.log('\n   Steps executed:');

  Object.entries(finalState.openSteps).forEach(([stepId, step], idx) => {
    console.log(`   ${idx + 1}. ${stepId} (${step.kind})`);
    console.log(`      Status: ${step.status}`);
  });

  if (Object.keys(finalState.artifacts).length > 0) {
    console.log('\n   Artifacts created:');
    Object.entries(finalState.artifacts).forEach(([key, value]) => {
      console.log(`   - ${key}:`, value);
    });
  }

  console.log('\n✨ Demo complete! The agent coordinator system is working.\n');
  console.log('   📁 Output saved to:', tempDir);
  console.log('\n   You just witnessed:');
  console.log('   ✓ Dependency injection (Container)');
  console.log('   ✓ Component orchestration (Coordinator)');
  console.log('   ✓ Deterministic workflow execution (Engine)');
  console.log('   ✓ Workflow logic (HelloSpec)');
  console.log('   ✓ Agent execution (MockAgent)');
  console.log('   ✓ State management (EngineState)');
  console.log('   ✓ Storage abstraction (LocalFileStorage)');

  // Cleanup
  console.log('\n🧹 Cleaning up demo artifacts...');
  await fs.rm(tempDir, { recursive: true, force: true });
  console.log('   ✅ Done!\n');
}

main().catch((error) => {
  console.error('❌ Demo failed:', error);
  process.exit(1);
});
