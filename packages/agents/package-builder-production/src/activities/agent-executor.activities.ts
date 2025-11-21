/**
 * Agent Executor Activities
 *
 * Orchestrates the full AI agent execution pipeline for package building.
 * Integrates prompt building, Claude API execution, response parsing, and file operations.
 */

import { buildAgentPrompt } from './prompt-builder.activities.js';
import { executeAgentWithClaude } from './agent-execution.activities.js';
import { parseAgentResponse } from './response-parser.activities.js';
import { applyFileChanges } from './file-operations.activities.js';
import type { AgentExecutionInput, AgentExecutionResult } from '../types/coordinator.types.js';
import type { TaskType, BuildPromptInput } from '../types/index.js';

/**
 * Execute complete AI agent pipeline
 *
 * Orchestrates:
 * 1. Prompt building with quality standards and GitHub context
 * 2. Claude API execution
 * 3. Response parsing and validation
 * 4. File operations (create/update/delete)
 *
 * @param input - Agent execution configuration
 * @returns Execution result with success status and changes
 */
export async function executeRealAgent(input: AgentExecutionInput): Promise<AgentExecutionResult> {
  const { task, context } = input;

  console.log(`[AgentExecutor] Starting real agent execution`);
  console.log(`[AgentExecutor] Task type: ${task.type}`);
  console.log(`[AgentExecutor] Package: ${context.packagePath}`);

  const changes: string[] = [];

  try {
    // Determine plan path from context
    // Convention: plans/{package-path}.md
    const planPath = context.planPath || `${context.packagePath.replace('packages/', 'plans/packages/')}.md`;

    // Step 1: Build comprehensive prompt
    console.log(`[AgentExecutor] [1/4] Building prompt...`);

    const promptInput: BuildPromptInput = {
      agentName: 'package-development-agent',
      taskType: mapTaskTypeToPromptType(task.type),
      instructions: task.instructions,
      packagePath: context.packagePath,
      planPath,
      workspaceRoot: context.workspaceRoot,
      githubContext: context.githubContext,
      includeQualityStandards: true,
      includeFewShotExamples: true,
      includeValidationChecklist: true
    };

    const prompt = await buildAgentPrompt(promptInput);

    console.log(`[AgentExecutor] Prompt: ${prompt.length} chars (~${Math.ceil(prompt.length / 4)} tokens)`);

    // Step 2: Execute with Claude
    console.log(`[AgentExecutor] [2/4] Calling Claude API...`);

    const startTime = Date.now();

    const claudeResponse = await executeAgentWithClaude({
      prompt,
      model: 'claude-sonnet-4-5-20250929',
      temperature: task.type === 'PACKAGE_SCAFFOLDING' ? 0.2 : 0.3,
      maxTokens: 16000
    });

    const duration = Date.now() - startTime;

    console.log(`[AgentExecutor] Claude responded in ${duration}ms`);
    console.log(`[AgentExecutor] Response: ${claudeResponse.length} chars`);

    // Step 3: Parse response
    console.log(`[AgentExecutor] [3/4] Parsing response...`);

    const parsedResponse = await parseAgentResponse({
      responseText: claudeResponse,
      packagePath: context.packagePath
    });

    console.log(`[AgentExecutor] Parsed ${parsedResponse.files.length} file operations`);
    console.log(`[AgentExecutor] Summary: ${parsedResponse.summary}`);

    // Log meta-agent fields if present
    if (parsedResponse.questions && parsedResponse.questions.length > 0) {
      console.log(`[AgentExecutor] Questions: ${parsedResponse.questions.length}`);
      parsedResponse.questions.forEach((q, i) => {
        console.log(`[AgentExecutor]   ${i + 1}. ${q.question}`);
      });
    }

    if (parsedResponse.suggestions && parsedResponse.suggestions.length > 0) {
      console.log(`[AgentExecutor] Suggestions: ${parsedResponse.suggestions.length}`);
    }

    // Step 4: Apply file changes
    console.log(`[AgentExecutor] [4/4] Applying file changes...`);

    const fileResult = await applyFileChanges({
      operations: parsedResponse.files,
      packagePath: context.packagePath,
      workspaceRoot: context.workspaceRoot
    });

    console.log(`[AgentExecutor] Applied ${fileResult.modifiedFiles.length} file changes`);

    if (fileResult.failedOperations.length > 0) {
      console.warn(`[AgentExecutor] Failed operations: ${fileResult.failedOperations.length}`);
      fileResult.failedOperations.forEach(failure => {
        console.warn(`[AgentExecutor]   - ${failure.operation} ${failure.path}: ${failure.error}`);
      });
    }

    // Build changes list for output
    for (const file of fileResult.modifiedFiles) {
      const operation = parsedResponse.files.find(f => f.path === file)?.operation || 'modified';
      changes.push(`${operation}: ${file}`);
    }

    // Success
    return {
      success: true,
      changes,
      output: `Agent completed successfully.\n\nSummary: ${parsedResponse.summary}\n\nFiles modified: ${fileResult.modifiedFiles.length}\nQuestions: ${parsedResponse.questions?.length || 0}\nSuggestions: ${parsedResponse.suggestions?.length || 0}`
    };

  } catch (error) {
    console.error(`[AgentExecutor] Execution failed:`, error);

    return {
      success: false,
      changes,
      output: `Agent execution failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Map task type string to TaskType enum
 *
 * @param taskType - Task type string from coordinator
 * @returns TaskType enum value
 */
function mapTaskTypeToPromptType(taskType: string): TaskType {
  const typeMap: Record<string, TaskType> = {
    'PACKAGE_SCAFFOLDING': 'PACKAGE_SCAFFOLDING',
    'BUILD_FAILURE': 'BUG_FIX',
    'TEST_FAILURE': 'BUG_FIX',
    'QUALITY_FAILURE': 'REFACTORING',
    'FEATURE_IMPLEMENTATION': 'FEATURE_IMPLEMENTATION',
    'BUG_FIX': 'BUG_FIX',
    'REFACTORING': 'REFACTORING',
    'DOCUMENTATION': 'DOCUMENTATION',
    'TESTING': 'TESTING'
  };

  return typeMap[taskType] || 'BUG_FIX';
}
