#!/usr/bin/env node
/**
 * Temporal Worker for Package Queue Orchestrator
 *
 * This worker connects to Temporal server and executes workflows and activities.
 * On startup, it ensures exactly one orchestrator instance is running.
 *
 * Usage:
 *   node dist/worker.js
 *   tsx src/worker.ts
 */

import { Worker, NativeConnection } from '@temporalio/worker';
import { WorkflowClient, WorkflowNotFoundError } from '@temporalio/client';
import * as activities from './activities/index.js';
import { ContinuousBuilderWorkflow } from './workflows/continuous-builder.workflow.js';
import type { OrchestratorInput } from './types/index.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ORCHESTRATOR_WORKFLOW_ID = 'continuous-builder-orchestrator';

/**
 * ensureOrchestratorRunning
 *
 * Ensures exactly one orchestrator instance is running.
 * If already running, does nothing. If not running, starts it.
 *
 * @param client - Temporal workflow client
 * @param input - Configuration for the orchestrator
 */
export async function ensureOrchestratorRunning(
  client: WorkflowClient,
  input: OrchestratorInput
): Promise<void> {
  try {
    // Check if already running
    const handle = client.getHandle(ORCHESTRATOR_WORKFLOW_ID);
    const description = await handle.describe();

    // If workflow exists but is not running, start a new one
    if (description.status.name !== 'RUNNING') {
      await client.start(ContinuousBuilderWorkflow, {
        workflowId: ORCHESTRATOR_WORKFLOW_ID,
        taskQueue: 'engine',
        args: [input],
      });
      console.log('   ✅ Orchestrator started');
    } else {
      console.log('   ✅ Orchestrator already running');
    }
  } catch (err) {
    if (err instanceof WorkflowNotFoundError) {
      // Not running, start it
      await client.start(ContinuousBuilderWorkflow, {
        workflowId: ORCHESTRATOR_WORKFLOW_ID,
        taskQueue: 'engine',
        args: [input],
      });
      console.log('   ✅ Orchestrator started');
    } else {
      // Unexpected error
      throw err;
    }
  }
}

/**
 * run
 *
 * Main entry point for the worker.
 * Connects to Temporal, ensures orchestrator is running, and starts the worker.
 */
export async function run(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Temporal Worker - Package Queue Orchestrator            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Connect to Temporal server
  const temporalAddress = process.env.TEMPORAL_ADDRESS || 'localhost:7233';
  console.log('🔌 Connecting to Temporal server...');
  const connection = await NativeConnection.connect({
    address: temporalAddress,
  });
  console.log('   ✅ Connected to Temporal at:', temporalAddress);

  // Create workflow client
  const client = new WorkflowClient({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || 'default',
  });

  // Ensure orchestrator is running
  console.log('\n🎭 Checking orchestrator status...');
  const workspaceRoot = process.env.WORKSPACE_ROOT || process.cwd();
  const registry = process.env.NPM_REGISTRY || 'https://registry.npmjs.org';
  const maxConcurrent = parseInt(process.env.MAX_CONCURRENT_BUILDS || '4', 10);

  const orchestratorInput: OrchestratorInput = {
    maxConcurrent,
    workspaceRoot,
    config: {
      registry,
    },
  };

  await ensureOrchestratorRunning(client, orchestratorInput);

  // Determine workflow bundle path
  // In development: src/workflows/index.ts
  // In production: dist/workflows/index.js
  const isBuilt = __filename.endsWith('.js');
  const workflowsPath = isBuilt
    ? join(__dirname, 'workflows', 'index.js')
    : join(__dirname, 'workflows', 'index.ts');

  console.log('\n📦 Creating worker...');
  console.log('   Task Queue:', 'engine');
  console.log('   Workflows:', workflowsPath);
  console.log('   Activities: Loaded from activities module');
  console.log('   Max Concurrent Builds:', maxConcurrent);

  // Create worker
  const worker = await Worker.create({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || 'default',
    taskQueue: 'engine',
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

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((err) => {
    console.error('❌ Worker failed:', err);
    process.exit(1);
  });
}
