/**
 * Plan Writer Service Activities
 *
 * Activities perform side effects and can fail/retry.
 * Following naming standards from standardization design doc.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import Anthropic from '@anthropic-ai/sdk';
import type {
  WritePlanResult,
  WritePlanInputWithContext,
  GitCommitInput,
  GitCommitResult,
  MCPUpdateInput,
  MCPUpdateResult,
  PackageEvaluationInput,
  PackageEvaluationResult
} from '../types/index';

const execAsync = promisify(exec);

// Initialize Anthropic client
let anthropicClient: Anthropic | null = null;
function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable not set');
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

/**
 * Agentic Activity: Spawns AI agent to write package plan
 *
 * Display Name: "Write package plan (claude-sonnet-4-5 | plan-writer-agent-v1.0.0)"
 * Activity Type: agentic
 */
export async function spawnPlanWriterAgent(input: WritePlanInputWithContext): Promise<WritePlanResult> {
  const startTime = Date.now();

  try {
    console.log(`[spawnPlanWriterAgent] Writing plan for ${input.packageId}`);
    console.log(`[spawnPlanWriterAgent] Reason: ${input.reason}`);

    if (input.parentPlanContent) {
      console.log(`[spawnPlanWriterAgent] Using parent context from ${input.parentPackageId}`);
      console.log(`[spawnPlanWriterAgent] Lineage depth: ${input.lineage?.length || 0}`);
    }

    // Generate plan using AI agent (falls back to mock if API key not set)
    const planContent = await generatePlanContent(input);
    const planFilePath = getPlanFilePath(input.packageId);

    // Write plan to filesystem
    const fullPath = join(process.cwd(), planFilePath);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, planContent, 'utf-8');

    const duration = Date.now() - startTime;

    console.log(`[spawnPlanWriterAgent] Plan written to ${planFilePath} in ${duration}ms`);

    return {
      success: true,
      planContent,
      planFilePath,
      duration
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error(`[spawnPlanWriterAgent] Failed for ${input.packageId}:`, errorMessage);

    return {
      success: false,
      planContent: '',
      planFilePath: '',
      duration,
      error: errorMessage
    };
  }
}

/**
 * CLI Activity: Commits plan to Git with --no-verify
 *
 * Display Name: "Commit plan to Git (--no-verify)"
 * Activity Type: cli
 */
