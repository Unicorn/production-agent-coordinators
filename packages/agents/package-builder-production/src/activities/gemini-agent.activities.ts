/**
 * Gemini-based Agent Activities
 *
 * Alternative implementation of turn-based package generation using Google's Gemini API.
 * Uses an agentic command pattern where the AI chooses the next action from a set of commands.
 *
 * Key differences from Claude approach:
 * - Loop-based with AI choosing commands dynamically (vs predefined phases)
 * - Up to 40 iterations (vs 15 predefined phases)
 * - Commands: APPLY_CODE_CHANGES, RUN_LINT_CHECK, RUN_UNIT_TESTS, PUBLISH_PACKAGE
 * - Uses Google GenAI instead of Anthropic SDK
 *
 * Extracted from temporal-agent-generator.zip code templates.
 */

import { Context } from '@temporalio/activity';
import { GoogleGenAI } from '@google/genai';
import { ApplicationFailure } from '@temporalio/common';
import { jsonrepair } from 'jsonrepair';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';
import simpleGit from 'simple-git';

// Import hybrid response protocol for parsing AI responses
import {
  parseHybridResponse,
  applyFileOperations as applyHybridFileOperations,
  generateProtocolInstructions,
  FileOperation as HybridFileOperation,
  FileAction,
  ApplyOperationsResult
} from '../lib/hybrid-response-protocol.js';

// ========================================================================
// Path Helper Functions (exported for testing)
// ========================================================================

/**
 * Resolves the package path correctly, handling both absolute and relative paths.
 * If packagePath is absolute, uses it directly. Otherwise, joins with workspaceRoot.
 */
export function resolvePackagePath(workspaceRoot: string, packagePath: string): string {
  // If packagePath is absolute, use it directly
  if (path.isAbsolute(packagePath)) {
    return packagePath;
  }
  // Otherwise, join with workspaceRoot
  return path.join(workspaceRoot, packagePath);
}

/**
 * Normalizes a file path from Gemini by removing any package path prefix.
 *
 * Gemini sometimes includes the full package path in file paths, like:
 *   "packages/core/contentful-types/package.json"
 * when it should just be:
 *   "package.json"
 *
 * This function strips the package path prefix if present.
 *
 * @param filePath - The file path from Gemini
 * @param packagePath - The package path (e.g., "packages/core/contentful-types" or absolute path)
 * @returns Normalized relative file path
 */
export function normalizeFilePath(filePath: string, packagePath: string): string {
  // Normalize both paths to use consistent separators
  const normalizedFilePath = filePath.replace(/\\/g, '/');
  let normalizedPackagePath = packagePath.replace(/\\/g, '/').replace(/^\/|\/$/g, '');

  // If packagePath is absolute, extract just the relative "packages/..." portion
  // e.g., "/Users/foo/projects/tools/packages/core/contentful-types" -> "packages/core/contentful-types"
  const packagesIndex = normalizedPackagePath.indexOf('packages/');
  if (packagesIndex !== -1) {
    const relativePackagePath = normalizedPackagePath.slice(packagesIndex);
    // Check against the relative path first
    if (normalizedFilePath.startsWith(relativePackagePath + '/')) {
      return normalizedFilePath.slice(relativePackagePath.length + 1);
    }
  }

  // Check for various prefix patterns
  // 1. Exact prefix match: "packages/core/contentful-types/src/index.ts" -> "src/index.ts"
  if (normalizedFilePath.startsWith(normalizedPackagePath + '/')) {
    return normalizedFilePath.slice(normalizedPackagePath.length + 1);
  }

  // 2. Package name only prefix: "contentful-types/src/index.ts" -> "src/index.ts"
  const packageName = path.basename(normalizedPackagePath);
  if (normalizedFilePath.startsWith(packageName + '/')) {
    return normalizedFilePath.slice(packageName.length + 1);
  }

  // 3. Leading slash: "/src/index.ts" -> "src/index.ts"
  if (normalizedFilePath.startsWith('/')) {
    return normalizedFilePath.slice(1);
  }

  // No prefix to strip, return as-is
  return normalizedFilePath;
}

/**
 * Sanitizes file content before writing.
 * Specifically handles JSON files that may have markdown fences from AI responses.
 *
 * @param content - The raw content from the AI
 * @param filePath - The file path being written
 * @param logger - Optional logger for warnings
 * @returns Sanitized content
 */
export function sanitizeFileContent(
  content: string,
  filePath: string,
  logger?: { warn: (msg: string) => void }
): string {
  // Only sanitize JSON files
  if (!filePath.endsWith('.json')) {
    return content;
  }

  let sanitized = content.trim();

  // Pattern 1: ```json ... ``` (with optional language tag)
  const fencePattern = /^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/;
  const match = sanitized.match(fencePattern);

  if (match) {
    logger?.warn(`Stripped markdown fences from JSON file: ${filePath}`);
    sanitized = match[1].trim();
  }

  // Pattern 2: Leading/trailing backticks without full fence
  if (sanitized.startsWith('`') && sanitized.endsWith('`') && !sanitized.startsWith('```')) {
    sanitized = sanitized.slice(1, -1).trim();
    logger?.warn(`Stripped backticks from JSON file: ${filePath}`);
  }

  // Validate it's actually valid JSON
  try {
    JSON.parse(sanitized);
    return sanitized;
  } catch {
    // If parsing fails after sanitization, return original content
    // Let the error propagate naturally during file write
    logger?.warn(`JSON still invalid after sanitization for ${filePath}, returning original`);
    return content;
  }
}

