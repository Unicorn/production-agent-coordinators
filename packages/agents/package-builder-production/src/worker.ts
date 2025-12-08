/**
 * Temporal Worker for Package Builder Workflows
 *
 * This worker runs TWO task queues simultaneously:
 * 1. 'engine' queue - Executes PackageBuilderWorkflow (parent coordinator)
 * 2. 'turn-based-coding' queue - Legacy queue (kept for backward compatibility)
 *    - CLI agents now handle code generation directly in PackageBuildWorkflow
 *    - No longer uses separate child workflows for code generation
 *
 * Note: CLI agents (Gemini/Claude) handle rate limiting internally.
 * The turn-based-coding queue may be removed in a future version.
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

  // If TEMPORAL_TASK_QUEUE is set, only run a single worker on that queue
  // This is for backward compatibility and manual testing
  const taskQueue = process.env.TEMPORAL_TASK_QUEUE;

  if (taskQueue) {
    const worker = await Worker.create({
      taskQueue,
      workflowsPath: path.join(__dirname, 'workflows'),
      activities,
      // Limit concurrent executions to prevent resource exhaustion
      maxConcurrentActivityTaskExecutions: maxConcurrentActivities,
      maxConcurrentWorkflowTaskExecutions: maxConcurrentWorkflowTasks,
    });

    console.log('🔨 Package Builder Worker started (single queue mode)');
    console.log(`   Task Queue: ${taskQueue}`);
    console.log(`   Namespace: ${process.env.TEMPORAL_NAMESPACE || 'default'}`);
    console.log(`   Max Concurrent Activities: ${maxConcurrentActivities}`);
    console.log(`   Max Concurrent Workflow Tasks: ${maxConcurrentWorkflowTasks}`);
    console.log('   Ready to execute workflow tasks\n');

    await worker.run();
    return;
  }

  // Default: Run TWO workers for both queues
  console.log('🔨 Package Builder Workers starting (multi-queue mode)...\n');

  // Worker 1: 'engine' queue (parent coordinator workflows)
  const engineWorker = await Worker.create({
    taskQueue: 'engine',
    workflowsPath: path.join(__dirname, 'workflows'),
    activities,
    maxConcurrentActivityTaskExecutions: maxConcurrentActivities,
    maxConcurrentWorkflowTaskExecutions: maxConcurrentWorkflowTasks,
  });

  console.log('✅ Engine Worker ready');
  console.log(`   Task Queue: engine`);
  console.log(`   Max Concurrent Activities: ${maxConcurrentActivities}`);
  console.log(`   Max Concurrent Workflow Tasks: ${maxConcurrentWorkflowTasks}`);

<<<<<<< HEAD
  // Worker 2: 'turn-based-coding' queue (Legacy - kept for backward compatibility)
  // NOTE: CLI agents now handle code generation directly in PackageBuildWorkflow
  // This queue is maintained for backward compatibility but may be removed in future
=======
  // Worker 2: 'turn-based-coding' queue (Claude API child workflows)
  // CRITICAL: Both limits set to 1 to prevent Claude API rate limiting
  //   - maxConcurrentWorkflowTaskExecutions: 1 limits workflow task concurrency
  //   - maxConcurrentActivityTaskExecutions: 1 limits Claude API call concurrency (THE KEY!)
  // maxCachedWorkflows: 0 prevents runtime conflicts when running multiple workers in same process
>>>>>>> 9a45c12 (chore: commit worktree changes from Cursor IDE)
  const turnBasedWorker = await Worker.create({
    taskQueue: 'turn-based-coding',
    workflowsPath: path.join(__dirname, 'workflows'),
    activities,
<<<<<<< HEAD
    maxConcurrentActivityTaskExecutions: 1,
    maxConcurrentWorkflowTaskExecutions: 1,
    maxCachedWorkflows: 0,
=======
    maxConcurrentActivityTaskExecutions: 1, // ← Only 1 concurrent Claude API call
    maxConcurrentWorkflowTaskExecutions: 1, // ← Only 1 concurrent workflow task
    maxCachedWorkflows: 0, // ← Disable caching to avoid runtime conflicts
>>>>>>> 9a45c12 (chore: commit worktree changes from Cursor IDE)
  });

  console.log('✅ Turn-Based Coding Worker ready (legacy queue)');
  console.log(`   Task Queue: turn-based-coding`);
<<<<<<< HEAD
  console.log(`   Note: CLI agents now handle code generation in PackageBuildWorkflow`);
=======
  console.log(`   Max Concurrent Activities: 1 (Claude API rate limit control)`);
  console.log(`   Max Concurrent Workflow Tasks: 1`);
>>>>>>> 9a45c12 (chore: commit worktree changes from Cursor IDE)

  console.log(`\n   Namespace: ${process.env.TEMPORAL_NAMESPACE || 'default'}`);
  console.log('   Ready to execute all workflow types\n');

  // Run both workers concurrently
  await Promise.all([
    engineWorker.run(),
    turnBasedWorker.run()
  ]);
}

run().catch((err) => {
  console.error('Worker failed:', err);
  process.exit(1);
});
