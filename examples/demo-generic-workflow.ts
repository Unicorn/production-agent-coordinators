#!/usr/bin/env tsx

/**
 * Generic Workflow Demo - Registry-Based Dynamic Execution
 *
 * This demonstrates the genericWorkflow capability to run ANY spec/agent
 * combination from the workflow-runner registries with Temporal durability.
 *
 * Features demonstrated:
 * - Dynamic spec/agent selection at runtime
 * - Registry-based workflow execution
 * - Optional sleep configuration per workflow
 * - Multiple workflows running different specs
 * - Integration with CLI's workflow-runner architecture
 *
 * Prerequisites:
 * - Temporal infrastructure running (yarn infra:up)
 * - Worker running (yarn workspace @coordinator/temporal-coordinator start:worker)
 *
 * Run with: npx tsx examples/demo-generic-workflow.ts
 */

import { Connection, Client } from '@temporalio/client';
import type { GenericWorkflowConfig } from '../packages/temporal-coordinator/src/workflows.js';

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Generic Workflow Demo - Registry-Based Execution        ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('🔧 This demo shows how the generic workflow can run ANY');
  console.log('   spec/agent combination from the workflow-runner registry\n');

  // Connect to Temporal
  console.log('📋 Step 1: Connecting to Temporal');
  console.log('   Address: localhost:7233');

  const connection = await Connection.connect({
    address: 'localhost:7233',
  });

  const client = new Client({
    connection,
    namespace: 'default',
  });

  console.log('   ✅ Connected to Temporal\n');

  // Demo 1: Run "hello" spec with "mock" agent
  console.log('══════════════════════════════════════════════════════════');
  console.log('Demo 1: Hello Spec + Mock Agent (No Sleep)');
  console.log('══════════════════════════════════════════════════════════\n');

  const helloConfig: GenericWorkflowConfig = {
    goalId: `hello-${Date.now()}`,
    specName: 'hello',      // From workflow-runner SPEC_REGISTRY
    agentName: 'mock',      // From workflow-runner AGENT_REGISTRY
    agentConfig: {
      defaultResponse: {
        status: 'OK',
        content: {
          message: 'Hello from Generic Workflow with Hello Spec!',
          timestamp: new Date().toISOString(),
        },
      },
    },
  };

  console.log(`   Goal ID: ${helloConfig.goalId}`);
  console.log(`   Spec: ${helloConfig.specName}`);
  console.log(`   Agent: ${helloConfig.agentName}`);
  console.log(`   Sleep: None\n`);

  const helloWorkflowId = `generic-hello-${Date.now()}`;
  const helloHandle = await client.workflow.start('genericWorkflow', {
    taskQueue: 'agent-coordinator-queue',
    workflowId: helloWorkflowId,
    args: [helloConfig],
  });

  console.log('   🚀 Workflow started!\n');
  console.log('   Waiting for completion...\n');

  const helloStartTime = Date.now();
  const helloResult = await helloHandle.result();
  const helloElapsed = Date.now() - helloStartTime;

  console.log('   ✅ Hello workflow complete!');
  console.log(`   Status: ${helloResult.status}`);
  console.log(`   Time: ${(helloElapsed / 1000).toFixed(1)}s`);
  console.log(`   Steps: ${Object.keys(helloResult.openSteps).length}\n`);

  // Demo 2: Run "conversation" spec with "mock" agent and 5s sleep
  console.log('══════════════════════════════════════════════════════════');
  console.log('Demo 2: Conversation Spec + Mock Agent (5s Sleep)');
  console.log('══════════════════════════════════════════════════════════\n');

  const conversationConfig: GenericWorkflowConfig = {
    goalId: `conversation-${Date.now()}`,
    specName: 'conversation', // From workflow-runner SPEC_REGISTRY
    agentName: 'mock',        // From workflow-runner AGENT_REGISTRY
    sleepDurationSeconds: 5,  // Optional sleep between steps
    agentConfig: {
      responseByWorkKind: {
        'agent_a_initiate': {
          status: 'OK',
          content: {
            speaker: 'Alice',
            message: 'Hey! What do you think about this generic workflow pattern?',
            timestamp: new Date().toISOString(),
          },
        },
        'agent_b_respond': {
          status: 'OK',
          content: {
            speaker: 'Bob',
            message: 'It\'s great! We can now run any spec/agent combo from the registry. Very flexible!',
            timestamp: new Date().toISOString(),
          },
        },
        'agent_a_reply': {
          status: 'OK',
          content: {
            speaker: 'Alice',
            message: 'Exactly! And with configurable sleep, we can control pacing too.',
            timestamp: new Date().toISOString(),
          },
        },
        'agent_b_conclude': {
          status: 'OK',
          content: {
            speaker: 'Bob',
            message: 'Plus Temporal handles all the durability and retries. Perfect!',
            timestamp: new Date().toISOString(),
          },
        },
      },
    },
  };

  console.log(`   Goal ID: ${conversationConfig.goalId}`);
  console.log(`   Spec: ${conversationConfig.specName}`);
  console.log(`   Agent: ${conversationConfig.agentName}`);
  console.log(`   Sleep: ${conversationConfig.sleepDurationSeconds}s between steps\n`);

  const conversationWorkflowId = `generic-conversation-${Date.now()}`;
  const conversationHandle = await client.workflow.start('genericWorkflow', {
    taskQueue: 'agent-coordinator-queue',
    workflowId: conversationWorkflowId,
    args: [conversationConfig],
  });

  console.log('   🚀 Workflow started!\n');
  console.log('   Watching conversation unfold (5s between messages)...\n');

  const conversationStartTime = Date.now();
  const conversationResult = await conversationHandle.result();
  const conversationElapsed = Date.now() - conversationStartTime;

  console.log('   ✅ Conversation workflow complete!');
  console.log(`   Status: ${conversationResult.status}`);
  console.log(`   Time: ${(conversationElapsed / 1000).toFixed(1)}s`);
  console.log(`   Steps: ${Object.keys(conversationResult.openSteps).length}\n`);

  if (conversationResult.artifacts.messages) {
    const messages = conversationResult.artifacts.messages as Array<{
      speaker: string;
      message: string;
      timestamp: string;
    }>;

    console.log('   📝 Conversation:\n');
    messages.forEach((msg, i) => {
      console.log(`   ${i + 1}. ${msg.speaker}:`);
      console.log(`      "${msg.message}"\n`);
    });
  }

  // Summary
  console.log('══════════════════════════════════════════════════════════');
  console.log('✨ Demo Complete!\n');

  console.log('📊 Summary:');
  console.log(`   Demo 1 (hello + mock): ${(helloElapsed / 1000).toFixed(1)}s`);
  console.log(`   Demo 2 (conversation + mock): ${(conversationElapsed / 1000).toFixed(1)}s (with 5s sleeps)\n`);

  console.log('🎯 Key Features Demonstrated:');
  console.log('   ✓ Dynamic spec selection from registry');
  console.log('   ✓ Dynamic agent selection from registry');
  console.log('   ✓ Configurable sleep between steps');
  console.log('   ✓ Multiple specs running through same workflow');
  console.log('   ✓ Temporal durability for all workflows');
  console.log('   ✓ Integration with workflow-runner architecture\n');

  console.log('🔍 View workflows in Temporal Web UI:');
  console.log(`   http://localhost:8233/namespaces/default/workflows/${helloWorkflowId}`);
  console.log(`   http://localhost:8233/namespaces/default/workflows/${conversationWorkflowId}\n`);

  console.log('📚 Available Specs in Registry:');
  console.log('   - hello: Simple hello world spec');
  console.log('   - conversation: Multi-step conversation spec\n');

  console.log('🤖 Available Agents in Registry:');
  console.log('   - mock: Mock agent for testing');
  console.log('   - anthropic: Real Claude API integration\n');

  console.log('💡 Next Steps:');
  console.log('   - Add more specs to the registry');
  console.log('   - Test with anthropic agent (requires API key)');
  console.log('   - Create custom specs for your use cases');
  console.log('   - Experiment with different sleep durations\n');

  console.log('👋 Done!\n');
}

main().catch((error) => {
  console.error('❌ Demo failed:', error);
  process.exit(1);
});
