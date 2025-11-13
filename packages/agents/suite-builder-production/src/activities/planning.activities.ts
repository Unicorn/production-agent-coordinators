import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

export interface PlanSearchInput {
  packageName: string;
  workspaceRoot: string;
}

/**
 * Search for a plan file in the plans/packages directory structure.
 * Matches plan files by package name (e.g., "@bernierllc/openai-client" matches "openai-client.md")
 *
 * @param input - Package name and workspace root to search
 * @returns Absolute path to plan file if found, null otherwise
 * @throws Error if input validation fails
 */
export async function searchLocalPlans(input: PlanSearchInput): Promise<string | null> {
  // Input validation
  if (!input.packageName || input.packageName.trim() === '') {
    throw new Error('packageName cannot be empty');
  }

  if (!input.workspaceRoot || input.workspaceRoot.trim() === '') {
    throw new Error('workspaceRoot cannot be empty');
  }

  if (!fs.existsSync(input.workspaceRoot)) {
    throw new Error(`workspaceRoot does not exist: ${input.workspaceRoot}`);
  }

  const stats = fs.statSync(input.workspaceRoot);
  if (!stats.isDirectory()) {
    throw new Error(`workspaceRoot is not a directory: ${input.workspaceRoot}`);
  }

  // Extract package name from scoped name (e.g., "@bernierllc/openai-client" -> "openai-client")
  const packageNameWithoutScope = input.packageName.includes('/')
    ? input.packageName.split('/')[1]
    : input.packageName;

  // Check if plans/packages directory exists
  const plansPackagesDir = path.join(input.workspaceRoot, 'plans', 'packages');
  if (!fs.existsSync(plansPackagesDir)) {
    return null;
  }

  // Search recursively in plans/packages/** for .md files
  try {
    const planFiles = await glob('plans/packages/**/*.md', {
      cwd: input.workspaceRoot,
      absolute: true
    });

    console.log(`[searchLocalPlans] Found ${planFiles.length} plan files`);
    console.log(`[searchLocalPlans] Looking for: "${packageNameWithoutScope}"`);

    // Match plan files by package name
    for (const planFile of planFiles) {
      const fileName = path.basename(planFile, '.md');
      if (fileName === packageNameWithoutScope) {
        console.log(`[searchLocalPlans] MATCH! ${planFile}`);
        return planFile;
      }
    }

    console.log(`[searchLocalPlans] No match found for "${packageNameWithoutScope}"`);
    return null;
  } catch (error) {
    console.warn('[searchLocalPlans] Error searching for plan files:', error);
    return null;
  }
}

/**
 * Query the packages-api MCP server for a plan file
 *
 * This function will query the MCP server using the mcp__vibe-kanban__* tools
 * to retrieve plan content for a given package from the centralized plan registry.
 *
 * TODO: Implement actual MCP integration using mcp__vibe-kanban__* tools
 * The implementation will:
 * 1. Use MCP tools to query the packages-api server
 * 2. Search for a plan file matching the packageName
 * 3. Return the plan content as a string if found
 * 4. Return null if no plan is registered for the package
 *
 * @param input - Object containing packageName to search for
 * @returns Promise resolving to plan content string or null if not found
 * @throws Error if input validation fails
 */
export async function queryMcpForPlan(input: {
  packageName: string;
}): Promise<string | null> {
  // Input validation
  if (!input.packageName || input.packageName.trim() === '') {
    throw new Error('packageName cannot be empty');
  }

  // TODO: Implement MCP query
  // This will use the mcp__vibe-kanban__* tools to query the packages-api server
  // For now, return null as a stub until MCP server is properly configured
  return null;
}

/**
 * Read the contents of a plan file from disk.
 * This activity handles file I/O which cannot be done in workflows.
 *
 * @param input - Object containing planPath to read
 * @returns Promise resolving to plan file content as string
 * @throws Error if input validation fails or file doesn't exist
 */
