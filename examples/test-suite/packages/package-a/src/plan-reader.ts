/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { promises as fs } from 'fs';
import { PackageResult } from './types';

/**
 * Reads the content of a plan file from the specified path.
 * This function implements the "readPlanFile activity" as per project plan.
 *
 * @param filePath The absolute path to the plan file (e.g., `examples/test-suite/packages/package-a/plan.md`).
 * @returns A `PackageResult` containing the file content as a string on success,
 *          or an error message on failure.
 */
export async function readPlanFile(filePath: string): Promise<PackageResult<string>> {
  if (typeof filePath !== 'string' || filePath.trim().length === 0) {
    return { success: false, error: 'File path must be a non-empty string.' };
  }

  try {
    const content: string = await fs.readFile(filePath, 'utf8');
    return { success: true, data: content };
  } catch (err: unknown) {
    const errorMessage: string = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Failed to read plan file at '${filePath}': ${errorMessage}` };
  }
}