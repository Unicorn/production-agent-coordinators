/**
 * Test Client for Sample Activities
 *
 * This script starts a simple worker and executes the test workflow
 * to verify that sample activities work correctly.
 */

import { Worker, NativeConnection } from '@temporalio/worker';
import { Client } from '@temporalio/client';
import * as activities from './activities/index.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTest() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Testing Sample Activities                                ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // 1. Connect to Temporal
  const temporalAddress = process.env.TEMPORAL_ADDRESS || 'localhost:7233';
  console.log('🔌 Connecting to Temporal at:', temporalAddress);

  const connection = await NativeConnection.connect({
    address: temporalAddress,
  });

  console.log('✅ Connected to Temporal\n');

  // 2. Create test worker
  console.log('🔨 Creating test worker...');

  const isBuilt = __filename.endsWith('.js');
  const workflowsPath = isBuilt
    ? path.join(__dirname, 'test-workflow.js')
    : path.join(__dirname, 'test-workflow.ts');

  const worker = await Worker.create({
    connection,
    namespace: 'default',
    taskQueue: 'test-sample-activities',
    workflowsPath,
    activities,
  });

  console.log('✅ Test worker created');
  console.log('   Task Queue: test-sample-activities');
  console.log('   Activities:', Object.keys(activities).join(', '));
  console.log('');

  // 3. Start worker (non-blocking)
  console.log('🚀 Starting worker...');
  const workerRun = worker.run();
  console.log('✅ Worker running\n');

  // 4. Create client and execute workflow
  const client = new Client({ connection });

  console.log('📋 Executing test workflow...');
  console.log('');

  try {
    const handle = await client.workflow.start('simpleTestWorkflow', {
      args: ['Hello from test client!'],
      taskQueue: 'test-sample-activities',
      workflowId: `test-${Date.now()}`,
    });

    console.log('   Workflow started:', handle.workflowId);
    console.log('   Waiting for result...');
    console.log('');

    const result = await handle.result();

    console.log('✅ Workflow completed successfully!');
    console.log('   Result:', result);
    console.log('');

    // Test the comprehensive workflow
    console.log('📋 Executing comprehensive test workflow...');
    console.log('');

    const handle2 = await client.workflow.start('testSampleActivities', {
      args: [{ testMessage: 'Testing all activities' }],
      taskQueue: 'test-sample-activities',
      workflowId: `test-comprehensive-${Date.now()}`,
    });

    console.log('   Workflow started:', handle2.workflowId);
    console.log('   Waiting for result...');
    console.log('');

    const result2 = await handle2.result();

    console.log('✅ Comprehensive test completed successfully!');
    console.log('   Sample Result:', result2.sampleResult);
    console.log('   Build Result:', JSON.stringify(result2.buildResult, null, 2));
    console.log('   Transform Result:', result2.transformResult);
    console.log('   Validation Result:', JSON.stringify(result2.validationResult, null, 2));
    console.log('');

    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║   ✅ All tests passed!                                     ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    // 5. Shutdown worker
    console.log('\n🛑 Shutting down worker...');
    worker.shutdown();
    await workerRun;
    console.log('✅ Worker shut down');
  }
}

// Run the test
runTest()
  .then(() => {
    console.log('\n👋 Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