export async function readPlanFile(input: {
  planPath: string;
}): Promise<string> {
  // Input validation
  if (!input.planPath || input.planPath.trim() === '') {
    throw new Error('planPath cannot be empty');
  }

  if (!fs.existsSync(input.planPath)) {
    throw new Error(`Plan file does not exist: ${input.planPath}`);
  }

  const stats = fs.statSync(input.planPath);
  if (!stats.isFile()) {
    throw new Error(`planPath is not a file: ${input.planPath}`);
  }

  // Read file content
  try {
    const content = fs.readFileSync(input.planPath, 'utf-8');
    return content;
  } catch (error) {
    throw new Error(`Failed to read plan file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export interface PlanValidationResult {
  passed: boolean;
  missingSections: string[];
  foundSections: string[];
}

/**
 * Validate that a plan file contains all required sections.
 *
 * Required sections (with accepted variations):
 * - Overview/Description/Summary
 * - Requirements/Scope
 * - Implementation/Tasks
 * - Testing/Tests
 *
 * @param input - Object containing planPath to validate
 * @returns Promise resolving to validation result
 * @throws Error if input validation fails or file doesn't exist
 */
export async function validatePlan(input: {
  planPath: string;
}): Promise<PlanValidationResult> {
  // Input validation
  if (!input.planPath || input.planPath.trim() === '') {
    throw new Error('planPath cannot be empty');
  }

  // Check if file exists
  if (!fs.existsSync(input.planPath)) {
    throw new Error(`planPath does not exist: ${input.planPath}`);
  }

  // Read plan file content
  const planContent = await fs.promises.readFile(input.planPath, 'utf-8');

  // Define required sections and their variations
  const requiredSections = [
    { name: 'Overview', variations: ['overview', 'description', 'summary'] },
    { name: 'Requirements', variations: ['requirements', 'scope'] },
    { name: 'Implementation', variations: ['implementation', 'tasks'] },
    { name: 'Testing', variations: ['testing', 'tests'] }
  ];

  // Parse markdown headers to find sections
  const foundSections: string[] = [];
  const lines = planContent.split('\n');

  for (const line of lines) {
    // Match markdown headers: #, ##, ###, etc.
    const headerMatch = line.match(/^#{1,6}\s+(.+)$/);
    if (headerMatch) {
      const sectionName = headerMatch[1].trim();
      foundSections.push(sectionName);
    }
  }

  // Check which required sections are missing
  const missingSections: string[] = [];

  for (const required of requiredSections) {
    let found = false;

    // Check if any variation of this section exists in the plan
    for (const foundSection of foundSections) {
      const foundSectionLower = foundSection.toLowerCase();

      // Check if the found section matches any variation
      for (const variation of required.variations) {
        if (foundSectionLower.includes(variation)) {
          found = true;
          break;
        }
      }

      if (found) break;
    }

    if (!found) {
      missingSections.push(required.name);
    }
  }

  const passed = missingSections.length === 0;

  return {
    passed,
    missingSections,
    foundSections
  };
}

/**
 * Register a plan with the packages-api MCP server
 *
 * This function will register a plan with the MCP server using the mcp__vibe-kanban__* tools
 * to store the plan content in the centralized plan registry.
 *
 * TODO: Implement actual MCP integration using mcp__vibe-kanban__* tools
 * The implementation will:
 * 1. Use MCP tools to connect to the packages-api server
 * 2. Register the plan file with the packageName as the identifier
 * 3. Store the planContent in the registry
 * 4. Return true if registration succeeded, false otherwise
 *
 * @param input - Object containing packageName and planContent
 * @returns Promise resolving to true if registration succeeded, false otherwise
 * @throws Error if input validation fails
 */
export async function registerPlanWithMcp(input: {
  packageName: string;
  planContent: string;
}): Promise<boolean> {
  // Input validation
  if (!input.packageName || input.packageName.trim() === '') {
    throw new Error('packageName cannot be empty');
  }

  if (!input.planContent || input.planContent.trim() === '') {
    throw new Error('planContent cannot be empty');
  }

  // TODO: Implement MCP registration
  // This will use the mcp__vibe-kanban__* tools to register the plan with packages-api server
  // For now, return true as a stub until MCP server is properly configured
  return true;
}

/**
 * Helper function to call MCP tools via HTTP/SSE
 */
async function callMcpTool<T = any>(toolName: string, params: any, mcpServerUrl: string): Promise<T> {
  const authToken = process.env.PACKAGES_API_TOKEN || process.env.MCP_TOKEN || '';

  const jsonRpcRequest = {
    jsonrpc: '2.0',
    method: 'tools/call',
    params: { name: toolName, arguments: params },
    id: Date.now()
  };

  const response = await fetch(mcpServerUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authToken ? `Bearer ${authToken}` : '',
      'Accept': 'application/json'
    },
    body: JSON.stringify(jsonRpcRequest),
  });

  if (!response.ok) {
    throw new Error(`MCP tool ${toolName} failed: ${response.status}`);
  }

  const responseText = await response.text();

  let jsonData: any;
  if (responseText.includes('event:') && responseText.includes('data:')) {
    const dataMatch = responseText.match(/data:\s*({.*})/);
    if (dataMatch) {
      jsonData = JSON.parse(dataMatch[1]);
    } else {
      throw new Error('Failed to parse SSE response');
    }
  } else {
    jsonData = JSON.parse(responseText);
  }

  if (jsonData.error) {
    throw new Error(`MCP error: ${jsonData.error.message}`);
  }

  const result = jsonData.result;
  if (result?.content?.[0]?.type === 'text') {
    return JSON.parse(result.content[0].text) as T;
  }

  return result as T;
}

/**
 * Generate a plan for a package
 *
 * Queries MCP for package dependencies and registers a plan.
 * TODO (Task 7): Invoke package-planning-writer agent for actual plan generation
 */
export async function generatePlanForPackage(input: {
  packageName: string;
  requestedBy: string;
}): Promise<void> {
  const mcpServerUrl = process.env.MCP_SERVER_URL || 'http://localhost:3355/api/mcp';

  console.log(`Generating plan for ${input.packageName}...`);

  // 1. Get dependency chain from MCP
  const depsData = await callMcpTool<any>('packages_get_dependencies', {
    id: input.packageName
  }, mcpServerUrl);

  console.log(`  Dependencies: ${depsData.dependencies?.length || 0}`);

  // 2. TODO (Task 7): Invoke package-planning-writer agent
  // For now, just register a placeholder plan
  const planPath = `/Users/mattbernier/projects/tools/plans/packages/${input.packageName.split('/')[1]}.md`;
  const branchName = `plan/${input.packageName.split('/')[1]}-auto`;

  // 3. Register plan with MCP
  await callMcpTool('packages_update', {
    id: input.packageName,
    data: {
      plan_file_path: planPath,
      branch_name: branchName,
      status: 'planning'
    }
  }, mcpServerUrl);

  console.log(`  ✓ Registered plan at ${planPath}`);
}

/**
 * Discover packages that need plans
 *
 * Queries MCP for packages in 'planning' status with no plan_file_path
 */
export async function discoverPackagesNeedingPlans(): Promise<string[]> {
  const mcpServerUrl = process.env.MCP_SERVER_URL || 'http://localhost:3355/api/mcp';

  // Query MCP for packages in planning status with no plan_file_path
  const result = await callMcpTool<any>('packages_query', {
    filters: {
      status: ['planning']
    },
    limit: 10
  }, mcpServerUrl);

  const packagesNeedingPlans = result.packages
    ?.filter((pkg: any) => !pkg.plan_file_path)
    .map((pkg: any) => pkg.id) || [];

  return packagesNeedingPlans;
}
