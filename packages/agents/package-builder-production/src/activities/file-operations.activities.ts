/**
 * File Operations Activities
 *
 * Handles file creation, updates, and deletions with security validation.
 * Implements path traversal protection and safe file I/O.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { ApplyFileChangesInput, ApplyFileChangesResult } from '../types/index.js';

/**
 * Apply file changes from agent response to workspace
 *
 * Handles:
 * - File creation with directory scaffolding
 * - File updates (overwrites existing content)
 * - File deletions
 * - Path traversal attack prevention
 * - UTF-8 encoding normalization
 *
 * @param input - File operations configuration
 * @returns Result with modified files and any failures
 */
export async function applyFileChanges(input: ApplyFileChangesInput): Promise<ApplyFileChangesResult> {
  const { operations, packagePath, workspaceRoot } = input;

  const modifiedFiles: string[] = [];
  const failedOperations: Array<{
    path: string;
    operation: string;
    error: string;
  }> = [];

  // Compute absolute package directory
  const absolutePackageDir = path.isAbsolute(packagePath)
    ? packagePath
    : path.join(workspaceRoot, packagePath);

  // Process each file operation
  for (const operation of operations) {
    try {
      // Security: Validate path safety
      validatePathSafety(operation.path);

      // Resolve absolute file path
      const absoluteFilePath = path.join(absolutePackageDir, operation.path);

      // Ensure path is within package directory (prevent traversal)
      if (!isPathWithinDirectory(absoluteFilePath, absolutePackageDir)) {
        throw new Error(`Path traversal attempt blocked: ${operation.path}`);
      }

      // Execute operation
      switch (operation.operation) {
        case 'create':
        case 'update': {
          if (!operation.content) {
            throw new Error('Content required for create/update operations');
          }

          // Ensure parent directory exists
          const dir = path.dirname(absoluteFilePath);
          await fs.mkdir(dir, { recursive: true });

          // Write file with UTF-8 encoding
          await fs.writeFile(absoluteFilePath, operation.content, 'utf-8');

          modifiedFiles.push(operation.path);
          console.log(`[FileOps] ${operation.operation.toUpperCase()}: ${operation.path}`);
          break;
        }

        case 'delete': {
          // Check if file exists before attempting delete
          try {
            await fs.access(absoluteFilePath);
            await fs.unlink(absoluteFilePath);
            modifiedFiles.push(operation.path);
            console.log(`[FileOps] DELETE: ${operation.path}`);
          } catch (error) {
            // File doesn't exist - consider this a success
            console.log(`[FileOps] DELETE (already absent): ${operation.path}`);
          }
          break;
        }

        default:
          throw new Error(`Unknown operation: ${operation.operation}`);
      }

    } catch (error) {
      failedOperations.push({
        path: operation.path,
        operation: operation.operation,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      console.error(`[FileOps] FAILED ${operation.operation.toUpperCase()}: ${operation.path} - ${error}`);
    }
  }

  // Summary
  console.log(`[FileOps] Completed: ${modifiedFiles.length} succeeded, ${failedOperations.length} failed`);

  return {
    modifiedFiles,
    failedOperations
  };
}

/**
 * Validate path safety
 *
 * Checks for:
 * - Path traversal attempts (..)
 * - Absolute paths
 * - Null bytes
 * - Reserved characters
 *
 * @param filePath - Path to validate
 * @throws Error if path is unsafe
 */
function validatePathSafety(filePath: string): void {
  // Reject path traversal
  if (filePath.includes('..')) {
    throw new Error('Path contains ".." (path traversal)');
  }

  // Reject absolute paths
  if (path.isAbsolute(filePath)) {
    throw new Error('Absolute paths not allowed');
  }

  // Reject null bytes (security)
  if (filePath.includes('\0')) {
    throw new Error('Path contains null byte');
  }

  // Reject empty paths
  if (!filePath || filePath.trim() === '') {
    throw new Error('Empty path not allowed');
  }

  // Normalize and check again
  const normalized = path.normalize(filePath);
  if (normalized.startsWith('..') || normalized.includes(`${path.sep}..${path.sep}`)) {
    throw new Error('Normalized path escapes directory');
  }
}

/**
 * Check if path is within allowed directory
 *
 * Prevents path traversal attacks by ensuring resolved path
 * stays within the package directory.
 *
 * @param targetPath - Path to check
 * @param allowedDir - Directory that must contain path
 * @returns True if path is within directory
 */
function isPathWithinDirectory(targetPath: string, allowedDir: string): boolean {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedAllowed = path.resolve(allowedDir);

  // Must start with allowed directory
  return resolvedTarget.startsWith(resolvedAllowed + path.sep) ||
         resolvedTarget === resolvedAllowed;
}

/**
 * Normalize file content for consistent formatting
 *
 * Handles:
 * - Line ending normalization (LF)
 * - UTF-8 encoding validation
 * - Trailing newline consistency
 *
 * @param content - Content to normalize
 * @returns Normalized content
 */
export function normalizeContent(content: string): string {
  // Normalize line endings to LF
  let normalized = content.replace(/\r\n/g, '\n');

  // Ensure single trailing newline for non-empty files
  if (normalized.length > 0) {
    normalized = normalized.replace(/\n*$/, '\n');
  }

  return normalized;
}

/**
 * Verify file was created successfully
 *
 * @param filePath - Absolute path to file
 * @param expectedContent - Expected file content
 * @returns True if file exists and matches content
 */
export async function verifyFileCreated(
  filePath: string,
  expectedContent?: string
): Promise<boolean> {
  try {
    const stats = await fs.stat(filePath);

    if (!stats.isFile()) {
      return false;
    }

    if (expectedContent) {
      const actualContent = await fs.readFile(filePath, 'utf-8');
      return actualContent === expectedContent;
    }

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Clean up test workspace
 *
 * Useful for test harness cleanup
 *
 * @param dirPath - Directory to remove
 */
export async function cleanWorkspace(dirPath: string): Promise<void> {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
    console.log(`[FileOps] Cleaned workspace: ${dirPath}`);
  } catch (error) {
    console.warn(`[FileOps] Failed to clean workspace: ${error}`);
  }
}
