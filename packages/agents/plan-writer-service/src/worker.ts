#!/usr/bin/env node
/**
 * Temporal Worker for Plan Writer Service
 *
 * This worker connects to Temporal server and executes plan writer workflows.
 *
 * Usage:
 *   npm run worker
 *   tsx src/worker.ts
 */

import 'dotenv/config';
import { Worker, NativeConnection } from '@temporalio/worker';
import * as planActivities from './activities/plan.activities.js';
import * as mcpActivities from './activities/mcp.activities.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function run() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Temporal Worker - Plan Writer Service                   ║');
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
  console.log('   Task Queue: plan-writer-service');
  console.log('   Workflows:', workflowsPath);
  console.log('   Activities: Plan + MCP activities');

  // Create worker
  const worker = await Worker.create({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || 'default',
    taskQueue: 'plan-writer-service',
    workflowsPath,
    activities: {
      ...planActivities,
      ...mcpActivities,
    },
    // Worker options
    maxConcurrentActivityTaskExecutions: 10,
    maxConcurrentWorkflowTaskExecutions: 10,
  });

  console.log('\n🚀 Worker is ready!');
  console.log('   Waiting for workflows...\n');
  console.log('   📊 Temporal UI: http://localhost:8233');
  console.log('   Press Ctrl+C to shutdown\n');

  // Run worker
  await worker.run();

  console.log('\n👋 Worker shutdown complete');
}

run().catch((err) => {
  console.error('❌ Worker failed:', err);
  process.exit(1);
});
