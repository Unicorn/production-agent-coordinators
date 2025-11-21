/**
 * Prompt Builder Activities
 *
 * Responsible for constructing context-rich prompts for Claude AI agent.
 * Includes plan content, quality standards, few-shot examples, and GitHub context.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { BuildPromptInput } from '../types/index.js';
import { getQualityStandards } from '../templates/quality-standards.js';
import { getFewShotExample } from '../templates/few-shot-examples.js';
import {
  isValidGitHubContext,
  fetchGitHubFiles,
  buildGitHubContextSection
} from '../helpers/github.helpers.js';

/**
 * Build a comprehensive prompt for Claude AI agent
 *
 * This is a Temporal activity that constructs prompts with:
 * - Task instructions and context
 * - Package plan content
 * - Quality standards (optional)
 * - Few-shot examples (optional)
 * - Validation checklist (optional)
 * - GitHub repository context (optional)
 *
 * @param input - Prompt building configuration
 * @returns Formatted prompt string ready for Claude API
 */
export async function buildAgentPrompt(input: BuildPromptInput): Promise<string> {
  const {
    agentName,
    taskType,
    instructions,
    packagePath,
    planPath,
    workspaceRoot,
    githubContext,
    includeQualityStandards = true,
    includeFewShotExamples = true,
    includeValidationChecklist = true
  } = input;

  // Load plan file content - try multiple locations
  const absolutePlanPath = path.isAbsolute(planPath)
    ? planPath
    : path.join(workspaceRoot, planPath);

  let planContent: string;

  try {
    planContent = await fs.readFile(absolutePlanPath, 'utf-8');
  } catch (error) {
    // If not found, try the completed directory
    // plans/packages/core/foo.md -> plans/completed/core/foo.md
    const completedPath = absolutePlanPath.replace('/packages/', '/completed/');

    try {
      planContent = await fs.readFile(completedPath, 'utf-8');
      console.log(`[PromptBuilder] Found plan in completed directory: ${completedPath}`);
    } catch (completedError) {
      // If still not found, try packages/completed
      // plans/packages/core/foo.md -> plans/packages/completed/core/foo.md
      const packagesCompletedPath = absolutePlanPath.replace('/packages/core/', '/packages/completed/core/')
                                                    .replace('/packages/service/', '/packages/completed/service/');

      try {
        planContent = await fs.readFile(packagesCompletedPath, 'utf-8');
        console.log(`[PromptBuilder] Found plan in packages/completed directory: ${packagesCompletedPath}`);
      } catch (packagesCompletedError) {
        throw new Error(`Plan file not found at any of:\n  - ${absolutePlanPath}\n  - ${completedPath}\n  - ${packagesCompletedPath}`);
      }
    }
  }

  // Build prompt sections
  const sections: string[] = [];

  // 1. System context and role
  sections.push(`
# Package Development Agent

You are **${agentName}**, an AI agent specialized in building high-quality TypeScript packages.

## Your Task

**Task Type:** ${taskType}
**Package Path:** ${packagePath}

${instructions}
`);

  // 2. Package plan
  sections.push(`
## Package Plan

${planContent}
`);

  // 3. Quality standards (if requested)
  if (includeQualityStandards) {
    const standards = getQualityStandards({
      minCoverage: 80,
      maxFileLines: 300,
      includeChecklist: includeValidationChecklist
    });
    sections.push(standards);
  }

  // 4. Few-shot examples (if requested)
  if (includeFewShotExamples) {
    const example = getFewShotExample(taskType);
    sections.push(example);
  }

  // 5. GitHub context (if available and valid)
  if (isValidGitHubContext(githubContext)) {
    try {
      // Fetch relevant files from repository
      // Start with common configuration files
      const filesToFetch = [
        'package.json',
        'tsconfig.json',
        'tsconfig.base.json',
        '.prettierrc',
        '.eslintrc.json'
      ];

      // Add package-specific files if they exist
      filesToFetch.push(
        `${packagePath}/package.json`,
        `${packagePath}/tsconfig.json`,
        `${packagePath}/README.md`
      );

      const githubFiles = await fetchGitHubFiles(githubContext, filesToFetch);

      if (githubFiles.size > 0) {
        const contextSection = buildGitHubContextSection(githubFiles);
        sections.push(contextSection);
      }
    } catch (error) {
      // Log error but don't fail - GitHub context is optional
      console.warn('Failed to fetch GitHub context:', error);
    }
  }

  // 6. Response format instructions
  sections.push(`
## Response Format

You MUST respond with a valid JSON object in the following format:

\`\`\`json
{
  "files": [
    {
      "path": "relative/path/to/file.ts",
      "operation": "create" | "update" | "delete",
      "content": "complete file content here (not diffs!)"
    }
  ],
  "summary": "Brief description of what was implemented",
  "qualityChecklist": {
    "strictModeEnabled": true,
    "noAnyTypes": true,
    "testCoverageAbove80": true,
    "allPublicFunctionsDocumented": true,
    "errorHandlingComplete": true
  },
  "questions": [
    {
      "question": "Clarifying question if needed",
      "context": "Why you're asking",
      "suggestedAnswer": "Your recommended answer"
    }
  ],
  "suggestions": [
    {
      "type": "ADDITIONAL_FILE" | "REFACTORING" | "OPTIMIZATION" | "TESTING",
      "description": "Suggestion for improvement",
      "priority": "low" | "medium" | "high",
      "autoExecute": false
    }
  ]
}
\`\`\`

**Important Response Guidelines:**

1. **Complete File Content**: Always provide FULL file content, never diffs or partial code
2. **Relative Paths**: All file paths must be relative to package root (${packagePath})
3. **ES Module Extensions**: All imports must include \`.js\` extension
4. **No Markdown Wrapper**: Return raw JSON, not wrapped in \`\`\`json blocks
5. **Quality Checklist**: Verify ALL items are true before responding
6. **Questions**: Ask if requirements are unclear or decisions needed
7. **Suggestions**: Propose improvements for follow-up work

**Quality Verification:**

Before responding, verify:
- [ ] All TypeScript code compiles with strict mode
- [ ] No \`any\` types used
- [ ] All exports have JSDoc comments
- [ ] Tests included for all functions
- [ ] Error handling complete
- [ ] All imports use \`.js\` extension
- [ ] package.json has \`"type": "module"\`

**Path Examples:**

Good: \`src/index.ts\`, \`tests/logger.test.ts\`, \`package.json\`
Bad: \`${packagePath}/src/index.ts\`, \`/absolute/path/file.ts\`
`);

  // Combine all sections
  return sections.join('\n\n' + '─'.repeat(80) + '\n\n');
}