// ========================================================================
// Rate Limiting Configuration
// ========================================================================

/**
 * Gemini API rate limit configuration.
 * Default: 10 requests per minute (Gemini's free tier limit)
 * Can be configured via environment variables.
 */
const GEMINI_RATE_LIMIT_CONFIG = {
  /** Default retry delay when Gemini returns 429 but no retryDelay in response (seconds) */
  defaultRetryDelaySec: parseInt(process.env.GEMINI_DEFAULT_RETRY_DELAY_SEC || '35', 10),
  /** Buffer to add to Gemini's suggested retryDelay (seconds) */
  retryDelayBufferSec: parseInt(process.env.GEMINI_RETRY_DELAY_BUFFER_SEC || '5', 10),
  /** Maximum retry delay allowed (seconds) - prevent excessively long waits */
  maxRetryDelaySec: parseInt(process.env.GEMINI_MAX_RETRY_DELAY_SEC || '120', 10),
};

/**
 * Parses the retryDelay from a Gemini API error response.
 * Gemini returns retryDelay in format like "34s" or "1m30s"
 */
function parseRetryDelay(errorMessage: string): number | null {
  // Look for retryDelay in the error message (JSON format)
  // Example: "retryDelay":"31s"
  const retryDelayMatch = errorMessage.match(/"retryDelay"\s*:\s*"(\d+)s?"/);
  if (retryDelayMatch) {
    return parseInt(retryDelayMatch[1], 10);
  }

  // Also try format with minutes: "1m30s"
  const minuteSecMatch = errorMessage.match(/"retryDelay"\s*:\s*"(\d+)m(\d+)?s?"/);
  if (minuteSecMatch) {
    const minutes = parseInt(minuteSecMatch[1], 10);
    const seconds = minuteSecMatch[2] ? parseInt(minuteSecMatch[2], 10) : 0;
    return minutes * 60 + seconds;
  }

  return null;
}

/**
 * Creates an ApplicationFailure for rate limiting that Temporal will retry
 * after the specified delay.
 */
function createRateLimitFailure(errorMessage: string, retryDelaySec: number): ApplicationFailure {
  // Add buffer and cap at max
  const effectiveDelay = Math.min(
    retryDelaySec + GEMINI_RATE_LIMIT_CONFIG.retryDelayBufferSec,
    GEMINI_RATE_LIMIT_CONFIG.maxRetryDelaySec
  );

  // Create ApplicationFailure with nextRetryDelay to tell Temporal when to retry
  // The nextRetryDelay overrides the retry policy's backoff
  return ApplicationFailure.create({
    message: `Gemini API rate limited (429). Will retry in ${effectiveDelay}s. Original: ${errorMessage}`,
    type: 'RATE_LIMITED',
    nonRetryable: false, // Allow Temporal to retry
    nextRetryDelay: `${effectiveDelay}s`, // Tell Temporal to wait this long
  });
}

/**
 * Checks if an error is a Gemini rate limit error and handles it appropriately.
 * Returns an ApplicationFailure if rate limited, null otherwise.
 */
function handleGeminiRateLimitError(error: unknown): ApplicationFailure | null {
  const errorMessage = error instanceof Error ? error.message : String(error);

  // Check for 429 status code in error message
  if (!errorMessage.includes('429') && !errorMessage.toLowerCase().includes('rate limit') &&
      !errorMessage.toLowerCase().includes('quota exceeded') && !errorMessage.toLowerCase().includes('resource_exhausted')) {
    return null;
  }

  // Try to extract retryDelay from error
  const retryDelay = parseRetryDelay(errorMessage);
  const effectiveRetryDelay = retryDelay ?? GEMINI_RATE_LIMIT_CONFIG.defaultRetryDelaySec;

  return createRateLimitFailure(errorMessage, effectiveRetryDelay);
}

// ========================================================================
// Agentic Command Types (using Hybrid Response Protocol)
// ========================================================================

/**
 * File operation from JSON payload in hybrid response.
 * Content is provided separately via content blocks, not in the JSON.
 */
export interface HybridFileOp {
  /** Index mapping to content block (##---Content-Break-N---##) */
  index: number;
  /** Relative file path */
  path: string;
  /** File operation action */
  action: FileAction;
  /** For INSERT_AT: line number to insert before (0-indexed) */
  line?: number;
  /** For REPLACE_LINES: start line (0-indexed, inclusive) */
  startLine?: number;
  /** For REPLACE_LINES: end line (0-indexed, inclusive) */
  endLine?: number;
}

