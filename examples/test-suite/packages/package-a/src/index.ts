/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { PackageResult, PlanFileContent } from './types';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Reads the content of a plan file from the specified path.
 *
 * @param filePath The absolute or relative path to the plan file.
 * @returns A PackageResult containing the plan file content as a string on success,
 *          or an error message on failure.
 */
export async function readPlanFile(filePath: string): Promise<PackageResult<PlanFileContent>> {
  if (filePath.trim() === '') {
    return { success: false, error: 'File path cannot be empty' };
  }

  try {
    const absolutePath: string = path.resolve(filePath);
    const content: string = await fs.readFile(absolutePath, 'utf8');
    return { success: true, data: content };
  } catch (error: unknown) {
    let errorMessage: string = 'Unknown error reading plan file.';
    if (error instanceof Error) {
      errorMessage = `Failed to read plan file at "${filePath}": ${error.message}`;
    }
    return { success: false, error: errorMessage };
  }
}