import type { PackageWorkflowInput, PackageNode } from '../types';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { execSync } from 'child_process';

/**
 * Helper function to call MCP server tools using JSON-RPC protocol
 * Handles Server-Sent Events (SSE) response format from MCP server
 */
async function callMcpTool<T = any>(toolName: string, params: any, mcpServerUrl: string): Promise<T> {
  // Get auth token from environment
  const authToken = process.env.PACKAGES_API_TOKEN || process.env.MCP_TOKEN || '';

  const jsonRpcRequest = {
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: params
    },
    id: Date.now()
  };

  try {
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
      const errorText = await response.text();
      throw new Error(`MCP tool ${toolName} failed: ${response.status} ${errorText}`);
    }

    const responseText = await response.text();

    // Handle SSE format: extract JSON from "data: " lines
    let jsonData: any;
    if (responseText.includes('event:') && responseText.includes('data:')) {
      // SSE format - extract the data line
      const dataMatch = responseText.match(/data:\s*({.*})/);
      if (dataMatch) {
        jsonData = JSON.parse(dataMatch[1]);
      } else {
        throw new Error(`Failed to extract JSON from SSE response: ${responseText.substring(0, 200)}`);
      }
    } else {
      // Plain JSON response
      jsonData = JSON.parse(responseText);
    }

    if (jsonData.error) {
      throw new Error(`MCP error: ${jsonData.error.message || JSON.stringify(jsonData.error)}`);
    }

    // Extract actual data from result.content[0].text for MCP tools that return text content
    const result = jsonData.result;
    if (result && result.content && Array.isArray(result.content) && result.content[0]?.type === 'text') {
      const textContent = result.content[0].text;
      // If it's already an object, return it directly; otherwise parse as JSON string
      return (typeof textContent === 'string' ? JSON.parse(textContent) : textContent) as T;
    }

    return result as T;
  } catch (error) {
    if (error instanceof Error && error.message.includes('fetch')) {
      throw new Error(
        `Failed to connect to MCP server at ${mcpServerUrl}. ` +
        `Please ensure the MCP server is running. Error: ${error.message}`
      );
    }
    throw error;
  }
}

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

/**
 * Check if a package is already published
 * Uses MCP packages-api for @bernierllc/* packages
 * Uses npm view for other packages
 */
export async function checkPackagePublished(input: {
  packageName: string;
  mcpServerUrl: string;
}): Promise<{ isPublished: boolean; version?: string }> {
  const isBernierPackage = input.packageName.startsWith('@bernierllc/');

  if (isBernierPackage) {
    // Check using MCP packages-api with JSON-RPC protocol
    try {
      const result = await callMcpTool<any>('packages_get', {
        id: input.packageName,
        include: ['latest_metrics']
      }, input.mcpServerUrl);

      // Check the is_published field from the MCP response
      const isPublished = result && result.is_published === true;
      return {
        isPublished,
        version: result?.version || result?.latest_version || undefined
      };
    } catch (error) {
      // If MCP server fails, fall back to npm check
      console.warn(`MCP check failed for ${input.packageName}, falling back to npm: ${error}`);
      return checkViaNpm(input.packageName);
    }
  } else {
    // Check using npm view for non-bernierllc packages
    return checkViaNpm(input.packageName);
  }
}

/**
 * Check package publication status via npm registry
 */
function checkViaNpm(packageName: string): { isPublished: boolean; version?: string } {
  try {
    const output = execSync(`npm view ${packageName} version --json`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'] // Ignore stderr
    });

    const version = JSON.parse(output.trim());
    return {
      isPublished: !!version,
      version: version
    };
  } catch (error) {
    // npm view fails if package doesn't exist
    return { isPublished: false };
  }
}

export async function copyEnvFiles(input: {
  sourceRoot: string;
  worktreePath: string;
}): Promise<void> {
  const files = [
    path.join(input.sourceRoot, '.env'),
    path.join(input.sourceRoot, 'mgr', '.env')
  ];

  for (const file of files) {
    if (fs.existsSync(file)) {
      const relativePath = path.relative(input.sourceRoot, file);
      const target = path.join(input.worktreePath, relativePath);

      // Create target directory if needed
      await fs.promises.mkdir(path.dirname(target), { recursive: true });

      // Copy file
      await fs.promises.copyFile(file, target);
    }
  }
}

/**
 * Check if MCP server is reachable (only for localhost)
 * Throws an error if localhost server is not reachable
 */
