/**
 * Response Parser Activities
 *
 * Parses Claude AI responses into structured data.
 * Implements lenient parsing to preserve extra fields for meta-agent pattern.
 */

import type { ParseResponseInput, AgentResponse } from '../types/index.js';

/**
 * Parse Claude AI response into structured format
 *
 * Handles:
 * - Markdown code block wrapping (```json ... ```)
 * - Lenient JSON parsing (preserves unknown fields)
 * - Validation of required fields
 *
 * @param input - Parse configuration
 * @returns Parsed agent response with files and metadata
 * @throws Error if response is not valid JSON or missing required fields
 */
export async function parseAgentResponse(input: ParseResponseInput): Promise<AgentResponse> {
  const { responseText } = input;

  // Strip markdown code blocks if present
  let jsonText = responseText.trim();

  // Remove ```json or ``` wrappers
  if (jsonText.startsWith('```')) {
    // Find first code block
    const firstBlockEnd = jsonText.indexOf('```', 3);
    if (firstBlockEnd !== -1) {
      // Extract content between first ``` and closing ```
      let blockContent = jsonText.substring(3, firstBlockEnd).trim();

      // Remove language identifier (json, JSON, etc.)
      if (blockContent.startsWith('json') || blockContent.startsWith('JSON')) {
        blockContent = blockContent.substring(4).trim();
      }

      jsonText = blockContent;
    }
  }

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new Error(`Invalid JSON response from Claude: ${error instanceof Error ? error.message : 'Parse error'}`);
  }

  // Validate it's an object
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Response must be a JSON object');
  }

  const response = parsed as Record<string, unknown>;

  // Validate required fields
  if (!Array.isArray(response.files)) {
    throw new Error('Response missing required "files" array');
  }

  if (typeof response.summary !== 'string') {
    throw new Error('Response missing required "summary" string');
  }

  // Validate file operations
  for (const file of response.files) {
    if (typeof file !== 'object' || file === null) {
      throw new Error('Invalid file operation: must be an object');
    }

    const fileOp = file as Record<string, unknown>;

    if (typeof fileOp.path !== 'string') {
      throw new Error('File operation missing "path" string');
    }

    if (!['create', 'update', 'delete'].includes(fileOp.operation as string)) {
      throw new Error(`Invalid operation: ${fileOp.operation}. Must be create, update, or delete`);
    }

    // Content required for create/update
    if (fileOp.operation !== 'delete' && typeof fileOp.content !== 'string') {
      throw new Error(`File operation "${fileOp.path}" missing content`);
    }

    // Security: Validate no path traversal
    if (fileOp.path.includes('..') || fileOp.path.startsWith('/')) {
      throw new Error(`Invalid file path: ${fileOp.path}. Paths must be relative and not contain '..'`);
    }
  }

  // Cast to AgentResponse (lenient - preserves all fields)
  const agentResponse = response as AgentResponse;

  // Log metadata for monitoring
  console.log(`[Parser] Parsed ${agentResponse.files.length} file operations`);
  console.log(`[Parser] Summary: ${agentResponse.summary.substring(0, 60)}...`);

  if (agentResponse.questions) {
    console.log(`[Parser] Questions: ${agentResponse.questions.length}`);
  }

  if (agentResponse.suggestions) {
    console.log(`[Parser] Suggestions: ${agentResponse.suggestions.length}`);
  }

  if (agentResponse.qualityChecklist) {
    const checklistPassed = Object.values(agentResponse.qualityChecklist).filter(v => v === true).length;
    const checklistTotal = Object.values(agentResponse.qualityChecklist).length;
    console.log(`[Parser] Quality checklist: ${checklistPassed}/${checklistTotal} items passed`);
  }

  return agentResponse;
}

/**
 * Validate quality checklist from agent response
 *
 * Checks if all required quality standards were met
 *
 * @param response - Agent response to validate
 * @returns Validation result with warnings for failed checks
 */
export function validateQualityChecklist(response: AgentResponse): {
  passed: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  if (!response.qualityChecklist) {
    warnings.push('No quality checklist provided');
    return { passed: false, warnings };
  }

  const checklist = response.qualityChecklist;

  // Required checks
  const requiredChecks = [
    'strictModeEnabled',
    'noAnyTypes',
    'testCoverageAbove80',
    'allPublicFunctionsDocumented',
    'errorHandlingComplete'
  ];

  for (const check of requiredChecks) {
    if (checklist[check] !== true) {
      warnings.push(`Quality check failed: ${check}`);
    }
  }

  return {
    passed: warnings.length === 0,
    warnings
  };
}

/**
 * Extract file paths from agent response
 *
 * Useful for knowing which files will be modified before applying changes
 *
 * @param response - Agent response
 * @returns Array of file paths grouped by operation
 */
export function extractFilePaths(response: AgentResponse): {
  created: string[];
  updated: string[];
  deleted: string[];
} {
  const created: string[] = [];
  const updated: string[] = [];
  const deleted: string[] = [];

  for (const file of response.files) {
    switch (file.operation) {
      case 'create':
        created.push(file.path);
        break;
      case 'update':
        updated.push(file.path);
        break;
      case 'delete':
        deleted.push(file.path);
        break;
    }
  }

  return { created, updated, deleted };
}
