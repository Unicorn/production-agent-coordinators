/**
 * Hybrid Response Protocol
 *
 * A reusable protocol for AI responses that combines structured JSON metadata
 * with raw file content, separated by a delimiter. This avoids the complexity
 * of encoding file content within JSON (base64, escaping, etc.).
 *
 * ## Format
 *
 * ```
 * {
 *   "command": "APPLY_CODE_CHANGES",
 *   "files": [
 *     { "index": 0, "path": "src/index.ts", "action": "CREATE_OR_OVERWRITE" },
 *     { "index": 1, "path": "src/utils.ts", "action": "INSERT_AT", "line": 15 }
 *   ]
 * }
 *
 * ##---Content-Break-0---##
 * // Content for file at index 0
 * export const hello = "world";
 *
 * ##---Content-Break-1---##
 * // Content for file at index 1
 * function inserted() { return true; }
 * ```
 *
 * ## Benefits
 *
 * - No escaping/encoding headaches
 * - AI writes code naturally
 * - Multiple files per response (saves tokens)
 * - Flexible operations (create, insert, replace, append, delete)
 * - Parser knows exactly what to expect from JSON metadata
 *
 * @module hybrid-response-protocol
 */

import * as fs from 'fs/promises';
import * as path from 'path';

// ============================================================================
// Constants
// ============================================================================

/** The delimiter pattern used to separate content blocks */
export const CONTENT_BREAK_PREFIX = '##---Content-Break-';
export const CONTENT_BREAK_SUFFIX = '---##';

/** Regex to match any content break marker */
export const CONTENT_BREAK_REGEX = /##---Content-Break-(\d+)---##/g;

/** Regex to match the first content break (for splitting JSON from content) */
export const FIRST_CONTENT_BREAK_REGEX = /##---Content-Break-\d+---##/;

// ============================================================================
// Types
// ============================================================================

/**
 * File operation actions supported by the protocol
 */
export type FileAction =
  | 'CREATE_OR_OVERWRITE'  // Replace entire file with content
  | 'INSERT_AT'            // Insert content before specified line
  | 'REPLACE_LINES'        // Replace line range with content
  | 'APPEND'               // Add content to end of file
  | 'DELETE';              // Delete the file (no content needed)

/**
 * Base file operation with common fields
 */
export interface BaseFileOperation {
  /** Index for mapping to content blocks */
  index: number;
  /** Relative file path */
  path: string;
  /** Operation action */
  action: FileAction;
}

/**
 * CREATE_OR_OVERWRITE operation - replaces entire file
 */
export interface CreateOrOverwriteOperation extends BaseFileOperation {
  action: 'CREATE_OR_OVERWRITE';
}

/**
 * INSERT_AT operation - inserts content before specified line
 */
export interface InsertAtOperation extends BaseFileOperation {
  action: 'INSERT_AT';
  /** Line number to insert before (0-indexed) */
  line: number;
}

/**
 * REPLACE_LINES operation - replaces a range of lines
 */
export interface ReplaceLinesOperation extends BaseFileOperation {
  action: 'REPLACE_LINES';
  /** Start line (0-indexed, inclusive) */
  startLine: number;
  /** End line (0-indexed, inclusive) */
  endLine: number;
}

/**
 * APPEND operation - adds content to end of file
 */
export interface AppendOperation extends BaseFileOperation {
  action: 'APPEND';
}

/**
 * DELETE operation - removes the file
 */
export interface DeleteOperation extends BaseFileOperation {
  action: 'DELETE';
}

/**
 * Union type of all file operations
 */
export type FileOperation =
  | CreateOrOverwriteOperation
  | InsertAtOperation
  | ReplaceLinesOperation
  | AppendOperation
  | DeleteOperation;

/**
 * Parsed hybrid response containing JSON payload and content blocks
 */
export interface ParsedHybridResponse<T = Record<string, unknown>> {
  /** The parsed JSON payload */
  json: T;
  /** Map of content block index to content string */
  contentBlocks: Map<number, string>;
  /** Any parsing warnings (non-fatal issues) */
  warnings: string[];
}

/**
 * Result of applying file operations
 */
export interface ApplyOperationsResult {
  /** Files that were successfully modified */
  filesModified: string[];
  /** Files that were deleted */
  filesDeleted: string[];
  /** Any warnings during application */
  warnings: string[];
  /** Any errors (operation continues but logs issues) */
  errors: string[];
}

/**
 * Options for parsing hybrid responses
 */
export interface ParseOptions {
  /** Whether to attempt JSON repair on malformed JSON */
  attemptJsonRepair?: boolean;
  /** Custom JSON repair function */
  jsonRepairFn?: (json: string) => string;
}

