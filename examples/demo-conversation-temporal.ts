#!/usr/bin/env tsx

/**
 * Multi-Step Conversation Demo with Temporal Sleep
 *
 * This demonstrates:
 * - Two agents having a conversation (4 messages)
 * - Temporal sleep (10 seconds between messages)
 * - Durable execution that survives restarts
 * - Multi-step workflow coordination
 *
 * Prerequisites:
 * - Temporal infrastructure running (yarn infra:up)
 * - Worker running (yarn workspace @coordinator/temporal-coordinator start:worker)
 *
 * Run with: npx tsx examples/demo-conversation-temporal.ts
 */

import { Connection, Client } from '@temporalio/client';
import type { ConversationWorkflowConfig } from '../packages/temporal-coordinator/src/workflows.js';

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Multi-Step Conversation Demo with Temporal Sleep        ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('🤖 Using MockAgent with pre-configured conversation');
  console.log('💤 10-second sleep between each message');
  console.log('📋 Topic: Favorite programming languages\n');

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

  // Configure workflow with pre-configured mock responses
  const goalId = `conversation-${Date.now()}`;
  const workflowId = `conversation-workflow-${Date.now()}`;

  const config: ConversationWorkflowConfig = {
    goalId,
    specType: 'conversation',
    agentType: 'mock-agent',
    agentConfig: {
      // Pre-configure responses for each work kind
      responseByWorkKind: {
        'agent_a_initiate': {
          status: 'OK',
          content: {
            speaker: 'Alice',
            message: "Hi Bob! I'm curious - what's your favorite programming language and why?",
            timestamp: new Date().toISOString(),
          },
        },
        'agent_b_respond': {
          status: 'OK',
          content: {
            speaker: 'Bob',
            message: "Hey Alice! I love TypeScript because of its type safety and excellent tooling. It makes large codebases much more maintainable. What about you?",
            timestamp: new Date().toISOString(),
          },
        },
        'agent_a_reply': {
          status: 'OK',
          content: {
            speaker: 'Alice',
            message: "Great choice! I'm a fan of Python for its simplicity and amazing data science ecosystem. The libraries like pandas and numpy are incredible. Have you tried Python much?",
            timestamp: new Date().toISOString(),
          },
        },
        'agent_b_conclude': {
          status: 'OK',
          content: {
            speaker: 'Bob',
            message: "I have! Python is fantastic for data science and scripting. I use it all the time for quick automation tasks. Nice chatting with you about this!",
            timestamp: new Date().toISOString(),
          },
        },
      },
    },
    sleepDurationSeconds: 10, // 10 seconds between messages
  };

  console.log('📋 Step 2: Configuring Workflow');
  console.log(`   Goal ID: ${goalId}`);
  console.log(`   Workflow ID: ${workflowId}`);
  console.log('   Spec Type: conversation');
  console.log('   Agent Type: mock-agent');
  console.log('   Sleep Duration: 10 seconds\n');

  // Start workflow
  console.log('📋 Step 3: Starting Conversation Workflow');
  console.log('   Task Queue: agent-coordinator-queue');

  const handle = await client.workflow.start('conversationWorkflow', {
    taskQueue: 'agent-coordinator-queue',
    workflowId,
    args: [config],
  });

  console.log('   ✅ Workflow started!\n');

  console.log('📋 Step 4: Watching Conversation Unfold');
  console.log('   (Each message will have a 10-second delay)\n');
  console.log('════════════════════════════════════════════════════════════\n');

  // Wait for completion
  const startTime = Date.now();
  const result = await handle.result();
  const elapsed = Date.now() - startTime;

  console.log('\n════════════════════════════════════════════════════════════');
  console.log('🎉 Conversation Complete!\n');

  console.log('📊 Final State:');
  console.log(`   Status: ${result.status}`);
  console.log(`   Goal ID: ${goalId}`);
  console.log(`   Total Time: ${(elapsed / 1000).toFixed(1)} seconds`);
  console.log(`   Total Steps: ${Object.keys(result.openSteps).length}\n`);

  console.log('   Steps executed:');
  Object.entries(result.openSteps).forEach(([stepId, step], idx) => {
    console.log(`   ${idx + 1}. ${stepId}`);
    console.log(`      Kind: ${step.kind}`);
    console.log(`      Status: ${step.status}`);
  });

  if (result.artifacts.messages) {
    const messages = result.artifacts.messages as Array<{
      speaker: string;
      message: string;
      timestamp: string;
    }>;

    console.log('\n📝 Full Conversation:\n');
    messages.forEach((msg, i) => {
      console.log(`${i + 1}. ${msg.speaker}:`);
      console.log(`   "${msg.message}"`);
      console.log(`   [${new Date(msg.timestamp).toLocaleTimeString()}]\n`);
    });
  }

  if (Object.keys(result.log).length > 0) {
    console.log('📋 Event Log:');
    result.log.forEach((event) => {
      const timestamp = new Date(event.at).toISOString();
      console.log(`   - [${timestamp}] ${event.event}`);
    });
  }

  console.log('\n✨ Demo complete! The conversation ran with Temporal durability.\n');

  console.log('   Key features demonstrated:');
  console.log('   ✓ Multi-step conversation coordination');
  console.log('   ✓ Temporal sleep (10 seconds between messages)');
  console.log('   ✓ Durable execution (survives restarts)');
  console.log('   ✓ ConversationSpec state machine');
  console.log('   ✓ MockAgent with pre-configured responses');
  console.log('   ✓ State persistence across steps\n');

  console.log('   🔍 View workflow in Temporal Web UI:');
  console.log(`   http://localhost:8233/namespaces/default/workflows/${workflowId}\n`);

  console.log('👋 Done!\n');
}

main().catch((error) => {
  console.error('❌ Demo failed:', error);
  process.exit(1);
});
