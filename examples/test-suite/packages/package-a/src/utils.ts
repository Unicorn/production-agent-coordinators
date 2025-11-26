/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { promises as fs } from 'fs';
import { PackageResult } from './types';

/**
 * Reads the content of a file from the specified path.
 * This function is intended to implement the "readPlanFile activity".
 *
 * @param filePath The absolute or relative path to the file.
 * @returns A `PackageResult<string>` containing the file content on success,
 *          or an error message if the file cannot be read.
 */
export async function readPlanFile(filePath: string): Promise<PackageResult<string>> {
  if (!filePath) {
    return { success: false, error: 'File path cannot be empty.' };
  }

  try {
    const content: string = await fs.readFile(filePath, { encoding: 'utf-8' });
    return { success: true, data: content };
  } catch (error: unknown) {
    let errorMessage: string = 'An unknown error occurred while reading the file.';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, error: `Failed to read plan file '${filePath}': ${errorMessage}` };
  }
}