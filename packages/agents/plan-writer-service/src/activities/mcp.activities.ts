/**
 * MCP Query Activities
 *
 * These activities query the packages-api via REST API for package information.
 *
 * Uses direct REST API calls instead of MCP functions for better control and error handling.
 * See: docs/plans/2025-11-14-mcp-vs-rest-api-architecture-note.md
 */

import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  MCPPackageDetails,
  MCPPackageLineage
} from '../types/index';

// Helper to get API configuration
function getApiConfig() {
  const apiKey = process.env.MBERNIER_API_KEY;
  const apiUrl = process.env.MBERNIER_API_URL || 'http://localhost:3355/api/v1';

  if (!apiKey) {
    throw new Error('MBERNIER_API_KEY environment variable not set');
  }

  return { apiKey, apiUrl };
}

/**
 * Query package details from MCP
 *
 * Display Name: "Query package from MCP"
 * Activity Type: standard
 */
export async function queryPackageDetails(packageId: string): Promise<MCPPackageDetails> {
  console.log(`[queryPackageDetails] Querying MCP for ${packageId}`);

  const { apiKey, apiUrl } = getApiConfig();

  const response = await fetch(`${apiUrl}/packages/${encodeURIComponent(packageId)}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  // 404 means package legitimately doesn't exist - this is OK
  if (response.status === 404) {
    console.log(`[queryPackageDetails] Package does not exist: ${packageId}`);
    return {
      packageId,
      exists: false,
      status: 'plan_needed'
    };
  }

  // Any other non-OK status (500, 503, etc) is an API error
  // Throw error so Temporal can retry with exponential backoff
  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(`packages-API error [${response.status}]: ${errorText.substring(0, 200)}`);
    console.error(`[queryPackageDetails] API unavailable for ${packageId}: ${error.message}`);
    throw error;
  }

  const responseBody = await response.json() as any;

  // Check if data is nested under a 'data' property
  const data = responseBody.data || responseBody;

  console.log(`[queryPackageDetails] Package exists: ${data.name}`);
  console.log(`[queryPackageDetails] Status: ${data.status || 'unknown'}`);

  return {
    packageId: data.name,
    exists: true,
    status: data.status,
    plan_file_path: data.plan_file_path,
    plan_git_branch: data.plan_git_branch,
    current_version: data.current_version,
    dependencies: data.dependencies
  };
}

/**
 * Query package lineage (parent chain) from MCP
 *
 * Display Name: "Query package lineage from MCP"
 * Activity Type: standard
 */
export async function queryPackageLineage(packageId: string): Promise<MCPPackageLineage> {
  console.log(`[queryPackageLineage] Querying lineage for ${packageId}`);

  const { apiKey, apiUrl } = getApiConfig();

  // First get package details to check if it exists
  // This will throw if API is down, which is correct - we want to retry
  const packageDetails = await queryPackageDetails(packageId);

  if (!packageDetails.exists) {
    console.log(`[queryPackageLineage] Package doesn't exist, returning empty lineage`);
    return {
      packageId,
      parents: [],
      depth: 0
    };
  }

  // Get dependencies to find parents (packages this one depends on)
  const response = await fetch(
    `${apiUrl}/packages/${encodeURIComponent(packageId)}/dependencies?type=internal`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    }
  );

  // 404 means no dependencies - this is OK, return empty parents
  if (response.status === 404) {
    console.log(`[queryPackageLineage] No dependencies found, returning root package`);
    return {
      packageId,
      parents: [],
      depth: 0
    };
  }

  // Any other non-OK status is an API error - throw for retry
  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(`packages-API error fetching dependencies [${response.status}]: ${errorText.substring(0, 200)}`);
    console.error(`[queryPackageLineage] API unavailable: ${error.message}`);
    throw error;
  }

  const deps = await response.json() as any;
  const parents = deps.dependencies
    ?.filter((d: any) => d.dependency_type === 'production' && d.dependency_name.startsWith('@bernierllc/'))
    .map((d: any) => d.dependency_name) || [];

  console.log(`[queryPackageLineage] Lineage depth: ${parents.length}`);
  console.log(`[queryPackageLineage] Parents: ${parents.join(', ') || 'none'}`);

  return {
    packageId,
    parents,
    depth: parents.length
  };
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

    const fullPath = join(process.cwd(), planPath);
    await access(fullPath);

    console.log(`[checkPlanExists] File exists: ${planPath}`);
    return true;
  } catch (error) {
    console.log(`[checkPlanExists] File does not exist: ${planPath}`);
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

    const fullPath = join(process.cwd(), planPath);
    const content = await readFile(fullPath, 'utf-8');

    console.log(`[readPlanFile] Read ${content.length} characters from ${planPath}`);
    return content;
  } catch (error) {
    console.log(`[readPlanFile] File not found: ${planPath}`);
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

    const response = await fetch(`https://registry.npmjs.org/${packageId}`);

    if (response.status === 404) {
      console.log(`[fetchNpmPackageInfo] Package not published to npm: ${packageId}`);
      return null;
    }

    if (!response.ok) {
      throw new Error(`npm registry returned ${response.status}`);
    }

    const data = await response.json() as any;
    const latestVersion = data['dist-tags']?.latest;

    if (!latestVersion) {
      console.log(`[fetchNpmPackageInfo] No latest version found for ${packageId}`);
      return null;
    }

    const publishedAt = data.time?.[latestVersion];

    console.log(`[fetchNpmPackageInfo] Found ${packageId}@${latestVersion} published ${publishedAt}`);

    return {
      version: latestVersion,
      published_at: publishedAt,
      url: `https://www.npmjs.com/package/${packageId}`
    };
  } catch (error) {
    console.log(`[fetchNpmPackageInfo] Package not available: ${packageId}`);
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
  console.log(`[queryChildPackages] Querying children for ${packageId}`);

  const { apiKey, apiUrl } = getApiConfig();

  // Get packages that depend on this one (reverse dependencies = children)
  const response = await fetch(
    `${apiUrl}/packages/${encodeURIComponent(packageId)}/dependents`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    }
  );

  // 404 means no dependents - this is OK, return empty array
  if (response.status === 404) {
    console.log(`[queryChildPackages] No dependents found for ${packageId}`);
    return [];
  }

  // Any other non-OK status is an API error - throw for retry
  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(`packages-API error fetching dependents [${response.status}]: ${errorText.substring(0, 200)}`);
    console.error(`[queryChildPackages] API unavailable: ${error.message}`);
    throw error;
  }

  const data = await response.json() as any;
  const children = data.dependents?.map((d: any) => d.package_id) || [];

  console.log(`[queryChildPackages] Found ${children.length} children: ${children.join(', ') || 'none'}`);

  return children;
}