/**
 * Options for applying file operations
 */
export interface ApplyOptions {
  /** Base directory for resolving relative paths */
  basePath: string;
  /** Whether to create parent directories if they don't exist */
  createDirectories?: boolean;
  /** Logger function for debug output */
  logger?: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
}

// ============================================================================
// Parser Functions
// ============================================================================

/**
 * Parses a hybrid response string into JSON payload and content blocks.
 *
 * @param response - The raw response string from the AI
 * @param options - Parsing options
 * @returns Parsed response with JSON and content blocks
 *
 * @example
 * ```typescript
 * const response = `
 * {"command": "APPLY_CODE_CHANGES", "files": [{"index": 0, "path": "src/index.ts", "action": "CREATE_OR_OVERWRITE"}]}
 *
 * ##---Content-Break-0---##
 * export const hello = "world";
 * `;
 *
 * const parsed = parseHybridResponse(response);
 * console.log(parsed.json.command); // "APPLY_CODE_CHANGES"
 * console.log(parsed.contentBlocks.get(0)); // 'export const hello = "world";'
 * ```
 */
export function parseHybridResponse<T = Record<string, unknown>>(
  response: string,
  options: ParseOptions = {}
): ParsedHybridResponse<T> {
  const warnings: string[] = [];

  // Step 1: Split on first content break to separate JSON from content
  const firstBreakMatch = response.match(FIRST_CONTENT_BREAK_REGEX);

  let jsonPart: string;
  let contentPart: string;

  if (firstBreakMatch) {
    const splitIndex = response.indexOf(firstBreakMatch[0]);
    jsonPart = response.substring(0, splitIndex).trim();
    contentPart = response.substring(splitIndex);
  } else {
    // No content breaks - entire response is JSON
    jsonPart = response.trim();
    contentPart = '';
  }

  // Step 2: Clean and parse JSON
  jsonPart = cleanJsonString(jsonPart);

  let json: T;
  try {
    json = JSON.parse(jsonPart) as T;
  } catch (parseError) {
    // Attempt repair if enabled
    if (options.attemptJsonRepair && options.jsonRepairFn) {
      try {
        const repairedJson = options.jsonRepairFn(jsonPart);
        json = JSON.parse(repairedJson) as T;
        warnings.push('JSON was malformed and required repair');
      } catch (repairError) {
        throw new Error(
          `Failed to parse JSON even after repair: ${parseError instanceof Error ? parseError.message : String(parseError)}`
        );
      }
    } else {
      throw new Error(
        `Failed to parse JSON payload: ${parseError instanceof Error ? parseError.message : String(parseError)}`
      );
    }
  }

  // Step 3: Extract content blocks
  const contentBlocks = extractContentBlocks(contentPart);

  return {
    json,
    contentBlocks,
    warnings
  };
}

/**
 * Extracts content blocks from the content portion of a hybrid response.
 *
 * @param contentPart - The content portion after the JSON
 * @returns Map of index to content string
 */
export function extractContentBlocks(contentPart: string): Map<number, string> {
  const contentBlocks = new Map<number, string>();

  if (!contentPart.trim()) {
    return contentBlocks;
  }

  // Find all content break markers and their positions
  const markers: Array<{ index: number; position: number }> = [];
  let match: RegExpExecArray | null;

  // Reset regex state
  CONTENT_BREAK_REGEX.lastIndex = 0;

  while ((match = CONTENT_BREAK_REGEX.exec(contentPart)) !== null) {
    markers.push({
      index: parseInt(match[1], 10),
      position: match.index
    });
  }

  // Extract content between markers
  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i];
    const markerEnd = marker.position + `${CONTENT_BREAK_PREFIX}${marker.index}${CONTENT_BREAK_SUFFIX}`.length;

    // Content extends from end of this marker to start of next marker (or end of string)
    const nextMarkerPosition = i + 1 < markers.length
      ? markers[i + 1].position
      : contentPart.length;

    // Extract and trim content (preserve internal whitespace but trim leading/trailing)
    const content = contentPart.substring(markerEnd, nextMarkerPosition).trim();
    contentBlocks.set(marker.index, content);
  }

  return contentBlocks;
}

/**
 * Cleans a JSON string by removing markdown code block wrappers and extra whitespace.
 */
function cleanJsonString(json: string): string {
  let cleaned = json.trim();

  // Remove markdown code block wrappers
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }

  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }

  return cleaned.trim();
}

// ============================================================================
// File Operation Functions
// ============================================================================

