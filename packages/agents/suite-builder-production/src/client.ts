#!/usr/bin/env node
/**
 * Temporal Client for Suite Builder Production
 *
 * Triggers the SuiteBuilderWorkflow to build a package
 *
 * Usage:
 *   npx tsx src/client.ts <packageName>
 *   npx tsx src/client.ts openai-client
 */

import { Connection, Client } from '@temporalio/client';
import type { PackageWorkflowInput } from './types/index.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load configuration from config.json
const configPath = join(__dirname, '..', 'config.json');
const defaultConfig = JSON.parse(readFileSync(configPath, 'utf-8'));

async function run() {
  const packageName = process.argv[2];

  if (!packageName) {
    console.error('❌ Error: Package name is required');
    console.error('\nUsage: npx tsx src/client.ts <packageName>');
    console.error('Example: npx tsx src/client.ts openai-client');
    process.exit(1);
  }

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Suite Builder Production - Workflow Client             ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Connect to Temporal server
  // Environment variables override config file values
  const temporalAddress = process.env.TEMPORAL_ADDRESS || defaultConfig.temporal.address;
  console.log('🔌 Connecting to Temporal server...');
  const connection = await Connection.connect({ address: temporalAddress });
  console.log(`   ✅ Connected to Temporal at: ${temporalAddress}\n`);

  // Create client
  const client = new Client({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || defaultConfig.temporal.namespace,
  });

  // Prepare workflow input
  // Environment variables override config file values
  // Secrets (like NPM_TOKEN) only come from environment variables
  const input: PackageWorkflowInput = {
    packageName,
    config: {
      workspaceRoot: process.env.WORKSPACE_ROOT || defaultConfig.workspaceRoot,
      npmRegistry: process.env.NPM_REGISTRY || defaultConfig.npmRegistry,
      npmToken: process.env.NPM_TOKEN || '',
      maxConcurrentBuilds: defaultConfig.build.maxConcurrentBuilds,
      mcpServer: {
        url: process.env.MCP_SERVER_URL || defaultConfig.mcpServer.url,
      },
      temporal: {
        address: temporalAddress,
        namespace: process.env.TEMPORAL_NAMESPACE || defaultConfig.temporal.namespace,
        taskQueue: defaultConfig.temporal.taskQueue,
      },
      testing: defaultConfig.testing,
      publishing: defaultConfig.publishing,
    },
  };

  // Use deterministic workflow ID (no timestamp) to enable workflow resume/restart
  const workflowId = `suite-builder-${packageName}`;

  console.log('🔍 Checking for existing workflow...');
  console.log(`   Workflow ID: ${workflowId}\n`);

  let handle;
  let isExisting = false;

  try {
    // Try to get handle to existing workflow
    const existingHandle = client.workflow.getHandle(workflowId);

    // Check if workflow is still running
    const description = await existingHandle.describe();

    if (description.status.name === 'RUNNING') {
      console.log('♻️  Found running workflow - attaching to it');
      console.log(`   Run ID: ${description.runId}`);
      console.log(`   Started: ${description.startTime}`);
      handle = existingHandle;
      isExisting = true;
    } else if (description.status.name === 'COMPLETED') {
      console.log('✅ Found completed workflow');
      console.log(`   Run ID: ${description.runId}`);
      console.log(`   Completed: ${description.closeTime}`);
      console.log('\n🔄 Starting new workflow run...\n');
      isExisting = false;
    } else if (description.status.name === 'FAILED' || description.status.name === 'TERMINATED') {
      console.log(`⚠️  Found ${description.status.name.toLowerCase()} workflow`);
      console.log(`   Previous Run ID: ${description.runId}`);
      console.log('\n🔄 Starting new workflow run...\n');
      isExisting = false;
    }
  } catch (err: any) {
    // Workflow doesn't exist, create new one
    if (err.message?.includes('NOT_FOUND') || err.message?.includes('not found')) {
      console.log('📝 No existing workflow found - creating new one\n');
      isExisting = false;
    } else {
      throw err;
    }
  }

  // Start new workflow if needed
  if (!isExisting) {
    console.log('🚀 Starting SuiteBuilderWorkflow...');
    console.log(`   Package: ${packageName}`);
    console.log(`   Workspace: ${input.config.workspaceRoot}`);
    console.log(`   Task Queue: suite-builder\n`);

    handle = await client.workflow.start('SuiteBuilderWorkflow', {
      taskQueue: 'suite-builder',
      args: [input],
      workflowId,
    });

    console.log(`✅ Workflow started!`);
    console.log(`   Workflow ID: ${handle.workflowId}`);
    console.log(`   Run ID: ${handle.firstExecutionRunId}`);
  }

  console.log(`\n📊 View in Temporal UI: http://localhost:8233/namespaces/default/workflows/${workflowId}\n`);

  console.log('⏳ Waiting for workflow to complete...\n');

  try {
    const result = await handle.result();
    console.log('✅ Workflow completed successfully!');
    console.log('\n📋 Result:');
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('❌ Workflow failed:', err);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('❌ Client error:', err);
  process.exit(1);
});
