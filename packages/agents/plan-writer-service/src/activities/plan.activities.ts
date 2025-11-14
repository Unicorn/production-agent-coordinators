/**
 * Plan Writer Service Activities
 *
 * Activities perform side effects and can fail/retry.
 * Following naming standards from standardization design doc.
 */

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

    // TODO: Implement actual agent spawning
    // This will call the agent-prompt-writer-service or use existing agent
    // For now, generate a mock plan

    const planContent = generateMockPlan(input);
    const planFilePath = getPlanFilePath(input.packageId);

    // TODO: Write plan to filesystem
    // await writeFile(planFilePath, planContent);

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

    // TODO: Implement actual git operations
    // 1. Ensure on correct branch (git checkout -b feature/{package-name})
    // 2. Add plan file (git add {planFilePath})
    // 3. Commit (git commit --no-verify -m "{commitMessage}")
    // 4. Push (git push origin {gitBranch} --no-verify)

    const mockCommitSha = `abc${Date.now().toString(36)}`;

    console.log(`[gitCommitPlan] Committed as ${mockCommitSha}`);

    return {
      success: true,
      commitSha: mockCommitSha,
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

    // TODO: Implement actual MCP API call
    // await mcpClient.packages.update(input.packageId, {
    //   plan_file_path: input.planFilePath,
    //   plan_git_branch: input.gitBranch,
    //   status: input.status
    // });

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
    // - If no existing plan but parent exists → needs plan
    // - If parent plan changed recently → might need update
    if (!input.existingPlanContent && input.parentPlanContent) {
      mockResult.needsUpdate = true;
      mockResult.updateType = 'plan';
      mockResult.reason = 'No existing plan found, but parent plan exists';
      mockResult.confidence = 'high';
    } else if (!input.npmPackageInfo && input.packageDetails.status === 'plan_written') {
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
