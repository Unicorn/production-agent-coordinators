/**
 * Validation system for verifying agent changes
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { FileChange } from './registry.js';

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate that all changes were applied correctly
 */
export async function validateChanges(
  changes: FileChange[],
  workingDirectory: string
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const change of changes) {
    const fullPath = path.join(workingDirectory, change.path);

    try {
      switch (change.operation) {
        case 'create':
          await validateCreate(change, fullPath, errors, warnings);
          break;

        case 'update':
          await validateUpdate(change, fullPath, errors, warnings);
          break;

        case 'delete':
          await validateDelete(change, fullPath, errors, warnings);
          break;
      }
    } catch (error) {
      errors.push(
        `Failed to validate ${change.operation} on ${change.path}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

async function validateCreate(
  change: FileChange,
  fullPath: string,
  errors: string[],
  _warnings: string[]
): Promise<void> {
  // Verify file exists
  try {
    await fs.access(fullPath);
  } catch {
    errors.push(`File was not created: ${change.path}`);
    return;
  }

  // Verify content matches
  if (change.afterContent !== undefined) {
    const actualContent = await fs.readFile(fullPath, 'utf-8');
    if (actualContent !== change.afterContent) {
      errors.push(`File content mismatch for ${change.path}`);
    }
  }
}

async function validateUpdate(
  change: FileChange,
  fullPath: string,
  errors: string[],
  warnings: string[]
): Promise<void> {
  // Verify file exists
  try {
    await fs.access(fullPath);
  } catch {
    errors.push(`File does not exist: ${change.path}`);
    return;
  }

  // Verify content was updated
  if (change.afterContent !== undefined) {
    const actualContent = await fs.readFile(fullPath, 'utf-8');
    if (actualContent !== change.afterContent) {
      errors.push(`File content mismatch for ${change.path}`);
    }

    // Warn if content is identical to before
    if (change.beforeContent !== undefined && actualContent === change.beforeContent) {
      warnings.push(`File ${change.path} was not actually modified`);
    }
  }
}

async function validateDelete(
  change: FileChange,
  fullPath: string,
  errors: string[],
  _warnings: string[]
): Promise<void> {
  // Verify file no longer exists
  try {
    await fs.access(fullPath);
    errors.push(`File was not deleted: ${change.path}`);
  } catch {
    // File doesn't exist - this is correct
  }
}

/**
 * Generate a summary of changes for reporting
 */
export function summarizeChanges(changes: FileChange[]): string {
  if (changes.length === 0) {
    return 'No files were modified';
  }

  const summary: string[] = [];
  const byOperation = {
    create: changes.filter(c => c.operation === 'create'),
    update: changes.filter(c => c.operation === 'update'),
    delete: changes.filter(c => c.operation === 'delete')
  };

  if (byOperation.create.length > 0) {
    summary.push(`Created ${byOperation.create.length} file(s):`);
    byOperation.create.forEach(c => summary.push(`  + ${c.path}`));
  }

  if (byOperation.update.length > 0) {
    summary.push(`Updated ${byOperation.update.length} file(s):`);
    byOperation.update.forEach(c => summary.push(`  ~ ${c.path}`));
  }

  if (byOperation.delete.length > 0) {
    summary.push(`Deleted ${byOperation.delete.length} file(s):`);
    byOperation.delete.forEach(c => summary.push(`  - ${c.path}`));
  }

  return summary.join('\n');
}
