#!/usr/bin/env tsx
/**
 * Test script to manually trigger the MCP poller workflow
 *
 * This allows us to test the orchestrator without waiting 30 minutes
 */

import { config as loadDotenv } from 'dotenv';
import { Connection, Client } from '@temporalio/client';

// Load environment variables
loadDotenv();

async function main() {
  console.log('🧪 Testing Package Queue Orchestrator\n');

  // Connect to Temporal
  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
  });

  const client = new Client({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || 'default',
  });

  console.log('✅ Connected to Temporal');

  // Manually execute the MCP poller workflow
  console.log('\n📡 Triggering MCP poller workflow...');

  try {
    const result = await client.workflow.execute('MCPPollerWorkflow', {
      workflowId: `mcp-poller-manual-${Date.now()}`,
      taskQueue: 'engine',
      args: [],
    });

    console.log('✅ Poller executed successfully');
    console.log('Result:', result);
  } catch (error) {
    console.error('❌ Poller failed:', error);
  }

  // Query the orchestrator state
  console.log('\n🔍 Querying orchestrator state...');

  try {
    const handle = client.workflow.getHandle('continuous-builder-orchestrator');
    const state = await handle.query('getState');

    console.log('\n📊 Orchestrator State:');
    console.log('  Internal Queue:', state.internalQueue);
    console.log('  Active Builds:', state.activeBuilds.size);
    console.log('  Failed Retries:', Object.fromEntries(state.failedRetries));
    console.log('  Is Paused:', state.isPaused);
    console.log('  Is Draining:', state.isDraining);
    console.log('  Max Concurrent:', state.maxConcurrent);
  } catch (error) {
    console.error('❌ Query failed:', error);
  }

  console.log('\n✅ Test complete!');
  console.log('\n💡 You can also:');
  console.log('  - Check Temporal UI: http://localhost:8080');
  console.log('  - View worker logs in the terminal');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
