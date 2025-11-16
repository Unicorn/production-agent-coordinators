#!/usr/bin/env node
/**
 * Temporal Client for Plan Writer Service
 *
 * Provides utilities for starting workflows and sending signals.
 *
 * Usage:
 *   npm run client:start-service    # Start main service workflow
 *   npm run client:trigger-scan     # Trigger manual MCP scan
 *   npm run client:request-plan <packageId>  # Request plan for specific package
 */

import 'dotenv/config';
import { Connection, Client, WorkflowHandle } from '@temporalio/client';
import { PlanWriterServiceWorkflow } from './workflows/plan-writer-service.workflow.js';
import { MCPScannerWorkflow } from './workflows/mcp-scanner.workflow.js';
import { packagePlanNeededSignal, triggerMcpScanSignal } from './workflows/plan-writer-service.workflow.js';
import type { ServiceSignalPayload, PackagePlanNeededPayload } from './types/index.js';

async function getClient(): Promise<Client> {
  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
  });

  return new Client({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || 'default',
  });
}

/**
 * Start the main Plan Writer Service workflow
 */
export async function startService(): Promise<WorkflowHandle<typeof PlanWriterServiceWorkflow>> {
  const client = await getClient();

  console.log('🚀 Starting Plan Writer Service workflow...');

  const handle = await client.workflow.start(PlanWriterServiceWorkflow, {
    taskQueue: 'plan-writer-service',
    workflowId: 'plan-writer-service',
    // No arguments - service starts fresh or continues from continue-as-new
  });

  console.log('✅ Service started with ID:', handle.workflowId);
  console.log('📊 View in Temporal UI: http://localhost:8233');

  return handle;
}

/**
 * Start the MCP Scanner cron workflow (usually scheduled automatically)
 */
export async function startScanner(): Promise<void> {
  const client = await getClient();

  console.log('🔍 Starting MCP Scanner workflow...');

  const handle = await client.workflow.start(MCPScannerWorkflow, {
    taskQueue: 'plan-writer-service',
    workflowId: 'mcp-scanner',
    cronSchedule: '@hourly', // Run every hour
  });

  console.log('✅ Scanner started with ID:', handle.workflowId);
  console.log('📅 Schedule: @hourly');
  console.log('📊 View in Temporal UI: http://localhost:8233');
}

/**
 * Trigger an immediate MCP scan (on-demand)
 */
export async function triggerScan(): Promise<void> {
  const client = await getClient();

  console.log('🔍 Triggering manual MCP scan...');

  const handle = client.workflow.getHandle('plan-writer-service');
  await handle.signal(triggerMcpScanSignal);

  console.log('✅ Manual scan triggered');
  console.log('   Service will scan MCP for packages needing plans');
}

/**
 * Request a plan for a specific package
 */
export async function requestPlan(
  packageId: string,
  reason: string = 'Manual request',
  priority: 'high' | 'normal' | 'low' = 'normal'
): Promise<void> {
  const client = await getClient();

  console.log(`📝 Requesting plan for ${packageId}...`);

  const handle = client.workflow.getHandle('plan-writer-service');

  const signal: ServiceSignalPayload<PackagePlanNeededPayload> = {
    signalType: 'package_plan_needed',
    sourceService: 'client',
    targetService: 'plan-writer-service',
    packageId,
    timestamp: new Date().toISOString(),
    priority,
    data: {
      reason,
      context: { discoverySource: 'manual-client' }
    }
  };

  await handle.signal(packagePlanNeededSignal, signal);

  console.log('✅ Plan request queued');
  console.log(`   Package: ${packageId}`);
  console.log(`   Priority: ${priority}`);
  console.log(`   Reason: ${reason}`);
}

/**
 * Get service workflow status
 */
export async function getServiceStatus(): Promise<void> {
  const client = await getClient();

  console.log('📊 Fetching service status...\n');

  try {
    const handle = client.workflow.getHandle('plan-writer-service');
    const description = await handle.describe();

    console.log('Status:', description.status.name);
    console.log('Started:', description.startTime);
    console.log('History Length:', description.historyLength, 'events');

    if (description.historyLength >= 37500) {
      console.log('⚠️  Service approaching continue-as-new threshold (37,500 events)');
    }
  } catch (error) {
    console.log('❌ Service workflow not found');
    console.log('   Run: npm run client:start-service');
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];

  (async () => {
    switch (command) {
      case 'start-service':
        await startService();
        break;

      case 'start-scanner':
        await startScanner();
        break;

      case 'trigger-scan':
        await triggerScan();
        break;

      case 'request-plan':
        const packageId = process.argv[3];
        const reason = process.argv[4];
        const priority = (process.argv[5] as 'high' | 'normal' | 'low') || 'normal';

        if (!packageId) {
          console.error('Usage: npm run client:request-plan <packageId> [reason] [priority]');
          process.exit(1);
        }

        await requestPlan(packageId, reason, priority);
        break;

      case 'status':
        await getServiceStatus();
        break;

      default:
        console.log('Available commands:');
        console.log('  start-service    - Start main service workflow');
        console.log('  start-scanner    - Start MCP scanner cron workflow');
        console.log('  trigger-scan     - Trigger manual MCP scan');
        console.log('  request-plan     - Request plan for package');
        console.log('  status           - Get service status');
        process.exit(1);
    }

    process.exit(0);
  })().catch((err) => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
}
