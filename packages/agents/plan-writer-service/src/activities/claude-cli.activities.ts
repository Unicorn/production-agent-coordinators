/**
 * Claude Code CLI Activities
 *
 * Alternative to API-based activities - uses local Claude Code CLI
 * instead of direct Anthropic API calls.
 *
 * Benefits:
 * - No API key management required
 * - Uses existing Claude Code subscription
 * - Access to all Claude Code features (tools, agents, skills)
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type {
  WritePlanResult,
  WritePlanInputWithContext
} from '../types/index';

const execFileAsync = promisify(execFile);

export interface ClaudeCodeInput {
  prompt: string;
  timeout?: number; // milliseconds
}

export interface ClaudeCodeResult {
  success: boolean;
  output: string;
  error?: string;
  duration: number;
}

/**
 * CLI Activity: Execute Claude Code in non-interactive mode
 *
 * Display Name: "Execute Claude Code CLI"
 * Activity Type: cli
 */
export async function executeClaudeCode(input: ClaudeCodeInput): Promise<ClaudeCodeResult> {
  const startTime = Date.now();

  try {
    console.log(`[executeClaudeCode] Running Claude with prompt (${input.prompt.length} chars)`);

    const args = [
      '--print',
      '--dangerously-skip-permissions',
      '--output-format', 'json',
      input.prompt
    ];

    const { stdout, stderr } = await execFileAsync('claude', args, {
      timeout: input.timeout || 300000, // 5 minutes default
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      env: {
        ...process.env,
      }
    });

    const duration = Date.now() - startTime;

    if (stderr) {
      console.warn(`[executeClaudeCode] stderr output: ${stderr}`);
    }

    console.log(`[executeClaudeCode] Completed in ${duration}ms`);

    // Parse JSON output
    let parsedOutput;
    try {
      parsedOutput = JSON.parse(stdout);
    } catch (e) {
      // If JSON parsing fails, use raw stdout
      parsedOutput = { text: stdout };
    }

    return {
      success: true,
      output: typeof parsedOutput === 'string' ? parsedOutput : JSON.stringify(parsedOutput, null, 2),
      duration
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error(`[executeClaudeCode] Failed: ${errorMessage}`);

    return {
      success: false,
      output: '',
      error: errorMessage,
      duration
    };
  }
}

/**
 * CLI-based Agentic Activity: Spawns Claude Code CLI to write package plan
 *
 * Display Name: "Write package plan (claude-code-cli | plan-writer-v1.0.0)"
 * Activity Type: cli-agentic
 *
 * Alternative to spawnPlanWriterAgent that uses local Claude Code CLI
 * instead of direct Anthropic API calls.
 */
export async function spawnClaudeCodePlanWriter(input: WritePlanInputWithContext): Promise<WritePlanResult> {
  const startTime = Date.now();

  try {
    console.log(`[spawnClaudeCodePlanWriter] Writing plan for ${input.packageId} using Claude Code CLI`);
    console.log(`[spawnClaudeCodePlanWriter] Reason: ${input.reason}`);

    if (input.parentPlanContent) {
      console.log(`[spawnClaudeCodePlanWriter] Using parent context from ${input.parentPackageId}`);
      console.log(`[spawnClaudeCodePlanWriter] Lineage depth: ${input.lineage?.length || 0}`);
    }

    // Build prompt for Claude Code CLI
    const prompt = buildPlanPrompt(input);

    // Execute Claude Code CLI
    const claudeResult = await executeClaudeCode({
      prompt,
      timeout: 300000 // 5 minutes
    });

    if (!claudeResult.success) {
      throw new Error(claudeResult.error || 'Claude Code execution failed');
    }

    // Extract plan content from Claude's response
    const planContent = extractPlanContent(claudeResult.output);
    const planFilePath = getPlanFilePath(input.packageId);

    // Write plan to filesystem
    const fullPath = join(process.cwd(), planFilePath);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, planContent, 'utf-8');

    const duration = Date.now() - startTime;

    console.log(`[spawnClaudeCodePlanWriter] Plan written to ${planFilePath} in ${duration}ms`);

    return {
      success: true,
      planContent,
      planFilePath,
      duration
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error(`[spawnClaudeCodePlanWriter] Failed for ${input.packageId}:`, errorMessage);

    return {
      success: false,
      planContent: '',
      planFilePath: '',
      duration,
      error: errorMessage
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build prompt for Claude Code CLI plan generation
 */
function buildPlanPrompt(input: WritePlanInputWithContext): string {
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

Format the plan as a well-structured Markdown document. Output ONLY the markdown plan, no additional commentary.`;

  return prompt;
}

/**
 * Extract plan content from Claude's JSON response
 */
function extractPlanContent(output: string): string {
  try {
    const parsed = JSON.parse(output);

    // Claude Code CLI with --output-format json returns different structures
    // Try to extract text from various possible formats
    if (parsed.text) {
      return parsed.text;
    }
    if (parsed.content) {
      return parsed.content;
    }
    if (parsed.response) {
      return parsed.response;
    }
    if (typeof parsed === 'string') {
      return parsed;
    }

    // If we can't find a known field, stringify the whole thing
    return JSON.stringify(parsed, null, 2);
  } catch (e) {
    // If parsing fails, assume output is already the plan content
    return output;
  }
}

/**
 * Get plan file path for package ID
 */
function getPlanFilePath(packageId: string): string {
  // Convert @bernierllc/package-name to plans/packages/package-name.md
  const packageName = packageId.replace('@bernierllc/', '');
  return `plans/packages/${packageName}.md`;
}
