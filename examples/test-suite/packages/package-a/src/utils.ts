/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import * as fs from 'fs/promises';
import { PackageResult } from './types';

/**
 * Reads a plan file from the given path.
 *
 * This function handles file system operations and provides a standard `PackageResult`
 * for consistent error handling.
 *
 * @param filePath - The path to the plan file.
 * @returns A `PackageResult` containing the file content as a string on success,
 *          or an error message on failure (e.g., file not found, permission issues).
 */
export async function readPlanFile(filePath: string): Promise<PackageResult<string>> {
  if (!filePath) {
    return { success: false, error: 'File path cannot be empty.' };
  }

  try {
    const content: string = await fs.readFile(filePath, { encoding: 'utf-8' });
    return { success: true, data: content };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Failed to read plan file at '${filePath}': ${errorMessage}` };
  }
}