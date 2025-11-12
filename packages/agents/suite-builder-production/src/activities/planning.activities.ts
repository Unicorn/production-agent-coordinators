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
