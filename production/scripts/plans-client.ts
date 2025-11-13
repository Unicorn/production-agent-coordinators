#!/usr/bin/env node
/**
 * Temporal Client for Plans Workflow Singleton
 *
 * Starts the long-running Plans Workflow that processes plan generation requests.
 * This workflow runs indefinitely and handles signals from build workflows.
 *
 * Usage:
 *   npx tsx production/scripts/plans-client.ts
 */

import { Connection, Client } from '@temporalio/client';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load configuration from config.json
const configPath = join(__dirname, '..', '..', 'packages', 'agents', 'suite-builder-production', 'config.json');
const defaultConfig = JSON.parse(readFileSync(configPath, 'utf-8'));

async function run() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Plans Workflow Singleton - Workflow Client             ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Connect to Temporal server
  const temporalAddress = process.env.TEMPORAL_ADDRESS || defaultConfig.temporal.address;
  console.log('🔌 Connecting to Temporal server...');
  const connection = await Connection.connect({ address: temporalAddress });
  console.log(`   ✅ Connected to Temporal at: ${temporalAddress}\n`);

  // Create client
  const client = new Client({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || defaultConfig.temporal.namespace,
  });

  // Fixed workflow ID for singleton
  const workflowId = 'plans-workflow-singleton';

  console.log('🔍 Checking for existing Plans Workflow...');
  console.log(`   Workflow ID: ${workflowId}\n`);

  let handle;
  let isExisting = false;

  try {
    // Try to get handle to existing workflow
    const existingHandle = client.workflow.getHandle(workflowId);

    // Check if workflow is still running
    const description = await existingHandle.describe();

    if (description.status.name === 'RUNNING') {
      console.log('✅ Plans Workflow is already running!');
      console.log(`   Run ID: ${description.runId}`);
      console.log(`   Started: ${description.startTime}`);
      console.log('\n💡 The singleton is already processing plan requests.');
      console.log('   No need to start a new instance.\n');
      handle = existingHandle;
      isExisting = true;
    } else if (description.status.name === 'COMPLETED' || description.status.name === 'FAILED' || description.status.name === 'TERMINATED') {
      console.log(`⚠️  Found ${description.status.name.toLowerCase()} workflow`);
      console.log(`   Previous Run ID: ${description.runId}`);
      console.log('\n🔄 Starting new Plans Workflow singleton...\n');
      isExisting = false;
    }
  } catch (err: any) {
    // Workflow doesn't exist, create new one
    if (err.message?.includes('NOT_FOUND') || err.message?.includes('not found')) {
      console.log('📝 No existing workflow found - creating new singleton\n');
      isExisting = false;
    } else {
      throw err;
    }
  }

  // Start new workflow if needed
  if (!isExisting) {
    console.log('🚀 Starting Plans Workflow Singleton...');
    console.log(`   Workflow ID: ${workflowId}`);
    console.log(`   Task Queue: suite-builder`);
    console.log(`   Mode: Long-running singleton\n`);

    handle = await client.workflow.start('PlansWorkflow', {
      taskQueue: 'suite-builder',
      args: [],
      workflowId,
      // Long-running workflow configuration
      workflowExecutionTimeout: '0s', // No timeout - runs indefinitely
    });

    console.log(`✅ Plans Workflow started!`);
    console.log(`   Workflow ID: ${handle.workflowId}`);
    console.log(`   Run ID: ${handle.firstExecutionRunId}\n`);
  }

  console.log(`📊 View in Temporal UI: http://localhost:8233/namespaces/default/workflows/${workflowId}\n`);

  console.log('✨ Plans Workflow is now listening for signals from build workflows.');
  console.log('   This workflow runs indefinitely and processes plan generation requests.\n');
  console.log('💡 Build workflows can signal this workflow to request plan generation.');
  console.log('   The Plans Workflow will queue and process requests with priority.\n');

  // Don't wait for result - this workflow runs indefinitely
  console.log('🎉 Setup complete! Plans Workflow is running in the background.\n');
}

run().catch((err) => {
  console.error('❌ Client error:', err);
  process.exit(1);
});