/**
 * Applies file operations using content from parsed content blocks.
 *
 * @param operations - Array of file operations to apply
 * @param contentBlocks - Map of content block index to content string
 * @param options - Application options (basePath, logger, etc.)
 * @returns Result with modified/deleted files and any warnings/errors
 *
 * @example
 * ```typescript
 * const operations: FileOperation[] = [
 *   { index: 0, path: 'src/index.ts', action: 'CREATE_OR_OVERWRITE' }
 * ];
 * const contentBlocks = new Map([[0, 'export const x = 1;']]);
 *
 * const result = await applyFileOperations(operations, contentBlocks, {
 *   basePath: '/path/to/package'
 * });
 * ```
 */
export async function applyFileOperations(
  operations: FileOperation[],
  contentBlocks: Map<number, string>,
  options: ApplyOptions
): Promise<ApplyOperationsResult> {
  const { basePath, createDirectories = true, logger } = options;
  const log = logger || {
    info: () => {},
    warn: () => {},
    error: () => {}
  };

  const result: ApplyOperationsResult = {
    filesModified: [],
    filesDeleted: [],
    warnings: [],
    errors: []
  };

  for (const operation of operations) {
    const fullPath = path.join(basePath, operation.path);

    try {
      switch (operation.action) {
        case 'CREATE_OR_OVERWRITE': {
          const content = contentBlocks.get(operation.index);
          if (content === undefined) {
            result.errors.push(`Missing content block for index ${operation.index} (${operation.path})`);
            continue;
          }

          if (createDirectories) {
            await fs.mkdir(path.dirname(fullPath), { recursive: true });
          }

          await fs.writeFile(fullPath, content, 'utf-8');
          result.filesModified.push(operation.path);
          log.info(`CREATE_OR_OVERWRITE: ${operation.path}`);
          break;
        }

        case 'INSERT_AT': {
          const content = contentBlocks.get(operation.index);
          if (content === undefined) {
            result.errors.push(`Missing content block for index ${operation.index} (${operation.path})`);
            continue;
          }

          const existingContent = await readFileOrEmpty(fullPath);
          const lines = existingContent.split('\n');

          // Insert at specified line (0-indexed)
          const insertLine = Math.max(0, Math.min(operation.line, lines.length));
          lines.splice(insertLine, 0, content);

          await fs.writeFile(fullPath, lines.join('\n'), 'utf-8');
          result.filesModified.push(operation.path);
          log.info(`INSERT_AT line ${operation.line}: ${operation.path}`);
          break;
        }

        case 'REPLACE_LINES': {
          const content = contentBlocks.get(operation.index);
          if (content === undefined) {
            result.errors.push(`Missing content block for index ${operation.index} (${operation.path})`);
            continue;
          }

          const existingContent = await readFileOrEmpty(fullPath);
          const lines = existingContent.split('\n');

          // Validate line numbers
          const startLine = Math.max(0, operation.startLine);
          const endLine = Math.min(lines.length - 1, operation.endLine);

          if (startLine > endLine) {
            result.warnings.push(`Invalid line range [${operation.startLine}, ${operation.endLine}] for ${operation.path}`);
          }

          // Remove lines in range and insert new content
          const deleteCount = endLine - startLine + 1;
          lines.splice(startLine, deleteCount, content);

          await fs.writeFile(fullPath, lines.join('\n'), 'utf-8');
          result.filesModified.push(operation.path);
          log.info(`REPLACE_LINES [${startLine}-${endLine}]: ${operation.path}`);
          break;
        }

        case 'APPEND': {
          const content = contentBlocks.get(operation.index);
          if (content === undefined) {
            result.errors.push(`Missing content block for index ${operation.index} (${operation.path})`);
            continue;
          }

          const existingContent = await readFileOrEmpty(fullPath);
          const newContent = existingContent
            ? existingContent + '\n' + content
            : content;

          await fs.writeFile(fullPath, newContent, 'utf-8');
          result.filesModified.push(operation.path);
          log.info(`APPEND: ${operation.path}`);
          break;
        }

        case 'DELETE': {
          try {
            await fs.unlink(fullPath);
            result.filesDeleted.push(operation.path);
            log.info(`DELETE: ${operation.path}`);
          } catch (unlinkError) {
            // File may not exist, which is fine for delete
            const errMsg = unlinkError instanceof Error ? unlinkError.message : String(unlinkError);
            if (errMsg.includes('ENOENT')) {
              result.warnings.push(`File already deleted or doesn't exist: ${operation.path}`);
            } else {
              result.errors.push(`Failed to delete ${operation.path}: ${errMsg}`);
            }
          }
          break;
        }

        default: {
          const _exhaustive: never = operation;
          result.errors.push(`Unknown action: ${JSON.stringify(_exhaustive)}`);
        }
      }
    } catch (opError) {
      const errMsg = opError instanceof Error ? opError.message : String(opError);
      result.errors.push(`Failed to apply ${operation.action} on ${operation.path}: ${errMsg}`);
      log.error(`${operation.action} failed for ${operation.path}: ${errMsg}`);
    }
  }

  return result;
}

