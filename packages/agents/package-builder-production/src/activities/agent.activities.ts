import * as path from 'path';
import type { QualityFailure } from '../types/index';
import { executeCLIAgent, selectCLIProvider } from './cli-agent.activities.js';

/**
 * Spawn fix agent using CLI (Gemini or Claude)
 * 
 * Replaces the old API-based approach with CLI agent calls.
 * Automatically selects appropriate model based on failure types.
 */
export async function spawnFixAgent(input: {
  packagePath: string;
  planPath: string;
  failures: QualityFailure[];
  workspaceRoot?: string;
}): Promise<void> {
  // Categorize failures
  const failureTypes = [...new Set(input.failures.map(f => f.type))];

  // Format failures for prompt
  const formattedFailures = input.failures
    .map(f => {
      if (f.file && f.line) {
        return `- ${f.type.toUpperCase()}: ${f.file}:${f.line} - ${f.message}`;
      }
      return `- ${f.type.toUpperCase()}: ${f.message}`;
    })
    .join('\n');

  // Error type will be extracted from instruction for model selection

  // Build fix instruction
  const fixInstruction = `Fix the following quality issues in this package:

${formattedFailures}

Requirements:
- Fix all reported issues
- Ensure code passes all quality checks
- Maintain existing functionality
- Follow BernierLLC package requirements
- Run validation after fixes

Make minimal, targeted changes to resolve the issues.`;

  // Select provider (prefer Gemini, fallback to Claude)
  const provider = await selectCLIProvider('fix', 'gemini');
  
  // Get full package path
  const workspaceRoot = input.workspaceRoot || process.cwd();
  const packageFullPath = path.isAbsolute(input.packagePath)
    ? input.packagePath
    : path.join(workspaceRoot, input.packagePath);

  console.log(`[FixAgent] Using ${provider.name} CLI to fix ${failureTypes.length} issue types`);
  console.log(`[FixAgent] Package: ${packageFullPath}`);
  console.log(`[FixAgent] Failures: ${formattedFailures.substring(0, 200)}...`);

  // Execute CLI agent with fix task (provider will be selected automatically)
  const result = await executeCLIAgent({
    instruction: fixInstruction,
    workingDir: packageFullPath,
    task: 'fix',
  }, provider.name);

  if (!result.success) {
    throw new Error(`Fix agent failed: ${result.error || 'Unknown error'}`);
  }

  console.log(`[FixAgent] Fix complete (cost: $${result.cost_usd}, provider: ${result.provider})`);
}

export async function verifyDependencies(dependencies: string[] = []): Promise<void> {
  // In production, this would check npm registry or local registry
  // For now, we'll just validate the list isn't empty
  if (!dependencies || !Array.isArray(dependencies)) {
    console.log('No dependencies to verify');
    return;
  }

  if (dependencies.length > 0) {
    console.log(`Verifying ${dependencies.length} dependencies...`);
  }

  // TODO: Add actual npm registry checks
  // for (const dep of dependencies) {
  //   const exists = await checkNpmPackage(dep);
  //   if (!exists) {
  //     throw new Error(`Dependency not published: ${dep}`);
  //   }
  // }
}
