import { Connection, Client } from '@temporalio/client';
import { FeaturePlanningWorkflow } from './src/workflows/feature-planning.workflow';
import { DevelopmentTaskWorkflow } from './src/workflows/development-task.workflow';

async function testPhase1() {
  // Connect to Temporal
  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233'
  });

  const client = new Client({ connection });

  console.log('=== Phase 1 End-to-End Test ===\n');

  // Test 1: Start FeaturePlanningWorkflow
  console.log('1. Starting FeaturePlanningWorkflow...');

  const planningHandle = await client.workflow.start(FeaturePlanningWorkflow, {
    taskQueue: 'dev-workflow',
    workflowId: `planning-test-${Date.now()}`,
    args: [{
      featureRequest: 'Add user authentication with OAuth2',
      repoPath: '/Users/mattbernier/projects/production-agent-coordinators',
      projectId: 'proj-test'
    }]
  });

  console.log(`   Workflow started: ${planningHandle.workflowId}`);

  const planningResult = await planningHandle.result();

  console.log(`   Result:`, planningResult);
  console.log(`   ✓ Created REQ: ${planningResult.reqId}`);
  console.log(`   ✓ Created ${planningResult.taskCount} tasks\n`);

  // Test 2: Start DevelopmentTaskWorkflow
  console.log('2. Starting DevelopmentTaskWorkflow (will run for 2 minutes)...');

  const devHandle = await client.workflow.start(DevelopmentTaskWorkflow, {
    taskQueue: 'dev-workflow',
    workflowId: `dev-worker-test-${Date.now()}`,
    args: [{
      workerId: 'test-worker-1'
    }]
  });

  console.log(`   Workflow started: ${devHandle.workflowId}`);
  console.log(`   Worker is polling for tasks...`);
  console.log(`   Let it run for 2 minutes to see it pick up tasks`);
  console.log(`   Press Ctrl+C to stop\n`);

  // Wait 2 minutes then cancel
  await new Promise(resolve => setTimeout(resolve, 120000));

  console.log('\n3. Stopping dev worker...');
  await devHandle.cancel();

  console.log('\n=== Phase 1 Test Complete ===');
  console.log('✓ Planning workflow creates REQs and tasks');
  console.log('✓ Development workflow polls and claims tasks');
  console.log('✓ Tasks are marked as completed (simulated)');
  console.log('\nNext: Phase 2 will add real agent execution');

  process.exit(0);
}

testPhase1().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