/**
 * Reads a file, returning empty string if it doesn't exist.
 */
async function readFileOrEmpty(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return '';
  }
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates that all file operations have corresponding content blocks (where required).
 *
 * @param operations - Array of file operations
 * @param contentBlocks - Map of content blocks
 * @returns Array of validation errors (empty if valid)
 */
export function validateOperationsHaveContent(
  operations: FileOperation[],
  contentBlocks: Map<number, string>
): string[] {
  const errors: string[] = [];

  for (const op of operations) {
    // DELETE doesn't need content
    if (op.action === 'DELETE') {
      continue;
    }

    if (!contentBlocks.has(op.index)) {
      errors.push(`Operation at index ${op.index} (${op.path}, ${op.action}) has no content block`);
    }
  }

  return errors;
}

/**
 * Checks if file operations array contains any content-requiring actions.
 */
export function hasContentRequiringActions(operations: FileOperation[]): boolean {
  return operations.some(op => op.action !== 'DELETE');
}

// ============================================================================
// Prompt Generation Helpers
// ============================================================================

/**
 * Generates instructions for AI on how to format hybrid responses.
 * Use this in your AI prompts to teach the format.
 *
 * @param options - Options for customizing the instructions
 * @returns Instructions string to include in AI prompts
 */
export function generateProtocolInstructions(options?: {
  includeExamples?: boolean;
  actionsToInclude?: FileAction[];
}): string {
  const { includeExamples = true, actionsToInclude } = options || {};

  const actions = actionsToInclude || ['CREATE_OR_OVERWRITE', 'INSERT_AT', 'REPLACE_LINES', 'APPEND', 'DELETE'];

  let instructions = `
## File Operation Response Format

When applying code changes, use this hybrid format that separates JSON metadata from file content:

1. **JSON Payload** - Contains the command and file operation metadata
2. **Content Breaks** - Delimiters that separate file contents, indexed to match JSON

### Available Actions
`;

  if (actions.includes('CREATE_OR_OVERWRITE')) {
    instructions += `
- \`CREATE_OR_OVERWRITE\` - Replace entire file with content`;
  }
  if (actions.includes('INSERT_AT')) {
    instructions += `
- \`INSERT_AT\` - Insert content before line N (0-indexed). Requires \`line\` param.`;
  }
  if (actions.includes('REPLACE_LINES')) {
    instructions += `
- \`REPLACE_LINES\` - Replace lines [startLine, endLine] (inclusive, 0-indexed). Requires \`startLine\` and \`endLine\` params.`;
  }
  if (actions.includes('APPEND')) {
    instructions += `
- \`APPEND\` - Add content to end of file`;
  }
  if (actions.includes('DELETE')) {
    instructions += `
- \`DELETE\` - Delete the file (no content block needed)`;
  }

  instructions += `

### Format Rules

1. JSON must come first, before any content breaks
2. Each file operation with content needs an \`index\` that maps to a content break
3. Content break format: \`##---Content-Break-{index}---##\`
4. DELETE operations don't need content blocks
5. Write file content naturally - no escaping or encoding needed
`;

  if (includeExamples) {
    instructions += `
### Example Response

\`\`\`
{
  "command": "APPLY_CODE_CHANGES",
  "files": [
    { "index": 0, "path": "src/index.ts", "action": "CREATE_OR_OVERWRITE" },
    { "index": 1, "path": "src/utils.ts", "action": "INSERT_AT", "line": 5 },
    { "index": 2, "path": "old-file.ts", "action": "DELETE" }
  ]
}

##---Content-Break-0---##
// Full content for src/index.ts
export const hello = "world";

export function greet(name: string) {
  return \`Hello, \${name}!\`;
}

##---Content-Break-1---##
// This content will be inserted at line 5 of src/utils.ts
function newUtility() {
  return true;
}
\`\`\`

Note: File at index 2 (DELETE) has no content block.
`;
  }

  return instructions.trim();
}

/**
 * Creates a content break marker for a given index.
 */
export function createContentBreak(index: number): string {
  return `${CONTENT_BREAK_PREFIX}${index}${CONTENT_BREAK_SUFFIX}`;
}
