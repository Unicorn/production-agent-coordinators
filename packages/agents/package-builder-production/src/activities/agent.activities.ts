import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { QualityFailure } from '../types/index';

export async function spawnFixAgent(input: {
  packagePath: string;
  planPath: string;
  failures: QualityFailure[];
}): Promise<void> {
  // Categorize failures
  const failureTypes = [...new Set(input.failures.map(f => f.type))];

  // Get or create fix prompt
  const fixPrompt = await getOrCreateFixPrompt(failureTypes);

  // Format failures for prompt
  const formattedFailures = input.failures
    .map(f => {
      if (f.file && f.line) {
        return `- ${f.type.toUpperCase()}: ${f.file}:${f.line} - ${f.message}`;
      }
      return `- ${f.type.toUpperCase()}: ${f.message}`;
    })
    .join('\n');

  // In a real implementation, this would use the Task tool
  // For now, we'll simulate by logging what would be sent
  console.log('Would spawn agent with prompt:');
  console.log(`Package: ${input.packagePath}`);
  console.log(`Plan: ${input.planPath}`);
  console.log(`Failures:\n${formattedFailures}`);
  console.log(`Prompt template: ${fixPrompt}`);

  // TODO: Integrate with actual agent spawning mechanism
  // await spawnAgent({
  //   subagent_type: 'package-development-agent',
  //   description: `Fix quality issues in ${input.packagePath}`,
  //   prompt: `${fixPrompt}\n\nPackage: ${input.packagePath}\nPlan: ${input.planPath}\n\nQuality Failures:\n${formattedFailures}\n\nFix all issues and ensure ./manager validate-requirements passes.`
  // });
}

async function getOrCreateFixPrompt(failureTypes: string[]): Promise<string> {
  const promptsDir = '.claude/agents/fix-prompts';

  // Try to find specific prompt for these failure types
  const promptKey = failureTypes.sort().join('-');
  const specificPrompt = path.join(promptsDir, `${promptKey}.md`);

  if (fs.existsSync(specificPrompt)) {
    return fs.readFileSync(specificPrompt, 'utf-8');
  }

  // Fall back to generic developer prompt
  const genericPrompt = path.join(promptsDir, 'generic-developer.md');

  if (!fs.existsSync(genericPrompt)) {
    // Copy from ~/.claude/agents/package-development-agent.md as template
    const homeAgentsDir = path.join(os.homedir(), '.claude/agents');
    const templatePrompt = path.join(homeAgentsDir, 'package-development-agent.md');

    if (fs.existsSync(templatePrompt)) {
      const template = fs.readFileSync(templatePrompt, 'utf-8');

      // Create prompts directory
      fs.mkdirSync(promptsDir, { recursive: true });

      // Write generic prompt
      fs.writeFileSync(genericPrompt, template);
    } else {
      // Create minimal fallback prompt
      const fallbackPrompt = `You are a package development agent. Fix the reported quality issues.`;
      fs.mkdirSync(promptsDir, { recursive: true });
      fs.writeFileSync(genericPrompt, fallbackPrompt);
    }
  }

  return fs.readFileSync(genericPrompt, 'utf-8');
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
