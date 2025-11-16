/**
 * MCP Query Activities
 *
 * These activities query the packages-api (MCP) for package information.
 *
 * NOTE: Currently using MCP functions. Future: migrate to direct REST API calls.
 * See: docs/plans/2025-11-14-mcp-vs-rest-api-architecture-note.md
 */

import type {
  MCPPackageDetails,
  MCPPackageLineage
} from '../types/index';

export interface PackageInfo {
  id: string;
  name: string;
  status: string;
  plan_file_path: string | null;
  current_version?: string;
}

/**
 * Query package details from MCP
 *
 * Display Name: "Query package from MCP"
 * Activity Type: standard
 */
export async function queryPackageDetails(packageId: string): Promise<MCPPackageDetails> {
  try {
    console.log(`[queryPackageDetails] Querying MCP for ${packageId}`);

    // TODO: Implement actual MCP query
    // For now, return mock data
    const mockDetails: MCPPackageDetails = {
      packageId,
      exists: false, // Default to false for new packages
      status: 'plan_needed'
    };

    console.log(`[queryPackageDetails] Package exists: ${mockDetails.exists}`);

    return mockDetails;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[queryPackageDetails] Failed for ${packageId}:`, errorMessage);

    // Return non-existent package on error
    return {
      packageId,
      exists: false
    };
  }
}

/**
 * Query package lineage (parent chain) from MCP
 *
 * Display Name: "Query package lineage from MCP"
 * Activity Type: standard
 */
export async function queryPackageLineage(packageId: string): Promise<MCPPackageLineage> {
  try {
    console.log(`[queryPackageLineage] Querying lineage for ${packageId}`);

    // TODO: Implement actual MCP lineage query
    // This should recursively find parents until reaching root

    const mockLineage: MCPPackageLineage = {
      packageId,
      parents: [], // Empty means no parents (root package)
      depth: 0
    };

    console.log(`[queryPackageLineage] Lineage depth: ${mockLineage.depth}`);

    return mockLineage;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[queryPackageLineage] Failed for ${packageId}:`, errorMessage);

    return {
      packageId,
      parents: [],
      depth: 0
    };
  }
}

/**
 * Check if plan file exists
 *
 * Display Name: "Check if plan file exists"
 * Activity Type: standard
 */
export async function checkPlanExists(planPath: string): Promise<boolean> {
  try {
    console.log(`[checkPlanExists] Checking ${planPath}`);

    // TODO: Implement actual file existence check
    // For now, always return false (plan doesn't exist)

    return false;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[checkPlanExists] Failed for ${planPath}:`, errorMessage);
    return false;
  }
}

/**
 * Read plan file content
 *
 * Display Name: "Read plan file"
 * Activity Type: standard
 */
export async function readPlanFile(planPath: string): Promise<string | null> {
  try {
    console.log(`[readPlanFile] Reading ${planPath}`);

    // TODO: Implement actual file read
    // For now, return null (file doesn't exist)

    return null;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[readPlanFile] Failed for ${planPath}:`, errorMessage);
    return null;
  }
}

/**
 * Fetch package info from npm
 *
 * Display Name: "Fetch package from npm registry"
 * Activity Type: standard
 */
export async function fetchNpmPackageInfo(packageId: string): Promise<{
  version: string;
  published_at: string;
  url: string;
} | null> {
  try {
    console.log(`[fetchNpmPackageInfo] Fetching ${packageId} from npm`);

    // TODO: Implement actual npm registry query
    // For now, return null (package doesn't exist on npm)

    return null;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[fetchNpmPackageInfo] Failed for ${packageId}:`, errorMessage);
    return null;
  }
}

/**
 * Query children packages from MCP
 *
 * Display Name: "Query child packages from MCP"
 * Activity Type: standard
 */
export async function queryChildPackages(packageId: string): Promise<string[]> {
  try {
    console.log(`[queryChildPackages] Querying children for ${packageId}`);

    // TODO: Implement actual MCP query for children
    // For now, return empty array (no children)

    return [];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[queryChildPackages] Failed for ${packageId}:`, errorMessage);
    return [];
  }
}

/**
 * Scan MCP for packages that are published but have no plan file
 * Used by MCPScannerWorkflow for automated discovery
 */
export async function scanForUnplannedPackages(): Promise<PackageInfo[]> {
  const apiUrl = process.env.MBERNIER_API_URL;
  const apiKey = process.env.MBERNIER_API_KEY;

  if (!apiUrl || !apiKey) {
    throw new Error('MBERNIER_API_URL and MBERNIER_API_KEY must be set');
  }

  console.log('[scanForUnplannedPackages] Querying MCP for unpublished packages without plans');

  const url = `${apiUrl}/packages?filters[status]=published&filters[no_plan_file]=true`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MCP API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const packages = data.data || [];

  console.log(`[scanForUnplannedPackages] Found ${packages.length} packages needing plans`);

  return packages;
}
