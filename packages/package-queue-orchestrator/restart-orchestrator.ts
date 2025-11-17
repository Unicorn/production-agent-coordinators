#!/usr/bin/env tsx
import { config as loadDotenv } from 'dotenv';
import { Connection, Client } from '@temporalio/client';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..', '..', '..');
loadDotenv({ path: join(projectRoot, '.env') });

async function main() {
  console.log('🔄 Restarting Orchestrator Workflow\n');

  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
  });

  const client = new Client({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || 'default',
  });

  const orchestratorWorkflowId = 'continuous-builder-orchestrator';

  try {
    console.log(`🛑 Terminating existing orchestrator: ${orchestratorWorkflowId}...`);
    const handle = client.workflow.getHandle(orchestratorWorkflowId);
    await handle.terminate('Restarting with updated activities');
    console.log('✅ Terminated');
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      console.log('ℹ️  No existing orchestrator found (OK)');
    } else {
      console.log(`⚠️  Termination error (may be OK):`, error.message);
    }
  }

  console.log(`\n🚀 Starting fresh orchestrator workflow...`);
  const handle = await client.workflow.start('ContinuousBuilderWorkflow', {
    workflowId: orchestratorWorkflowId,
    taskQueue: 'engine',
    args: [{ maxConcurrentBuilds: 4 }],
  });

  console.log(`✅ Orchestrator started: ${handle.workflowId}`);
  console.log('\n🔄 Complete! Worker will now process workflows with all activities.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
