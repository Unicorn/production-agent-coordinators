import type { PackageWorkflowInput } from '../types';
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
  const searchedLocations: string[] = [];

  // 1. Search in plans directory
  searchedLocations.push('plans/packages/**');
  const planFiles = await glob('plans/packages/**/*.md', {
    cwd: input.workspaceRoot,
    absolute: true
  });

  for (const planFile of planFiles) {
    const content = fs.readFileSync(planFile, 'utf-8');
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
    const packageJson = JSON.parse(fs.readFileSync(packageJsonFile, 'utf-8'));
    const packageName = packageJson.name;

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
  }

  // 3. TODO: Query packages-api MCP (stub for now)
  searchedLocations.push('packages-api MCP');

  return {
    found: false,
    searchedLocations
  };
}
