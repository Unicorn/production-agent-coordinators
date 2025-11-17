/**
 * Temporal Worker for Package Builder Workflows
 *
 * This worker executes PackageBuildWorkflow tasks from the Temporal server.
 *
 * Start with: yarn workspace @coordinator/agent-package-builder-production start:worker
 */

import { Worker } from '@temporalio/worker';
import { fileURLToPath } from 'url';
import * as path from 'path';
import * as activities from './activities/build.activities.js';
import * as agentActivities from './activities/agent.activities.js';
import * as reportActivities from './activities/report.activities.js';
import * as agentRegistryActivities from './activities/agent-registry.activities.js';

async function run() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const worker = await Worker.create({
    taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'engine',
    workflowsPath: path.join(__dirname, 'workflows'),
    activities: {
      ...activities,
      ...agentActivities,
      ...reportActivities,
      ...agentRegistryActivities
    },
  });

  console.log('🔨 Package Builder Worker started');
  console.log(`   Task Queue: ${process.env.TEMPORAL_TASK_QUEUE || 'engine'}`);
  console.log(`   Namespace: ${process.env.TEMPORAL_NAMESPACE || 'default'}`);
  console.log('   Ready to execute PackageBuildWorkflow tasks\n');

  await worker.run();
}

run().catch((err) => {
  console.error('Worker failed:', err);
  process.exit(1);
});