export async function gitCommitPlan(input: GitCommitInput): Promise<GitCommitResult> {
  try {
    console.log(`[gitCommitPlan] Committing plan for ${input.packageId}`);
    console.log(`[gitCommitPlan] Branch: ${input.gitBranch}`);

    const cwd = process.cwd();

    // 1. Create and checkout branch (or checkout existing)
    try {
      await execAsync(`git checkout -b ${input.gitBranch}`, { cwd });
    } catch (error) {
      // Branch might already exist, try to check it out
      await execAsync(`git checkout ${input.gitBranch}`, { cwd });
    }

    // 2. Add plan file
    await execAsync(`git add ${input.planFilePath}`, { cwd });

    // 3. Commit with --no-verify
    const commitMessage = input.commitMessage || `Add plan for ${input.packageId}`;
    await execAsync(`git commit --no-verify -m "${commitMessage}"`, { cwd });

    // 4. Get commit SHA
    const { stdout: commitSha } = await execAsync('git rev-parse --short HEAD', { cwd });
    const cleanCommitSha = commitSha.trim();

    console.log(`[gitCommitPlan] Committed as ${cleanCommitSha}`);

    return {
      success: true,
      commitSha: cleanCommitSha,
      branch: input.gitBranch
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error(`[gitCommitPlan] Failed for ${input.packageId}:`, errorMessage);

    return {
      success: false,
      commitSha: '',
      branch: input.gitBranch,
      error: errorMessage
    };
  }
}

/**
 * Standard Activity: Updates MCP with plan metadata
 *
 * Display Name: "Update MCP package status"
 * Activity Type: standard
 */
export async function updateMCPStatus(input: MCPUpdateInput): Promise<MCPUpdateResult> {
  try {
    console.log(`[updateMCPStatus] Updating MCP for ${input.packageId}`);
    console.log(`[updateMCPStatus] Status: ${input.status}`);
    console.log(`[updateMCPStatus] Plan path: ${input.planFilePath}`);
    console.log(`[updateMCPStatus] Git branch: ${input.gitBranch}`);

    // Call packages API to update package metadata
    const apiKey = process.env.MBERNIER_API_KEY;
    const apiUrl = process.env.MBERNIER_API_URL || 'http://localhost:3355/api/v1';

    if (!apiKey) {
      throw new Error('MBERNIER_API_KEY environment variable not set');
    }

    // Try to update first
    let response = await fetch(`${apiUrl}/packages/${encodeURIComponent(input.packageId)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        plan_file_path: input.planFilePath,
        plan_git_branch: input.gitBranch,
        status: input.status,
      }),
    });

    // If package doesn't exist (404), create it first
    if (response.status === 404) {
      console.log(`[updateMCPStatus] Package doesn't exist, creating it first`);

      const createResponse = await fetch(`${apiUrl}/packages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          name: input.packageId,
          description: `Package ${input.packageId}`,
          category: 'other',
          status: input.status,
          plan_file_path: input.planFilePath,
          plan_git_branch: input.gitBranch,
        }),
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        throw new Error(`Failed to create package: ${createResponse.status} ${errorText}`);
      }

      console.log(`[updateMCPStatus] Package created successfully`);

      // Now update the package with plan metadata
      const updateResponse = await fetch(`${apiUrl}/packages/${encodeURIComponent(input.packageId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          plan_file_path: input.planFilePath,
          plan_git_branch: input.gitBranch,
          status: input.status,
        }),
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        throw new Error(`Failed to update plan metadata: ${updateResponse.status} ${errorText}`);
      }

      console.log(`[updateMCPStatus] Plan metadata updated successfully`);
      return { success: true };
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${errorText}`);
    }

    console.log(`[updateMCPStatus] MCP updated successfully`);

    return {
      success: true
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error(`[updateMCPStatus] Failed for ${input.packageId}:`, errorMessage);

    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Agentic Activity: Spawns AI agent to evaluate if package needs update
 *
 * Display Name: "Evaluate package update need (claude-sonnet-4-5 | package-evaluator-agent-v1.0.0)"
 * Activity Type: agentic
 */
export async function spawnPackageEvaluatorAgent(
  input: PackageEvaluationInput
): Promise<PackageEvaluationResult> {
  const startTime = Date.now();

  try {
    console.log(`[spawnPackageEvaluatorAgent] Evaluating ${input.packageId}`);
    console.log(`[spawnPackageEvaluatorAgent] Status: ${input.packageDetails.status}`);

    if (input.existingPlanContent) {
      console.log(`[spawnPackageEvaluatorAgent] Existing plan found`);
    }
    if (input.parentPlanContent) {
      console.log(`[spawnPackageEvaluatorAgent] Parent plan available for comparison`);
    }
    if (input.npmPackageInfo) {
      console.log(`[spawnPackageEvaluatorAgent] Package published: v${input.npmPackageInfo.version}`);
    }

    // TODO: Implement actual agent spawning
    // Agent will compare:
    // - Existing plan vs parent plan expectations
    // - Existing npm package implementation vs requirements
    // - Make decision: update plan, update implementation, or sufficient

    // Mock decision logic
    const mockResult: PackageEvaluationResult = {
      success: true,
      needsUpdate: false, // Default to no update needed
      reason: 'Existing package matches parent expectations and requirements',
      updateType: 'none',
      confidence: 'high'
    };

    // Simple heuristics for mock:
    // - If status is plan_needed → needs plan
    // - If no existing plan but parent exists → needs plan
    // - If parent plan changed recently → might need update
    if (input.packageDetails.status === 'plan_needed') {
      mockResult.needsUpdate = true;
      mockResult.updateType = 'plan';
      mockResult.reason = 'Package status is plan_needed';
      mockResult.confidence = 'high';
    } else if (!input.existingPlanContent && input.parentPlanContent) {
      mockResult.needsUpdate = true;
      mockResult.updateType = 'plan';
      mockResult.reason = 'No existing plan found, but parent plan exists';
      mockResult.confidence = 'high';
    } else if (!input.npmPackageInfo && input.packageDetails.status === 'planning') {
      mockResult.needsUpdate = true;
      mockResult.updateType = 'implementation';
      mockResult.reason = 'Plan exists but package not yet implemented';
      mockResult.confidence = 'high';
    }

    const duration = Date.now() - startTime;

    console.log(`[spawnPackageEvaluatorAgent] Decision: ${mockResult.updateType}`);
    console.log(`[spawnPackageEvaluatorAgent] Reason: ${mockResult.reason}`);
    console.log(`[spawnPackageEvaluatorAgent] Confidence: ${mockResult.confidence}`);
    console.log(`[spawnPackageEvaluatorAgent] Completed in ${duration}ms`);

    return mockResult;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[spawnPackageEvaluatorAgent] Failed for ${input.packageId}:`, errorMessage);

    return {
      success: false,
      needsUpdate: false,
      reason: `Evaluation failed: ${errorMessage}`,
      updateType: 'none',
      confidence: 'low',
      error: errorMessage
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate plan content - tries AI first, falls back to mock if API key not available
 */
async function generatePlanContent(input: WritePlanInputWithContext): Promise<string> {
  // Check if Anthropic API key is available
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY;

  if (hasApiKey) {
    try {
      console.log(`[generatePlanContent] Using AI agent to generate plan`);
      return await generateAIPlan(input);
    } catch (error) {
      console.error(`[generatePlanContent] AI generation failed, falling back to mock:`, error);
      return generateMockPlan(input);
    }
  } else {
    console.log(`[generatePlanContent] No ANTHROPIC_API_KEY, using mock plan`);
    return generateMockPlan(input);
  }
}

/**
 * Generate plan using Claude AI
 */
async function generateAIPlan(input: WritePlanInputWithContext): Promise<string> {
  const client = getAnthropicClient();

  // Build context for the prompt
  let contextInfo = '';

  if (input.parentPlanContent && input.parentPackageId) {
    contextInfo += `\n## Parent Package Context\n\n`;
    contextInfo += `**Parent**: ${input.parentPackageId}\n`;
    contextInfo += `**Lineage**: ${input.lineage?.join(' → ') || 'None'}\n\n`;
    contextInfo += `The parent package has the following plan:\n\n`;
    contextInfo += `\`\`\`markdown\n${input.parentPlanContent}\n\`\`\`\n\n`;
    contextInfo += `This package should follow the architectural patterns and standards established by the parent.\n`;
  }

  const prompt = `You are an expert software architect creating an implementation plan for a TypeScript/Node.js package.

Package: ${input.packageId}
Reason for plan: ${input.reason}
${contextInfo}

${input.context ? `Additional Context:\n${JSON.stringify(input.context, null, 2)}\n` : ''}

Create a comprehensive implementation plan in Markdown format. The plan should include:

1. **Overview** - Brief description and purpose
2. **Architecture** - High-level design decisions
3. **Implementation Steps** - Detailed phases with checkboxes
4. **Testing Strategy** - How to test the package
5. **Quality Requirements** - Standards that must be met
6. **Dependencies** - Internal and external dependencies

The plan should be:
- Actionable and specific
- Include concrete file paths and code examples where appropriate
- Follow TypeScript and Node.js best practices
- Include testing requirements (unit, integration)
- Specify quality gates (linting, coverage, build)

Format the plan as a well-structured Markdown document.`;

  console.log(`[generateAIPlan] Calling Claude to generate plan for ${input.packageId}`);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: prompt
    }]
  });

  const planContent = response.content[0].type === 'text'
    ? response.content[0].text
    : '';

  console.log(`[generateAIPlan] Generated ${planContent.length} characters`);

  return planContent;
}

