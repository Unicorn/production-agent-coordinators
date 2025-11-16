/**
 * MCP Integration Activities
 *
 * These activities handle interactions with the MCP (Model Context Protocol) API
 * for querying package queues and updating package status.
 */

import type { Package } from '../types/index.js';

/**
 * Query MCP for packages ready to build
 *
 * This activity is called by the MCPPollerWorkflow to get the list of packages
 * that are ready to be built (dependencies satisfied, sorted by priority).
 */
export async function queryMCPForPackages(): Promise<Package[]> {
  // TODO: Implement MCP packages_get_build_queue call
  // For now, return empty array as placeholder
  return [];
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
  // TODO: Implement MCP packages_update call
  // For now, just log
  console.log(`Updating package ${packageName} status to ${status}`, errorDetails);
}
