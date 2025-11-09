#!/usr/bin/env tsx

/**
 * Agent Coordinator + Temporal Demo
 *
 * This demonstrates the agent-coordinator system running on Temporal for
 * durable workflow execution with automatic retries and failure handling.
 *
 * Prerequisites:
 * 1. Temporal server running: yarn infra:up
 * 2. Worker running: tsx packages/temporal-coordinator/src/worker.ts
 *
 * Run with: npx tsx examples/demo-with-temporal.ts
 */

import { Connection, Client } from '@temporalio/client';
import type { HelloWorkflowConfig } from '../packages/temporal-coordinator/src/workflows';

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Agent Coordinator + Temporal Demo                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Check if we should use a real agent or mock
  const useRealAgent = process.env.ANTHROPIC_API_KEY && process.argv.includes('--real-agent');
  const agentType = useRealAgent ? 'anthropic-agent' : 'mock-agent';

  if (useRealAgent) {
    console.log('🤖 Using AnthropicAgent (real LLM calls)\n');
  } else {
    console.log('🤖 Using MockAgent (no API key required)\n');
    if (process.env.ANTHROPIC_API_KEY) {
      console.log('   💡 Tip: Add --real-agent flag to use AnthropicAgent\n');
    }
  }

  console.log('📋 Step 1: Connecting to Temporal');
  console.log('   Address: localhost:7233');

  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
  });

  const client = new Client({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || 'default',
  });

  console.log('   ✅ Connected to Temporal\n');

  console.log('📋 Step 2: Configuring Workflow');

  const workflowConfig: HelloWorkflowConfig = {
    goalId: `goal-${Date.now()}`,
    specType: 'hello',
    specConfig: {
      workKind: 'greet',
    },
    agentType,
    agentConfig: {},
    agentApiKey: useRealAgent ? process.env.ANTHROPIC_API_KEY : undefined,
    maxIterations: 10,
  };

  console.log('   Goal ID:', workflowConfig.goalId);
  console.log('   Spec Type:', workflowConfig.specType);
  console.log('   Agent Type:', workflowConfig.agentType);
  console.log('   Work Kind:', workflowConfig.specConfig?.workKind);

  console.log('\n📋 Step 3: Starting Workflow');

  const workflowId = `hello-workflow-${Date.now()}`;
  console.log('   Workflow ID:', workflowId);
  console.log('   Task Queue: agent-coordinator-queue');

  const handle = await client.workflow.start('helloWorkflow', {
    taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'agent-coordinator-queue',
    workflowId,
    args: [workflowConfig],
  });

  console.log('   ✅ Workflow started!\n');

  console.log('📋 Step 4: Waiting for Workflow to Complete');
  console.log('   This may take a few seconds...\n');

  try {
    const result = await handle.result();

    console.log('════════════════════════════════════════════════════════════');
    console.log('🎉 Workflow Completed Successfully!\n');

    console.log('📊 Final State:');
    console.log('   Status:', result.status);
    console.log('   Goal ID:', result.goalId);
    console.log('   Total Steps:', Object.keys(result.openSteps).length);

    if (Object.keys(result.openSteps).length > 0) {
      console.log('\n   Steps executed:');
      Object.entries(result.openSteps).forEach(([stepId, step], idx) => {
        console.log(`   ${idx + 1}. ${stepId}`);
        console.log(`      Kind: ${step.kind}`);
        console.log(`      Status: ${step.status}`);
        if (step.payload) {
          console.log(`      Payload:`, JSON.stringify(step.payload, null, 2).replace(/\n/g, '\n      '));
        }
      });
    }

    if (Object.keys(result.artifacts).length > 0) {
      console.log('\n   Artifacts created:');
      Object.entries(result.artifacts).forEach(([key, value]) => {
        console.log(`   - ${key}:`, JSON.stringify(value, null, 2).replace(/\n/g, '\n     '));
      });
    }

    if (result.log.length > 0) {
      console.log('\n   Event Log:');
      result.log.slice(0, 5).forEach((entry) => {
        const timestamp = new Date(entry.at).toISOString();
        console.log(`   - [${timestamp}] ${entry.event}`);
      });
      if (result.log.length > 5) {
        console.log(`   ... and ${result.log.length - 5} more events`);
      }
    }

    console.log('\n✨ Demo complete! Your workflow ran with Temporal durability.\n');
    console.log('   Key features demonstrated:');
    console.log('   ✓ Durable workflow execution');
    console.log('   ✓ Automatic retries on failures');
    console.log('   ✓ Agent Coordinator integration');
    console.log('   ✓ HelloSpec workflow logic');
    console.log('   ✓ ' + (useRealAgent ? 'Real LLM agent execution' : 'Mock agent execution'));
    console.log('   ✓ Activity-based side effects');
    console.log('   ✓ State persistence');

    console.log('\n   🔍 View workflow in Temporal Web UI:');
    console.log('   http://localhost:8233');

  } catch (error) {
    console.log('════════════════════════════════════════════════════════════');
    console.log('❌ Workflow Failed\n');
    console.error('Error:', error);
    console.log('\n   Troubleshooting:');
    console.log('   1. Check if Temporal is running: yarn infra:up');
    console.log('   2. Check if Worker is running: tsx packages/temporal-coordinator/src/worker.ts');
    console.log('   3. Check Worker logs for errors');
    process.exit(1);
  }

  console.log('\n👋 Done!\n');
}

main().catch((error) => {
  console.error('❌ Demo failed:', error);
  process.exit(1);
});