function generateMockPlan(input: WritePlanInputWithContext): string {
  let plan = `# ${input.packageId} Implementation Plan\n\n`;

  if (input.parentPlanContent && input.parentPackageId) {
    plan += `## Parent Package Context\n\n`;
    plan += `**Parent**: ${input.parentPackageId}\n`;
    plan += `**Lineage**: ${input.lineage?.join(' → ') || 'None'}\n\n`;
    plan += `### Parent Architecture\n\n`;
    plan += `This package is part of the ${input.parentPackageId} suite.\n`;
    plan += `It should follow the architectural patterns established by the parent.\n\n`;
    plan += `_Parent plan excerpt:_\n`;
    plan += `\`\`\`\n${input.parentPlanContent.substring(0, 500)}...\n\`\`\`\n\n`;
  }

  plan += `## Overview\n\n**Reason**: ${input.reason}\n\n`;
  plan += `## Context\n\n${JSON.stringify(input.context, null, 2)}\n\n`;
  plan += `## Implementation Steps\n\n`;
  plan += `### Phase 1: Setup\n`;
  plan += `- [ ] Create package structure\n`;
  plan += `- [ ] Set up tsconfig\n`;
  plan += `- [ ] Install dependencies\n\n`;
  plan += `### Phase 2: Core Implementation\n`;
  plan += `- [ ] Implement main functionality\n`;
  plan += `- [ ] Add error handling\n`;
  plan += `- [ ] Add logging\n\n`;
  plan += `### Phase 3: Testing\n`;
  plan += `- [ ] Write unit tests\n`;
  plan += `- [ ] Write integration tests\n`;
  plan += `- [ ] Achieve 80%+ coverage\n\n`;
  plan += `### Phase 4: Documentation\n`;
  plan += `- [ ] Write README\n`;
  plan += `- [ ] Add code comments\n`;
  plan += `- [ ] Create examples\n\n`;
  plan += `## Quality Requirements\n\n`;
  plan += `- All tests pass (100%)\n`;
  plan += `- Linting passes (no errors)\n`;
  plan += `- Build succeeds\n`;
  plan += `- Documentation complete\n\n`;
  plan += `---\n\n`;
  plan += `Generated by plan-writer-service\n`;
  plan += `${new Date().toISOString()}\n`;

  return plan;
}

function getPlanFilePath(packageId: string): string {
  // Convert @bernierllc/package-name to plans/packages/package-name.md
  const packageName = packageId.replace('@bernierllc/', '');
  return `plans/packages/${packageName}.md`;
}
