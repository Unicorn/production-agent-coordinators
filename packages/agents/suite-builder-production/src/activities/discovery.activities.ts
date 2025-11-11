import type { PackageWorkflowInput, PackageNode } from '../types';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

export interface ParsedInput {
  type: 'packageName' | 'packageIdea' | 'planFilePath' | 'updatePrompt';
  value: string;
}

export interface SearchResult {
  found: boolean;
  packagePath?: string;
  packageName?: string;
  searchedLocations: string[];
}

export interface PackageMetadata {
  name: string;
  version: string;
  dependencies: string[];
  scripts: Record<string, string>;
}

export function parseInput(input: PackageWorkflowInput): ParsedInput {
  if (input.packageName) {
    return { type: 'packageName', value: input.packageName };
  }
  if (input.packageIdea) {
    return { type: 'packageIdea', value: input.packageIdea };
  }
  if (input.planFilePath) {
    return { type: 'planFilePath', value: input.planFilePath };
  }
  if (input.updatePrompt) {
    return { type: 'updatePrompt', value: input.updatePrompt };
  }
  throw new Error('No input provided. Must provide one of: packageName, packageIdea, planFilePath, updatePrompt');
}

export async function searchForPackage(input: {
  searchQuery: string;
  workspaceRoot: string;
}): Promise<SearchResult> {
  // Input validation
  if (!input.searchQuery || input.searchQuery.trim() === '') {
    throw new Error('searchQuery cannot be empty');
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

  const searchedLocations: string[] = [];

  // 1. Search in plans directory
  searchedLocations.push('plans/packages/**');
  const planFiles = await glob('plans/packages/**/*.md', {
    cwd: input.workspaceRoot,
    absolute: true
  });

  for (const planFile of planFiles) {
    const content = await fs.promises.readFile(planFile, 'utf-8');
    if (content.includes(input.searchQuery)) {
      // Extract package path from plan file
      const packagePathMatch = content.match(/Package Path:\s*`([^`]+)`/);
      if (packagePathMatch) {
        return {
          found: true,
          packagePath: packagePathMatch[1],
          packageName: input.searchQuery,
          searchedLocations
        };
      }
    }
  }

  // 2. Search in packages directory
  searchedLocations.push('packages/**');
  const packageJsonFiles = await glob('packages/**/package.json', {
    cwd: input.workspaceRoot,
    absolute: true,
    ignore: ['**/node_modules/**', '**/dist/**']
  });

  for (const packageJsonFile of packageJsonFiles) {
    try {
      const content = await fs.promises.readFile(packageJsonFile, 'utf-8');
      const packageJson = JSON.parse(content);
      const packageName = packageJson.name;

      if (!packageName) {
        console.warn(`Warning: package.json at ${packageJsonFile} does not have a name field`);
        continue;
      }

      if (packageName === input.searchQuery ||
          packageName.includes(input.searchQuery) ||
          path.dirname(packageJsonFile).includes(input.searchQuery)) {
        return {
          found: true,
          packagePath: path.relative(input.workspaceRoot, path.dirname(packageJsonFile)),
          packageName: packageJson.name,
          searchedLocations
        };
      }
    } catch (error) {
      console.warn(`Warning: Failed to parse package.json at ${packageJsonFile}:`, error instanceof Error ? error.message : String(error));
      continue;
    }
  }

  // 3. TODO: Query packages-api MCP (stub for now)
  searchedLocations.push('packages-api MCP');

  return {
    found: false,
    searchedLocations
  };
}

export async function readPackageJson(input: {
  packagePath: string;
}): Promise<PackageMetadata> {
  const packageJsonPath = path.join(input.packagePath, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`package.json not found at ${packageJsonPath}`);
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

  // Extract workspace dependencies (those starting with @bernierllc/)
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };

  const workspaceDeps = Object.keys(allDeps)
    .filter(dep => dep.startsWith('@bernierllc/'));

  return {
    name: packageJson.name,
    version: packageJson.version,
    dependencies: workspaceDeps,
    scripts: packageJson.scripts || {}
  };
}

export interface DependencyTree {
  packages: PackageNode[];
}

export async function buildDependencyTree(input: {
  packageName: string;
  workspaceRoot: string;
}): Promise<DependencyTree> {
  const visited = new Set<string>();
  const packages: PackageNode[] = [];

  async function discoverPackage(packageName: string) {
    if (visited.has(packageName)) {
      return;
    }
    visited.add(packageName);

    // Find package in workspace
    const searchResult = await searchForPackage({
      searchQuery: packageName,
      workspaceRoot: input.workspaceRoot
    });

    if (!searchResult.found || !searchResult.packagePath) {
      throw new Error(`Package ${packageName} not found in workspace`);
    }

    // Read package.json
    const metadata = await readPackageJson({
      packagePath: path.join(input.workspaceRoot, searchResult.packagePath)
    });

    // Create package node
    const packageNode: PackageNode = {
      name: metadata.name,
      path: searchResult.packagePath,
      version: metadata.version,
      dependencies: metadata.dependencies,
      buildCommand: metadata.scripts.build || 'yarn build',
      testCommand: metadata.scripts['test:run'] || metadata.scripts.test || 'yarn test',
      buildStatus: 'pending',
      testStatus: 'pending'
    };

    packages.push(packageNode);

    // Recursively discover dependencies
    for (const dep of metadata.dependencies) {
      await discoverPackage(dep);
    }
  }

  await discoverPackage(input.packageName);

  return { packages };
}
