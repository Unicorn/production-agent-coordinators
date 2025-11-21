/**
 * Temporal Worker for Package Builder Workflows
 *
 * This worker executes PackageBuildWorkflow tasks from the Temporal server.
 *
 * Start with: yarn workspace @coordinator/agent-package-builder-production start:worker
 */

import { config } from 'dotenv';
import { Worker } from '@temporalio/worker';
import { fileURLToPath } from 'url';
import * as path from 'path';

// Get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file (relative to worker.ts location)
config({ path: path.join(__dirname, '..', '..', '..', '..', '.env') });

// Import all activities from centralized barrel file
import * as activities from './activities/index.js';

async function run() {
  // Worker concurrency limits (configurable via environment variables)
  const maxConcurrentActivities = parseInt(
    process.env.MAX_CONCURRENT_ACTIVITY_EXECUTIONS || '5',
    10
  );
  const maxConcurrentWorkflowTasks = parseInt(
    process.env.MAX_CONCURRENT_WORKFLOW_EXECUTIONS || '10',
    10
  );

  const worker = await Worker.create({
    taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'engine',
    workflowsPath: path.join(__dirname, 'workflows'),
    activities,
    // Limit concurrent executions to prevent resource exhaustion
    maxConcurrentActivityTaskExecutions: maxConcurrentActivities,
    maxConcurrentWorkflowTaskExecutions: maxConcurrentWorkflowTasks,
  });

  console.log('🔨 Package Builder Worker started');
  console.log(`   Task Queue: ${process.env.TEMPORAL_TASK_QUEUE || 'engine'}`);
  console.log(`   Namespace: ${process.env.TEMPORAL_NAMESPACE || 'default'}`);
  console.log(`   Max Concurrent Activities: ${maxConcurrentActivities}`);
  console.log(`   Max Concurrent Workflow Tasks: ${maxConcurrentWorkflowTasks}`);
  console.log('   Ready to execute PackageBuildWorkflow tasks\n');

  await worker.run();
}

run().catch((err) => {
  console.error('Worker failed:', err);
  process.exit(1);
});
