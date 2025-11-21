import { Worker } from '@temporalio/worker';
import * as activities from '../activities';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const worker = await Worker.create({
    workflowsPath: join(__dirname, '../workflows'),
    activities,
    taskQueue: 'dev-workflow',
    maxConcurrentActivityExecutions: 4,
    maxConcurrentWorkflowTaskExecutions: 10
  });

  console.log('Dev workflow worker started');
  console.log('Task queue: dev-workflow');
  console.log('Temporal address:', process.env.TEMPORAL_ADDRESS || 'localhost:7233');

  await worker.run();
}

main().catch(err => {
  console.error('Worker failed:', err);
  process.exit(1);
});
