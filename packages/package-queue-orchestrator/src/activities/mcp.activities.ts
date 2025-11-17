/**
 * MCP Integration Activities
 *
 * These activities handle interactions with the MCP (Model Context Protocol) API
 * for querying package queues and updating package status.
 */

import { Connection, WorkflowClient } from '@temporalio/client';
import type { Package, MCPPackage } from '../types/index.js';
import { mcpClient } from './mcp-client.js';

/**
 * Interface for package update data sent to MCP
 */
interface PackageUpdateData {
  status: string;
  metadata?: {
    error: string;
  };
}

/**
 * Query MCP for packages ready to build
 *
 * This activity is called by the MCPPollerWorkflow to get the list of packages
 * that are ready to be built (dependencies satisfied, sorted by priority).
 *
 * @param limit - Maximum number of packages to return
 */
export async function queryMCPForPackages(limit: number): Promise<Package[]> {
  try {
    // Call MCP packages_get_build_queue tool
    const response = await mcpClient.callTool('packages_get_build_queue', {
      limit,
      filters: {
        exclude_blocked: true,
      },
    });

    // Transform MCP response to internal Package format
    // MCP returns { queue: [...], blocked: [...] }
    const packages: Package[] = (response.queue || []).map((mcpPkg: MCPPackage) => ({
      name: mcpPkg.name,
      priority: mcpPkg.priority,
      dependencies: mcpPkg.dependencies,
    }));

    return packages;
  } catch (error) {
    // Re-throw to let Temporal handle retries
    throw error;
  }
}

/**
 * Update package status in MCP
 *
 * This activity is called after a package build completes (success or failure)
 * to update the package status in the MCP system.
 *
 * @param packageName - The name of the package to update
 * @param status - The new status ('published', 'failed', etc.)
 * @param errorDetails - Optional error details if status is 'failed'
 */
export async function updateMCPPackageStatus(
  packageName: string,
  status: string,
  errorDetails?: string
): Promise<void> {
  try {
    // Prepare update data
    const updateData: PackageUpdateData = {
      status,
    };

    // Add error details to metadata if provided
    if (errorDetails) {
      updateData.metadata = {
        error: errorDetails,
      };
    }

    // Call MCP packages_update tool
    await mcpClient.callTool('packages_update', {
      id: packageName,
      data: updateData,
    });
  } catch (error) {
    // Re-throw to let Temporal handle retries
    throw error;
  }
}

/**
 * Signal the ContinuousBuilderWorkflow orchestrator
 *
 * This activity is called by the MCPPollerWorkflow to send packages to the
 * orchestrator workflow via a signal.
 *
 * @param signalName - The name of the signal to send (e.g., 'newPackages')
 * @param packages - The packages to send to the orchestrator
 */
export async function signalOrchestrator(
  signalName: string,
  packages: Package[]
): Promise<void> {
  // Get the Temporal connection from the activity context
  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
  });

  const client = new WorkflowClient({ connection });

  // Get handle to the orchestrator workflow
  const orchestratorWorkflowId = 'continuous-builder-orchestrator';
  const handle = client.getHandle(orchestratorWorkflowId);

  // Send the signal with packages
  await handle.signal(signalName, packages);
}