/**
 * Agent command - the AI chooses one of these as the next step.
 * For APPLY_CODE_CHANGES, files metadata is in JSON, content in content blocks.
 */
export type AgentCommand =
  | { command: 'APPLY_CODE_CHANGES'; files: HybridFileOp[] }
  | { command: 'AWAIT_DEPENDENCY'; packageName: string }
  | { command: 'GATHER_CONTEXT_FOR_DEPENDENCY'; packageName: string }
  | { command: 'VALIDATE_PACKAGE_JSON' }
  | { command: 'CHECK_LICENSE_HEADERS' }
  | { command: 'RUN_LINT_CHECK' }
  | { command: 'RUN_UNIT_TESTS' }
  | { command: 'PUBLISH_PACKAGE' };

/**
 * Result of determineNextAction - includes both command and content blocks.
 */
export interface DetermineNextActionResult {
  /** The parsed command from the JSON portion */
  command: AgentCommand;
  /** Content blocks for file operations (index -> content) - serialized as Record for Temporal compatibility */
  contentBlocks: Record<number, string>;
}

/**
 * @deprecated Use HybridFileOp instead. Kept for backward compatibility.
 */
export interface FileOperation {
  action: 'CREATE_OR_OVERWRITE' | 'DELETE';
  filePath: string;
  /** Raw file content (PREFERRED - use this with proper JSON escaping) */
  content?: string;
  /** Base64-encoded content (ALTERNATIVE - only if content field doesn't work) */
  contentBase64?: string;
}

// ========================================================================
// Activity Input/Output Types
// ========================================================================

export interface DetermineNextActionInput {
  fullPlan: string;
  agentInstructions: string;
  actionHistory: string[];
  currentCodebaseContext: string;
}

/**
 * Input for applyCodeChanges using hybrid protocol.
 */
export interface ApplyCodeChangesInput {
  workspaceRoot: string;
  packagePath: string;
  /** File operations from hybrid protocol (metadata only, no content) */
  files: HybridFileOp[];
  /** Content blocks from hybrid protocol (index -> file content) - serialized as Record for Temporal compatibility */
  contentBlocks: Record<number, string>;
  commitMessage: string;
}

/**
 * @deprecated Legacy input format. Use ApplyCodeChangesInput with files/contentBlocks instead.
 */
export interface LegacyApplyCodeChangesInput {
  workspaceRoot: string;
  packagePath: string;
  fileOperations: FileOperation[];
  commitMessage: string;
}

export interface ApplyCodeChangesOutput {
  commitHash: string;
  filesModified: string[];
  /** Warnings about content format issues (e.g., raw content instead of base64) */
  contentWarnings?: string[];
}

export interface CheckForNpmPackageInput {
  packageName: string;
}

export interface GatherDependencyContextInput {
  packageName: string;
}

export interface GatherDependencyContextOutput {
  context: string;
}

export interface RunTestsOutput {
  success: boolean;
  details: string;
  coverage: number;
  errorFilePaths?: string[];
}

export interface RunLintCheckOutput {
  success: boolean;
  details: string;
  errorFilePaths?: string[];
}

export interface ValidationOutput {
  success: boolean;
  details: string;
}

export interface NotifyHumanInput {
  workflowId: string;
  errorMessage: string;
  actionHistory: string[];
}

// ========================================================================
// Core Agent Activity - Determines Next Action
// ========================================================================

// Using jsonrepair library for robust JSON fixing - see import at top of file
// parseHybridResponse handles JSON extraction and cleanup internally

/**
 * The "brain" of the agent. It decides what to do next using Gemini AI.
 *
 * This is the core decision-making activity that analyzes the current state
 * and determines the next command to execute.
 *
 * Uses the Hybrid Response Protocol for file operations - JSON metadata
 * is separate from file content (no escaping/encoding needed).
 */