/**
 * Estimate token count for a prompt
 *
 * Uses rough approximation of ~4 characters per token
 *
 * @param prompt - Prompt text to estimate
 * @returns Estimated token count
 */
export function estimateTokenCount(prompt: string): number {
  return Math.ceil(prompt.length / 4);
}

/**
 * Validate prompt before sending to Claude
 *
 * Checks for common issues that could cause failures
 *
 * @param prompt - Prompt to validate
 * @returns Validation result with any warnings
 */
export function validatePrompt(prompt: string): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  // Check token count (Claude Sonnet 4.5 has 200k token limit)
  const tokenCount = estimateTokenCount(prompt);
  if (tokenCount > 100000) {
    warnings.push(`Prompt is very large (${tokenCount} tokens) - may hit token limits`);
  }

  // Check for required sections
  if (!prompt.includes('Package Plan')) {
    warnings.push('Prompt missing package plan section');
  }

  if (!prompt.includes('Response Format')) {
    warnings.push('Prompt missing response format instructions');
  }

  // Check for absolute paths (common mistake)
  const absolutePathPattern = /\/Users\/|\/home\/|C:\\/;
  if (absolutePathPattern.test(prompt)) {
    warnings.push('Prompt contains absolute file paths - use relative paths instead');
  }

  return {
    valid: warnings.length === 0,
    warnings
  };
}
