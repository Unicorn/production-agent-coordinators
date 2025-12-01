#!/usr/bin/env tsx
/**
 * Register Workflow Builder Activities
 * 
 * This script registers all activities from the workflow-builder package
 * into the activity registry database.
 * 
 * Usage:
 *   tsx scripts/register-activities.ts
 * 
 * Environment Variables:
 *   - SUPABASE_URL: Supabase project URL
 *   - SUPABASE_SERVICE_ROLE_KEY: Service role key for admin access
 *   - SYSTEM_USER_ID: UUID of system user (optional, will use first user if not provided)
 */

import { createClient } from '@supabase/supabase-js';
import { createActivityRegistry } from '../src/lib/activities/activity-registry';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const registry = createActivityRegistry(supabase);

// Get system user ID
async function getSystemUserId(): Promise<string> {
  // Try to find system user first
  const { data: systemUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', 'system@workflow-builder.local')
    .single();

  if (systemUser) {
    return systemUser.id;
  }

  // Fall back to first user
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .limit(1);

  if (!users || users.length === 0) {
    throw new Error('No users found in database. Please create a user first.');
  }

  return users[0].id;
}

// Activity definitions with JSON schemas
const activities = [
  // ============================================================================
  // File System Activities
  // ============================================================================
  {
    name: 'findFiles',
    description: 'Find files in a directory using glob patterns or regex',
    inputSchema: {
      type: 'object',
      properties: {
        workspacePath: { type: 'string', description: 'Base directory to search' },
        pattern: { type: 'string', description: 'Glob pattern or regex to match files' },
        recursive: { type: 'boolean', default: true, description: 'Search subdirectories' },
        caseSensitive: { type: 'boolean', default: false, description: 'Case-sensitive matching' },
      },
      required: ['workspacePath', 'pattern'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        files: { type: 'array', items: { type: 'string' }, description: 'List of matching file paths' },
        count: { type: 'number', description: 'Number of files found' },
        error: { type: 'string' },
      },
    },
    packageName: '@coordinator/workflow-builder',
    modulePath: './src/lib/activities/file-system.activities',
    functionName: 'findFiles',
    category: 'File',
    tags: ['file', 'search', 'glob', 'pattern', 'discovery'],
    examples: {
      basic: {
        input: { workspacePath: './src', pattern: '*.ts', recursive: true },
        output: { success: true, files: ['src/index.ts', 'src/app.ts'], count: 2 },
      },
    },
  },
  {
    name: 'readFile',
    description: 'Read the contents of a file',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Path to file to read' },
        encoding: { type: 'string', default: 'utf8', enum: ['utf8', 'base64', 'ascii'], description: 'File encoding' },
      },
      required: ['filePath'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        content: { type: 'string', description: 'File contents' },
        size: { type: 'number', description: 'File size in bytes' },
        error: { type: 'string' },
      },
    },
    packageName: '@coordinator/workflow-builder',
    modulePath: './src/lib/activities/file-system.activities',
    functionName: 'readFile',
    category: 'File',
    tags: ['file', 'read', 'io'],
    examples: {
      basic: {
        input: { filePath: './package.json' },
        output: { success: true, content: '{"name": "..."}', size: 1024 },
      },
    },
  },
  {
    name: 'writeFile',
    description: 'Write content to a file, creating directories if needed',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Path to file to write' },
        content: { type: 'string', description: 'Content to write' },
        encoding: { type: 'string', default: 'utf8', enum: ['utf8', 'base64', 'ascii'] },
        createDirs: { type: 'boolean', default: true, description: 'Create parent directories if missing' },
      },
      required: ['filePath', 'content'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        filePath: { type: 'string' },
        bytesWritten: { type: 'number' },
        error: { type: 'string' },
      },
    },
    packageName: '@coordinator/workflow-builder',
    modulePath: './src/lib/activities/file-system.activities',
    functionName: 'writeFile',
    category: 'File',
    tags: ['file', 'write', 'io', 'save'],
    examples: {
      basic: {
        input: { filePath: './output.txt', content: 'Hello World' },
        output: { success: true, filePath: './output.txt', bytesWritten: 11 },
      },
    },
  },
  {
    name: 'searchFileContent',
    description: 'Search for text patterns in file contents using regex',
    inputSchema: {
      type: 'object',
      properties: {
        workspacePath: { type: 'string', description: 'Base directory to search' },
        pattern: { type: 'string', description: 'Regex pattern to search for' },
        filePattern: { type: 'string', description: 'Glob pattern to filter files' },
        recursive: { type: 'boolean', default: true },
        caseSensitive: { type: 'boolean', default: false },
      },
      required: ['workspacePath', 'pattern'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        matches: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              file: { type: 'string' },
              line: { type: 'number' },
              column: { type: 'number' },
              text: { type: 'string' },
            },
          },
        },
        count: { type: 'number' },
        error: { type: 'string' },
      },
    },
    packageName: '@coordinator/workflow-builder',
    modulePath: './src/lib/activities/file-system.activities',
    functionName: 'searchFileContent',
    category: 'File',
    tags: ['file', 'search', 'grep', 'regex', 'content'],
    examples: {
      basic: {
        input: { workspacePath: './src', pattern: 'export function', filePattern: '*.ts' },
        output: { success: true, matches: [{ file: 'src/index.ts', line: 10, column: 0, text: 'export function' }], count: 1 },
      },
    },
  },
  {
    name: 'listDirectory',
    description: 'List files and directories in a directory',
    inputSchema: {
      type: 'object',
      properties: {
        directoryPath: { type: 'string', description: 'Directory to list' },
        recursive: { type: 'boolean', default: false, description: 'Recursively list subdirectories' },
        includeFiles: { type: 'boolean', default: true, description: 'Include files in results' },
        includeDirs: { type: 'boolean', default: true, description: 'Include directories in results' },
      },
      required: ['directoryPath'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        entries: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              path: { type: 'string' },
              type: { type: 'string', enum: ['file', 'directory'] },
              size: { type: 'number' },
            },
          },
        },
        error: { type: 'string' },
      },
    },
    packageName: '@coordinator/workflow-builder',
    modulePath: './src/lib/activities/file-system.activities',
    functionName: 'listDirectory',
    category: 'File',
    tags: ['file', 'directory', 'list', 'browse'],
    examples: {
      basic: {
        input: { directoryPath: './src', recursive: false },
        output: { success: true, entries: [{ name: 'index.ts', path: './src/index.ts', type: 'file', size: 1024 }] },
      },
    },
  },
  {
    name: 'batchReadFiles',
    description: 'Read multiple files efficiently in parallel',
    inputSchema: {
      type: 'object',
      properties: {
        filePaths: { type: 'array', items: { type: 'string' }, description: 'List of file paths to read' },
        encoding: { type: 'string', default: 'utf8' },
      },
      required: ['filePaths'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        files: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              filePath: { type: 'string' },
              content: { type: 'string' },
              success: { type: 'boolean' },
              error: { type: 'string' },
            },
          },
        },
        error: { type: 'string' },
      },
    },
    packageName: '@coordinator/workflow-builder',
    modulePath: './src/lib/activities/file-system.activities',
    functionName: 'batchReadFiles',
    category: 'File',
    tags: ['file', 'read', 'batch', 'parallel'],
    examples: {
      basic: {
        input: { filePaths: ['./file1.txt', './file2.txt'] },
        output: { success: true, files: [{ filePath: './file1.txt', content: 'content1', success: true }] },
      },
    },
  },
  {
    name: 'batchWriteFiles',
    description: 'Write multiple files atomically',
    inputSchema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              filePath: { type: 'string' },
              content: { type: 'string' },
            },
            required: ['filePath', 'content'],
          },
        },
        encoding: { type: 'string', default: 'utf8' },
      },
      required: ['files'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        written: { type: 'number', description: 'Number of files written' },
        failed: { type: 'number', description: 'Number of files that failed' },
        errors: { type: 'array', items: { type: 'string' } },
      },
    },
    packageName: '@coordinator/workflow-builder',
    modulePath: './src/lib/activities/file-system.activities',
    functionName: 'batchWriteFiles',
    category: 'File',
    tags: ['file', 'write', 'batch', 'atomic'],
    examples: {
      basic: {
        input: { files: [{ filePath: './file1.txt', content: 'content1' }] },
        output: { success: true, written: 1, failed: 0, errors: [] },
      },
    },
  },

  // ============================================================================
  // Command Execution Activities
  // ============================================================================
  {
    name: 'executeCommand',
    description: 'Execute a shell command with timeout, resource monitoring, and validation',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Command to execute' },
        workingDir: { type: 'string', description: 'Working directory for command' },
        timeoutMs: { type: 'number', default: 300000, description: 'Timeout in milliseconds' },
        env: { type: 'object', additionalProperties: { type: 'string' }, description: 'Environment variables' },
      },
      required: ['command', 'workingDir'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        exitCode: { type: 'number' },
        stdout: { type: 'string' },
        stderr: { type: 'string' },
        duration: { type: 'number', description: 'Execution duration in milliseconds' },
        error: { type: 'string' },
      },
    },
    packageName: '@coordinator/workflow-builder',
    modulePath: './src/lib/activities/command-execution.activities',
    functionName: 'executeCommand',
    category: 'Build',
    tags: ['command', 'shell', 'execution', 'cli'],
    examples: {
      basic: {
        input: { command: 'echo "Hello"', workingDir: './' },
        output: { success: true, exitCode: 0, stdout: 'Hello\n', stderr: '', duration: 50 },
      },
    },
  },
  {
    name: 'runBuildCommand',
    description: 'Run a build command and parse TypeScript errors and warnings',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Build command (e.g., "npm run build")' },
        workingDir: { type: 'string' },
        timeoutMs: { type: 'number', default: 600000 },
      },
      required: ['command', 'workingDir'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        exitCode: { type: 'number' },
        stdout: { type: 'string' },
        stderr: { type: 'string' },
        buildErrors: { type: 'number' },
        buildWarnings: { type: 'number' },
        errors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              file: { type: 'string' },
              line: { type: 'number' },
              column: { type: 'number' },
              message: { type: 'string' },
            },
          },
        },
        duration: { type: 'number' },
      },
    },
    packageName: '@coordinator/workflow-builder',
    modulePath: './src/lib/activities/command-execution.activities',
    functionName: 'runBuildCommand',
    category: 'Build',
    tags: ['build', 'typescript', 'compilation', 'errors'],
    examples: {
      basic: {
        input: { command: 'npm run build', workingDir: './' },
        output: { success: true, exitCode: 0, buildErrors: 0, buildWarnings: 0, errors: [] },
      },
    },
  },
  {
    name: 'runTestCommand',
    description: 'Run a test command and parse test results and coverage',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Test command (e.g., "npm test")' },
        workingDir: { type: 'string' },
        timeoutMs: { type: 'number', default: 600000 },
        coverage: { type: 'boolean', default: false, description: 'Collect coverage information' },
      },
      required: ['command', 'workingDir'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        exitCode: { type: 'number' },
        stdout: { type: 'string' },
        stderr: { type: 'string' },
        testResults: {
          type: 'object',
          properties: {
            passed: { type: 'number' },
            failed: { type: 'number' },
            skipped: { type: 'number' },
            total: { type: 'number' },
          },
        },
        coverage: {
          type: 'object',
          properties: {
            lines: { type: 'number' },
            statements: { type: 'number' },
            functions: { type: 'number' },
            branches: { type: 'number' },
          },
        },
        duration: { type: 'number' },
      },
    },
    packageName: '@coordinator/workflow-builder',
    modulePath: './src/lib/activities/command-execution.activities',
    functionName: 'runTestCommand',
    category: 'Build',
    tags: ['test', 'testing', 'coverage', 'vitest', 'jest'],
    examples: {
      basic: {
        input: { command: 'npm test', workingDir: './' },
        output: { success: true, exitCode: 0, testResults: { passed: 10, failed: 0, skipped: 0, total: 10 } },
      },
    },
  },
  {
    name: 'runLintCommand',
    description: 'Run a lint command and parse lint issues',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Lint command (e.g., "npm run lint")' },
        workingDir: { type: 'string' },
        timeoutMs: { type: 'number', default: 300000 },
      },
      required: ['command', 'workingDir'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        exitCode: { type: 'number' },
        stdout: { type: 'string' },
        stderr: { type: 'string' },
        issues: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              file: { type: 'string' },
              line: { type: 'number' },
              column: { type: 'number' },
              severity: { type: 'string', enum: ['error', 'warning'] },
              message: { type: 'string' },
              rule: { type: 'string' },
            },
          },
        },
        errorCount: { type: 'number' },
        warningCount: { type: 'number' },
        duration: { type: 'number' },
      },
    },
    packageName: '@coordinator/workflow-builder',
    modulePath: './src/lib/activities/command-execution.activities',
    functionName: 'runLintCommand',
    category: 'Build',
    tags: ['lint', 'eslint', 'code-quality', 'validation'],
    examples: {
      basic: {
        input: { command: 'npm run lint', workingDir: './' },
        output: { success: true, exitCode: 0, errorCount: 0, warningCount: 0, issues: [] },
      },
    },
  },

  // ============================================================================
  // Git Activities
  // ============================================================================
  {
    name: 'createTag',
    description: 'Create a git tag (annotated or lightweight)',
    inputSchema: {
      type: 'object',
      properties: {
        workspacePath: { type: 'string', description: 'Git repository path' },
        tagName: { type: 'string', description: 'Name of the tag' },
        message: { type: 'string', description: 'Tag message (for annotated tags)' },
        commitHash: { type: 'string', description: 'Commit hash to tag (defaults to HEAD)' },
        annotated: { type: 'boolean', default: true, description: 'Create annotated tag' },
      },
      required: ['workspacePath', 'tagName'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        tagName: { type: 'string' },
        commitHash: { type: 'string' },
        error: { type: 'string' },
      },
    },
    packageName: '@coordinator/workflow-builder',
    modulePath: './src/lib/activities/git.activities',
    functionName: 'createTag',
    category: 'Build',
    tags: ['git', 'tag', 'version', 'release'],
    examples: {
      basic: {
        input: { workspacePath: './', tagName: 'v1.0.0', message: 'Release 1.0.0' },
        output: { success: true, tagName: 'v1.0.0', commitHash: 'abc123' },
      },
    },
  },
  {
    name: 'gitStatus',
    description: 'Get the status of a git repository including staged, unstaged, and untracked files',
    inputSchema: {
      type: 'object',
      properties: {
        workspacePath: { type: 'string', description: 'Git repository path' },
        short: { type: 'boolean', default: false, description: 'Use short format output' },
      },
      required: ['workspacePath'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        isClean: { type: 'boolean', description: 'True if working directory is clean' },
        hasChanges: { type: 'boolean', description: 'True if there are any changes' },
        stagedFiles: { type: 'array', items: { type: 'string' } },
        unstagedFiles: { type: 'array', items: { type: 'string' } },
        untrackedFiles: { type: 'array', items: { type: 'string' } },
        stdout: { type: 'string' },
        error: { type: 'string' },
      },
    },
    packageName: '@coordinator/workflow-builder',
    modulePath: './src/lib/activities/git.activities',
    functionName: 'gitStatus',
    category: 'Build',
    tags: ['git', 'status', 'changes', 'version-control'],
    examples: {
      basic: {
        input: { workspacePath: './' },
        output: { success: true, isClean: true, hasChanges: false, stagedFiles: [], unstagedFiles: [], untrackedFiles: [] },
      },
    },
  },
  {
    name: 'listBranches',
    description: 'List local and remote git branches',
    inputSchema: {
      type: 'object',
      properties: {
        workspacePath: { type: 'string', description: 'Git repository path' },
        includeRemote: { type: 'boolean', default: true, description: 'Include remote branches' },
      },
      required: ['workspacePath'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        branches: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              current: { type: 'boolean' },
              lastCommit: { type: 'string' },
              remote: { type: 'boolean' },
            },
          },
        },
        currentBranch: { type: 'string' },
        error: { type: 'string' },
      },
    },
    packageName: '@coordinator/workflow-builder',
    modulePath: './src/lib/activities/git.activities',
    functionName: 'listBranches',
    category: 'Build',
    tags: ['git', 'branch', 'version-control'],
    examples: {
      basic: {
        input: { workspacePath: './' },
        output: { success: true, branches: [{ name: 'main', current: true, lastCommit: 'abc123', remote: false }], currentBranch: 'main' },
      },
    },
  },
  {
    name: 'gitDiff',
    description: 'Generate a diff between commits or the working directory',
    inputSchema: {
      type: 'object',
      properties: {
        workspacePath: { type: 'string', description: 'Git repository path' },
        fromCommit: { type: 'string', description: 'Starting commit (defaults to HEAD)' },
        toCommit: { type: 'string', description: 'Ending commit (defaults to working directory)' },
        filePath: { type: 'string', description: 'Specific file to diff' },
        stat: { type: 'boolean', default: false, description: 'Show file statistics only' },
      },
      required: ['workspacePath'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        diff: { type: 'string', description: 'Diff output' },
        filesChanged: { type: 'number' },
        insertions: { type: 'number' },
        deletions: { type: 'number' },
        error: { type: 'string' },
      },
    },
    packageName: '@coordinator/workflow-builder',
    modulePath: './src/lib/activities/git.activities',
    functionName: 'gitDiff',
    category: 'Build',
    tags: ['git', 'diff', 'changes', 'version-control'],
    examples: {
      basic: {
        input: { workspacePath: './', fromCommit: 'HEAD~1', toCommit: 'HEAD' },
        output: { success: true, diff: 'diff --git a/file.txt...', filesChanged: 1, insertions: 5, deletions: 2 },
      },
    },
  },

  // ============================================================================
  // Notification Activities
  // ============================================================================
  {
    name: 'sendSlackNotification',
    description: 'Send a Slack notification via webhook with attachments and formatting',
    inputSchema: {
      type: 'object',
      properties: {
        webhookUrl: { type: 'string', format: 'uri', description: 'Slack webhook URL' },
        message: { type: 'string', description: 'Message text' },
        channel: { type: 'string', description: 'Channel to send to (overrides webhook default)' },
        username: { type: 'string', default: 'Workflow Builder', description: 'Bot username' },
        iconEmoji: { type: 'string', default: ':robot_face:', description: 'Bot icon emoji' },
        attachments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              color: { type: 'string' },
              title: { type: 'string' },
              text: { type: 'string' },
              fields: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    value: { type: 'string' },
                    short: { type: 'boolean' },
                  },
                },
              },
            },
          },
        },
      },
      required: ['webhookUrl', 'message'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        messageId: { type: 'string' },
        error: { type: 'string' },
      },
    },
    packageName: '@coordinator/workflow-builder',
    modulePath: './src/lib/activities/notifications.activities',
    functionName: 'sendSlackNotification',
    category: 'Notification',
    tags: ['slack', 'notification', 'communication', 'alert'],
    examples: {
      basic: {
        input: { webhookUrl: 'https://hooks.slack.com/services/...', message: 'Workflow completed' },
        output: { success: true, messageId: 'msg-123' },
      },
    },
  },
  {
    name: 'updateWorkflowStatus',
    description: 'Update workflow execution status with progress and metadata',
    inputSchema: {
      type: 'object',
      properties: {
        executionId: { type: 'string', description: 'Workflow execution ID' },
        status: { type: 'string', enum: ['pending', 'running', 'completed', 'failed', 'cancelled'], description: 'Execution status' },
        message: { type: 'string', description: 'Status message' },
        progress: { type: 'number', minimum: 0, maximum: 100, description: 'Progress percentage' },
        metadata: { type: 'object', additionalProperties: true, description: 'Additional metadata' },
      },
      required: ['executionId', 'status'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        updated: { type: 'boolean' },
        error: { type: 'string' },
      },
    },
    packageName: '@coordinator/workflow-builder',
    modulePath: './src/lib/activities/notifications.activities',
    functionName: 'updateWorkflowStatus',
    category: 'Notification',
    tags: ['status', 'workflow', 'progress', 'update'],
    examples: {
      basic: {
        input: { executionId: 'exec-123', status: 'running', progress: 50 },
        output: { success: true, updated: true },
      },
    },
  },
  {
    name: 'sendErrorAlert',
    description: 'Send an error alert notification with severity levels and optional Slack integration',
    inputSchema: {
      type: 'object',
      properties: {
        executionId: { type: 'string', description: 'Workflow execution ID' },
        error: { type: 'string', description: 'Error message' },
        severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
        context: { type: 'object', additionalProperties: true, description: 'Additional context' },
        notifySlack: { type: 'boolean', default: false, description: 'Send Slack notification' },
        slackWebhookUrl: { type: 'string', format: 'uri', description: 'Slack webhook URL if notifySlack is true' },
      },
      required: ['executionId', 'error'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        alertId: { type: 'string' },
        slackNotified: { type: 'boolean' },
        error: { type: 'string' },
      },
    },
    packageName: '@coordinator/workflow-builder',
    modulePath: './src/lib/activities/notifications.activities',
    functionName: 'sendErrorAlert',
    category: 'Notification',
    tags: ['error', 'alert', 'slack', 'notification', 'severity'],
    examples: {
      basic: {
        input: { executionId: 'exec-123', error: 'Build failed', severity: 'high' },
        output: { success: true, alertId: 'alert-123', slackNotified: false },
      },
    },
  },
  {
    name: 'sendProgressUpdate',
    description: 'Send a progress update for workflow execution with step information',
    inputSchema: {
      type: 'object',
      properties: {
        executionId: { type: 'string', description: 'Workflow execution ID' },
        step: { type: 'string', description: 'Current step name' },
        progress: { type: 'number', minimum: 0, maximum: 100, description: 'Progress percentage' },
        message: { type: 'string', description: 'Progress message' },
        estimatedTimeRemaining: { type: 'number', description: 'Estimated time remaining in milliseconds' },
      },
      required: ['executionId', 'step', 'progress'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        updated: { type: 'boolean' },
        error: { type: 'string' },
      },
    },
    packageName: '@coordinator/workflow-builder',
    modulePath: './src/lib/activities/notifications.activities',
    functionName: 'sendProgressUpdate',
    category: 'Notification',
    tags: ['progress', 'status', 'update', 'workflow'],
    examples: {
      basic: {
        input: { executionId: 'exec-123', step: 'Compiling', progress: 50 },
        output: { success: true, updated: true },
      },
    },
  },
];

// Main registration function
async function registerAllActivities() {
  try {
    const userId = await getSystemUserId();
    console.log(`Using user ID: ${userId}\n`);

    console.log(`Registering ${activities.length} activities...\n`);

    const results = [];
    for (const activity of activities) {
      try {
        console.log(`Registering: ${activity.name}...`);
        const result = await registry.registerActivity({
          ...activity,
          createdBy: userId,
        });
        results.push({ name: activity.name, success: true, id: result.id });
        console.log(`  ✓ Registered: ${activity.name} (${result.id})`);
      } catch (error: any) {
        results.push({ name: activity.name, success: false, error: error.message });
        console.error(`  ✗ Failed: ${activity.name} - ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('Registration Summary');
    console.log('='.repeat(60));
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    console.log(`Total: ${activities.length}`);
    console.log(`Successful: ${successful}`);
    console.log(`Failed: ${failed}`);

    if (failed > 0) {
      console.log('\nFailed Activities:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`  - ${r.name}: ${r.error}`);
      });
    }

    process.exit(failed > 0 ? 1 : 0);
  } catch (error: any) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  registerAllActivities();
}

export { registerAllActivities, activities };

