import { Worker } from '@temporalio/worker';
import * as discoveryActivities from '../../packages/agents/suite-builder-production/src/activities/discovery.activities';
import * as planningActivities from '../../packages/agents/suite-builder-production/src/activities/planning.activities';
import * as meceActivities from '../../packages/agents/suite-builder-production/src/activities/mece.activities';
import * as buildActivities from '../../packages/agents/suite-builder-production/src/activities/build.activities';
import * as qualityActivities from '../../packages/agents/suite-builder-production/src/activities/quality.activities';
import * as publishActivities from '../../packages/agents/suite-builder-production/src/activities/publish.activities';
import * as reportActivities from '../../packages/agents/suite-builder-production/src/activities/report.activities';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function run() {
  const worker = await Worker.create({
    // Point to TypeScript source - Temporal worker handles TS compilation
    workflowsPath: join(__dirname, '../../packages/agents/suite-builder-production/src/workflows'),
    activities: {
      ...discoveryActivities,
      ...planningActivities,
      ...meceActivities,
      ...buildActivities,
      ...qualityActivities,
      ...publishActivities,
      ...reportActivities
    },
    taskQueue: 'suite-builder',
  });

  console.log('✅ Worker started! Listening on suite-builder task queue...');
  await worker.run();
}

run().catch((err) => {
  console.error('❌ Worker error:', err);
  process.exit(1);
});
