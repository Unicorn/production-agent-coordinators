/**
 * Tool Registry for Agent Execution
 *
 * Provides tools that agents can use to interact with the file system,
 * git, and other resources.
 */

import type { Anthropic } from '@anthropic-ai/sdk';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * File change record for tracking modifications
 */
export interface FileChange {
  path: string;
  operation: 'create' | 'update' | 'delete';
  beforeContent?: string;
  afterContent?: string;
  timestamp: string;
}

/**
 * Tool execution context
 */
export interface ToolContext {
  workingDirectory: string;
  changes: FileChange[];
}

/**
 * Tool execution result
 */
export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
  changes?: FileChange[];
}

/**
 * File system tools for agents
 */
export const fileSystemTools: Anthropic.Tool[] = [
  {
    name: 'read_file',
    description: 'Read the contents of a file. Returns the file content as a string.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file to read (relative to working directory)'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'write_file',
    description: 'Write content to a file. Creates the file if it doesn\'t exist, overwrites if it does.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file to write (relative to working directory)'
        },
        content: {
          type: 'string',
          description: 'Content to write to the file'
        }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'list_directory',
    description: 'List files and directories in a directory.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the directory to list (relative to working directory)'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'file_exists',
    description: 'Check if a file or directory exists.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to check (relative to working directory)'
        }
      },
      required: ['path']
    }
  }
];

/**
 * Git tools for agents (read-only context)
 */
export const gitTools: Anthropic.Tool[] = [
  {
    name: 'git_status',
    description: 'Get the current git status showing modified, staged, and untracked files.',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'git_diff',
    description: 'Get the git diff for current changes.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Optional path to get diff for specific file'
        }
      }
    }
  }
];

/**
 * Execute a tool based on its name and input
 */
export async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  context: ToolContext
): Promise<ToolResult> {
  try {
    switch (toolName) {
      case 'read_file':
        return await readFile(toolInput.path as string, context);

      case 'write_file':
        return await writeFile(
          toolInput.path as string,
          toolInput.content as string,
          context
        );

      case 'list_directory':
        return await listDirectory(toolInput.path as string, context);

      case 'file_exists':
        return await fileExists(toolInput.path as string, context);

      case 'git_status':
        return await gitStatus(context);

      case 'git_diff':
        return await gitDiff(toolInput.path as string | undefined, context);

      default:
        return {
          success: false,
          error: `Unknown tool: ${toolName}`
        };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Tool implementations
 */

async function readFile(relativePath: string, context: ToolContext): Promise<ToolResult> {
  const fullPath = path.join(context.workingDirectory, relativePath);

  try {
    const content = await fs.readFile(fullPath, 'utf-8');
    return {
      success: true,
      output: content
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

async function writeFile(
  relativePath: string,
  content: string,
  context: ToolContext
): Promise<ToolResult> {
  const fullPath = path.join(context.workingDirectory, relativePath);

  try {
    // Check if file exists to determine operation type
    let beforeContent: string | undefined;
    let operation: 'create' | 'update' = 'create';

    try {
      beforeContent = await fs.readFile(fullPath, 'utf-8');
      operation = 'update';
    } catch {
      // File doesn't exist, this is a create operation
    }

    // Ensure directory exists
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });

    // Write the file
    await fs.writeFile(fullPath, content, 'utf-8');

    // Track the change
    const change: FileChange = {
      path: relativePath,
      operation,
      beforeContent,
      afterContent: content,
      timestamp: new Date().toISOString()
    };

    context.changes.push(change);

    return {
      success: true,
      output: `Successfully ${operation === 'create' ? 'created' : 'updated'} ${relativePath}`,
      changes: [change]
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to write file: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

async function listDirectory(relativePath: string, context: ToolContext): Promise<ToolResult> {
  const fullPath = path.join(context.workingDirectory, relativePath);

  try {
    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    const formatted = entries.map(entry => {
      const type = entry.isDirectory() ? 'dir' : 'file';
      return `${type}: ${entry.name}`;
    });

    return {
      success: true,
      output: formatted.join('\n')
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to list directory: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

async function fileExists(relativePath: string, context: ToolContext): Promise<ToolResult> {
  const fullPath = path.join(context.workingDirectory, relativePath);

  try {
    await fs.access(fullPath);
    return {
      success: true,
      output: 'true'
    };
  } catch {
    return {
      success: true,
      output: 'false'
    };
  }
}

async function gitStatus(context: ToolContext): Promise<ToolResult> {
  try {
    const { stdout } = await execAsync('git status --porcelain', {
      cwd: context.workingDirectory
    });

    return {
      success: true,
      output: stdout || 'No changes'
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to get git status: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

async function gitDiff(relativePath: string | undefined, context: ToolContext): Promise<ToolResult> {
  try {
    const cmd = relativePath
      ? `git diff ${relativePath}`
      : 'git diff';

    const { stdout } = await execAsync(cmd, {
      cwd: context.workingDirectory
    });

    return {
      success: true,
      output: stdout || 'No changes'
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to get git diff: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Get all available tools
 */
export function getAllTools(): Anthropic.Tool[] {
  return [...fileSystemTools, ...gitTools];
}
