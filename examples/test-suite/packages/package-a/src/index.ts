/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { promises as fs } from 'fs';
import * as path from 'path';
import { PackageResult } from './types';

/**
 * Reads the content of a plan file asynchronously.
 *
 * This function handles file system operations and returns a standardized
 * `PackageResult` indicating success or failure.
 *
 * @param filePath The full path to the plan file.
 * @returns A promise that resolves to a `PackageResult<string>`.
 *          If successful, `data` contains the file content.
 *          If unsuccessful, `error` contains a descriptive error message.
 */
export async function readPlanFile(filePath: string): Promise<PackageResult<string>> {
  if (!filePath || typeof filePath !== 'string') {
    return {
      success: false,
      error: 'Invalid file path provided. File path must be a non-empty string.',
    };
  }

  const resolvedPath: string = path.resolve(filePath);

  try {
    const fileContent: string = await fs.readFile(resolvedPath, { encoding: 'utf8' });
    return { success: true, data: fileContent };
  } catch (error: unknown) {
    let errorMessage: string = 'An unknown error occurred while reading the file.';

    if (error instanceof Error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        errorMessage = `File not found at path: ${resolvedPath}`;
      } else if ((error as NodeJS.ErrnoException).code === 'EACCES') {
        errorMessage = `Permission denied to read file at path: ${resolvedPath}`;
      } else {
        errorMessage = `Failed to read file at ${resolvedPath}: ${error.message}`;
      }
    } else if (typeof error === 'string') {
      errorMessage = `Failed to read file at ${resolvedPath}: ${error}`;
    }

    return { success: false, error: errorMessage };
  }
}
```