export async function checkMcpServerReachability(input: {
  mcpServerUrl: string;
}): Promise<{ isReachable: boolean; isLocalhost: boolean }> {
  const url = new URL(input.mcpServerUrl);
  const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';

  // Only check reachability for localhost
  if (!isLocalhost) {
    return { isReachable: true, isLocalhost: false };
  }

  // Try to connect to the server with a simple HTTP request
  try {
    const http = await import('http');

    return new Promise((resolve, reject) => {
      const request = http.request({
        hostname: url.hostname,
        port: url.port || 80,
        path: '/',
        method: 'HEAD',
        timeout: 2000 // 2 second timeout
      }, (response) => {
        resolve({ isReachable: true, isLocalhost: true });
      });

      request.on('error', (error) => {
        reject(new Error(
          `MCP server at ${input.mcpServerUrl} is not reachable. ` +
          `Please start the MCP server before running the workflow.\n` +
          `Error: ${error.message}`
        ));
      });

      request.on('timeout', () => {
        request.destroy();
        reject(new Error(
          `MCP server at ${input.mcpServerUrl} connection timeout. ` +
          `Please start the MCP server before running the workflow.`
        ));
      });

      request.end();
    });
  } catch (error) {
    throw new Error(
      `Failed to check MCP server reachability at ${input.mcpServerUrl}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export interface PlanDiscoveryResult {
  found: boolean;
  source?: 'dependency' | 'dependent' | 'suite';
  sourcePackage?: string;
  planContent?: string;
  searchedPackages?: string[];
}

/**
 * Discover plan through dependency graph when package has no direct plan
 * Searches dependencies, dependents, and suite packages for available plans
 */
export async function discoverPlanFromDependencyGraph(input: {
  packageName: string;
  mcpServerUrl: string;
}): Promise<PlanDiscoveryResult> {
  const searchedPackages: string[] = [input.packageName];

  // 1. Get package metadata from MCP
  const packageData = await callMcpTool<any>('packages_get', {
    id: input.packageName,
    include: ['plan_content']
  }, input.mcpServerUrl);

  // If package has a plan already, return it
  if (packageData.plan_content) {
    return {
      found: true,
      source: 'dependency',
      sourcePackage: input.packageName,
      planContent: packageData.plan_content
    };
  }

  // 2. Get dependencies and check for plans
  const depsData = await callMcpTool<any>('packages_get_dependencies', {
    id: input.packageName
  }, input.mcpServerUrl);

  if (depsData.dependencies && depsData.dependencies.length > 0) {
    for (const dep of depsData.dependencies) {
      const depPackageName = dep.package_name;
      searchedPackages.push(depPackageName);

      const depData = await callMcpTool<any>('packages_get', {
        id: depPackageName,
        include: ['plan_content']
      }, input.mcpServerUrl);

      if (depData.plan_content) {
        return {
          found: true,
          source: 'dependency',
          sourcePackage: depPackageName,
          planContent: depData.plan_content
        };
      }
    }
  }

  // 3. Get dependents and check for plans
  const dependentsData = await callMcpTool<any>('packages_get_dependents', {
    id: input.packageName
  }, input.mcpServerUrl);

  if (dependentsData.dependents && dependentsData.dependents.length > 0) {
    for (const dependent of dependentsData.dependents) {
      const depPackageName = dependent.package_name;
      searchedPackages.push(depPackageName);

      const depData = await callMcpTool<any>('packages_get', {
        id: depPackageName,
        include: ['plan_content']
      }, input.mcpServerUrl);

      if (depData.plan_content) {
        return {
          found: true,
          source: 'dependent',
          sourcePackage: depPackageName,
          planContent: depData.plan_content
        };
      }
    }
  }

  return {
    found: false,
    searchedPackages
  };
}

/**
 * Poll MCP server for plan_file_path with exponential backoff
 *
 * This activity will retry polling the MCP server for a plan file until:
 * - A plan_file_path is found (returns { found: true, planPath: string })
 * - Max attempts reached (returns { found: false })
 *
 * Uses exponential backoff: 5s → 7.5s → 11.25s → ... (capped at 2 minutes)
 *
 * @param input - Package name, MCP server URL, and retry configuration
 * @returns Promise resolving to plan discovery result
 */
export async function pollMcpForPlan(input: {
  packageName: string;
  mcpServerUrl: string;
  maxAttempts?: number;
  initialDelayMs?: number;
}): Promise<{ found: boolean; planPath?: string }> {
  const maxAttempts = input.maxAttempts || 10;
  const initialDelayMs = input.initialDelayMs || 5000;  // 5 seconds
  const backoffCoefficient = 1.5;
  const maxDelayMs = 120000; // 2 minutes

  let delayMs = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[pollMcpForPlan] Attempt ${attempt}/${maxAttempts} for ${input.packageName}`);

    try {
      // Query MCP for package
      const packageData = await callMcpTool<any>('packages_get', {
        id: input.packageName,
        include: ['plan_content']
      }, input.mcpServerUrl);

      // Check if plan exists
      if (packageData.plan_file_path) {
        console.log(`[pollMcpForPlan] Plan found: ${packageData.plan_file_path}`);
        return {
          found: true,
          planPath: packageData.plan_file_path
        };
      }

      console.log(`[pollMcpForPlan] No plan yet, will retry...`);
    } catch (error) {
      console.warn(`[pollMcpForPlan] MCP query failed on attempt ${attempt}:`, error);
      // Continue to retry
    }

    // If not the last attempt, wait before retrying
    if (attempt < maxAttempts) {
      console.log(`[pollMcpForPlan] Waiting ${delayMs}ms before next attempt...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      delayMs = Math.min(delayMs * backoffCoefficient, maxDelayMs);
    }
  }

  console.log(`[pollMcpForPlan] Max attempts reached, plan not found for ${input.packageName}`);
  return { found: false };
}
