/**
 * Plan Writer Service Activities
 *
 * Activities perform side effects and can fail/retry.
 * Following naming standards from standardization design doc.
 */

import type {
  WritePlanInput,
  WritePlanResult,
  GitCommitInput,
  GitCommitResult,
  MCPUpdateInput,
  MCPUpdateResult
} from '../types/index';

/**
 * Agentic Activity: Spawns AI agent to write package plan
 *
 * Display Name: "Write package plan (claude-sonnet-4-5 | plan-writer-agent-v1.0.0)"
 * Activity Type: agentic
 */
export async function spawnPlanWriterAgent(input: WritePlanInput): Promise<WritePlanResult> {
  const startTime = Date.now();

  try {
    console.log(`[spawnPlanWriterAgent] Writing plan for ${input.packageId}`);
    console.log(`[spawnPlanWriterAgent] Reason: ${input.reason}`);

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

// ============================================================================
// Helper Functions
// ============================================================================

function generateMockPlan(input: WritePlanInput): string {
  return `# ${input.packageId} Implementation Plan

## Overview

**Reason**: ${input.reason}

## Context

${JSON.stringify(input.context, null, 2)}

## Implementation Steps

### Phase 1: Setup
- [ ] Create package structure
- [ ] Set up tsconfig
- [ ] Install dependencies

### Phase 2: Core Implementation
- [ ] Implement main functionality
- [ ] Add error handling
- [ ] Add logging

### Phase 3: Testing
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Achieve 80%+ coverage

### Phase 4: Documentation
- [ ] Write README
- [ ] Add code comments
- [ ] Create examples

## Quality Requirements

- All tests pass (100%)
- Linting passes (no errors)
- Build succeeds
- Documentation complete

---

Generated by plan-writer-service
${new Date().toISOString()}
`;
}

function getPlanFilePath(packageId: string): string {
  // Convert @bernierllc/package-name to plans/packages/package-name.md
  const packageName = packageId.replace('@bernierllc/', '');
  return `plans/packages/${packageName}.md`;
}
