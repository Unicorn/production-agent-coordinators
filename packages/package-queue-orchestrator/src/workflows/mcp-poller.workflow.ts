/**
 * MCP Poller Workflow
 *
 * A cron-scheduled workflow that queries MCP for packages ready to build
 * and signals the orchestrator with the results.
 *
 * Schedule: Every 30 minutes (cron: '0 *\/30 * * *')
 */

import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities/index.js';

// Proxy activities with reasonable timeout
const { queryMCPForPackages, signalOrchestrator } = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
});

/**
 * MCPPollerWorkflow
 *
 * Cron-scheduled workflow that:
 * 1. Queries MCP for packages ready to build
 * 2. Signals the orchestrator with results
 * 3. Exits (will be re-triggered by cron schedule)
 */
export async function MCPPollerWorkflow(): Promise<void> {
  // 1. Query MCP for packages ready to build
  const packages = await queryMCPForPackages(10); // Default limit of 10 packages

  // 2. Signal orchestrator with results (if any packages found)
  if (packages.length > 0) {
    await signalOrchestrator('newPackages', packages);
  }
}
