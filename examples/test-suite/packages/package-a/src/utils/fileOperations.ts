/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { promises as fs } from 'fs';
import { PackageResult, PlanFileContent } from '../types';

/**
 * Reads the content of a plan file from the specified path.
 * This function handles file not found errors and other I/O exceptions,
 * returning a standardized PackageResult.
 *
 * @param filePath The absolute or relative path to the plan file.
 * @returns A promise that resolves to a PackageResult. On success, `data` contains
 *          the file content as a string. On failure, `error` contains a descriptive message.
 */
export async function readPlanFile(filePath: string): Promise<PackageResult<PlanFileContent>> {
  try {
    const content: string = await fs.readFile(filePath, { encoding: 'utf8' });
    return { success: true, data: content };
  } catch (error: unknown) {
    let errorMessage: string = 'An unknown error occurred while reading the plan file.';

    if (error instanceof Error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        errorMessage = `Plan file not found at path: '${filePath}'`;
      } else {
        errorMessage = `Failed to read plan file: ${error.message}`;
      }
    } else if (typeof error === 'string') {
      errorMessage = `Failed to read plan file: ${error}`;
    }

    // Ensure all promises are handled, this catch block explicitly handles the promise.
    return { success: false, error: errorMessage };
  }
}