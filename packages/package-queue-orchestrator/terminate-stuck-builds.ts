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
  console.log('🔍 Finding and terminating stuck PackageBuildWorkflow instances\n');

  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
  });

  const client = new Client({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || 'default',
  });

  // List of package names that might have stuck builds
  const packageNames = [
    '@bernierllc/openai-client',
    '@bernierllc/anthropic-client',
    '@bernierllc/supabase-client',
    '@bernierllc/content-workflow-service'
  ];

  let terminated = 0;

  for (const packageName of packageNames) {
    const workflowId = `build-${packageName}`;

    try {
      const handle = client.workflow.getHandle(workflowId);
      const description = await handle.describe();

      if (description.status.name === 'RUNNING') {
        console.log(`🛑 Terminating ${workflowId}...`);
        await handle.terminate('Restarting with updated workflow code');
        console.log(`   ✅ Terminated`);
        terminated++;
      } else {
        console.log(`   ℹ️  ${workflowId} is ${description.status.name} (skipping)`);
      }
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        console.log(`   ℹ️  ${workflowId} not found (OK)`);
      } else {
        console.log(`   ⚠️  Error checking ${workflowId}:`, error.message);
      }
    }
  }

  console.log(`\n✅ Terminated ${terminated} stuck workflows`);
  console.log('🔄 Worker will now process workflows with updated code');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