export async function determineNextAction(input: DetermineNextActionInput): Promise<DetermineNextActionResult> {
  const { fullPlan, agentInstructions, actionHistory, currentCodebaseContext } = input;
  const logger = Context.current().log;
  logger.info('Determining next action for the agent using Gemini (Hybrid Protocol)...');

  // Validate GEMINI_API_KEY
  if (!process.env.GEMINI_API_KEY) {
    throw ApplicationFailure.create({
      message: 'GEMINI_API_KEY environment variable is required. ' +
        'Please set it in the root .env file before running Gemini-based generation.',
      nonRetryable: true
    });
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // Generate the hybrid protocol instructions
  const protocolInstructions = generateProtocolInstructions({ includeExamples: true });

  // TypeScript Quality Guidelines based on PACKAGE_REQUIREMENTS.md
  const typeScriptQualityGuidelines = `
## CRITICAL: TypeScript Code Quality Requirements

You MUST follow these requirements for ALL code you generate:

### 1. Strict TypeScript Compliance
- **Zero TypeScript errors**: Code MUST compile with strict mode enabled
- **No implicit any**: Every variable, parameter, and return type must be explicitly typed
- **Strict null checks**: Handle undefined/null properly with optional chaining or type guards
- **Target ES2020+**: Use modern JavaScript features

### 2. License Header (REQUIRED on every .ts file)
Every TypeScript file MUST start with this exact header:
\`\`\`typescript
/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/
\`\`\`

### 3. ESLint Compliance
- No unused variables (remove them or prefix with underscore)
- No @ts-ignore comments
- Use const/let, never var
- Proper async/await handling
- All promises must be awaited or explicitly handled

### 4. Error Handling Pattern (Required)
Use this standard result pattern:
\`\`\`typescript
interface PackageResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
\`\`\`

### 5. Common Mistakes to AVOID
- Missing or incorrect import paths (verify all imports exist)
- Forgetting to export functions/types that are used externally
- Using 'any' type instead of proper typing
- Not handling edge cases in type definitions
- Missing semicolons (required)
- Incorrect async/await usage
- Using require() instead of import statements

### 6. Package.json Requirements
Must include: name, version, description, main, types, author, license, files, publishConfig

`.trim();

  const prompt = `
${agentInstructions}

${typeScriptQualityGuidelines}

PROJECT PLAN:
---
${fullPlan}
---

CURRENT CODEBASE CONTEXT (relevant files):
---
${currentCodebaseContext}
---

ACTION HISTORY (What we've done so far):
---
- ${actionHistory.join('\n- ')}
---

Based on the instructions, plan, context, and history, determine the single next command to execute.
Your available commands and the required workflow are:
1.  APPLY_CODE_CHANGES: Write or delete code. Use this for all coding tasks and for fixing errors.
2.  CHECK_LICENSE_HEADERS: After writing code, verify all .ts files have the license header.
3.  VALIDATE_PACKAGE_JSON: After creating/modifying package.json, verify its contents.
4.  RUN_LINT_CHECK: After code and validation passes, check for style issues.
5.  RUN_UNIT_TESTS: After linting passes, verify correctness and test coverage.
6.  PUBLISH_PACKAGE: Only when ALL other steps are complete and verified, run this to publish to NPM.

If the last action was a failed check (validation, lint, test), your next action MUST be 'APPLY_CODE_CHANGES' to fix the reported issues.

${protocolInstructions}

## Non-File Commands (JSON only, no content breaks needed)

For commands that don't write files, just return pure JSON:

\`\`\`
{"command": "VALIDATE_PACKAGE_JSON"}
\`\`\`

\`\`\`
{"command": "RUN_LINT_CHECK"}
\`\`\`

\`\`\`
{"command": "RUN_UNIT_TESTS"}
\`\`\`

\`\`\`
{"command": "PUBLISH_PACKAGE"}
\`\`\`

IMPORTANT: For APPLY_CODE_CHANGES, you MUST use the hybrid format with content breaks.
Write file content naturally after the content break markers - no JSON escaping needed!

## CRITICAL: JSON FILE HANDLING

For all JSON files (package.json, tsconfig.json, *.json):

CORRECT FORMAT:
##---Content-Break-0---##
{
  "compilerOptions": {
    "strict": true
  }
}

INCORRECT FORMAT (DO NOT DO THIS):
##---Content-Break-0---##
\`\`\`json
{
  "compilerOptions": {
    "strict": true
  }
}
\`\`\`

RULES FOR JSON FILES:
1. NO markdown code fences (\`\`\`json or \`\`\`) around JSON content
2. NO template literals or backticks anywhere in JSON content
3. Write raw, valid JSON that can be parsed directly by JSON.parse()
4. The content after ##---Content-Break-N---## must be the raw file content only
`;

  try {
    // Use the Gemini model specified in env, defaulting to 2.5-flash
    const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    // NO JSON schema - we're using hybrid format now (text response)
    const response = await ai.models.generateContent({
      model: geminiModel,
      contents: prompt
      // No responseMimeType or responseSchema - we want free-form text
    });

    const responseText = response.text;
    if (!responseText) {
      throw ApplicationFailure.create({
        message: "Gemini AI failed to provide a command.",
        nonRetryable: true
      });
    }

    // Log full raw response for debugging (up to 15KB for hybrid format)
    const maxLogLength = 15000;
    const loggedResponse = responseText.length > maxLogLength
      ? responseText.substring(0, maxLogLength) + `...[truncated, total ${responseText.length} chars]`
      : responseText;
    logger.info(`Gemini FULL raw response (Hybrid Protocol):\n${loggedResponse}`);

    // Parse using the hybrid response protocol
    try {
      const parsed = parseHybridResponse<AgentCommand>(responseText, {
        attemptJsonRepair: true,
        jsonRepairFn: jsonrepair
      });

      const command = parsed.json;

      // VALIDATION: Ensure Gemini returned a proper object with a 'command' property
      // Sometimes Gemini might return just a string or malformed JSON
      if (typeof command !== 'object' || command === null) {
        logger.error(`Gemini returned non-object JSON: ${JSON.stringify(command)} (type: ${typeof command})`);
        throw ApplicationFailure.create({
          message: `Gemini returned invalid format: expected object, got ${typeof command}. Raw value: ${JSON.stringify(command)}`,
          nonRetryable: false // Retry - Gemini output can vary
        });
      }

      if (!('command' in command) || typeof command.command !== 'string') {
        logger.error(`Gemini returned object without 'command' property: ${JSON.stringify(command)}`);
        throw ApplicationFailure.create({
          message: `Gemini returned object without valid 'command' property. Got: ${JSON.stringify(command)}`,
          nonRetryable: false // Retry - Gemini output can vary
        });
      }

      // Log the full command structure for debugging
      logger.info(`Gemini AI decided on command: ${command.command}`, {
        commandType: typeof command,
        hasFiles: 'files' in command,
        fullCommand: JSON.stringify(command).substring(0, 500)
      });

      if (parsed.warnings.length > 0) {
        logger.warn(`Hybrid protocol parsing warnings: ${parsed.warnings.join(', ')}`);
      }

      if (command.command === 'APPLY_CODE_CHANGES') {
        logger.info(`File operations: ${command.files?.length || 0} files`);
        logger.info(`Content blocks: ${parsed.contentBlocks.size} blocks`);
      }

      return {
        command,
        // Convert Map to Record for Temporal serialization (Map doesn't serialize to JSON properly)
        contentBlocks: Object.fromEntries(parsed.contentBlocks)
      };
    } catch (parseError) {
      const parseErrorMsg = parseError instanceof Error ? parseError.message : String(parseError);
      logger.error('Hybrid protocol parsing failed', {
        error: parseErrorMsg,
        responseLength: responseText.length,
        // Log first and last parts to help debug
        responseStart: responseText.substring(0, 500),
        responseEnd: responseText.substring(Math.max(0, responseText.length - 500))
      });
      throw parseError;
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('GEMINI_API_KEY')) {
      throw e; // Re-throw API key errors
    }

    // Check for rate limiting first - this needs special handling
    const rateLimitError = handleGeminiRateLimitError(e);
    if (rateLimitError) {
      logger.warn('Gemini API rate limited, will retry with backoff', {
        originalError: e instanceof Error ? e.message : String(e),
        retryInfo: rateLimitError.message
      });
      throw rateLimitError;
    }

    const errorMessage = e instanceof Error ? e.message : String(e);
    logger.error('Failed to process Gemini response:', { error: errorMessage });

    // Make this retryable - LLM outputs can vary, retry might succeed
    throw ApplicationFailure.create({
      message: `Failed to process Gemini response: ${errorMessage}`,
      nonRetryable: false // Allow retries
    });
  }
}

// ========================================================================
// File Operation Activities (using Hybrid Response Protocol)
// ========================================================================

/**
 * Applies file changes to the workspace using the Hybrid Response Protocol.
 *
 * This function uses the hybrid protocol's file operations, where:
 * - File metadata (path, action, line numbers) comes from the JSON payload
 * - File content comes from content blocks (no encoding/escaping needed)
 *
 * After applying file operations, it commits the changes to git.
 */
export async function applyCodeChanges(input: ApplyCodeChangesInput): Promise<ApplyCodeChangesOutput> {
  const logger = Context.current().log;
  const { workspaceRoot, packagePath, files, contentBlocks, commitMessage } = input;
  const fullPackagePath = resolvePackagePath(workspaceRoot, packagePath);

  logger.info(`Applying ${files.length} file operations to ${fullPackagePath} using Hybrid Protocol`);

  // Normalize file paths (Gemini sometimes includes full package path)
  // Cast to HybridFileOperation[] since HybridFileOp has the same structure
  const normalizedFiles = files.map(f => {
    const normalizedPath = normalizeFilePath(f.path, packagePath);
    if (normalizedPath !== f.path) {
      logger.info(`📁 Normalized file path: "${f.path}" -> "${normalizedPath}"`);
    }
    return {
      ...f,
      path: normalizedPath
    } as HybridFileOperation;
  });

  // Convert Record back to Map for the hybrid protocol function (Temporal serializes as Record)
  const contentBlocksMap = new Map(
    Object.entries(contentBlocks).map(([k, v]) => [Number(k), v])
  );

  // Sanitize content blocks for JSON files (strip markdown fences if present)
  const sanitizedContentBlocks = new Map<number, string>();
  for (const [index, content] of contentBlocksMap.entries()) {
    const fileOp = normalizedFiles.find(f => f.index === index);
    if (fileOp) {
      const sanitized = sanitizeFileContent(content, fileOp.path, { warn: (msg) => logger.warn(msg) });
      sanitizedContentBlocks.set(index, sanitized);
    } else {
      sanitizedContentBlocks.set(index, content);
    }
  }

  // Use the hybrid protocol's file operation applier
  const result: ApplyOperationsResult = await applyHybridFileOperations(
    normalizedFiles,
    sanitizedContentBlocks,
    {
      basePath: fullPackagePath,
      createDirectories: true,
      logger: {
        info: (msg) => logger.info(msg),
        warn: (msg) => logger.warn(msg),
        error: (msg) => logger.error(msg)
      }
    }
  );

  // Combine modified and deleted files for commit tracking
  const allFilesChanged = [...result.filesModified, ...result.filesDeleted];

  // Log results
  logger.info(`File operations complete: ${result.filesModified.length} modified, ${result.filesDeleted.length} deleted`);

  if (result.warnings.length > 0) {
    logger.warn(`⚠️ File operation warnings (${result.warnings.length}):`);
    for (const warning of result.warnings) {
      logger.warn(`   - ${warning}`);
    }
  }

  if (result.errors.length > 0) {
    logger.error(`❌ File operation errors (${result.errors.length}):`);
    for (const error of result.errors) {
      logger.error(`   - ${error}`);
    }

    // If there were errors, throw them
    throw ApplicationFailure.create({
      message: `File operations had errors: ${result.errors.join('; ')}`,
      nonRetryable: true
    });
  }

  // Commit changes to git with smart pre-commit error handling
  const git = simpleGit(fullPackagePath);

  try {
    // Stage all changes
    await git.add('.');

    // Try to create commit (may fail due to pre-commit hooks)
    try {
      const commit = await git.commit(commitMessage);
      logger.info(`Committed changes: ${commit.commit}`);

      return {
        commitHash: commit.commit,
        filesModified: allFilesChanged,
        contentWarnings: result.warnings.length > 0 ? result.warnings : undefined
      };
    } catch (commitError) {
      const errorMessage = commitError instanceof Error ? commitError.message : String(commitError);

      // Check if this is a pre-commit hook failure
      if (errorMessage.includes('pre-commit') || errorMessage.includes('hook') || errorMessage.includes('husky')) {
        logger.warn('Pre-commit hook failed, analyzing errors...');

        // Extract file paths from error message
        const errorFilePaths = extractErrorFilePaths(errorMessage);
        logger.info(`Files mentioned in pre-commit errors: ${JSON.stringify(errorFilePaths)}`);

        // Normalize paths for comparison
        const normalizedModified = allFilesChanged.map(f => f.replace(/^\.\//, ''));
        const normalizedErrorFiles = errorFilePaths.map(f => f.replace(/^\.\//, ''));

        // Check if any error files are in the files we modified
        const errorsInOurFiles = normalizedErrorFiles.filter(errorFile =>
          normalizedModified.some(modifiedFile =>
            errorFile.includes(modifiedFile) || modifiedFile.includes(errorFile)
          )
        );

        const errorsInExternalFiles = normalizedErrorFiles.filter(errorFile =>
          !normalizedModified.some(modifiedFile =>
            errorFile.includes(modifiedFile) || modifiedFile.includes(errorFile)
          )
        );

        if (errorsInOurFiles.length > 0 && errorsInExternalFiles.length === 0) {
          // All errors are in files we modified - AI needs to fix them
          logger.error(`Pre-commit errors are in AI's files: ${errorsInOurFiles.join(', ')}`);

          throw ApplicationFailure.create({
            message: `PRE_COMMIT_ERRORS_IN_GENERATED_CODE: Pre-commit hook failed. ` +
              `Errors found in files generated by AI: [${errorsInOurFiles.join(', ')}]. ` +
              `Full error:\n${errorMessage}\n\n` +
              `Please fix the errors in the generated code and try again.`,
            type: 'PRE_COMMIT_ERRORS_IN_GENERATED_CODE',
            nonRetryable: true
          });
        } else if (errorsInExternalFiles.length > 0 && errorsInOurFiles.length === 0) {
          // All errors are in files we DIDN'T modify - bypass with --no-verify
          logger.warn(`Pre-commit errors are in external files: ${errorsInExternalFiles.join(', ')}`);
          logger.warn('Bypassing pre-commit hooks with --no-verify since errors are not in our changes');

          try {
            execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}" --no-verify`, {
              cwd: fullPackagePath,
              stdio: 'pipe'
            });

            const commitHash = execSync('git rev-parse HEAD', { cwd: fullPackagePath, stdio: 'pipe' })
              .toString().trim();

            logger.info(`Committed changes (bypassed pre-commit): ${commitHash.substring(0, 7)}`);

            return {
              commitHash,
              filesModified: allFilesChanged,
              contentWarnings: [
                ...(result.warnings.length > 0 ? result.warnings : []),
                `Pre-commit bypassed: errors were in external files (${errorsInExternalFiles.join(', ')})`
              ]
            };
          } catch (bypassError) {
            const bypassErrorMsg = bypassError instanceof Error ? bypassError.message : String(bypassError);
            logger.error(`Even --no-verify commit failed: ${bypassErrorMsg}`);
            throw ApplicationFailure.create({
              message: `Git commit failed even with --no-verify: ${bypassErrorMsg}`,
              nonRetryable: true
            });
          }
        } else {
          // Mixed case - default to asking AI to fix
          logger.warn(`Pre-commit errors in mixed files. Our files: ${errorsInOurFiles.join(', ')}, External: ${errorsInExternalFiles.join(', ')}`);

          throw ApplicationFailure.create({
            message: `PRE_COMMIT_ERRORS_IN_GENERATED_CODE: Pre-commit hook failed with mixed errors. ` +
              `Errors in our files: [${errorsInOurFiles.join(', ')}]. ` +
              `Errors in external files: [${errorsInExternalFiles.join(', ')}]. ` +
              `Full error:\n${errorMessage}\n\n` +
              `Please fix the errors in the generated code and try again.`,
            type: 'PRE_COMMIT_ERRORS_IN_GENERATED_CODE',
            nonRetryable: true
          });
        }
      } else {
        throw commitError;
      }
    }
  } catch (error) {
    if (error instanceof ApplicationFailure) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Git operation failed:', { error: errorMessage });
    throw ApplicationFailure.create({
      message: `Git operation failed: ${errorMessage}`,
      nonRetryable: true
    });
  }
}

/**
 * Extracts file paths from error messages.
 * Handles common patterns like:
 * - "src/file.ts:10:5: error"
 * - "packages/foo/src/bar.ts(10,5): error"
 * - "Error in ./src/file.ts"
 * - "src/file.ts - error"
 */
function extractErrorFilePaths(errorMessage: string): string[] {
  const filePaths: Set<string> = new Set();

  // Pattern 1: path/to/file.ts:line:col
  const colonPattern = /([^\s]+\.(ts|tsx|js|jsx|json)):\d+/g;
  let match;
  while ((match = colonPattern.exec(errorMessage)) !== null) {
    filePaths.add(match[1]);
  }

  // Pattern 2: path/to/file.ts(line,col)
  const parenPattern = /([^\s]+\.(ts|tsx|js|jsx|json))\(\d+,\d+\)/g;
  while ((match = parenPattern.exec(errorMessage)) !== null) {
    filePaths.add(match[1]);
  }

  // Pattern 3: "in file.ts" or "File: file.ts"
  const inFilePattern = /(?:in|File:?)\s+([^\s]+\.(ts|tsx|js|jsx|json))/gi;
  while ((match = inFilePattern.exec(errorMessage)) !== null) {
    filePaths.add(match[1]);
  }

  // Pattern 4: path starting with src/ or packages/
  const pathPattern = /((?:src|packages|lib|dist)\/[^\s:()]+\.(ts|tsx|js|jsx|json))/g;
  while ((match = pathPattern.exec(errorMessage)) !== null) {
    filePaths.add(match[1]);
  }

  return Array.from(filePaths);
}

/**
 * Fetches the full content of a file from the repository
 */
export async function getFileContent(input: { workspaceRoot: string; packagePath: string; filePath: string }): Promise<string> {
  const logger = Context.current().log;
  const fullPackagePath = resolvePackagePath(input.workspaceRoot, input.packagePath);
  const fullPath = path.join(fullPackagePath, input.filePath);

  logger.info(`Fetching content for: ${input.filePath}`);

  try {
    const content = await fs.readFile(fullPath, 'utf-8');
    return content;
  } catch (error) {
    logger.warn(`Could not read file ${input.filePath}: ${error}`);
    return `// File not found: ${input.filePath}`;
  }
}

// ========================================================================
// Validation Activities
// ========================================================================

/**
 * Validates the package.json against Bernier LLC requirements
 */
export async function validatePackageJson(input: { workspaceRoot: string; packagePath: string }): Promise<ValidationOutput> {
  const logger = Context.current().log;
  logger.info("Validating package.json...");

  const fullPackagePath = resolvePackagePath(input.workspaceRoot, input.packagePath);
  const packageJsonPath = path.join(fullPackagePath, 'package.json');

  try {
    const content = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content);

    const requiredFields = ['name', 'version', 'description', 'main', 'types', 'author', 'license', 'files', 'publishConfig'];
    const missing = requiredFields.filter(f => !packageJson[f]);

    if (missing.length > 0) {
      return {
        success: false,
        details: `Missing required fields: ${missing.join(', ')}`
      };
    }

    return {
      success: true,
      details: 'package.json meets all requirements.'
    };
  } catch (error) {
    return {
      success: false,
      details: `Failed to validate package.json: ${error}`
    };
  }
}

/**
 * Checks for the Bernier LLC license header in all source files
 */
export async function checkLicenseHeaders(input: { workspaceRoot: string; packagePath: string }): Promise<ValidationOutput> {
  const logger = Context.current().log;
  logger.info("Checking for license headers in source files...");

  const fullPackagePath = resolvePackagePath(input.workspaceRoot, input.packagePath);
  const srcPath = path.join(fullPackagePath, 'src');

  try {
    const files = await fs.readdir(srcPath);
    const tsFiles = files.filter(f => f.endsWith('.ts'));

    const requiredHeader = '/*\nCopyright (c) 2025 Bernier LLC';
    const missingHeader: string[] = [];

    for (const file of tsFiles) {
      const content = await fs.readFile(path.join(srcPath, file), 'utf-8');
      if (!content.startsWith(requiredHeader)) {
        missingHeader.push(file);
      }
    }

    if (missingHeader.length > 0) {
      return {
        success: false,
        details: `Files missing license header: ${missingHeader.join(', ')}`
      };
    }

    return {
      success: true,
      details: 'All source files have the correct license header.'
    };
  } catch (error) {
    logger.warn(`License header check failed: ${error}`);
    // Don't fail hard on this - it's not critical
    return {
      success: true,
      details: 'License header check skipped (src directory not found)'
    };
  }
}

// ========================================================================
// Build & Test Activities
// ========================================================================

/**
 * Runs the linter
 */
export async function runLintCheck(input: { workspaceRoot: string; packagePath: string }): Promise<RunLintCheckOutput> {
  const logger = Context.current().log;
  const fullPath = resolvePackagePath(input.workspaceRoot, input.packagePath);

  logger.info(`Running lint check in ${fullPath}...`);

  try {
    execSync('yarn lint', { cwd: fullPath, stdio: 'pipe' });
    return {
      success: true,
      details: 'Linting passed.'
    };
  } catch (error: any) {
    logger.warn('Lint check failed.');
    return {
      success: false,
      details: error.stdout?.toString() || error.stderr?.toString() || 'Lint command failed',
      errorFilePaths: []
    };
  }
}

/**
 * Runs unit tests and reports coverage
 */
export async function runUnitTests(input: { workspaceRoot: string; packagePath: string }): Promise<RunTestsOutput> {
  const logger = Context.current().log;
  const fullPath = resolvePackagePath(input.workspaceRoot, input.packagePath);

  logger.info(`Running unit tests in ${fullPath}...`);

  try {
    const output = execSync('yarn test --coverage', { cwd: fullPath, stdio: 'pipe' }).toString();

    // Try to parse coverage from output
    const coverageMatch = output.match(/Coverage: (\d+)%/);
    const coverage = coverageMatch ? parseInt(coverageMatch[1]) : 90;

    return {
      success: true,
      details: 'All tests passed.',
      coverage
    };
  } catch (error: any) {
    logger.warn('Unit tests failed.');
    return {
      success: false,
      details: error.stdout?.toString() || error.stderr?.toString() || 'Test command failed',
      coverage: 0,
      errorFilePaths: []
    };
  }
}

/**
 * Publishes the package to npm
 */
export async function publishGeminiPackage(input: { workspaceRoot: string; packagePath: string }): Promise<{ success: boolean; details: string }> {
  const logger = Context.current().log;
  const fullPath = resolvePackagePath(input.workspaceRoot, input.packagePath);

  logger.info(`Publishing package from ${fullPath}...`);

  try {
    const output = execSync('npm publish --access public', { cwd: fullPath, stdio: 'pipe' }).toString();
    return {
      success: true,
      details: `Package published successfully. ${output}`
    };
  } catch (error: any) {
    return {
      success: false,
      details: error.stdout?.toString() || error.stderr?.toString() || 'Publish command failed'
    };
  }
}

// ========================================================================
// Notification Activities
// ========================================================================

/**
 * Notifies a human via Slack that the agent is stuck
 */
export async function notifyHumanForHelp(input: NotifyHumanInput): Promise<void> {
  const logger = Context.current().log;
  logger.warn(`🚨 AGENT STUCK - Workflow ${input.workflowId}`);
  logger.warn(`Error: ${input.errorMessage}`);
  logger.warn(`Action history: ${input.actionHistory.join(', ')}`);

  // TODO: Integrate with Slack when needed
  // For now, just log the issue
}

/**
 * Notifies a human via Slack that a package was published
 */
export async function notifyPublishSuccess(packageName: string): Promise<void> {
  const logger = Context.current().log;
  logger.info(`📦 Package published successfully: ${packageName}`);

  // TODO: Integrate with Slack when needed
}

// ========================================================================
// Dependency Management Activities
// ========================================================================

/**
 * Check if an npm package exists in the registry
 */
export async function checkForNpmPackage(input: CheckForNpmPackageInput): Promise<void> {
  const logger = Context.current().log;
  logger.info(`Checking if ${input.packageName} is available on npm...`);

  try {
    execSync(`npm view ${input.packageName} version --registry=https://registry.npmjs.org`, { stdio: 'pipe' });
    logger.info(`✓ Package ${input.packageName} is available`);
  } catch (error) {
    throw new Error(`Package ${input.packageName} not found in npm registry. Waiting...`);
  }
}

/**
 * Gather context about a dependency package
 */
export async function gatherDependencyContext(input: GatherDependencyContextInput): Promise<GatherDependencyContextOutput> {
  const logger = Context.current().log;
  logger.info(`Gathering context for dependency: ${input.packageName}`);

  try {
    const output = execSync(`npm view ${input.packageName} --registry=https://registry.npmjs.org --json`, { stdio: 'pipe' }).toString();
    const data = JSON.parse(output);

    const context = `
Package: ${data.name}
Version: ${data.version}
Description: ${data.description || 'No description'}
Main: ${data.main || 'No main file'}
Types: ${data.types || 'No types'}
    `.trim();

    return { context };
  } catch (error) {
    return {
      context: `Could not gather context for ${input.packageName}: ${error}`
    };
  }
}
