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
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

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
  console.log('   Activities: Loaded from activities module');
  console.log('\n   📋 Registered Activities:');
  console.log('   ', Object.keys(activities).sort().join(', '));

  // Create worker
  const worker = await Worker.create({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || 'default',
    taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'agent-coordinator-queue',
    workflowsPath,
    activities,
    // Worker options
    maxConcurrentActivityTaskExecutions: 10,
    maxConcurrentWorkflowTaskExecutions: 10,
  });

  console.log('\n🚀 Worker is ready!');
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
