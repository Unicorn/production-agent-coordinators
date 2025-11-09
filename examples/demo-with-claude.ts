#!/usr/bin/env tsx

/**
 * Agent Coordinator Demo - Real Claude Integration
 *
 * This demonstrates the agent coordinator with REAL Anthropic Claude API calls:
 * 1. Container wires up all dependencies (DI)
 * 2. Coordinator manages specs and agents
 * 3. Engine executes deterministic workflow
 * 4. Spec defines workflow logic (HelloSpec)
 * 5. Agent executes work with REAL Claude API calls (AnthropicAgent)
 *
 * Prerequisites:
 * - ANTHROPIC_API_KEY in .env file OR as environment variable
 *
 * Run with: npx tsx examples/demo-with-claude.ts
 * Or with: ANTHROPIC_API_KEY=sk-xxx npx tsx examples/demo-with-claude.ts
 */

import dotenv from 'dotenv';
import { Engine } from '../packages/engine/src/index.js';
import { Container, Coordinator, ConsoleLogger } from '../packages/coordinator/src/index.js';
import { LocalFileStorage } from '../packages/storage/src/index.js';
import { HelloSpecFactory } from '../packages/specs/hello/src/index.js';
import { AnthropicAgentFactory } from '../packages/agents/anthropic/src/index.js';
import type { EngineState, AgentResponse, StepState } from '../packages/contracts/src/index.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

// Load environment variables from .env file
dotenv.config();

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
    console.log(`\n🤖 Claude Agent executing step: ${stepId}`);
    console.log(`   Work kind: ${step.kind}`);
    console.log(`   Payload:`, JSON.stringify(step.payload, null, 2));
    console.log(`   ⏳ Calling Claude API...`);

    // Convert generic work kind to anthropic.chat format
    const anthropicPayload = {
      messages: [
        {
          role: 'user',
          content: (step.payload as any)?.message || 'Say hello',
        }
      ],
      max_tokens: 1024,
    };

    const result = await agent.execute('anthropic.chat', anthropicPayload, {
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

    if (result.status === 'FAIL' || result.status === 'RATE_LIMITED' || result.status === 'CONTEXT_EXCEEDED') {
      console.log(`   ❌ Claude response: ${result.status}`);
      if (result.errors && result.errors.length > 0) {
        console.log(`   🚨 Errors:`);
        result.errors.forEach((error, idx) => {
          console.log(`      ${idx + 1}. [${error.type}] ${error.message}`);
          if (error.retryable) {
            console.log(`         Retryable: yes${error.retryAfterMs ? ` (retry after ${error.retryAfterMs}ms)` : ''}`);
          }
        });
      }
    } else {
      console.log(`   ✅ Claude response: ${result.status}`);
      if (result.content) {
        console.log(`   💬 Response:`, result.content);
      }
      if (result.metrics) {
        console.log(`   📊 Metrics:`, {
          tokens: result.metrics.tokens,
          latencyMs: result.metrics.latencyMs,
          costUsd: result.metrics.costUsd?.toFixed(6),
          model: result.metrics.modelName,
        });
      }
    }

    return response;
  };
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║    Agent Coordinator - Real Claude Integration            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Check for API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('❌ Error: ANTHROPIC_API_KEY environment variable is required');
    console.error('');
    console.error('Please set your API key:');
    console.error('  export ANTHROPIC_API_KEY=sk-your-key-here');
    console.error('');
    console.error('Or run with:');
    console.error('  ANTHROPIC_API_KEY=sk-your-key-here npx tsx examples/demo-with-claude.ts');
    process.exit(1);
  }

  console.log('✅ API Key found');
  console.log(`   Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}\n`);

  // Setup temporary storage
  const tempDir = path.join(process.cwd(), 'demo-output-claude');
  await fs.mkdir(tempDir, { recursive: true });

  console.log('📦 Step 1: Setting up Container (Dependency Injection)');
  console.log('   - Registering LocalFileStorage');
  console.log('   - Registering ConsoleLogger');

  const container = new Container();
  container.registerStorage(new LocalFileStorage(tempDir));
  container.registerLogger(new ConsoleLogger('CLAUDE-DEMO'));

  console.log('\n🎯 Step 2: Creating Coordinator');
  console.log('   - Wiring up components');

  const coordinator = new Coordinator(container, {
    maxIterations: 10,
    timeout: 60000, // 60 seconds for API calls
  });

  console.log('\n📋 Step 3: Registering Spec and Agent Factories');
  console.log('   - HelloSpec: Simple greeting workflow');
  console.log('   - AnthropicAgent: Real Claude API integration');

  const helloFactory = new HelloSpecFactory();
  const anthropicFactory = new AnthropicAgentFactory();

  coordinator.registerSpec(helloFactory);
  coordinator.registerAgent('anthropic', anthropicFactory);

  console.log('\n🏗️  Step 4: Creating Spec and Agent Instances');

  const spec = coordinator.createSpec('hello', {
    workKind: 'greet',
  });

  const agent = coordinator.createAgent('anthropic', {
    ANTHROPIC_API_KEY: apiKey,
  }, {});

  console.log('   ✅ Spec created:', helloFactory.describe().name);
  console.log('   ✅ Agent created:', anthropicFactory.describe().name);
  console.log('   ✅ Model: claude-sonnet-4-20250514 (default)');

  console.log('\n⚙️  Step 5: Initializing Engine State');

  const initialState: EngineState = {
    goalId: 'demo-goal-claude-001',
    status: 'RUNNING',
    openSteps: {},
    artifacts: {},
    log: [],
  };

  console.log('   Goal ID:', initialState.goalId);
  console.log('   Status:', initialState.status);

  console.log('\n🚀 Step 6: Running Workflow with Real Claude API');
  console.log('════════════════════════════════════════════════════════════\n');

  const engine = new Engine(initialState, {
    maxIterations: 10,
    timeoutMs: 60000,
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

  console.log('\n✨ Demo complete! The agent coordinator is working with REAL Claude API.\n');
  console.log('   📁 Output saved to:', tempDir);
  console.log('\n   You just witnessed:');
  console.log('   ✓ Dependency injection (Container)');
  console.log('   ✓ Component orchestration (Coordinator)');
  console.log('   ✓ Deterministic workflow execution (Engine)');
  console.log('   ✓ Workflow logic (HelloSpec)');
  console.log('   ✓ REAL Claude API calls (AnthropicAgent)');
  console.log('   ✓ Token usage and cost tracking');
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
