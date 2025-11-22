import { App } from '@slack/bolt';
import { Client } from '@temporalio/client';
import { createDevWorkflowSlackConfig } from './slack-config';
import { handleDevWorkflowCommand } from './command-handler';
import { getTemporalClient } from '../temporal/connection';

/**
 * Start Slack bot server
 *
 * Handles:
 * - /dev-workflow slash commands
 * - Thread messages for conversational Q&A
 * - Interactive buttons (stop/pause)
 */
export async function startSlackBot() {
  console.log('🚀 Starting Slack bot server...');

  // Validate and load configuration
  const config = await createDevWorkflowSlackConfig();
  console.log('✅ Slack configuration validated');

  // Create Slack Bolt app
  const app = new App({
    token: config.slack.botToken,
    signingSecret: config.slack.signingSecret,
    appToken: config.slack.appToken,
    socketMode: config.connection.socketMode || false
  });

  console.log(`📡 Mode: ${config.connection.socketMode ? 'Socket Mode' : 'HTTP Mode'}`);

  // Handle /dev-workflow command
  app.command('/dev-workflow', async ({ command, ack, respond }) => {
    console.log(`📥 Received /dev-workflow command from ${command.user_id}: "${command.text}"`);

    // Acknowledge command immediately (required within 3 seconds)
    await ack();

    // Process command
    const result = await handleDevWorkflowCommand(command as any);

    if (result.success) {
      console.log(`✅ Started workflow: ${result.workflowId}`);
      await respond({
        text: `🚀 Starting development workflow...\n\nI'll gather requirements and create a plan. This conversation will continue in this thread.`,
        response_type: 'in_channel'
      });
    } else {
      console.error(`❌ Command failed: ${result.error}`);
      await respond({
        text: `❌ Error: ${result.error}`,
        response_type: 'ephemeral'
      });
    }
  });

  // Handle messages in threads (for conversational responses)
  // Phase 2: Logs messages for Phase 3 signal implementation
  app.message(async ({ message }) => {
    // Only respond to thread messages
    if ('thread_ts' in message && message.thread_ts) {
      console.log('📨 Thread message received:', {
        user: message.user,
        text: message.text,
        thread_ts: message.thread_ts
      });

      // TODO Phase 3: Send message to workflow via signal
      // const workflowId = getWorkflowIdFromThreadTs(message.thread_ts);
      // await sendUserResponseSignal(workflowId, message.text);
    }
  });

  // Handle interactive button clicks - Stop workflow
  app.action('stop_workflow', async ({ ack, body, client }) => {
    await ack();
    console.log('⏹️ Stop workflow button clicked');

    // Extract workflow ID from metadata
    const workflowId = (body as any).message?.metadata?.workflow_id;

    if (!workflowId) {
      console.error('❌ No workflow ID in message metadata');
      return;
    }

    try {
      // Get Temporal client
      const temporalClient = await getTemporalClient();
      const handle = temporalClient.workflow.getHandle(workflowId);

      // Send stop signal to workflow
      await handle.signal('stopWorkflow', {
        reason: 'stop',
        message: 'User requested stop via Slack',
        timestamp: new Date().toISOString()
      });

      console.log(`✅ Stop signal sent to workflow: ${workflowId}`);

      // Update message
      await client.chat.update({
        channel: (body as any).channel.id,
        ts: (body as any).message.ts,
        text: '⏸️ Workflow stopped by user',
        blocks: []
      });
    } catch (error) {
      console.error('❌ Failed to stop workflow:', error);
    }
  });

  // Handle interactive button clicks - Pause workflow
  app.action('pause_workflow', async ({ ack, body, client }) => {
    await ack();
    console.log('⏸️ Pause workflow button clicked');

    const workflowId = (body as any).message?.metadata?.workflow_id;

    if (!workflowId) {
      console.error('❌ No workflow ID in message metadata');
      return;
    }

    try {
      // Get Temporal client
      const temporalClient = await getTemporalClient();
      const handle = temporalClient.workflow.getHandle(workflowId);

      // Send pause signal
      await handle.signal('stopWorkflow', {
        reason: 'pause',
        message: 'User requested pause via Slack',
        timestamp: new Date().toISOString()
      });

      console.log(`✅ Pause signal sent to workflow: ${workflowId}`);

      await client.chat.update({
        channel: (body as any).channel.id,
        ts: (body as any).message.ts,
        text: '⏸️ Workflow paused by user',
        blocks: []
      });
    } catch (error) {
      console.error('❌ Failed to pause workflow:', error);
    }
  });

  // Start the app
  const port = parseInt(process.env.SLACK_PORT || '3000', 10);

  try {
    if (config.connection.socketMode) {
      await app.start();
      console.log('⚡️ Slack bot is running (Socket Mode)');
      console.log('✨ Ready to handle /dev-workflow commands');
    } else {
      await app.start(port);
      console.log(`⚡️ Slack bot is running on port ${port} (HTTP Mode)`);
      console.log('✨ Ready to handle /dev-workflow commands');
    }
  } catch (error) {
    console.error('❌ Failed to start Slack bot:', error);
    throw error;
  }

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down Slack bot...');
    await app.stop();
    console.log('👋 Slack bot stopped');
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down Slack bot...');
    await app.stop();
    console.log('👋 Slack bot stopped');
    process.exit(0);
  });
}

// Run if called directly
if (require.main === module) {
  startSlackBot().catch((error) => {
    console.error('💥 Fatal error starting Slack bot:', error);
    process.exit(1);
  });
}
