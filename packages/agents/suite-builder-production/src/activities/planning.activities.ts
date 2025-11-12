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

    // Match plan files by package name
    for (const planFile of planFiles) {
      const fileName = path.basename(planFile, '.md');
      if (fileName === packageNameWithoutScope) {
        return planFile;
      }
    }

    return null;
  } catch (error) {
    console.warn('Error searching for plan files:', error);
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
