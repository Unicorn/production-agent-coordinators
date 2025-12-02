#!/usr/bin/env node
/**
 * Temporal Worker for Agent Coordinator
 *
 * This worker connects to Temporal server and executes workflows and activities.
 * It should run as a separate process from the client.
 *
 * Usage:
 *   node dist/worker.js
 *   tsx src/worker.ts
 */

import { Worker, NativeConnection } from '@temporalio/worker';
import * as activities from './activities.js';
import * as claudeActivities from './claude-activities.js';
// Import shared activities from package-builder-production
import * as credentialActivities from '../../agents/package-builder-production/src/activities/credentials.activities.js';
import * as gitActivities from '../../agents/package-builder-production/src/activities/git.activities.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Merge all activities into a single object
const allActivities = {
  ...activities,
  ...claudeActivities,
  ...credentialActivities,
  ...gitActivities,
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function run() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Temporal Worker - Agent Coordinator                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Connect to Temporal server
  const temporalAddress = process.env.TEMPORAL_ADDRESS || 'localhost:7233';
  console.log('🔌 Connecting to Temporal server...');
  const connection = await NativeConnection.connect({
    address: temporalAddress,
  });
  console.log('   ✅ Connected to Temporal at:', temporalAddress);

  // Determine workflow bundle path
  // In development: src/workflows.ts
  // In production: dist/workflows.js
  const isBuilt = __filename.endsWith('.js');
  const workflowsPath = isBuilt
    ? join(__dirname, 'workflows.js')
    : join(__dirname, 'workflows.ts');

  console.log('\n📦 Creating worker...');
  console.log('   Task Queue:', process.env.TEMPORAL_TASK_QUEUE || 'agent-coordinator-queue');
  console.log('   Workflows:', workflowsPath);
  console.log('   Activities: Loaded from activities + claude-activities modules');
  console.log('\n   📋 Registered Activities:');
  console.log('   ', Object.keys(allActivities).sort().join(', '));

  // Worker concurrency limits (configurable via environment variables)
  const maxConcurrentActivities = parseInt(
    process.env.MAX_CONCURRENT_ACTIVITY_EXECUTIONS || '10',
    10
  );
  const maxConcurrentWorkflowTasks = parseInt(
    process.env.MAX_CONCURRENT_WORKFLOW_EXECUTIONS || '10',
    10
  );

  // Create worker
  const worker = await Worker.create({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || 'default',
    taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'agent-coordinator-queue',
    workflowsPath,
    activities: allActivities,
    // Worker options
    maxConcurrentActivityTaskExecutions: maxConcurrentActivities,
    maxConcurrentWorkflowTaskExecutions: maxConcurrentWorkflowTasks,
  });

  console.log('\n🚀 Worker is ready!');
  console.log(`   Max Concurrent Activities: ${maxConcurrentActivities}`);
  console.log(`   Max Concurrent Workflow Tasks: ${maxConcurrentWorkflowTasks}`);
  console.log('   Waiting for workflows...\n');
  console.log('   Press Ctrl+C to shutdown\n');

  // Run worker
  await worker.run();

  console.log('\n👋 Worker shutdown complete');
}

run().catch((err) => {
  console.error('❌ Worker failed:', err);
  process.exit(1);
});
