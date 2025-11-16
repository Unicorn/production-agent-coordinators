/**
 * MCP Scanner Cron Workflow
 *
 * Scheduled via Temporal cron: @hourly
 * Queries MCP for unpublished packages without plan files
 * Signals PlanWriterServiceWorkflow with discoveries
 *
 * Workflow ID: mcp-scanner (stable, reused by cron)
 */

import { proxyActivities, getExternalWorkflowHandle } from '@temporalio/workflow';
import type * as mcpActivities from '../activities/mcp.activities';
import { packagePlanNeededSignal } from './plan-writer-service.workflow';
import type { ServiceSignalPayload, PackagePlanNeededPayload } from '../types/index';

// Configure activity proxy
const mcp = proxyActivities<typeof mcpActivities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumInterval: '30s',
    maximumAttempts: 3
  }
});

export interface MCPScannerResult {
  packagesFound: number;
  packagesSignaled: number;
}

/**
 * MCP Scanner Workflow
 *
 * Executes on cron schedule (@hourly):
 * 1. Scan MCP for unpublished packages without plan files
 * 2. Signal plan-writer-service for each package found
 * 3. Return scan statistics
 */
export async function MCPScannerWorkflow(): Promise<MCPScannerResult> {
  console.log('[MCPScannerWorkflow] Starting MCP scan');

  // Step 1: Scan MCP
  const packages = await mcp.scanForUnplannedPackages();
  console.log(`[MCPScannerWorkflow] Found ${packages.length} packages needing plans`);

  // Step 2: Signal service for each package
  const serviceHandle = getExternalWorkflowHandle('plan-writer-service');
  let signaled = 0;

  for (const pkg of packages) {
    try {
      const signal: ServiceSignalPayload<PackagePlanNeededPayload> = {
        signalType: 'package_plan_needed',
        sourceService: 'mcp-scanner',
        targetService: 'plan-writer-service',
        packageId: pkg.id,
        timestamp: new Date().toISOString(),
        priority: 'low', // Scanner discoveries are lower priority
        data: {
          reason: 'Published package without plan file',
          context: { discoverySource: 'mcp-scanner-scheduled' }
        }
      };

      await serviceHandle.signal(packagePlanNeededSignal, signal);
      console.log(`[MCPScannerWorkflow] Signaled for ${pkg.id}`);
      signaled++;
    } catch (error) {
      console.error(`[MCPScannerWorkflow] Failed to signal for ${pkg.id}:`, error);
      // Continue with other packages
    }
  }

  console.log(`[MCPScannerWorkflow] Scan complete: ${packages.length} found, ${signaled} signaled`);

  return {
    packagesFound: packages.length,
    packagesSignaled: signaled
  };
}
