#!/usr/bin/env node
/**
 * Temporal Client for Plan Writer Service
 *
 * This script starts the service workflow and can send signals for testing.
 *
 * Usage:
 *   tsx src/client.ts start                    # Start the service workflow
 *   tsx src/client.ts signal <packageId>       # Signal the service to write a plan
 */

import { Connection, WorkflowClient } from '@temporalio/client';
import type { ServiceSignalPayload, PackagePlanNeededPayload } from './types/index.js';

async function run() {
  const command = process.argv[2] || 'start';
  const packageId = process.argv[3] || '@bernierllc/test-package';

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Temporal Client - Plan Writer Service                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Connect to Temporal server
  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
  });
  const client = new WorkflowClient({ connection });

  console.log('✅ Connected to Temporal at:', process.env.TEMPORAL_ADDRESS || 'localhost:7233');

  if (command === 'start') {
    console.log('\n🚀 Starting Plan Writer Service workflow...\n');

    try {
      const handle = await client.start('PlanWriterServiceWorkflow', {
        taskQueue: 'plan-writer-service',
        workflowId: 'plan-writer-service',
        // Service workflows run indefinitely
      });

      console.log('✅ Service workflow started!');
      console.log('   Workflow ID:', handle.workflowId);
      console.log('   Run ID:', handle.firstExecutionRunId);
      console.log('\n📊 View in Temporal UI: http://localhost:8233');
      console.log('\n💡 Now you can send signals to test the workflow:');
      console.log('   tsx src/client.ts signal @bernierllc/my-package\n');
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log('✅ Service workflow is already running!');
        console.log('   Workflow ID: plan-writer-service');
        console.log('\n📊 View in Temporal UI: http://localhost:8233');
        console.log('\n💡 You can send signals to test the workflow:');
        console.log('   tsx src/client.ts signal @bernierllc/my-package\n');
      } else {
        throw error;
      }
    }
  } else if (command === 'signal') {
    console.log(`\n📨 Sending package_plan_needed signal for: ${packageId}\n`);

    const handle = client.getHandle('plan-writer-service');

    const signal: ServiceSignalPayload<PackagePlanNeededPayload> = {
      signalType: 'package_plan_needed',
      sourceService: 'test-client',
      targetService: 'plan-writer-service',
      packageId,
      timestamp: new Date().toISOString(),
      priority: 'normal',
      data: {
        reason: 'Testing plan generation from client',
        context: {
          discoverySource: 'manual-test',
          requirements: ['Test requirement 1', 'Test requirement 2'],
        },
      },
    };

    await handle.signal('package_plan_needed', signal);

    console.log('✅ Signal sent!');
    console.log('\n📊 Watch the progress in:');
    console.log('   - Worker logs: /tmp/plan-writer-worker.log');
    console.log('   - Temporal UI: http://localhost:8233');
    console.log('\n💡 The service will:');
    console.log('   1. Query MCP for package details');
    console.log('   2. Evaluate if package needs update');
    console.log('   3. Spawn child workflow if needed');
    console.log('   4. Child workflow will discover lineage and write plan\n');
  } else {
    console.log('❌ Unknown command:', command);
    console.log('\nUsage:');
    console.log('   tsx src/client.ts start                    # Start the service workflow');
    console.log('   tsx src/client.ts signal <packageId>       # Signal to write a plan\n');
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('❌ Client failed:', err);
  process.exit(1);
});
